---
title: "Hacktheon Sejong 2026 Quals Brain Outside Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals Brain Outside 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "Reversing"]
draft: false
listed: false
---

# Brain Outside

실제 코드는 바이너리 안에 없었다.
`client`는 서버에서 stage를 받아 RWX `mmap`에 올린 뒤 바로 호출하는 loader다.

loader 동작은 이렇다.

```c
read(sock, &len, 4);
buf = mmap(..., PROT_READ | PROT_WRITE | PROT_EXEC, ...);
read(sock, buf, len);
ret = ((uint64_t (*)())buf)();
send(sock, &ret, 8);
```

stage마다 decrypt stub이 달랐다.
8-byte XOR, cumulative add 후 XOR, NOT/pair swap 같은 변형이 반복됐다.
stub을 패턴화해 body를 복호화했다.

처음에는 stage를 그대로 실행해 통과하려고 했다.
그런데 프로토콜은 단순했다.
서버는 stage 반환값만 받는다.
검증 코드를 실행하지 않아도 통과한 것처럼 ret 값을 보내며 다음 stage를 계속 받을 수 있다.

복호화된 stage 대부분은 `flag.png`의 특정 구간을 검증한다.
각 stage에서 세 값만 뽑으면 됐다.

```text
file offset
length
expected bytes
```

이 값들을 빈 PNG에 계속 덮어썼다.

```python
with open("flag_recovered.png", "r+b") as f:
    f.seek(fileoff)
    f.write(expected)
```

stage를 계속 모으니 gap이 사라졌다.

```text
known 9193720 of 9193720
gaps 0 []
```

복원된 이미지는 아래와 같다.

![Brain Outside recovered flag](../hacktheon-2026-writeup/flag_recovered.png)

플래그: `hacktheon2026{90364e95eddf0fc1d5f54662d8e80913}`
