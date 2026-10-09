---
title: "HyperSonic CTF 2026 aaa Writeup"
description: "HyperSonic CTF 2026 aaa writeup"
---

# aaa

## Overview

`aaa` is a crypto challenge that uses a side-channel trace recorded during RSA decryption. The provided code performs modular exponentiation with the private exponent `d`, and the public key values `N`, `e` and the ciphertext `c` are given separately.

The conditions I confirmed are as follows.

- Category: `crypto`
- Goal: recover the private exponent `d` from the trace and decrypt `c`.
- Verification: check that `pow(m, e, N) == c` holds for the decrypted plaintext `m`.

The branch in the decryption function is the key. Each bit of `d` decides whether a multiplication happens, so reading the operation pattern from the trace recovers the whole `d`.

## Challenge analysis

The values used below:

- `N`: the RSA modulus.
- `e`: the RSA public exponent, `65537`.
- `c`: the ciphertext to decrypt.
- `d`: the private exponent to recover from the trace.
- `samples`: the array of `float32` samples in the trace.
- `run`: a contiguous segment split by the threshold.

The provided decryption function is:

```python
def modexp_leaky(base, exp, mod):
    result = 1
    for bit in bin(exp)[2:]:
        result = (result * result) % mod
        if bit == '1':
            result = (result * base) % mod
    return result
```

This is left-to-right square-and-multiply over the exponent bits. It performs one square for every bit and an additional multiply only when the bit is `1`.

```text
bit 0: square
bit 1: square, multiply
```

So if square and multiply can be distinguished in the trace, each bit can be read off directly. Splitting the actual samples at a threshold of `0.4` cleanly separates high-power operation segments from low-power gaps.

```text
High-power operation segment: 220 samples
Short gap between square and multiply: 25 samples
Gap before the next exponent bit: 135 samples
```

These length differences make the bit decision rule simple.

```text
220 high, 25 low, 220 high, 135 low -> bit 1
220 high, 135 low                   -> bit 0
```

## Key idea

The information needed here is each bit of `d`. There is no need to find a mathematical weakness in RSA or to factor `N`. The decryption routine itself changes the number of operations based on the bits of `d`, so the length pattern of the trace is the bit string of the private exponent.

For `bit 0`, a single square is followed immediately by processing of the next bit. For `bit 1`, the square is followed by one more multiply, with a short gap between the two operations. So reading the threshold `run`s from the start, record `1` when an extra operation appears after a short gap, and `0` when it moves on directly through a long gap.

Once the recovered bit string is converted to an integer `d`, the rest is ordinary RSA decryption.

```text
m = c^d mod N
```

If re-encrypting `m` with the public key gives back the original `c`, the `d` read from the trace is correct.

## Solution

### Step 1. Segmenting the operations

The trace is an array of floating-point samples, so a threshold has to be chosen first. Trying different values, `0.4` splits every segment into the expected lengths. At this threshold every contiguous high-power segment is `220` samples, and low-power segments only appear as `25` or `135` samples.

The output of this step is a list of `run`s of the form `(state, start, end, length)`. A true state is an operation segment, a false state a gap.

### Step 2. Recovering exponent bits from gap lengths

Every bit starts with a square. So check that the current `run` is a `220`-sample high-power segment, then look at the length of the immediately following low-power segment.

If the low-power segment is `25` samples, it is the short gap between square and multiply. In that case another `220`-sample high-power segment must follow, and the bit is `1`. After that, one more `135`-sample gap, the bit boundary, is consumed.

If the low-power segment is `135` samples, it moved on to the next bit without a multiply, so the bit is `0`.

Scanning the whole trace with this rule yields a `2047`-bit `d`.

### Step 3. RSA decryption and verification

Converting the recovered bit string with `int(bits, 2)` gives the private exponent `d`. Then `pow(c, d, N)` gives the plaintext integer `m`, which is converted to bytes.

Checking that the decryption looks like a plausible string is not enough. Since the public key values are given, I checked the following condition.

```text
pow(m, e, N) == c
```

If this is true, the recovered `d` and plaintext satisfy the RSA relation.

## Exploit / Solver

The solver runs these steps:

1. Read the trace as an array of `float32` samples.
2. Split it into contiguous segments with threshold `0.4`.
3. Recover the bits of `d` using the `220/25/135` length pattern.
4. Read the given `N`, `e`, `c` and compute `pow(c, d, N)`.
5. Verify the result with `pow(m, e, N) == c`.

The code below is only the core routines.

```python
import array
import re
import struct


def load_npy_float32(path):
    with open(path, "rb") as f:
        if f.read(6) != b"\x93NUMPY":
            raise ValueError("not a numpy file")
        major, minor = f.read(2)
        if (major, minor) != (1, 0):
            raise ValueError("unsupported npy version")

        header_len = struct.unpack("<H", f.read(2))[0]
        header = f.read(header_len)
        if b"'descr': '<f4'" not in header:
            raise ValueError("unexpected dtype")

        data = array.array("f")
        data.frombytes(f.read())
        return data


def threshold_runs(samples, threshold=0.4):
    runs = []
    current = samples[0] > threshold
    start = 0

    for idx, value in enumerate(samples[1:], 1):
        high = value > threshold
        if high != current:
            runs.append((current, start, idx, idx - start))
            current = high
            start = idx

    runs.append((current, start, len(samples), len(samples) - start))
    return runs


def recover_exponent_bits(runs):
    bits = []
    idx = 0

    while idx < len(runs):
        high, _start, _end, high_len = runs[idx]
        if not high or high_len != 220:
            raise ValueError(f"unexpected operation run: {runs[idx]}")

        gap_len = runs[idx + 1][3]
        if gap_len == 25:
            if idx + 2 >= len(runs):
                raise ValueError("missing multiply run")
            next_high, *_rest, next_len = runs[idx + 2]
            if not next_high or next_len != 220:
                raise ValueError(f"unexpected multiply run: {runs[idx + 2]}")

            bits.append("1")
            idx += 3

            if idx < len(runs):
                separator_high, *_rest, separator_len = runs[idx]
                if separator_high or separator_len != 135:
                    raise ValueError(f"unexpected separator: {runs[idx]}")
                idx += 1

        elif gap_len == 135:
            bits.append("0")
            idx += 2
        else:
            raise ValueError(f"unexpected gap length: {gap_len}")

    return "".join(bits)


def parse_values(text):
    values = {}
    for name in ("N", "e", "c"):
        match = re.search(rf"^{name} = (\d+)", text, re.MULTILINE)
        if not match:
            raise ValueError(f"missing {name}")
        values[name] = int(match.group(1))
    return values["N"], values["e"], values["c"]


def solve(trace_path, output_text):
    samples = load_npy_float32(trace_path)
    runs = threshold_runs(samples)
    bits = recover_exponent_bits(runs)
    d = int(bits, 2)

    N, e, c = parse_values(output_text)
    m = pow(c, d, N)
    plaintext = m.to_bytes((m.bit_length() + 7) // 8, "big")

    return {
        "runs": len(runs),
        "bits": len(bits),
        "ones": bits.count("1"),
        "rsa_check": pow(m, e, N) == c,
        "plaintext": plaintext,
    }
```

There is no candidate search. The segment lengths are constant, so a single scan with exception checks is enough, and an unexpected length fails immediately.

## Result

The run recovered a `2047`-bit exponent from `6176` `run`s. `1041` of those bits were `1`, and the RSA check passed.

```text
runs=6176 bits=2047 ones=1041
rsa_check=True
hs{squ4re_4nd_mult1ply_l34ks_3v3ry_b1t_0f_y0ur_pr1v4t3_d}
```

The flag is:

```text
hs{squ4re_4nd_mult1ply_l34ks_3v3ry_b1t_0f_y0ur_pr1v4t3_d}
```
