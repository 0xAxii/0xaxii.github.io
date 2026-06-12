---
title: "HyperSonic CTF 2026 NORfuscated Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 NORfuscated 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Reversing"]
draft: false
listed: false
---

***SSG Writeup***

# NORfuscated

## 개요

`NORfuscated`는 입력 검증 로직이 NOR gate 회로로 구성된 reversing 문제입니다. 제공된 프로그램은 심볼이 제거된 64비트 PIE ELF로 확인됩니다. 프로그램은 입력을 받은 뒤 `Wrong!` 또는 `Correct!`를 출력합니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `reversing`
- 목표: `Correct!`가 출력되는 `68`바이트 입력을 찾습니다.
- 입력 조건: 개행을 제거한 뒤 길이가 정확히 `68`바이트여야 합니다.

풀이에서 먼저 확인할 부분은 직렬화된 Boolean 회로입니다. 문자열을 직접 비교하는 부분은 보이지 않고, 입력 비트가 회로에 들어가 최종 출력 비트가 `1`인지 검사됩니다.

## 문제 분석

먼저 풀이에서 사용할 표기를 정리합니다.

- `wire[i]`: Boolean 회로의 `i`번 `wire` 값입니다.
- `gate`: `(dst, a, b)` 형태의 NOR `gate`입니다.
- `input_groups`: 각 입력 바이트의 비트가 어떤 `wire`에 대응되는지 나타내는 목록입니다.
- `outputs`: 최종 출력으로 읽는 `wire` 목록입니다.

프로그램에서 바로 확인되는 출력 문자열은 다음과 같습니다.

```text
Enter flag:
Wrong!
Correct!
```

이 문자열만으로는 정답을 직접 비교하는 구조를 찾기 어렵습니다. 실제 검증 흐름은 입력 길이를 확인한 뒤, 입력 비트를 회로의 입력 `wire`에 배치하고, NOR `gate`를 순서대로 평가하는 방식입니다.

회로에서 각 `gate`는 다음 연산을 수행합니다.

```text
wire[dst] = NOT (wire[a] OR wire[b])
```

여기서 확인할 수 있는 점은 모든 연산이 NOR 하나로만 구성된다는 것입니다. 따라서 검증 로직 전체를 입력 비트에 대한 Boolean 제약식으로 바꿀 수 있습니다.

직렬화된 회로 데이터는 다음 형식으로 파싱할 수 있습니다.

```text
u32 gate_count
gate_count * (u32 dst, u32 a, u32 b)
u32 output_count
output_count * u32 output_wire
u32 input_group_count
input_group_count * (u32 bit_count, bit_count * u32 input_wire)
```

파싱 결과는 다음과 같습니다.

```text
gate_count        = 344048
output_count      = 1
output_wire       = 344592
input_group_count = 68
bits per group    = 8
input_bits        = 544
```

파싱 결과를 보면 입력 `68`바이트가 총 `544`개의 입력 비트로 확장되고, 많은 NOR `gate`를 거쳐 하나의 출력 `wire`로 모입니다. 최종적으로 `wire[344592]`가 참이 되는 입력을 찾으면 됩니다.

## 핵심 아이디어

NOR `gate`만으로 구성된 회로라 하더라도, 각 `gate`의 입출력 관계는 Boolean 제약식 하나로 표현할 수 있습니다. 즉 프로그램을 직접 역산하기보다, 회로 전체를 SAT 문제로 바꾸는 편이 자연스럽습니다.

전체 `gate` 수는 `344048`개로 많지만, 최종 출력 `wire`에 영향을 주지 않는 `gate`까지 모두 다룰 필요는 없습니다. `outputs`에서 시작해 각 `gate`의 입력 `wire`를 역방향으로 따라가면, 출력 계산에 필요한 `wire` 집합을 구할 수 있습니다. 이후 이 집합에 포함된 `gate`만 `solver`에 추가합니다.

정리하면 풀이 전략은 다음과 같습니다.

```text
1. 회로 데이터를 파싱한다.
2. 최종 출력 wire에 영향을 주는 wire만 역추적한다.
3. 입력 68바이트를 z3.BitVec로 둔다.
4. 각 입력 비트를 대응되는 wire에 연결한다.
5. NOR gate를 Boolean 제약식으로 추가한다.
6. 최종 출력 wire가 true가 되도록 solver에 요청한다.
```

복원된 입력은 실제로 제출 가능한 문자열이어야 하므로, `solver`에는 printable ASCII 조건을 함께 추가했습니다. 이 제한을 넣은 상태에서도 `sat`가 나왔고 검증을 통과했습니다.

## 풀이 과정

### Step 1. 입력 길이와 출력 조건 확인

검증 로직은 개행을 제거한 뒤 입력 길이가 `0x44`, 즉 `68`바이트인지 확인합니다. 길이가 맞지 않으면 회로 평가까지 가지 못합니다.

따라서 `solver`에서 만들어야 하는 값은 `68`개의 바이트입니다. 각 바이트는 `8`개의 비트로 나뉘어 총 `544`개의 회로 입력 `wire`에 연결됩니다.

### Step 2. 직렬화된 회로 파싱

회로 데이터는 `u32` 값들의 배열처럼 저장되어 있습니다. 처음에는 `gate` 개수가 나오고, 이후 `(dst, a, b)` 3개 값이 반복됩니다. 그 뒤에는 출력 `wire` 목록과 입력 비트 매핑이 이어집니다.

파싱 후 첫 번째 바이트는 `wire[1]`부터 `wire[8]`까지 연결되고, 두 번째 바이트는 `wire[9]`부터 `wire[16]`까지 연결되는 식으로 확인됩니다. 최종 출력은 하나이며, 대상 `wire`는 `344592`입니다.

이 단계에서 얻은 정보로 `solver`가 `z3.BitVec`로 표현한 입력 바이트와 회로 `wire`를 연결합니다.

### Step 3. 출력 `wire`에 필요한 `gate` 추적

모든 `gate`를 `solver`에 넣어도 풀 수는 있지만, 불필요한 제약식이 많아집니다. 따라서 `output_wire`에서 시작해 해당 `wire`를 만드는 `gate`를 찾고, 그 `gate`의 입력인 `a`, `b`를 다시 추적합니다.

이를 반복하면 최종 출력에 영향을 주는 `wire` 집합을 얻을 수 있습니다. 이후 `gate`를 순회하면서 `dst`가 이 집합에 포함된 경우에만 제약식을 추가합니다.

### Step 4. NOR 제약식으로 변환

각 입력 바이트는 `z3.BitVec`로 만들고, `input_groups`에 따라 비트 단위로 Boolean `wire`에 대응시킵니다.

```text
wire[input_wire] = selected input bit is 1
```

그 다음 NOR `gate`는 다음 Boolean 식으로 바꿉니다.

```text
wire[dst] = Not(Or(wire[a], wire[b]))
```

마지막으로 `wire[344592]`가 `true`라는 조건을 추가하면, `solver`는 이를 만족하는 `68`바이트 입력을 찾을 수 있습니다.

## Exploit / Solver

`solver`의 핵심 흐름은 회로를 파싱하고, 출력에 필요한 `gate`만 골라 `z3` 제약식으로 변환한 뒤, 모델에서 바이트 값을 복원하는 것입니다. 회로 데이터의 시작 위치와 길이는 분석에서 확인한 `0x4FFC`, `0x3F08E0`을 사용했습니다.

```python
import struct

import z3


RODATA_OFF = 0x4FFC
RODATA_LEN = 0x3F08E0
INPUT_LEN = 68


def parse_circuit(program):
    blob = program[RODATA_OFF : RODATA_OFF + RODATA_LEN]
    pos = 0

    gate_count = struct.unpack_from("<I", blob, pos)[0]
    pos += 4

    gates = []
    for _ in range(gate_count):
        gates.append(struct.unpack_from("<III", blob, pos))
        pos += 12

    output_count = struct.unpack_from("<I", blob, pos)[0]
    pos += 4
    outputs = list(struct.unpack_from(f"<{output_count}I", blob, pos))
    pos += 4 * output_count

    input_group_count = struct.unpack_from("<I", blob, pos)[0]
    pos += 4

    input_groups = []
    for _ in range(input_group_count):
        bit_count = struct.unpack_from("<I", blob, pos)[0]
        pos += 4
        input_groups.append(list(struct.unpack_from(f"<{bit_count}I", blob, pos)))
        pos += 4 * bit_count

    return gates, outputs, input_groups


def output_cone(gates, outputs):
    by_dest = {dst: (a, b) for dst, a, b in gates}
    needed = set(outputs)
    stack = list(outputs)

    while stack:
        dst = stack.pop()
        if dst not in by_dest:
            continue

        for src in by_dest[dst]:
            if src not in needed:
                needed.add(src)
                stack.append(src)

    return needed


def solve(program):
    gates, outputs, input_groups = parse_circuit(program)
    needed = output_cone(gates, outputs)

    bytes_ = [z3.BitVec(f"b{i}", 8) for i in range(INPUT_LEN)]
    solver = z3.Solver()

    for b in bytes_:
        solver.add(b >= 0x20, b <= 0x7E)

    wires = {}
    for byte_index, group in enumerate(input_groups):
        for bit_index, wire in enumerate(group):
            if wire in needed:
                bit = z3.Extract(bit_index, bit_index, bytes_[byte_index])
                wires[wire] = bit == 1

    for dst, a, b in gates:
        if dst in needed:
            wires[dst] = z3.Not(z3.Or(wires[a], wires[b]))

    solver.add(wires[outputs[0]] == True)

    if solver.check() != z3.sat:
        raise RuntimeError("unsat")

    model = solver.model()
    return bytes(model.eval(b, model_completion=True).as_long() for b in bytes_)
```

이 코드는 프로그램의 검증 함수를 그대로 에뮬레이션하지 않고, `gate` 관계만 추출해 `solver`가 풀 수 있는 형태로 바꿉니다. NOR `gate`의 직렬화 순서가 평가 순서와 맞기 때문에, 필요한 `wire`를 앞에서부터 채워 나가며 제약식을 만들 수 있습니다.

## 결과

`solver`가 복원한 입력을 프로그램에 넣으면 다음과 같이 검증을 통과합니다.

```text
HS{f89020f327be2051d14b23b5d26bf7433c86a499d3ec3f5b06d88a67e58c2d3e}
Correct!
```

flag는 다음과 같습니다.

```text
HS{f89020f327be2051d14b23b5d26bf7433c86a499d3ec3f5b06d88a67e58c2d3e}
```
