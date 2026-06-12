---
title: "HyperSonic CTF 2026 No.. This is Terrible... Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 No.. This is Terrible... 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Reversing"]
draft: false
listed: false
---

***SSG Writeup***

# No.. This is Terrible...

## 개요

이 문제는 입력 문자열을 그대로 비교하지 않고, 길이 256의 배열로 확장한 뒤 NTT 연산 결과를 비교하는 reversing 문제입니다.

분석으로 정리한 조건은 아래와 같습니다.

- 분류: `reversing`
- 제공된 프로그램: 심볼이 제거된 64비트 PIE ELF
- 목표: 검증 결과가 `Correct`가 되는 `68`바이트 입력을 찾습니다.

분석의 출발점은 입력이 어떤 배열로 바뀌는지, 그리고 최종 비교 테이블이 어떤 연산 결과인지 파악하는 것입니다. 문자열 비교 루틴은 보이지 않고, 대신 `998244353`과 `3`을 사용하는 NTT 형태의 함수가 검증 흐름에 들어갑니다.

## 문제 분석

분석에 사용할 표기는 다음처럼 두겠습니다.

- `p`: NTT에 쓰이는 모듈러 소수입니다. 값은 `998244353`입니다.
- `g`: NTT의 원시근으로 쓰이는 값입니다. 값은 `3`입니다.
- `n`: NTT 길이입니다. 값은 `256`입니다.
- `a`: 입력과 고정 패딩으로 만든 길이 `256`의 `u64` 배열입니다.
- `s`: 프로그램 안에 저장된 AES S-box 배열입니다.
- `target`: 최종 비교에 쓰이는 길이 `256`의 `u64` 배열입니다.
- `NTT(x)`: 길이 `256` 배열 `x`에 대한 NTT입니다.

프로그램에서 확인되는 출력 문자열은 다음과 같습니다.

```text
Wrong
Correct
```

검증 루틴은 먼저 한 줄을 입력받고, 끝의 `\n` 또는 `\r`을 제거합니다. 이후 길이가 `0x44`인지 확인합니다.

```c
input = read_line();
trim trailing newline or carriage return;

if (len(input) != 0x44) {
    print("Wrong");
    return;
}
```

`0x44`는 십진수로 `68`입니다. 따라서 복구해야 하는 값은 정확히 `68`바이트입니다.

길이 검사를 통과하면 프로그램은 길이 `256`의 `u64` 배열 `a`를 만듭니다. 앞부분에는 입력 바이트를 그대로 넣고, 나머지 원소는 고정된 식으로 채웁니다.

```c
for i in 0..68:
    a[i] = input[i]

for i in 68..256:
    a[i] = ((i * i + 17) ^ (73 * i + 41)) & 0xff
```

이제 입력이 직접 문자열로 비교되는 것이 아니라, 배열 `a`의 일부로 들어간다는 점을 확인할 수 있습니다. 뒤쪽 `188`개 원소는 입력과 무관하므로, 복구 후 검산에 사용할 수 있습니다.

프로그램의 읽기 전용 데이터 영역에는 길이 `256`의 `u64` 테이블이 두 개 있습니다. 첫 번째 테이블의 시작 값은 다음과 같습니다.

```text
63 7c 77 7b f2 6b 6f c5 30 01 67 2b fe d7 ab 76 ...
```

이는 AES S-box의 시작 부분과 일치합니다. 이 테이블을 `s`로 두겠습니다. 두 번째 테이블은 최종 비교용 배열이며, 글에서는 `target`으로 부르겠습니다.

검증 함수의 큰 흐름은 다음과 같이 정리할 수 있습니다.

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

NTT 함수에서는 비트 반전 순열을 적용한 뒤 길이를 `2`, `4`, `8`처럼 늘려 가며 버터플라이 연산을 수행합니다. 각 단계의 root는 `pow(3, (998244353 - 1) / length, 998244353)` 형태로 계산됩니다. 역 NTT에서는 root의 역원을 사용하고, 마지막에 `256`의 모듈러 역원을 곱합니다.

## 핵심 아이디어

검증식은 NTT 도메인에서 보면 단순한 원소별 곱셈입니다. 프로그램이 최종적으로 비교하는 값은 다음 관계를 만족합니다.

```text
target = INTT(NTT(a) * NTT(s))
```

여기서 `*`는 같은 인덱스끼리 곱하는 연산입니다. 양쪽에 NTT를 적용하면 식이 다음처럼 바뀝니다.

```text
NTT(target) = NTT(a) * NTT(s)
```

따라서 `NTT(s)`의 각 원소가 `0`이 아니면, 모듈러 역원을 곱해 `NTT(a)`를 복구할 수 있습니다.

```text
NTT(a)[i] = NTT(target)[i] * inverse(NTT(s)[i]) mod 998244353
```

이후 역 NTT를 한 번 더 적용하면 원래 배열 `a`가 나옵니다. `a[0:68]`은 입력 바이트이고, `a[68:256]`은 앞에서 확인한 고정 패딩입니다. 복구한 배열의 뒤쪽 원소가 패딩식과 맞는지 비교하면 역산이 제대로 되었는지도 함께 검산할 수 있습니다.

## 풀이 과정

### Step 1. 입력 배열과 패딩 구조 확인

검증 루틴에서 먼저 얻을 수 있는 정보는 입력 길이입니다. 개행을 제거한 뒤 길이가 `68`바이트가 아니면 바로 `Wrong`으로 분기합니다.

길이가 맞으면 입력 바이트는 `u64` 원소로 확장되어 `a[0]`부터 `a[67]`까지 들어갑니다. 이후 `a[68]`부터 `a[255]`까지는 다음 식으로 채워집니다.

```text
a[i] = ((i * i + 17) ^ (73 * i + 41)) & 0xff
```

이 단계에서 `a`의 뒤쪽은 이미 모두 알려져 있습니다. 아직 모르는 부분은 앞의 `68`개 원소뿐입니다.

### Step 2. S-box와 target 테이블 추출

다음으로 검증 함수가 복사하는 두 테이블을 확인합니다. 첫 번째 테이블은 `0x63, 0x7c, 0x77, 0x7b`로 시작하므로 AES S-box로 볼 수 있습니다. 이 값을 `s`로 둡니다.

두 번째 테이블은 역 NTT 이후의 `a`와 비교됩니다. 비교 루틴은 `256`개 `u64` 원소를 모두 확인하며, 하나라도 다르면 `Wrong`을 출력합니다. 따라서 이 테이블은 검증식의 결과인 `target`입니다.

이제 프로그램이 숨긴 값은 입력 자체가 아니라, `a`와 `s`의 NTT 기반 합성곱 결과라고 볼 수 있습니다.

### Step 3. NTT 도메인에서 입력 배열 복구

`target`은 다음 형태로 만들어졌습니다.

```text
target = INTT(NTT(a) * NTT(s))
```

이 식을 그대로 따라가며 브루트포스를 할 필요는 없습니다. `target`과 `s`는 모두 알고 있으므로 NTT 도메인에서 나눗셈을 하면 됩니다.

```text
target_freq = NTT(target)
sbox_freq   = NTT(s)
a_freq[i]   = target_freq[i] * inverse(sbox_freq[i]) mod p
a           = INTT(a_freq)
```

실제로 `sbox_freq`의 원소는 모두 `0`이 아니었습니다. 그래서 모든 인덱스에서 모듈러 역원을 계산할 수 있고, 길이 `256`의 배열 `a`가 그대로 복구됩니다.

### Step 4. 패딩 검산과 플래그 확인

복구한 배열에서 앞의 `68`개 원소를 바이트로 바꾸면 후보 입력이 됩니다. 다만 계산이나 오프셋이 틀렸을 가능성이 있으므로, 뒤쪽 원소를 패딩식과 비교했습니다.

```text
for i in 68..256:
    recovered[i] == ((i * i + 17) ^ (73 * i + 41)) & 0xff
```

이 검산이 모두 통과하면 `recovered[0:68]`을 플래그로 해석할 수 있습니다. 이후 프로그램에 입력했을 때 `Correct`가 출력되는 것도 확인했습니다.

## Exploit / Solver

solver의 흐름은 단순합니다. 프로그램에서 AES S-box와 `target` 테이블을 읽고, 둘 다 NTT 도메인으로 보낸 뒤 원소별로 나눕니다. 마지막으로 역 NTT를 적용해 입력 배열을 복구합니다.

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

코드에서 `SBOX_OFF`와 `TARGET_OFF`는 분석으로 확인한 두 테이블의 위치입니다. `sbox_freq`의 각 원소에 대해 역원을 곱하는 부분이 역산의 중심이며, 마지막 패딩 검사는 복구 결과의 신뢰도를 확인하는 용도입니다.

## 결과

복구한 입력을 프로그램에 넣으면 다음 결과가 출력됩니다.

```text
Correct
```

따라서 플래그는 다음과 같습니다.

```text
HS{6ce247509eece08f6c5a7a72263b90a396ca6f3e738e29b90089b4c33a40490c}
```
