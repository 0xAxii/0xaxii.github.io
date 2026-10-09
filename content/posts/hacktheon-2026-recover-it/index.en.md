---
title: "Hacktheon Sejong 2026 Quals Recover It! Writeup"
description: "Hacktheon Sejong 2026 Quals Recover It! writeup"
---

# Recover It!

### Summary

The check routine XORs the 64-byte input with a position-dependent constant and compares the result against `cmptable` in `.data`. XOR is its own inverse, so extracting the table gives the input directly.

### Analysis

The check:

```text
encoded[i] = input[i] ^ (i + 0x67)
encoded[i] == cmptable[i]
```

Inverting it gives each correct byte.

```text
input[i] = cmptable[i] ^ (i + 0x67)
```

`cmptable` is located at `0x4020` in `.data`. Dumping the table as bytes and applying the same index XOR yields the inner string.

### Solver

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

### Flag

`hacktheon2026{22c34e819d2800db605d9fdbc9ba9ab71d6b3b016c49cd94624f545c3}`
