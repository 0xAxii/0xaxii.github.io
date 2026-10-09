# 0xaxii.github.io

Axii의 개인 페이지와 블로그입니다. 프레임워크 없이 Node 스크립트로 정적 사이트를 생성하고, GitHub Pages에 배포합니다.

## 명령어

```sh
pnpm install
pnpm dev                      # http://localhost:4321 — 저장하면 다시 빌드하고 새로고침
pnpm dev --drafts             # 초안(draft: true) 글까지 미리보기
pnpm build                    # dist/ 에 배포용 빌드 (draft 제외, 검색 인덱스 생성)
pnpm preview                  # dist/ 를 그대로 서빙
pnpm new-post <slug> "제목"   # content/posts/<slug>/index.md 생성 (draft: true)
```

`main` 브랜치에 push하면 `.github/workflows/deploy.yml`이 빌드해서 배포합니다.

## 구조

```
content/
  profile.yml            메인 페이지(/)의 프로필·소속·대회 기록
  posts/<slug>/
    index.md             한국어 글 (frontmatter 포함)
    index.en.md          영어 번역 (frontmatter는 title, description만)
    *.png                글에서 상대 경로로 쓰는 이미지
static/                  그대로 복사되는 파일 (favicon, og-image, avatar 등)
assets/                  style.css, main.js (클라이언트 코드)
lib/
  content.js             글 로딩, frontmatter 파싱
  markdown.js            markdown-it + Shiki + KaTeX, 헤딩 앵커와 목차
  templates.js           모든 페이지의 HTML 템플릿
  html.js                escape, 아이콘, 날짜, 한/영 헬퍼
scripts/
  build.js               전체 빌드
  dev.js                 개발 서버 (watch + live reload)
site.config.js           사이트 제목, 메뉴, 카테고리/태그 영어 이름
```

## 글 frontmatter

```yaml
---
title: "Ethernaut 22 Dex"
published: 2026-05-07
updated: 2026-05-10        # 선택
description: "Ethernaut 22 Dex 문제 풀이."
category: "CTF/Wargame"
tags: ["Web3", "Ethernaut", "Writeup"]
draft: false               # true면 배포 빌드에서 제외
listed: false              # false면 목록에는 안 나오고 링크로만 접근 (시리즈 하위 글)
---
```

`listed: false`인 글은, 그 글을 링크하는 목록 글(예: `ethernaut-writeups`)의 하위 글로 묶입니다. 상단의 "뒤로" 링크와 이전/다음 글 버튼이 목록 글에 적힌 순서대로 연결됩니다.

## 한/영 전환

언어는 라이트/다크 테마처럼 헤더의 KR/EN 버튼으로 바꾸는 전역 설정입니다. 선택한 값은 브라우저에 저장되고, 첫 방문 때는 브라우저 언어를 따릅니다. 모든 페이지가 두 언어를 함께 담고 있어서 새로고침 없이 바로 전환됩니다.

- **글:** `index.en.md`가 있으면 영어 버전으로 사용합니다. 없으면 두 언어 모두 한국어 본문을 보여 줍니다.
- **이력 (`profile.yml`):** 값을 `{ ko: "...", en: "..." }`로 적으면 언어별로 표시됩니다. 대회 결과는 `"3위 / 27팀"` 형식으로 적으면 영어 표기(`3rd / 27 teams`)와 순위 배지가 자동으로 만들어집니다.
- **카테고리/태그:** 한국어 이름의 영어 표기는 `site.config.js`의 `terms`에 추가합니다.
