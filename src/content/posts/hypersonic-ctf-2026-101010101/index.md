---
title: "HyperSonic CTF 2026 101010101 Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 101010101 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Crypto"]
draft: false
listed: false
---

# 101010101

## 개요

`101010101`은 RSA에서 한 소인수 `p`의 일부 비트를 누출하는 `crypto` 문제입니다. 제공된 코드는 512비트 소수 `p`, `q`를 생성한 뒤 `p & mask`, `n = p*q`, `mask`를 출력하고, 입력값이 특정 RSA 식을 만족하는지 검사합니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `crypto`
- 누출값: `p & mask`, `n = p*q`, `mask`
- 목표: `answer^0x10001 = 0x1337 mod n`을 만족하는 값을 제출합니다.

풀이에서 먼저 확인할 부분은 `mask`가 어떤 비트를 가리는지입니다. 중간 구간의 비트는 모두 공개되고, 양쪽 구간에서는 짝수 위치 비트만 공개됩니다. 이 구조를 이용하면 모르는 비트를 두 개의 작은 변수로 묶고, 이변수 작은 해 문제로 `p`를 복구할 수 있습니다.

## 문제 분석

제공된 코드는 매우 짧습니다.

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

비트 번호는 최하위 비트를 `0`번으로 두겠습니다. `mask` 조건을 정리하면 다음과 같습니다.

```text
0 <= i < 96      : 짝수 비트만 공개
96 <= i < 416   : 모든 비트 공개
416 <= i < 512  : 짝수 비트만 공개
```

따라서 `p & mask`는 `p`의 많은 비트를 알려 줍니다. 공개되지 않는 부분은 낮은 쪽 홀수 비트와 높은 쪽 홀수 비트입니다. 다만 `p`는 512비트 소수이므로 최상위 비트인 511번 비트는 `1`로 고정됩니다. 이 비트는 `mask`에 포함되지 않지만 값은 알고 있으므로 상수항에 넣을 수 있습니다.

글에서 사용할 변수를 먼저 정리합니다.

- `L`: 출력된 `p & mask`
- `N`: 출력된 `p*q`
- `B`: `2^417`
- `x`: 1번, 3번, ..., 95번 비트가 만드는 낮은 쪽 미지수
- `y`: 417번, 419번, ..., 509번 비트를 417비트만큼 오른쪽으로 민 값
- `base`: 이미 알고 있는 비트를 모두 더한 값

관계식은 다음처럼 쓸 수 있습니다.

```text
B      = 2^417
TOP_Y  = 2^94
base   = L + B * TOP_Y
p      = base + x + B * y
```

여기서 `TOP_Y = 2^94`는 511번 비트를 의미합니다. `511 - 417 = 94`이므로 `B * TOP_Y`를 더하면 최상위 비트가 반영됩니다.

`x`, `y`의 범위도 코드에서 바로 계산할 수 있습니다.

```text
0 <= x < sum(2^i for odd i in [1, 95]) + 1
0 <= y < sum(2^(2*j) for 0 <= j < 47) + 1
```

이제 다음 다항식을 생각합니다.

```text
f(x, y) = base + x + B * y
```

실제 미지수 값을 `x0`, `y0`라고 하면 `f(x0, y0) = p`입니다. 따라서 `p`를 모르는 상태에서도 다음 성질은 사용할 수 있습니다.

```text
f(x0, y0) = 0 mod p
p | N
```

즉 `N`의 약수 `p`를 모듈러로 하는 이변수 작은 해 문제가 됩니다.

## 핵심 아이디어

직접 모르는 비트를 모두 탐색하면 낮은 쪽 48비트와 높은 쪽 47비트를 봐야 하므로 현실적이지 않습니다. 대신 비트 위치가 듬성듬성 비어 있다는 점을 이용해 미지수를 `x`, `y` 두 개로 압축합니다.

이후에는 Herrmann-May 방식의 이변수 Coppersmith 형태로 접근했습니다. 사용한 shift 다항식은 다음 꼴입니다.

```text
g_{k,j}(x, y) = y^j * f(x, y)^k * N^max(t-k, 0)

0 <= k <= m
0 <= j <= m-k
```

참값 `(x0, y0)`에서 `f(x0, y0) = p`이고 `p | N`입니다. `k < t`이면 `N^(t-k)`가 `p^(t-k)`를 제공하고, `f^k`에서 `p^k`가 나오므로 전체가 `p^t`로 나누어집니다. `k >= t`일 때는 `f^k`만으로도 `p^t`가 들어갑니다.

각 다항식의 계수를 격자 행으로 만들고, 단항식 `x^i y^j`에는 `X^i Y^j`를 곱해 해의 크기 범위를 반영합니다. 격자 축소 후 짧은 행을 다시 다항식으로 복원하면, 참값에서 정수로 0이 되는 다항식을 얻을 수 있습니다.

실제 풀이에서는 `m = 19`, `t = 5`가 잘 동작했습니다. 이때 shift 수와 단항식 수가 모두 210개라서 `210 x 210` 격자를 줄이게 됩니다.

## 풀이 과정

### Step 1. 누출된 비트 구조 정리

먼저 출력값 `L`, `N`, `mask`를 읽고 `mask`가 코드에서 계산한 값과 같은지 확인합니다. 그 뒤 `p`를 다음 형태로 둡니다.

```text
p = base + x + B * y
```

낮은 쪽 미지수 `x`는 96비트 아래 홀수 위치만 포함합니다.

```text
x = p_1*2^1 + p_3*2^3 + ... + p_95*2^95
```

높은 쪽 미지수 `y`는 417번부터 509번까지의 홀수 위치를 오른쪽으로 밀어 표현합니다.

```text
y = p_417*2^0 + p_419*2^2 + ... + p_509*2^92
```

이렇게 두면 다항식은 선형입니다.

```text
f(x, y) = base + x + B * y
```

선형 다항식이라 구조는 단순하지만, 모듈러가 `p`이고 우리는 `N = p*q`만 알고 있습니다. 따라서 `p`가 `N`의 큰 약수라는 조건을 포함해 작은 해를 찾아야 합니다.

### Step 2. Herrmann-May 형태의 격자 구성

다음 루틴으로 shift 다항식을 만들었습니다.

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

다항식은 `(x 차수, y 차수) -> 계수` 형태의 딕셔너리로 표현했습니다. `build_shifts`는 위에서 정리한 `y^j * f^k * N^max(t-k, 0)`를 그대로 생성합니다.

격자 행렬을 만들 때는 단항식별로 `X_BOUND^i * Y_BOUND^j`를 곱합니다.

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

격자 축소 후에는 가중치를 다시 나누어 정수 다항식으로 복원합니다. 나누어떨어지지 않는 행은 버립니다.

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

이 단계의 출력은 참값 `(x0, y0)`에서 0이 되는 정수 다항식 후보들입니다. 다음 단계에서는 이 다항식들에서 실제 작은 해를 뽑아냅니다.

### Step 3. 유한체 계산과 CRT로 작은 해 복구

복원된 다항식 두 개를 잡으면 원칙적으로 resultant나 Groebner basis로 `(x, y)`를 구할 수 있습니다. 다만 정수 위에서 바로 계산하면 시간이 오래 걸렸습니다. 제공 코드에 60초 제한이 있으므로, 작은 소수별로 먼저 해를 찾은 뒤 CRT로 들어 올렸습니다.

절차는 다음과 같습니다.

```text
1. 복원된 다항식 쌍을 하나 고릅니다.
2. 16비트 소수 pmod 위에서 두 다항식을 해석합니다.
3. y를 제거하는 resultant로 x 후보를 구합니다.
4. 각 x 후보마다 gcd를 계산해 y 후보를 구합니다.
5. 여러 pmod에서 얻은 (x, y)를 CRT로 합칩니다.
6. CRT로 합친 모듈러스가 X_BOUND, Y_BOUND를 넘으면 실제 소인수인지 검사합니다.
```

검사는 단순합니다.

```text
candidate = base + x + B * y
N % candidate == 0
```

이 조건을 통과하면 `candidate`가 `p`이고, `q = N // p`입니다.

### Step 4. RSA 입력값 계산

소인수분해가 끝나면 남은 과정은 표준 RSA입니다. 문제는 입력값 `answer`가 다음 조건을 만족하기를 요구합니다.

```text
answer^0x10001 = 0x1337 mod N
```

`p`, `q`를 알고 있으므로 개인 지수 `d`를 계산하고 `0x1337^d mod N`을 제출하면 됩니다.

```text
phi    = (p - 1) * (q - 1)
d      = inverse(0x10001, phi)
answer = 0x1337^d mod N
```

## Exploit / Solver

최종 solver는 세 부분으로 나뉩니다.

1. 출력된 `L`, `N`, `mask`를 읽고 `base`, `X_BOUND`, `Y_BOUND`를 구성합니다.
2. `m = 19`, `t = 5`로 격자를 만들고 축소한 뒤 정수 다항식들을 복원합니다.
3. 유한체 resultant와 CRT로 `(x, y)`를 찾아 `p`, `q`를 복구하고 RSA 역원을 제출합니다.

아래는 핵심 흐름만 정리한 코드입니다. 격자 축소 함수와 입출력 래퍼는 환경에 맞게 연결하면 됩니다.

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

`recover_root`는 후보를 찾을 때마다 바로 `N % candidate == 0`을 검사합니다. 그래서 CRT로 들어 올린 값이 실제 범위 안에 들어오는 순간, 불필요한 후보를 오래 들고 가지 않아도 됩니다.

## 결과

최종 실행에서는 `m = 19`, `t = 5`로 소인수분해가 성공했고, 계산한 RSA 입력값을 제출해 flag를 확인했습니다.

```text
HS{1e5b95ac85582e49cef84d5b90740033}
```

Flag는 다음과 같습니다.

```text
HS{1e5b95ac85582e49cef84d5b90740033}
```
