---
title: "HyperSonic CTF 2026 No.. This is Terrible... Writeup"
description: "HyperSonic CTF 2026 No.. This is Terrible... writeup"
---

# No.. This is Terrible...

## Overview

This is a reversing challenge where the input string is not compared directly; instead it is expanded into a length-256 array and the result of an NTT operation is compared.

The conditions I worked out from analysis are as follows.

- Category: `reversing`
- Provided program: a stripped 64-bit PIE ELF
- Goal: find the `68`-byte input that makes the verification result `Correct`.

The starting point of the analysis is to figure out what array the input turns into, and what operation produces the final comparison table. There is no visible string comparison routine; instead an NTT-style function using `998244353` and `3` is part of the verification flow.

## Challenge analysis

I will use the following notation in the analysis.

- `p`: the modular prime used in the NTT. The value is `998244353`.
- `g`: the value used as the primitive root of the NTT. The value is `3`.
- `n`: the NTT length. The value is `256`.
- `a`: a length-`256` `u64` array built from the input and fixed padding.
- `s`: the AES S-box array stored inside the program.
- `target`: the length-`256` `u64` array used in the final comparison.
- `NTT(x)`: the NTT over the length-`256` array `x`.

The output strings found in the program are as follows.

```text
Wrong
Correct
```

The verification routine first reads one line and strips a trailing `\n` or `\r`. It then checks whether the length is `0x44`.

```c
input = read_line();
trim trailing newline or carriage return;

if (len(input) != 0x44) {
    print("Wrong");
    return;
}
```

`0x44` is `68` in decimal. So the value to recover is exactly `68` bytes.

If it passes the length check, the program builds a length-`256` `u64` array `a`. It places the input bytes as-is at the front and fills the remaining elements with a fixed formula.

```c
for i in 0..68:
    a[i] = input[i]

for i in 68..256:
    a[i] = ((i * i + 17) ^ (73 * i + 41)) & 0xff
```

Now we can see that the input is not compared as a string directly but enters as part of the array `a`. The trailing `188` elements are independent of the input, so they can be used to cross-check after recovery.

The program's read-only data region holds two length-`256` `u64` tables. The starting values of the first table are as follows.

```text
63 7c 77 7b f2 6b 6f c5 30 01 67 2b fe d7 ab 76 ...
```

This matches the beginning of the AES S-box. I will call this table `s`. The second table is the final comparison array, which I will call `target`.

The overall flow of the verification function can be summarized as follows.

```python
p = 998244353
g = 3
n = 256

a = prepared_input_array
s = aes_sbox_array

NTT(a)
NTT(s)

for i in range(n):
    a[i] = a[i] * s[i] % p

INTT(a)

if a == target:
    print("Correct")
else:
    print("Wrong")
```

The NTT function applies a bit-reversal permutation and then performs butterfly operations while increasing the length as `2`, `4`, `8`, and so on. The root at each stage is computed as `pow(3, (998244353 - 1) / length, 998244353)`. The inverse NTT uses the inverse of the root and finally multiplies by the modular inverse of `256`.

## Core idea

Viewed in the NTT domain, the verification is simply element-wise multiplication. The value the program ultimately compares satisfies the following relationship.

```text
target = INTT(NTT(a) * NTT(s))
```

Here `*` is the operation that multiplies elements at the same index. Applying NTT to both sides changes the equation into the following.

```text
NTT(target) = NTT(a) * NTT(s)
```

So if each element of `NTT(s)` is nonzero, we can recover `NTT(a)` by multiplying by the modular inverse.

```text
NTT(a)[i] = NTT(target)[i] * inverse(NTT(s)[i]) mod 998244353
```

Applying the inverse NTT once more yields the original array `a`. `a[0:68]` is the input bytes, and `a[68:256]` is the fixed padding confirmed earlier. Comparing the trailing elements of the recovered array against the padding formula also cross-checks whether the inversion was done correctly.

## Solution process

### Step 1. Confirming the input array and padding structure

The first piece of information available from the verification routine is the input length. After stripping the newline, if the length is not `68` bytes, it branches straight to `Wrong`.

If the length matches, the input bytes are expanded into `u64` elements and placed from `a[0]` through `a[67]`. After that, `a[68]` through `a[255]` are filled with the following formula.

```text
a[i] = ((i * i + 17) ^ (73 * i + 41)) & 0xff
```

At this step the trailing part of `a` is already entirely known. The only unknown part is the first `68` elements.

### Step 2. Extracting the S-box and target tables

Next, confirm the two tables the verification function copies. The first table starts with `0x63, 0x7c, 0x77, 0x7b`, so it can be identified as the AES S-box. Call this value `s`.

The second table is compared against `a` after the inverse NTT. The comparison routine checks all `256` `u64` elements and prints `Wrong` if even one differs. So this table is `target`, the result of the verification equation.

Now we can see that the value the program hid is the NTT-based convolution of `a` and `s`.

### Step 3. Recovering the input array in the NTT domain

`target` was built in the following form.

```text
target = INTT(NTT(a) * NTT(s))
```

There is no need to brute-force by following this equation forward. Since both `target` and `s` are known, we just divide in the NTT domain.

```text
target_freq = NTT(target)
sbox_freq   = NTT(s)
a_freq[i]   = target_freq[i] * inverse(sbox_freq[i]) mod p
a           = INTT(a_freq)
```

In practice, none of the elements of `sbox_freq` were `0`. So the modular inverse can be computed at every index, and the length-`256` array `a` is recovered directly.

### Step 4. Padding cross-check and flag confirmation

Converting the first `68` elements of the recovered array to bytes gives the candidate input. Since the computation or offsets might be wrong, I compared the trailing elements against the padding formula.

```text
for i in 68..256:
    recovered[i] == ((i * i + 17) ^ (73 * i + 41)) & 0xff
```

If this cross-check passes entirely, `recovered[0:68]` can be interpreted as the flag. I also confirmed that entering it into the program prints `Correct`.

## Exploit / solver

The solver's flow is simple. Read the AES S-box and `target` table from the program, send both into the NTT domain, divide element-wise, and finally apply the inverse NTT to recover the input array.

```python
from pathlib import Path
from struct import unpack_from
import sys


MOD = 998244353
G = 3
N = 256

SBOX_OFF = 0x5FD0
TARGET_OFF = 0x6818
FLAG_LEN = 0x44


def ntt(a, invert=False):
    n = len(a)

    j = 0
    for i in range(1, n):
        bit = n >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j ^= bit

        if i < j:
            a[i], a[j] = a[j], a[i]

    length = 2
    while length <= n:
        wlen = pow(G, (MOD - 1) // length, MOD)
        if invert:
            wlen = pow(wlen, MOD - 2, MOD)

        half = length // 2
        for i in range(0, n, length):
            w = 1
            for j in range(half):
                u = a[i + j]
                v = a[i + j + half] * w % MOD

                a[i + j] = (u + v) % MOD
                a[i + j + half] = (u - v) % MOD
                w = w * wlen % MOD

        length <<= 1

    if invert:
        inv_n = pow(n, MOD - 2, MOD)
        for i in range(n):
            a[i] = a[i] * inv_n % MOD

    return a


def main():
    program = Path(sys.argv[1]).read_bytes()
    sbox = list(unpack_from("<256Q", program, SBOX_OFF))
    target = list(unpack_from("<256Q", program, TARGET_OFF))

    sbox_freq = ntt(sbox[:])
    target_freq = ntt(target[:])

    recovered_freq = [
        target_freq[i] * pow(sbox_freq[i], MOD - 2, MOD) % MOD
        for i in range(N)
    ]
    recovered = ntt(recovered_freq, invert=True)

    for i in range(FLAG_LEN, N):
        expected = ((i * i + 17) ^ (73 * i + 41)) & 0xFF
        assert recovered[i] == expected, (i, recovered[i], expected)

    print(bytes(recovered[:FLAG_LEN]).decode())


if __name__ == "__main__":
    main()
```

In the code, `SBOX_OFF` and `TARGET_OFF` are the locations of the two tables confirmed by analysis. The part that multiplies each element of `sbox_freq` by its inverse is the heart of the inversion, and the final padding check is there to verify the reliability of the recovery result.

## Result

Feeding the recovered input into the program prints the following result.

```text
Correct
```

So the flag is as follows.

```text
HS{6ce247509eece08f6c5a7a72263b90a396ca6f3e738e29b90089b4c33a40490c}
```
