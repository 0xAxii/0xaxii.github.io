---
title: "Hacktheon Sejong 2026 Quals Until Executing Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals Until Executing 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "Reversing"]
draft: false
listed: false
---

# Until Executing

### Summary

stripped OCaml native 바이너리지만 동적 심볼에 `camlMain`, `camlProc_a_engine`, `camlProc_b_engine`이 남아 있었다. 실제 verifier는 parent가 아니라 `fork()` 이후 child process에서 돈다.

### Analysis

입력 조건은 길이 64와 고정 alphabet이다.

```text
length   = 64
alphabet = abcdefghijklmnopqrstuvwxyz_0123456789!
```

OCaml immediate integer는 `(n << 1) | 1` 형태다. disassembly에서 길이 비교값처럼 보이는 `0x81`은 실제로 64를 뜻한다.

`Proc_a_engine`과 `Proc_b_engine`은 모두 `explode -> run -> collapse` 구조였다. `run`에서 check closure를 쌓고 마지막 `collapse`에서 검증이 실행된다. 제목의 Until Executing도 이 지점을 가리킨다.

문자는 ASCII 그대로 쓰이지 않는다. alphabet index를 tagged value로 바꾼다.

```text
a -> 1
b -> 3
c -> 5
...
```

`Proc_b`의 current check와 state update를 Python으로 옮겨 candidate를 줄였다. branch가 빠르게 줄어들어 끝에는 하나만 남았고 그 candidate를 `Proc_a` checker에도 넣어 다시 확인했다.

복구된 내부 문자열은 아래와 같다.

```text
ovajumher0erwkl28_i8eecp!hb5enitsj6ly5hx05qel7a2z1gb6y8vi4fd4l93
```

### Flag

`hacktheon2026{ovajumher0erwkl28_i8eecp!hb5enitsj6ly5hx05qel7a2z1gb6y8vi4fd4l93}`
