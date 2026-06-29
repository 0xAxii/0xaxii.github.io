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

### Summary

`client` 바이너리는 실제 검증 코드를 품고 있지 않았다. 서버가 보내는 stage를 RWX `mmap`에 올려 실행하고 반환값만 다시 보내는 loader에 가깝다. 그래서 stage를 전부 실행하지 않고도 protocol을 따라가며 PNG 조각을 모을 수 있었다.

### Analysis

loader가 하는 일은 짧다.

```c
read(sock, &len, 4);
buf = mmap(..., PROT_READ | PROT_WRITE | PROT_EXEC, ...);
read(sock, buf, len);
ret = ((uint64_t (*)())buf)();
send(sock, &ret, 8);
```

stage마다 decrypt stub은 조금씩 달랐다. 8-byte XOR, cumulative add 후 XOR, NOT/pair swap 같은 변형을 패턴으로 나눠 body를 복호화했다.

처음에는 stage를 그대로 실행해 통과하려고 했다. 그런데 서버는 stage의 반환값만 받는다. 검증 코드를 실제로 돌리지 않아도 맞는 ret 값을 보내면 다음 stage를 계속 받을 수 있었다.

복호화된 stage 대부분은 `flag.png`의 특정 구간을 검증한다. stage마다 필요한 값은 세 개뿐이다.

```text
file offset
length
expected bytes
```

이 값을 빈 PNG에 계속 덮어썼다.

```python
with open("flag_recovered.png", "r+b") as f:
    f.seek(fileoff)
    f.write(expected)
```

stage를 끝까지 모으자 gap이 사라졌다.

```text
known 9193720 of 9193720
gaps 0 []
```

복원된 이미지는 아래와 같다.

![Brain Outside recovered flag](../hacktheon-2026-writeup/flag_recovered.png)

### Flag

`hacktheon2026{90364e95eddf0fc1d5f54662d8e80913}`
