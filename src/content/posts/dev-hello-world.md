---
title: "[개발] 블로그 개발 환경 구축기"
published: 2026-04-05
description: "Astro + Fuwari 템플릿을 활용한 GitHub Pages 블로그 구축 과정을 정리합니다."
tags: ["Astro", "GitHub Pages", "블로그"]
category: "개발"
draft: false
---

## 블로그를 만들게 된 계기

보안 공부와 개발 과정에서 배운 것들을 체계적으로 기록하기 위해 기술 블로그를 개설했습니다.

## 기술 스택

- **프레임워크**: Astro
- **템플릿**: Fuwari
- **배포**: GitHub Pages
- **스타일링**: Tailwind CSS

## 구축 과정

### 1. Fuwari 템플릿 클론

```bash
git clone https://github.com/saicaca/fuwari.git blog
cd blog
pnpm install
```

### 2. 설정 커스터마이징

`src/config.ts`에서 블로그 제목, 프로필, 네비게이션 등을 수정했습니다.

### 3. 카테고리 구성

보안과 개발 활동에 맞춰 6개 카테고리로 구성했습니다:

- **개발**: 프로그래밍, 도구, 환경 설정
- **CTF/Wargame**: CTF 대회 Write-up, 워게임 풀이
- **BugBounty**: 버그바운티 활동 기록
- **블로그/기술문서**: 기술 문서 번역, 정리
- **논문/컨퍼런스**: 보안 논문 리뷰, 컨퍼런스 참관기
- **공모전/자격증**: 공모전 참가기, 자격증 준비

### 4. GitHub Pages 배포

GitHub Actions를 활용하여 자동 배포를 설정했습니다.

## 마무리

앞으로 꾸준히 글을 작성하며 성장 과정을 기록해 나가겠습니다.
