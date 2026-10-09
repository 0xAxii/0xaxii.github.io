---
title: "HyperSonic CTF 2026 EasyQuiz Writeup"
description: "HyperSonic CTF 2026 EasyQuiz writeup"
---

# EasyQuiz

## Overview

In `EasyQuiz`, three independent input branches each give a flag fragment. The provided code first reads `inp`, and when the value is `1`, `2`, or `3` it performs a different check in each case.

The conditions I confirmed:

- Category: `crypto`
- Goal: collect the flag fragments printed by the three branches and reconstruct the final flag.
- The input goes through `ast.literal_eval` or integer parsing into each branch's validation expression.

The values each branch takes:

- `N`: the integer presented each round in branch 1.
- `x`, `y`, `z`: the positive integers submitted in branch 1.
- `M`: the input in branch 2 that is converted via Sage's `Matrix(ZZ, M)`.
- `number`: the input in branch 3 that is parsed into a list of Python objects.
- `hash(i)`: the Python built-in hash compared in branch 3 to check that all elements are equal.

## Analyzing the challenge

The provided code splits into three branches as follows.

```python
inp = int(input())

if inp==1:
    score = 0
    for i in range(5):
        N = random.randint(4, 50)
        print(f"🍎/(🍌+🍍)+🍌/(🍍+🍎)+🍍/(🍎+🍌)={N}")
        x, y, z = map(int, input().split()); assert x>0 and y>0 and z>0
        if x/(y+z)+y/(x+z)+z/(x+y)==N: score+=1

    if score==5: print("HS{?")

if inp==2:
    M = ast.literal_eval(input())
    n = len(M)
    M = Matrix(ZZ, M)
    minkowski_bound = sqrt(n)*abs(det(M))**(1/n)

    if norm(M.BKZ(block_size=30)[0]) > minkowski_bound: print("?")

if inp==3:
    number = ast.literal_eval(input())

    theanswertolifetheuniverseandeverything = 42
    assert len(set(number))>theanswertolifetheuniverseandeverything//2 and len(set([hash(i) for i in number]))==1 and hash(number[0])==theanswertolifetheuniverseandeverything and all([abs(i)<2424242 for i in number]) and all([int(i.real)==i.real and int(i.imag)==i.imag for i in number if isinstance(i,complex)])

    print("?}")
```

Branch 1 gives `N` five times, and each round the positive integers `x`, `y`, `z` must satisfy the following expression under Python's `float` comparison.

```text
x/(y+z) + y/(x+z) + z/(x+y) == N
```

It looks like an integer equation, but the comparison is done on the result of Python's `/` operation, i.e. on `float` values. So it is enough to produce large integers whose result, computed in the same environment, rounds to exactly `N`.

Branch 2 converts the input into a Sage integer matrix and then calls `BKZ`. The condition looks like a lattice problem, but there is no exception handling. So the first thing to check is which matrix types `Matrix(ZZ, M)` can produce and what methods those types have.

Branch 3 requires `number` to have at least 22 distinct elements, and all elements must have the same hash. The first element's hash must be exactly `42`. Complex numbers must have integer real and imaginary parts, and all elements must also pass the absolute-value condition.

```text
len(set(number)) > 21
len(set(hash(i) for i in number)) == 1
hash(number[0]) == 42
abs(i) < 2424242
```

## Main idea

The three branches are independent of each other, so we get a fragment from each branch and concatenate them.

In branch 1, setting `y = z = s` reduces the expression to a single-variable form. Letting `t = x/s`, we get the following expression.

```text
t/2 + 2/(t+1) = N
```

The positive solution is as follows.

```text
t = ((2N - 1) + sqrt(4N^2 + 4N - 15)) / 2
```

This solution is generally not an integer. Instead, we pick a large `s = 10^k`, set `x = round(t*s)`, `y = z = s`, and recompute the same `float` expression as the code locally. If we find a `k` where the result equals `N`, the same input passes on the server too.

In branch 2, we feed an input that produces a Sage sparse matrix type. A dictionary-form input creates a sparse integer matrix, and this type has no `BKZ` method. If the exception is exposed as-is, the traceback includes the source line that was executing, and we can read the flag fragment on that line.

Branch 3 exploits Python's numeric hash rules. The integer `42` satisfies `hash(42) == 42`. For complex numbers, the real-part hash and the imaginary-part hash are combined with the `sys.hash_info.imag` constant. Also, `float` hashing computes the rational value modulo `sys.hash_info.modulus`, so by enumerating values with power-of-two denominators we can find values where `hash(value) == 42`.

## Solution walkthrough

### Step 1. Separate the output conditions of the three branches

The first `inp` value decides which branch runs. One connection runs only one branch, so you call each branch separately and collect the results.

The output conditions per branch:

```text
inp = 1: passing the float comparison five times prints the first fragment
inp = 2: getting past the Sage Matrix and BKZ condition prints the second fragment
inp = 3: supplying at least 22 distinct numbers whose hash is 42 prints the last fragment
```

After that, I solved each branch independently.

### Step 2. Pass the `float` comparison in branch 1

Setting `y = z = s`, the original expression becomes an expression in `t = x/s`.

```text
x/(y+z) + y/(x+z) + z/(x+y)
= t/2 + 2/(t+1)
```

For each given `N`, we compute the positive solution `t`, then vary `s = 10^k` to produce the integer `x`.

```python
def part1_triple(n):
    root = ((2 * n - 1) + math.sqrt(4 * n * n + 4 * n - 15)) / 2
    for k in range(10, 90):
        s = 10**k
        x = round(root * s)
        y = z = s
        if x / (y + z) + y / (x + z) + z / (x + y) == n:
            return x, y, z
    raise ValueError("no float triple found")
```

We need three integers for which Python's computed `float` result equals `n`. Since we check them locally with the same expression the server uses, the values can be submitted directly.

### Step 3. Induce a sparse-matrix exception in branch 2

Branch 2's input goes through `ast.literal_eval` and is passed to the Sage matrix constructor. A list-form matrix would have to satisfy the `BKZ` condition directly, but a dictionary creates a different matrix type.

```python
{(0, 0): 1, (1, 1): 1}
```

This input is interpreted as a sparse integer matrix. The `det(M)` computation proceeds, but the subsequently called `M.BKZ(block_size=30)` raises an exception because there is no `BKZ` method.

The challenge service did not hide the traceback. The exception message printed the executing `if norm(M.BKZ(...))` line, and the `print` string on that line held the second flag fragment.

### Step 4. Build a `hash == 42` set in branch 3

The tricky part of branch 3 is the requirement of at least 22 distinct elements. Simply putting in `42` many times fails because the size of `set(number)` is 1.

First we put in the integer `42`.

```text
hash(42) = 42
```

Next we use the complex-number hash formula. Taking `y` as a small integer and setting the real part as follows makes the whole complex number's hash equal to `42`.

```text
complex(42 - sys.hash_info.imag * hash(y), y)
```

Using `y = -2, -1, 1, 2` yields four distinct complex numbers, which also pass the absolute-value limit.

The rest are `float` values. Python's `float` hash handles values with power-of-two denominators via modular arithmetic. So, scanning over the exponent `d`, we look for a mantissa satisfying the following condition.

```text
mantissa = 42 * 2^d mod sys.hash_info.modulus
2^52 <= mantissa < 2^53
value = mantissa * 2^-d
hash(value) = 42
```

This found 17 `float` values. Combining 1 integer, 4 complex numbers, and 17 `float` values gives 22 distinct elements, and all elements' hashes are `42`.

### Step 5. Combine the flag fragments

Each branch prints the front, middle, and back fragments of the flag separately. Branches 1 and 3 print a flag fragment on the last line once the check passes. For branch 2, I extracted a `print("...")`-style string from the traceback.

Concatenating the three results in order gives the final flag.

## Exploit / Solver

The code below has only the solving routines. I left out the I/O code, which just sends the menu number and payload and reads the result.

```python
import math
import re
import sys


def part1_triple(n):
    root = ((2 * n - 1) + math.sqrt(4 * n * n + 4 * n - 15)) / 2
    for k in range(10, 90):
        s = 10**k
        x = round(root * s)
        y = z = s
        if x / (y + z) + y / (x + z) + z / (x + y) == n:
            return x, y, z
    raise ValueError("no float triple found")


def part2_payload():
    return "{(0,0):1,(1,1):1}"


def extract_part2(output):
    return re.findall(rb'print\("([^"]+)"\)', output)[-1].decode()


def part3_numbers():
    nums = [42]
    imag_const = sys.hash_info.imag
    modulus = sys.hash_info.modulus

    for y in [-2, -1, 1, 2]:
        nums.append(complex(42 - imag_const * hash(y), y))

    for d in range(0, 1075):
        mantissa = (42 * pow(2, d, modulus)) % modulus
        if (1 << 52) <= mantissa < (1 << 53):
            value = math.ldexp(mantissa, -d)
            if abs(value) < 2424242 and hash(value) == 42 and value not in nums:
                nums.append(value)

    mantissa = (42 * pow(2, 1074, modulus)) % modulus
    value = math.ldexp(mantissa, -1074)
    if hash(value) == 42 and value not in nums:
        nums.append(value)

    assert len(set(nums)) > 21
    assert len({hash(x) for x in nums}) == 1
    assert hash(nums[0]) == 42
    assert all(abs(x) < 2424242 for x in nums)
    assert all(
        int(x.real) == x.real and int(x.imag) == x.imag
        for x in nums
        if isinstance(x, complex)
    )
    return nums
```

In the actual run, for each of the five questions in branch 1 you submit the result of `part1_triple(N)`, and to branch 2 you send `part2_payload()`. To branch 3 you submit `repr(part3_numbers())`.

## Result

Combining the fragments obtained by running the three branches gives the following flag.

```text
HS{70927730afde31916a2f22a1385a5d2343377937a7c3cf1a796b78d05b7d070e50b8c5526395e3d968da2ca26f198476}
```
