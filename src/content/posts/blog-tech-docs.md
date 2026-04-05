---
title: "[기술문서] OWASP Top 10 2021 핵심 정리"
published: 2026-04-02
description: "OWASP Top 10 2021 버전의 주요 웹 애플리케이션 보안 위협을 정리합니다."
tags: ["OWASP", "보안", "웹보안", "기술문서"]
category: "블로그/기술문서"
draft: false
---

## OWASP Top 10이란?

OWASP(Open Web Application Security Project)에서 발표하는 가장 심각한 웹 애플리케이션 보안 위협 10가지입니다.

## 2021 버전 주요 항목

### A01: Broken Access Control
접근 제어 실패는 가장 흔한 보안 위협입니다.

**예시:**
- 다른 사용자의 계정 정보 접근
- 관리자 기능 무단 사용
- API 접근 제어 미흡

### A02: Cryptographic Failures
암호화 관련 실패로 민감한 데이터가 노출되는 경우입니다.

**체크포인트:**
- 전송 구간 암호화(TLS) 적용 여부
- 저장 데이터 암호화 여부
- 취약한 암호 알고리즘 사용 여부

### A03: Injection
SQL, NoSQL, OS 명령어 등의 인젝션 공격입니다.

```sql
-- 취약한 쿼리 예시
SELECT * FROM users WHERE id = '{user_input}';
```

### A04: Insecure Design
설계 단계에서의 보안 결함입니다.

### A05: Security Misconfiguration
보안 설정 오류로 인한 취약점입니다.

### A06: Vulnerable and Outdated Components
알려진 취약점이 있는 라이브러리/프레임워크 사용입니다.

### A07: Identification and Authentication Failures
인증 및 식별 관련 취약점입니다.

### A08: Software and Data Integrity Failures
소프트웨어 업데이트, CI/CD 파이프라인 등의 무결성 검증 실패입니다.

### A09: Security Logging and Monitoring Failures
보안 로깅 및 모니터링 부재입니다.

### A10: Server-Side Request Forgery (SSRF)
서버 측에서 의도하지 않은 요청을 보내게 하는 공격입니다.

## 참고 자료

- OWASP 공식 사이트
- OWASP Testing Guide
- OWASP Cheat Sheet Series
