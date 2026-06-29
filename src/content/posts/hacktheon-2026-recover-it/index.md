---
title: "Hacktheon Sejong 2026 Quals Recover It! Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals Recover It! 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "Reversing"]
draft: false
listed: false
---

# Recover It!

검증 루틴은 짧다.
입력 길이가 64인지 확인하고, 각 byte에 `i + 0x67`을 XOR한 뒤 `.data`의 `cmptable`과 비교한다.

식은 이렇다.

```text
encoded[i] = input[i] ^ (i + 0x67)
encoded[i] == cmptable[i]
```

XOR은 자기 자신이 역연산이라 정답은 바로 나온다.

```text
input[i] = cmptable[i] ^ (i + 0x67)
```

`cmptable`은 `.data`의 `0x4020`에 있다.

```python
cmptable = bytes.fromhex(
    "555a0a595f09555f5614434a43441114"
    "41484c1e421a191c1cb9e3e3bae5e7b1"
    "b6ecbfe8b2bdbabbeba6f3a1f1a4a4a0"
    "f4aca0f9ffa5a9a8ad94c7979791c695"
)

correct = bytes(c ^ ((i + 0x67) & 0xff) for i, c in enumerate(cmptable))
```

익스플로잇 코드

```python
cmptable = bytes.fromhex(
    "555a0a595f09555f5614434a43441114"
    "41484c1e421a191c1cb9e3e3bae5e7b1"
    "b6ecbfe8b2bdbabbeba6f3a1f1a4a4a0"
    "f4aca0f9ffa5a9a8ad94c7979791c695"
)

correct_input = bytes(
    c ^ ((i + 0x67) & 0xff)
    for i, c in enumerate(cmptable)
)

print(correct_input.decode())
print(f"hacktheon2026{{{correct_input.decode()}}}")
```

플래그: `hacktheon2026{22c34e819d2800db605d9fdbc9ba9ab71d6b3b016c49cd94624f545c3}`
