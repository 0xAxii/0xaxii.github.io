---
title: "HyperSonic CTF 2026 aaa Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 aaa 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Crypto"]
draft: false
listed: false
---

# aaa

## 개요

`aaa`는 RSA 복호화 과정에서 기록된 사이드 채널 트레이스를 이용하는 crypto 문제입니다. 제공된 코드는 private exponent `d`를 사용해 모듈러 거듭제곱을 수행하고, 별도로 공개키 값 `N`, `e`, ciphertext `c`가 주어집니다.

확인한 조건은 다음과 같습니다.

- 분야: `crypto`
- 목표: 트레이스에서 private exponent `d`를 복구하고 `c`를 복호화합니다.
- 검증 방식: 복호화한 평문 `m`에 대해 `pow(m, e, N) == c`가 성립하는지 확인합니다.

풀이에서 먼저 볼 부분은 복호화 함수의 분기입니다. `d`의 각 비트가 곱셈 여부를 직접 결정하므로, 트레이스에서 연산 패턴을 읽어낼 수 있으면 `d` 전체를 복구할 수 있습니다.

## 문제 분석

먼저 글에서 사용할 값을 정리합니다.

- `N`: RSA modulus입니다.
- `e`: RSA public exponent이며, 값은 `65537`입니다.
- `c`: 복호화해야 하는 ciphertext입니다.
- `d`: 트레이스에서 복구할 private exponent입니다.
- `samples`: 트레이스에 들어 있는 `float32` 샘플 배열입니다.
- `run`: threshold를 기준으로 나눈 연속 구간입니다.

제공된 복호화 함수는 다음과 같습니다.

```python
def modexp_leaky(base, exp, mod):
    result = 1
    for bit in bin(exp)[2:]:
        result = (result * result) % mod
        if bit == '1':
            result = (result * base) % mod
    return result
```

이 함수는 왼쪽에서 오른쪽으로 exponent 비트를 읽는 square-and-multiply 방식입니다. 모든 비트에서 square를 한 번 수행하고, 비트가 `1`일 때만 multiply를 추가로 수행합니다.

```text
bit 0: square
bit 1: square, multiply
```

따라서 트레이스에서 square와 multiply가 구분되면 각 비트를 바로 읽을 수 있습니다. 실제 샘플을 threshold `0.4` 기준으로 나누면 고전력 연산 구간과 저전력 공백 구간이 명확하게 분리됩니다.

```text
고전력 연산 구간: 220 샘플
square와 multiply 사이의 짧은 공백: 25 샘플
다음 exponent 비트로 넘어가는 공백: 135 샘플
```

이 길이 차이 때문에 비트 판정 규칙도 단순해집니다.

```text
220 high, 25 low, 220 high, 135 low -> bit 1
220 high, 135 low                   -> bit 0
```

## 핵심 아이디어

이 문제에서 필요한 정보는 `d`의 각 비트입니다. RSA의 수학적 약점을 찾거나 `N`을 인수분해할 필요는 없습니다. 복호화 루틴 자체가 `d`의 비트에 따라 연산 개수를 바꾸므로, 트레이스의 길이 패턴이 곧 private exponent의 비트열이 됩니다.

`bit 0`에서는 square 한 번 뒤 곧바로 다음 비트 처리로 넘어갑니다. 반대로 `bit 1`에서는 square 뒤에 multiply가 한 번 더 나오고, 두 연산 사이에는 짧은 공백이 있습니다. 즉 threshold로 만든 `run`을 앞에서부터 읽으면서 짧은 공백 뒤에 추가 연산이 나타나면 `1`, 긴 공백으로 바로 넘어가면 `0`으로 기록하면 됩니다.

복구한 비트열을 정수 `d`로 바꾼 뒤에는 일반 RSA 복호화와 같습니다.

```text
m = c^d mod N
```

마지막으로 `m`을 다시 공개키로 암호화했을 때 원래 `c`가 나오면, 트레이스에서 읽은 `d`가 올바르다고 볼 수 있습니다.

## 풀이 과정

### Step 1. 연산 구간 분리

트레이스는 실수 샘플 배열이므로 먼저 threshold를 정해야 합니다. 값을 바꿔 보니 `0.4`에서 모든 구간이 기대한 길이로 나뉩니다. 이때 연속된 고전력 구간은 모두 `220`샘플이고, 저전력 구간은 `25` 또는 `135`샘플로만 나타납니다.

이 단계의 결과는 `(상태, 시작 위치, 끝 위치, 길이)` 형태의 `run` 목록입니다. 여기서 상태가 참이면 연산 구간, 거짓이면 공백 구간으로 봅니다.

### Step 2. 공백 길이로 exponent 비트 복구

각 비트는 반드시 square 연산으로 시작합니다. 따라서 현재 `run`이 `220`샘플짜리 고전력 구간인지 확인한 뒤, 바로 다음 저전력 구간의 길이를 봅니다.

저전력 구간이 `25`샘플이면 square와 multiply 사이의 짧은 공백입니다. 이 경우 다음에 다시 `220`샘플짜리 고전력 구간이 나와야 하며, 해당 비트는 `1`입니다. 이후 비트 경계에 해당하는 `135`샘플 공백을 하나 더 소비합니다.

저전력 구간이 `135`샘플이면 multiply 없이 다음 비트로 넘어간 것이므로 해당 비트는 `0`입니다.

이 규칙으로 전체 트레이스를 스캔하면 `2047`비트의 `d`를 얻습니다.

### Step 3. RSA 복호화와 검증

복구한 비트열을 `int(bits, 2)`로 변환하면 private exponent `d`가 됩니다. 이후 `pow(c, d, N)`으로 평문 정수 `m`을 구하고, 이를 바이트열로 바꿉니다.

복호화 결과가 우연히 그럴듯한 문자열로 보이는지만 확인하면 부족합니다. 공개키 값이 함께 주어져 있으므로 다음 조건을 검사했습니다.

```text
pow(m, e, N) == c
```

이 값이 참이면 복구한 `d`와 평문이 RSA 관계를 만족합니다.

## Exploit / Solver

solver의 흐름은 다음과 같습니다.

1. 트레이스를 `float32` 샘플 배열로 읽습니다.
2. threshold `0.4`로 연속 구간을 나눕니다.
3. `220/25/135` 길이 패턴으로 `d`의 비트를 복구합니다.
4. 주어진 `N`, `e`, `c`를 읽고 `pow(c, d, N)`을 계산합니다.
5. `pow(m, e, N) == c`로 결과를 검증합니다.

아래 코드는 핵심 루틴만 정리한 것입니다.

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

코드에서 따로 복잡한 후보 탐색은 하지 않습니다. 트레이스 구간 길이가 일정하므로 예외 처리를 걸어 두고 한 번 스캔하면 됩니다. 구간 길이가 예상과 다르면 바로 실패하도록 한 것도 같은 이유입니다.

## 결과

실행 결과 `6176`개의 `run`에서 `2047`비트의 exponent를 복구했습니다. 그중 `1`비트는 `1041`개였고, RSA 검증도 통과했습니다.

```text
runs=6176 bits=2047 ones=1041
rsa_check=True
hs{squ4re_4nd_mult1ply_l34ks_3v3ry_b1t_0f_y0ur_pr1v4t3_d}
```

flag는 다음과 같습니다.

```text
hs{squ4re_4nd_mult1ply_l34ks_3v3ry_b1t_0f_y0ur_pr1v4t3_d}
```
