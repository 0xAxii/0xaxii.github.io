---
title: "[CTF] CTF 입문 가이드"
published: 2026-04-04
description: "CTF(Capture The Flag) 대회의 개념과 주요 분야, 시작 방법을 정리합니다."
tags: ["CTF", "보안", "Wargame", "입문"]
category: "CTF/Wargame"
draft: false
---

## CTF란?

CTF(Capture The Flag)는 정보보안 분야의 해킹 대회로, 주어진 문제를 풀어 플래그(Flag)를 찾는 방식으로 진행됩니다.

## 주요 분야

### Web Exploitation
웹 애플리케이션의 취약점을 찾아 공격하는 분야입니다.
- SQL Injection
- XSS (Cross-Site Scripting)
- SSRF (Server-Side Request Forgery)
- Command Injection

### Pwnable (Binary Exploitation)
바이너리 프로그램의 취약점을 분석하고 익스플로잇하는 분야입니다.
- Buffer Overflow
- Format String Bug
- Use-After-Free
- ROP (Return-Oriented Programming)

### Reversing
실행 파일을 분석하여 동작 원리를 파악하는 분야입니다.
- 정적 분석 (IDA, Ghidra)
- 동적 분석 (GDB, x64dbg)
- 안티 디버깅 우회

### Cryptography
암호학적 취약점을 분석하고 암호를 해독하는 분야입니다.
- RSA 공격
- AES 관련 공격
- Hash 충돌

### Forensics
디지털 포렌식 기법을 활용하여 증거를 분석하는 분야입니다.
- 메모리 포렌식
- 네트워크 패킷 분석
- 파일 시스템 분석

## 추천 워게임 사이트

| 사이트 | 특징 |
|--------|------|
| pwnable.kr | 시스템 해킹 입문 |
| webhacking.kr | 웹 해킹 입문 |
| dreamhack.io | 종합 보안 교육 |
| HackTheBox | 실전형 침투 테스트 |

## 시작하기

1. 기본적인 리눅스 명령어와 프로그래밍 언어(Python, C)를 익힙니다
2. 워게임 사이트에서 쉬운 문제부터 풀어봅니다
3. CTF 대회에 참가하여 실전 경험을 쌓습니다
4. Write-up을 작성하며 풀이 과정을 정리합니다
