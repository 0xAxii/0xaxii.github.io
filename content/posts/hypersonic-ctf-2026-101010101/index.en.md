---
title: "HyperSonic CTF 2026 101010101 Writeup"
description: "HyperSonic CTF 2026 101010101 writeup"
---

# 101010101

## Overview

`101010101` is a `crypto` challenge that leaks some bits of one prime factor `p` in RSA. The provided code generates two 512-bit primes `p` and `q`, then prints `p & mask`, `n = p*q`, and `mask`, and checks whether the input satisfies a particular RSA equation.

The conditions I confirmed are as follows.

- Category: `crypto`
- Leaked values: `p & mask`, `n = p*q`, `mask`
- Goal: submit a value satisfying `answer^0x10001 = 0x1337 mod n`.

The bits that `mask` hides differ by region. All bits in the middle region are public, while in the two outer regions only the even-position bits are public. Using this structure, we bundle the unknown bits into two small variables and recover `p` as a bivariate small-root problem.

## Challenge analysis

The provided code is very short.

```python
from Crypto.Util.number import getPrime
from signal import signal, alarm, SIGALRM

signal(SIGALRM, lambda s, f: exit())
alarm(60)

p, q = getPrime(512), getPrime(512)
mask = sum(
    1 << i
    for i in range(512)
    if i < 96 and i % 2 == 0 or 96 <= i < 416 or i >= 416 and i % 2 == 0
)

print(p & mask, p * q, mask)

if pow(int(input()), 0x10001, p * q) == 0x1337:
    print("HS{REDACTED}")
```

I will number bits with the least significant bit as bit `0`. Organizing the `mask` condition gives the following.

```text
0 <= i < 96      : only even bits public
96 <= i < 416   : all bits public
416 <= i < 512  : only even bits public
```

So `p & mask` reveals many bits of `p`. The parts that are not revealed are the low odd bits and the high odd bits. However, since `p` is a 512-bit prime, the most significant bit, bit 511, is fixed to `1`. This bit is not included in `mask`, but since we know its value we can fold it into the constant term.

Let me first lay out the variables used in this writeup.

- `L`: the printed `p & mask`
- `N`: the printed `p*q`
- `B`: `2^417`
- `x`: the low-side unknown formed by bits 1, 3, ..., 95
- `y`: the value of bits 417, 419, ..., 509 shifted right by 417 bits
- `base`: the sum of all the bits we already know

The relation can be written as follows.

```text
B      = 2^417
TOP_Y  = 2^94
base   = L + B * TOP_Y
p      = base + x + B * y
```

Here `TOP_Y = 2^94` denotes bit 511. Since `511 - 417 = 94`, adding `B * TOP_Y` accounts for the most significant bit.

The ranges of `x` and `y` can be computed directly from the code.

```text
0 <= x < sum(2^i for odd i in [1, 95]) + 1
0 <= y < sum(2^(2*j) for 0 <= j < 47) + 1
```

Now consider the following polynomial.

```text
f(x, y) = base + x + B * y
```

If the actual unknown values are `x0` and `y0`, then `f(x0, y0) = p`. So even without knowing `p`, the following property holds.

```text
f(x0, y0) = 0 mod p
p | N
```

In other words, this becomes a bivariate small-root problem modulo `p`, a divisor of `N`.

## Core idea

Brute-forcing all the unknown bits would require looking at 48 low-side bits and 47 high-side bits, which is impractical. Instead, we exploit the fact that the bit positions are sparsely spaced to compress the unknowns down to just two variables `x` and `y`.

From there I approached it as a bivariate Coppersmith of the Herrmann-May form. The shift polynomials used are of the following shape.

```text
g_{k,j}(x, y) = y^j * f(x, y)^k * N^max(t-k, 0)

0 <= k <= m
0 <= j <= m-k
```

At the true value `(x0, y0)`, `f(x0, y0) = p` and `p | N`. If `k < t`, then `N^(t-k)` supplies `p^(t-k)` and `f^k` yields `p^k`, so the whole thing is divisible by `p^t`. When `k >= t`, `f^k` alone already contains `p^t`.

We turn each polynomial's coefficients into a lattice row, and multiply the monomial `x^i y^j` by `X^i Y^j` to reflect the size bounds of the solution. After lattice reduction, reconstructing the short rows back into polynomials gives polynomials that become integer-zero at the true value.

In the actual solution, `m = 19` and `t = 5` worked well. In this case both the number of shifts and the number of monomials is 210, so we reduce a `210 x 210` lattice.

## Solution

### Step 1. Organizing the leaked bit structure

First read the outputs `L`, `N`, and `mask`, and confirm that `mask` matches the value computed in the code. Then set `p` in the following form.

```text
p = base + x + B * y
```

The low-side unknown `x` only includes the odd positions below bit 96.

```text
x = p_1*2^1 + p_3*2^3 + ... + p_95*2^95
```

The high-side unknown `y` represents the odd positions from bit 417 to bit 509, shifted right.

```text
y = p_417*2^0 + p_419*2^2 + ... + p_509*2^92
```

With this setup the polynomial is linear.

```text
f(x, y) = base + x + B * y
```

The structure is simple because it is a linear polynomial, but the modulus is `p` and we only know `N = p*q`. So we have to find the small solution subject to the condition that `p` is a large divisor of `N`.

### Step 2. Building the Herrmann-May lattice

I built the shift polynomials with the following routine.

```python
E = 0x10001
C = 0x1337
B = 1 << 417
TOP_Y = 1 << 94


def low_odd_bound():
    return sum(1 << i for i in range(1, 96, 2)) + 1


def high_odd_tail_bound():
    return sum(1 << (2 * j) for j in range(47)) + 1


X_BOUND = low_odd_bound()
Y_BOUND = high_odd_tail_bound()


def poly_mul(a, b):
    out = {}
    for (ai, aj), av in a.items():
        for (bi, bj), bv in b.items():
            key = (ai + bi, aj + bj)
            out[key] = out.get(key, 0) + av * bv
    return {key: value for key, value in out.items() if value}


def poly_shift_y(poly, amount):
    return {(i, j + amount): value for (i, j), value in poly.items()}


def build_shifts(base, modulus, m=19, t=5):
    f = {(0, 0): base, (1, 0): 1, (0, 1): B}
    shifts = []
    power = {(0, 0): 1}

    for k in range(m + 1):
        if k:
            power = poly_mul(power, f)
        scale = modulus ** max(t - k, 0)
        for y_power in range(m + 1 - k):
            shifted = poly_shift_y(power, y_power)
            shifts.append({
                monomial: coeff * scale
                for monomial, coeff in shifted.items()
            })

    return shifts
```

Polynomials are represented as dictionaries of the form `(x degree, y degree) -> coefficient`. `build_shifts` generates exactly the `y^j * f^k * N^max(t-k, 0)` laid out above.

When building the lattice matrix, we multiply each monomial by `X_BOUND^i * Y_BOUND^j`.

```python
def build_lattice(base, modulus, m=19, t=5):
    shifts = build_shifts(base, modulus, m, t)
    monomials = sorted({monomial for shift in shifts for monomial in shift})
    weights = [
        (X_BOUND ** i) * (Y_BOUND ** j)
        for i, j in monomials
    ]

    rows = []
    for shift in shifts:
        rows.append([
            shift.get(monomial, 0) * weight
            for monomial, weight in zip(monomials, weights)
        ])

    return rows, monomials, weights
```

After lattice reduction, we divide out the weights again to reconstruct integer polynomials. Rows that do not divide evenly are discarded.

```python
def reconstruct_polys(reduced_rows, monomials, weights, limit=80):
    polys = []
    for row in reduced_rows:
        poly = {}
        for value, monomial, weight in zip(row, monomials, weights):
            if value == 0:
                continue
            if value % weight != 0:
                poly = {}
                break
            poly[monomial] = value // weight

        if poly:
            polys.append(poly)
        if len(polys) >= limit:
            break

    return polys
```

The output of this step is a set of candidate integer polynomials that become zero at the true value `(x0, y0)`. In the next step we extract the actual small solution from these polynomials.

### Step 3. Recovering the small solution via finite-field computation and CRT

Given two reconstructed polynomials, we can obtain `(x, y)` via resultant or Groebner basis. Computing directly over the integers took too long, though. Since the provided code has a 60-second limit, I first found the solution modulo each small prime and then lifted it with CRT.

The procedure is as follows.

```text
1. Pick a pair of reconstructed polynomials.
2. Interpret the two polynomials over a 16-bit prime pmod.
3. Obtain x candidates via a resultant that eliminates y.
4. For each x candidate, compute a gcd to obtain y candidates.
5. Combine the (x, y) obtained over several pmod via CRT.
6. Once the CRT-combined modulus exceeds X_BOUND and Y_BOUND, check whether it is a genuine prime factor.
```

The check is simple.

```text
candidate = base + x + B * y
N % candidate == 0
```

If this condition passes, then `candidate` is `p`, and `q = N // p`.

### Step 4. Computing the RSA input

Once factorization is done, the rest is standard RSA. The challenge requires the input `answer` to satisfy the following condition.

```text
answer^0x10001 = 0x1337 mod N
```

Since we know `p` and `q`, we compute the private exponent `d` and submit `0x1337^d mod N`.

```text
phi    = (p - 1) * (q - 1)
d      = inverse(0x10001, phi)
answer = 0x1337^d mod N
```

## Exploit / Solver

The final solver breaks into three parts.

1. Read the printed `L`, `N`, and `mask`, and construct `base`, `X_BOUND`, `Y_BOUND`.
2. Build and reduce the lattice with `m = 19`, `t = 5`, then reconstruct the integer polynomials.
3. Find `(x, y)` via finite-field resultant and CRT, recover `p` and `q`, and submit the RSA inverse.

Below is the code with only the core flow. The lattice reduction function and the I/O wrappers can be wired up to match your environment.

```python
from sage.all import GF, PolynomialRing, inverse_mod


E = 0x10001
C = 0x1337
B = 1 << 417
TOP_Y = 1 << 94

PRIMES = [65521, 65519, 65497, 65479, 65449, 65447, 65437, 65423]


def to_sage(poly, ring):
    x, y = ring.gens()
    out = ring(0)
    for (i, j), coeff in poly.items():
        out += ring(coeff) * x**i * y**j
    return out


def roots_mod_prime(poly_a, poly_b, pmod):
    ring = PolynomialRing(GF(pmod), ("x", "y"), order="lex")
    x, y = ring.gens()
    a = to_sage(poly_a, ring)
    b = to_sage(poly_b, ring)

    resultant = a.resultant(b, y)
    if resultant == 0 or resultant.is_constant():
        return []

    roots = set()
    for xr, _ in resultant.univariate_polynomial().roots():
        xr = int(xr)
        common = a(xr, y).gcd(b(xr, y))
        if common == 0 or common.is_constant():
            continue
        for yr, _ in common.univariate_polynomial().roots():
            roots.add((xr, int(yr)))

    return sorted(roots)


def crt_pair(a, m, b, n):
    return int((a + m * (((b - a) * inverse_mod(m, n)) % n)) % (m * n))


def recover_root(polys, base, modulus, pairs):
    for i, j in pairs:
        states = [(0, 0, 1)]
        for pmod in PRIMES:
            residues = roots_mod_prime(polys[i], polys[j], pmod)
            next_states = set()

            for x0, y0, mod in states:
                for xr, yr in residues:
                    new_mod = mod * pmod
                    nx = crt_pair(x0, mod, xr, pmod)
                    ny = crt_pair(y0, mod, yr, pmod)

                    if new_mod > X_BOUND and nx >= X_BOUND:
                        continue
                    if new_mod > Y_BOUND and ny >= Y_BOUND:
                        continue

                    if new_mod > X_BOUND and new_mod > Y_BOUND:
                        factor = base + nx + B * ny
                        if 1 < factor < modulus and modulus % factor == 0:
                            return factor, modulus // factor

                    next_states.add((nx, ny, new_mod))

            states = sorted(next_states)

    raise ValueError("factor not recovered")


leak, n, mask = read_values()
base = leak + B * TOP_Y

rows, monomials, weights = build_lattice(base, n, m=19, t=5)
reduced_rows = reduce_lattice(rows)
polys = reconstruct_polys(reduced_rows, monomials, weights)

p, q = recover_root(
    polys,
    base,
    n,
    pairs=[(1, 2), (1, 3), (2, 3), (1, 4), (2, 4), (3, 4)],
)

d = pow(E, -1, (p - 1) * (q - 1))
answer = pow(C, d, n)
submit(answer)
```

`recover_root` checks `N % candidate == 0` immediately each time it finds a candidate. So it stops the moment a CRT-lifted value falls within the actual range, without carrying unnecessary candidates for long.

## Result

In the final run, factorization succeeded with `m = 19`, `t = 5`, and submitting the computed RSA input confirmed the flag.

```text
HS{1e5b95ac85582e49cef84d5b90740033}
```

The flag is as follows.

```text
HS{1e5b95ac85582e49cef84d5b90740033}
```
