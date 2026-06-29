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

OCaml native 바이너리다.
stripped이지만 동적 심볼에 `camlMain`, `camlProc_a_engine`, `camlProc_b_engine` 등이 남아 있어서 구조를 잡을 수 있었다.

parent만 따라가면 검증 루틴이 잘 안 보인다.
`run_child`가 `fork()`를 호출하고, 실제 verifier는 child process에서 실행된다.

입력은 이 조건을 만족해야 한다.

```text
length   = 64
alphabet = abcdefghijklmnopqrstuvwxyz_0123456789!
```

OCaml immediate integer는 `(n << 1) | 1` 식으로 표현된다.
그래서 disassembly에서 길이 비교 값으로 보이는 `0x81`은 실제로 64다.

`Proc_a_engine`과 `Proc_b_engine`은 둘 다 `explode -> run -> collapse` 구조다.
`run`에서 check closure를 쌓고, 마지막 `collapse`에서 실제 검증이 평가된다.
문제 제목도 이 지점을 가리킨다.

문자는 ASCII 그대로 쓰이지 않고 alphabet index의 tagged value로 바뀐다.

```text
a -> 1
b -> 3
c -> 5
...
```

`Proc_b`의 current check와 state update를 Python으로 옮겨 candidate를 줄였다.
branch가 빠르게 줄어들고, 끝에는 하나만 남았다.
그 candidate를 `Proc_a` checker에도 넣어 검증했다.

복구된 내부 문자열은 이렇다.

```text
ovajumher0erwkl28_i8eecp!hb5enitsj6ly5hx05qel7a2z1gb6y8vi4fd4l93
```

플래그: `hacktheon2026{ovajumher0erwkl28_i8eecp!hb5enitsj6ly5hx05qel7a2z1gb6y8vi4fd4l93}`
