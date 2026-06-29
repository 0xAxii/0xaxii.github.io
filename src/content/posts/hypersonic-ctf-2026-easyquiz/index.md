---
title: "HyperSonic CTF 2026 EasyQuiz Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 EasyQuiz 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Crypto"]
draft: false
listed: false
---

# EasyQuiz

## 개요

`EasyQuiz`는 세 개의 독립된 입력 분기에서 flag 조각을 얻는 문제입니다. 제공된 코드는 처음에 `inp`를 입력받고, 값이 `1`, `2`, `3`일 때 각각 다른 검증을 수행합니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `crypto`
- 목표: 세 분기에서 출력되는 flag 조각을 모아 최종 flag를 복원합니다.
- 입력은 `ast.literal_eval` 또는 정수 파싱을 거쳐 각 분기의 검증식에 들어갑니다.

풀이에서 먼저 정리할 개념은 각 분기가 요구하는 값입니다.

- `N`: 1번 분기에서 매번 제시되는 정수입니다.
- `x`, `y`, `z`: 1번 분기에서 제출하는 양의 정수입니다.
- `M`: 2번 분기에서 Sage의 `Matrix(ZZ, M)`로 변환되는 입력입니다.
- `number`: 3번 분기에서 Python 객체 목록으로 파싱되는 입력입니다.
- `hash(i)`: 3번 분기에서 모든 원소가 같은 값인지 비교하는 Python 내장 해시입니다.

## 문제 분석

제공된 코드는 세 분기를 다음처럼 나눕니다.

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

1번 분기는 `N`이 다섯 번 주어지고, 매번 양의 정수 `x`, `y`, `z`가 다음 식을 Python의 `float` 비교로 만족해야 합니다.

```text
x/(y+z) + y/(x+z) + z/(x+y) == N
```

정수 방정식처럼 보이지만 실제 비교는 Python의 `/` 연산 결과, 즉 `float` 값으로 이루어집니다. 이 때문에 수학적으로 정확한 유리수 해를 찾기보다, 같은 환경에서 계산했을 때 결과가 정확히 `N`으로 반올림되는 큰 정수를 만들면 됩니다.

2번 분기는 입력을 Sage 정수 행렬로 바꾼 뒤 `BKZ`를 호출합니다. 조건식 자체는 격자 문제처럼 보이지만, 예외 처리가 없습니다. 그래서 `Matrix(ZZ, M)`이 만들 수 있는 행렬 타입과 해당 타입의 메서드 목록을 보는 쪽이 더 먼저입니다.

3번 분기는 `number`의 서로 다른 원소가 22개 이상이어야 하고, 모든 원소의 해시가 하나로 같아야 합니다. 첫 원소의 해시는 반드시 `42`입니다. 복소수는 실수부와 허수부가 모두 정수여야 하며, 모든 원소는 절댓값 조건도 통과해야 합니다.

```text
len(set(number)) > 21
len(set(hash(i) for i in number)) == 1
hash(number[0]) == 42
abs(i) < 2424242
```

## 핵심 아이디어

세 분기는 서로 독립적이므로, 각 분기에서 flag 조각을 얻은 뒤 그대로 이어 붙이면 됩니다.

1번 분기에서는 `y = z = s`로 두면 식이 한 변수 형태로 줄어듭니다. `t = x/s`라고 하면 다음 식을 얻습니다.

```text
t/2 + 2/(t+1) = N
```

양의 해는 다음과 같습니다.

```text
t = ((2N - 1) + sqrt(4N^2 + 4N - 15)) / 2
```

이 해 자체는 일반적으로 정수가 아닙니다. 대신 `s = 10^k`를 크게 잡고 `x = round(t*s)`, `y = z = s`로 만든 뒤, 코드와 같은 `float` 식을 로컬에서 다시 계산합니다. 결과가 `N`과 같아지는 `k`를 찾으면 같은 입력이 서버에서도 통과합니다.

2번 분기에서는 Sage의 sparse 행렬 타입을 만들 수 있는 입력을 넣습니다. 딕셔너리 형태의 입력은 sparse 정수 행렬을 만들고, 이 타입에는 `BKZ` 메서드가 없습니다. 예외가 그대로 노출되면 traceback에 실행 중이던 소스 라인이 포함되고, 그 줄에 있는 flag 조각을 읽을 수 있습니다.

3번 분기는 Python의 숫자 해시 규칙을 이용합니다. 정수 `42`는 `hash(42) == 42`입니다. 복소수는 실수부 해시와 허수부 해시가 `sys.hash_info.imag` 상수로 결합됩니다. 또 `float` 해시는 유리수 값을 `sys.hash_info.modulus`에 대해 계산하므로, 2의 거듭제곱 분모를 갖는 값을 열거해 `hash(value) == 42`인 값을 찾을 수 있습니다.

## 풀이 과정

### Step 1. 세 분기의 출력 조건 분리

처음 입력한 `inp` 값에 따라 코드 흐름이 완전히 갈라집니다. 한 번의 연결에서 세 조각을 모두 얻는 구조가 아니라, 각 분기를 따로 호출해 결과를 모으면 됩니다.

이 단계에서 얻은 정리는 다음과 같습니다.

```text
inp = 1: float 비교를 다섯 번 통과하면 첫 조각 출력
inp = 2: Sage Matrix와 BKZ 조건을 지나면 두 번째 조각 출력
inp = 3: hash가 42인 서로 다른 숫자 22개 이상을 넣으면 마지막 조각 출력
```

이후에는 각 분기를 독립적으로 풀었습니다.

### Step 2. 1번 분기에서 `float` 비교 통과

`y = z = s`로 두면 원래 식은 `t = x/s`에 대한 식으로 정리됩니다.

```text
x/(y+z) + y/(x+z) + z/(x+y)
= t/2 + 2/(t+1)
```

이제 주어진 `N`마다 양의 해 `t`를 계산한 뒤, `s = 10^k`를 바꿔 가며 정수 `x`를 만듭니다.

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

여기서 필요한 것은 정확한 실수 해가 아니라, Python이 계산한 `float` 결과가 `n`과 같다고 판단되는 정수 세 개입니다. 실제 검증식과 같은 식으로 로컬에서 먼저 확인하므로, 찾은 값은 그대로 제출할 수 있습니다.

### Step 3. 2번 분기에서 sparse 행렬 예외 유도

2번 분기의 입력은 `ast.literal_eval`을 거쳐 Sage 행렬 생성자에 전달됩니다. 리스트 형태의 행렬만 생각하면 `BKZ` 조건을 직접 만족해야 하지만, 딕셔너리를 넣으면 다른 타입의 행렬이 생성됩니다.

```python
{(0, 0): 1, (1, 1): 1}
```

이 입력은 sparse 정수 행렬로 해석됩니다. `det(M)` 계산은 진행되지만, 이후 호출되는 `M.BKZ(block_size=30)`에서 `BKZ` 메서드가 없어 예외가 발생합니다.

문제 서비스는 traceback을 숨기지 않았습니다. 그 결과 예외 메시지에 실행 중이던 `if norm(M.BKZ(...))` 줄이 그대로 출력되고, 이 줄 안의 `print` 문자열에서 두 번째 flag 조각을 얻을 수 있었습니다.

### Step 4. 3번 분기에서 `hash == 42` 집합 구성

3번 분기의 조건은 서로 다른 원소가 22개 이상이어야 한다는 점이 까다롭습니다. 단순히 `42`를 여러 번 넣으면 `set(number)`의 크기가 1이므로 실패합니다.

먼저 정수 `42`를 넣습니다.

```text
hash(42) = 42
```

그다음 복소수 해시식을 이용합니다. `y`를 작은 정수로 잡고 실수부를 다음처럼 맞추면, 복소수 전체의 해시가 `42`가 됩니다.

```text
complex(42 - sys.hash_info.imag * hash(y), y)
```

`y = -2, -1, 1, 2`를 쓰면 네 개의 서로 다른 복소수를 얻고, 절댓값 제한도 통과합니다.

나머지는 `float` 값으로 채웁니다. Python의 `float` 해시는 2의 거듭제곱 분모를 갖는 값을 모듈러 연산으로 처리합니다. 따라서 지수 `d`를 훑으면서 다음 조건을 만족하는 mantissa를 찾습니다.

```text
mantissa = 42 * 2^d mod sys.hash_info.modulus
2^52 <= mantissa < 2^53
value = mantissa * 2^-d
hash(value) = 42
```

이 방식으로 17개의 `float` 값을 찾을 수 있었습니다. 정수 1개, 복소수 4개, `float` 17개를 합치면 서로 다른 원소가 22개가 되며, 모든 원소의 해시가 `42`입니다.

### Step 5. flag 조각 결합

각 분기는 flag의 앞, 중간, 뒤 조각을 따로 출력합니다. 1번 분기와 3번 분기는 검증을 통과하면 마지막 줄에 flag 조각이 출력됩니다. 2번 분기는 traceback에서 `print("...")` 형태의 문자열을 추출했습니다.

세 결과를 순서대로 이어 붙이면 최종 flag가 됩니다.

## Exploit / Solver

아래 코드는 풀이에 필요한 핵심 루틴만 정리한 것입니다. 입출력 코드는 메뉴 번호와 payload를 보내고 결과를 받아오는 단순한 부분이라 생략했습니다.

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

실제 실행에서는 1번 분기의 다섯 질문마다 `part1_triple(N)`의 결과를 제출하고, 2번 분기에는 `part2_payload()`를 보냅니다. 3번 분기에는 `repr(part3_numbers())`를 제출하면 됩니다.

## 결과

세 분기를 실행해 얻은 조각을 합치면 다음 flag가 됩니다.

```text
HS{70927730afde31916a2f22a1385a5d2343377937a7c3cf1a796b78d05b7d070e50b8c5526395e3d968da2ca26f198476}
```
