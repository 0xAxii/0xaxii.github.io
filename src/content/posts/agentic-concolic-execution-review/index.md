---
title: "Agentic Concolic Execution 논문 리뷰"
published: 2026-05-13
description: "LLM agent를 concolic execution의 실행 기록, 분기 선택, constraint 요약, 도구 호출, 검증 루프에 넣은 CONCOLLMIC 논문을 정리했다."
category: "블로그/기술문서"
tags: ["논문리뷰", "LLM", "Security", "Fuzzing"]
---

| 항목 | 내용 |
| --- | --- |
| 논문 제목 | Agentic Concolic Execution |
| 저자 | Zhengxiong Luo, Huan Zhao, Dylan Wolff, Cristian Cadar, Abhik Roychoudhury |
| 학회명 | IEEE Symposium on Security and Privacy, S&P 2026 |

## 0. 한 줄 요약

기존 concolic execution이 라이브러리, 런타임, 환경 조건, 복잡한 constraint에서 막히는 지점을 LLM agent와 실제 실행 검증 루프로 우회해 보려는 논문이다.

LLM에게 "버그 찾아줘"라고 맡기는 논문이라기보다, 실행 기록을 읽고 어떤 분기를 열지 고른 뒤, 그 분기에 닿기 위한 입력, 환경 조작, 검증 절차를 도구 루프로 묶은 시스템 논문에 가깝다.

## 1. 논문을 고른 이유

이 논문을 고른 이유는 LLM을 보안 분석에 쓰는 방식이 단순한 코드 요약이나 취약점 질의가 아니었기 때문이다.

요즘 내가 관심 있는 하네스 엔지니어링도 이쪽과 맞닿아 있다. 내가 말하는 하네스는 단순히 fuzz target 코드 하나가 아니라, LLM이 특정 작업을 잘 수행하도록 프롬프트, 도구 호출, 실행 환경, 피드백, 검증 루프를 묶어 둔 작업 틀에 가깝다. Google OSS-Fuzz 쪽에서도 Fuzz Introspector로 덜 퍼징된 함수를 찾고, LLM이 fuzz target을 만들고, 빌드/런타임 피드백으로 고치는 흐름을 보여준다. 내가 흥미롭게 본 지점도 결국 LLM을 혼자 두지 않고 작업 환경을 설계한다는 점이다.

이 논문도 같은 문제의식을 공유한다고 봤다. 좋은 입력 하나를 찍어내는 것보다, LLM이 실행 기록을 보고 도구를 호출하고 실패를 되먹임받게 만드는 구조가 더 중요할 수 있다는 점이 흥미로웠다.

## 2. 문제 정의

concolic execution은 실제 실행과 symbolic reasoning을 같이 쓴다. 간단한 코드에서는 실행 경로의 조건을 모으고, 그중 하나를 뒤집어 새 입력을 만들면 된다. 예를 들어 `if (x > 10)`에서 false 쪽으로 갔다면, 다음에는 `x > 10`을 만족하는 입력을 만들어 true 쪽을 열어 보는 식이다.

문제는 실제 프로그램에 들어가면 이 흐름이 바로 복잡해진다는 것이다.

- `atof`, `memcpy`, floating-point 연산처럼 라이브러리와 런타임에 기대는 동작이 많다.
- 파일, 네트워크, CLI 인자, 환경 변수도 실행 경로를 바꾼다.
- 이런 동작을 전부 SMT 식으로 모델링하려면 언어와 환경마다 모델을 따로 만들어야 한다.
- 모델을 만들더라도 조건식이 커지면 solver가 감당하기 어렵다.

논문에서는 앞의 문제를 C1: symbolic modeling, 뒤의 문제를 C2: constraint solving으로 둔다.

내가 보기엔 이 논문의 출발점은 "LLM이 더 똑똑한 solver인가?"가 아니라 오히려 "사람이 코드 의미를 읽고 조건을 줄여 쓰듯이, LLM이 constraint를 더 다루기 쉬운 형태로 바꿀 수 있는가?"가 맞다.

## 3. 핵심 아이디어

CONCOLLMIC은 LLM을 solver 자리에 그대로 놓지 않는다.

LLM은 실행 기록을 읽고, 아직 못 간 분기를 고르고, 그 분기를 열기 위한 조건을 정리한다. 조건은 꼭 낮은 수준의 SMT 식일 필요가 없다. 어떤 경우에는 자연어가 더 낫고, 어떤 경우에는 Python 코드나 Z3 식이 더 낫다.

예를 들어 사람이 보기에는 "두 float 사이에 표현 가능한 값이 20개 이하"만 알면 되는 상황이 있다. 기존 도구는 그 과정에 있는 `atof`, `memcpy`, type casting, 반복문을 모두 식으로 바꾸려다 막힌다. CONCOLLMIC은 이런 조건을 더 높은 의미 단위로 요약하고, 실제 계산은 Python이나 Z3 같은 도구에 넘긴다.

중요한 건 마지막에 실제 실행으로 확인한다는 점이다. LLM이 그럴듯한 조건을 만들어도 목표 줄에 도달하지 못하면 실패로 처리한다. 이 검증 루프가 없었다면 그냥 코드 설명을 잘하는 에이전트에 가까웠을 것이다.

## 4. 방법론 / 시스템 설명

전체 흐름은 아래처럼 보면 된다.

![](./workflow.png)

첫 단계는 소스 코드 계측이다. LLM이 조건문이나 반복문 같은 제어 흐름 단위에 로그를 넣고, 각 코드 블록이 실제 소스의 어느 줄에 해당하는지 매핑을 만든다.

그다음 프로그램을 초기 입력으로 실행한다. 실행 로그에서 함수 호출 흐름, 실행된 파일, 아직 실행되지 않은 코드 블록 같은 정보를 추려 execution abstraction을 만든다.

Summarization Agent는 이 정보를 보고 다음에 열어볼 분기를 고른다. Solving Agent는 그 분기에 도달하기 위한 입력이나 환경 조작 방법을 만든다. 여기서 Python 실행, Z3 호출, 코드 요청 같은 도구를 조합한다.

이 구조에서 하네스 엔지니어링이 중요해진다. LLM이 단순히 답을 생성하는 게 아니라, 실행 환경을 보고, 필요한 도구를 고르고, 실패하면 다시 시도하도록 미리 작업 틀을 만들어 두는 방식이기 때문이다.

## 5. 평가 및 결과 해석

| 평가 대상 | 결과 |
| --- | --- |
| 8개 C/C++ 프로그램 | KLEE 대비 233%, KLEE-Pending 대비 135%, SymCC 대비 130%, SymSan 대비 115% 더 높은 분기 커버리지 |
| AFL++ 비교 | 평균 81% 높은 커버리지 |
| 다중 언어 프로그램 | ultrajson 3.5배, jansi 8.2배, py4j 1.9배, protobuf-go 1.9배 coverage 증가 |
| FP-Bench | KLEE-Float보다 20%, 일반 KLEE보다 107% 높은 커버리지 |
| 버그 탐지 | 11개 신규 버그 발견, 9개는 확인 또는 수정, libsoup 버그는 CVE-2025-4945 |

숫자만 보면 CONCOLLMIC이 KLEE나 AFL++보다 낫다는 이야기로 끝나기 쉬워보인다. 그런데 그렇게만 보면 오해가 생길 수 있다. KLEE류 도구는 잘 정의된 symbolic model과 solver가 강한 영역에서 장점이 있다. 반대로 CONCOLLMIC은 라이브러리 호출, 환경 변수, CLI 인자, 네트워크 입력처럼 모델링하기 까다로운 영역에서 강점을 보인다.

그래서 이 결과는 "LLM이 solver를 대체했다"기보다는, 기존 concolic execution이 낮은 수준의 모델링 때문에 막히는 지점에서 LLM agent가 semantic bridge 역할을 할 수 있다는 쪽으로 읽는 게 맞아 보인다.

특히 libsoup 버그가 CVE로 이어진 점이 중요하다. 커버리지 숫자만 올린 게 아니라 실제 버그로 이어지는 경로까지 건드렸고, cutoff와 관련없이 모델 학습 이후에 발견한 것이므로 모델의 학습을 통해 나온 결과가 아니라는 점을 볼 수 있다.

## 6. 인상 깊었던 사례: `bc`의 malloc 실패 경로

`bc` 사례가 제일 인상적이었다. 일반적인 테스트에서는 `malloc`이 거의 실패하지 않기 때문에, 메모리 할당 실패를 처리하는 분기는 잘 열리지 않는다.

CONCOLLMIC은 여기서 단순히 입력 파일을 바꾸지 않았다.

- 목표: `malloc` 실패 분기 도달
- 조건: `bc_malloc` 안에서 `malloc(size)`이 `NULL`을 반환해야 함
- 방법: custom malloc wrapper 작성
- 실행: `LD_PRELOAD`로 표준 `malloc` 가로채기
- 결과: 평소에는 닿기 어려운 에러 처리 경로 실행

## 7. 한계점

먼저 비용이 크다. 논문 기준으로 테스트 입력 하나를 만드는 데 평균 69초, 0.21달러가 든다. 이 방식은 퍼저처럼 수백만 입력을 던지는 구조와는 맞지 않는다.

현실적인 사용법은 따로 있을 것 같다. 기존 퍼저나 DSE가 막힌 지점에서 비싼 입력 몇 개를 정교하게 만드는 보조 도구로 쓰는 방식이다.

LLM이 만드는 조건도 틀릴 수 있다. CONCOLLMIC은 실행 기록 grounding, 도구 호출, 실제 실행 검증으로 틀린 출력을 걸러내지만, 정확성을 수학적으로 보장하지는 않는다. 그래서 검증 도구라기보다는 버그 탐지 도구로 보는 게 맞다.

부록의 ablation도 중요하다. LLM 기반 test input scheduling은 DFS나 random보다 통계적으로 유의미하게 좋지 않았다. 즉 성능의 핵심은 "LLM이 다음 목표를 기가 막히게 고른다"가 아니라, constraint summarization, solving, 환경 조작 쪽에 더 가까워 보인다.

실패 사례 분석도 비슷한 이야기를 한다. oggenc 실패 50개를 보면, 큰 비중은 애초에 도달 불가능한 경로를 고른 경우와 목표에 닿기 전에 프로그램이 먼저 크래시한 경우였다. Summarization Agent의 오류도 있었지만, 전체 실패를 단순히 "LLM 환각"으로만 설명하기는 어렵다.

논문 meta-review에서도 평가 프로그램 규모, high-level semantic reasoning과 low-level precision 사이의 trade-off, LLM 비결정성으로 인한 재현성 문제가 지적됐다. 가능성은 크지만, 아직 안정적인 산업용 도구라고 보기는 어렵다.

## 8. 느낀 점

읽고 나서 가장 크게 남은 건 LLM이 작업을 하게 만드는 틀을 설계하는 방식이다.

CONCOLLMIC은 LLM에게 버그를 찾아달라고만 시키지 않는다. 어떤 환경을 만들어야 특정 분기에 도달하는지 생각하게 하고, 그걸 실제 실행으로 확인한다.

요즘 LLM 기반 보안 연구도 점점 이 방향으로 가는 것 같다. 모델에게 최종 판단을 맡기는 것보다, 모델을 실행 가능한 중간 산출물을 만드는 데 쓰고, 그 산출물을 빌드/실행/커버리지/크래시로 검증한다.

하네스 엔지니어링이 중요해지는 이유도 여기에 있다고 느꼈다. 좋은 모델 하나보다, 모델이 어떤 정보를 보고 어떤 도구를 쓰고 어떤 기준으로 실패를 고치는지가 더 큰 차이를 만들 수 있다. LLM은 이 수작업을 줄일 수 있지만, 검증 루프 없이 믿고 쓰기에는 아직 위험하다.

## 9. 앞으로 해볼 것

직접 적용한다면 처음부터 전체 DeFi 프로토콜을 대상으로 삼기보다, 하나의 공개된 bug bounty scope 안에서 "특정 상태가 되어야만 실행되는 분기"를 하나 고르는 게 좋을 것 같다.

예를 들면 이런 상태를 목표로 잡을 수 있다.

- 가격 oracle 값이 특정 범위에 있을 때
- 권한 상태가 바뀐 직후
- pool reserve가 비정상적인 비율이 되었을 때
- liquidation 조건이 거의 경계값에 걸렸을 때
- 여러 transaction이 특정 순서로 실행되어야 할 때

그다음 CONCOLLMIC식으로 실행 로그를 남기고, 목표 분기를 고르고, 그 분기에 도달하기 위한 transaction sequence나 fork 환경을 LLM이 조합하게 한다.

처음부터 버그를 찾겠다를 목표로 잡으면 실험이 너무 커지니까 성공 기준은 작게 잡는 게 나아 보인다. 예를 들어 기존 퍼저가 못 닿던 `require` 이후 분기에 도달했다거나, 특정 revert 조건을 통과하는 transaction sequence를 만들었다는 정도면 충분히 첫 실험이 될 수 있다.

web3에서는 입력 하나보다 호출 순서와 상태가 더 중요하기도 해서 `LD_PRELOAD`로 `malloc` 실패를 만드는 사례가 크게 와닿았다. 스마트컨트랙트에서도 결국 중요한 건 특정 상태를 일부러 만드는 일이고, LLM이 그 상태에 도달하는 실험을 잘 수행하도록 컨텍스트, 도구, 실행 환경, 검증 기준을 묶어 주는 게 하네스 엔지니어링의 좋은 예시로 봤다.

## 마무리

CONCOLLMIC은 concolic execution을 LLM으로 단순히 다시 포장한 논문이라기보다, 기존 도구가 막히는 지점에 LLM agent를 끼워 넣은 연구에 가깝다.

핵심은 LLM에게 "버그를 찾아라"라고 맡기는 것이 아니라 실행 기록, 목표 분기, 도구 호출, 환경 조작, 실패 피드백, 실제 실행 검증을 하나의 작업 틀로 묶어서 LLM이 특정 분석 작업을 반복적으로 수행하게 만든다는 점이 더 중요하다.

계속 돌려놓는 fuzzer처럼 쓰기에는 비용과 속도가 부담스럽다. 더 현실적인 활용 방식은 기존 퍼저나 symbolic execution이 막힌 지점에서, LLM이 도구와 검증 루프 안에서 비싼 시도를 몇 번 더 해보게 만드는 보조 시스템으로 쓰는 것이다.

## 참고한 자료

- [Agentic Concolic Execution 논문 PDF](https://fouzhe.github.io/publications/paper/SP26-ConcoLLMic.pdf)
- [OSS-Fuzz: Fuzz target generation using LLMs](https://google.github.io/oss-fuzz/research/llms/target_generation/)
- [Google Security Blog: AI-Powered Fuzzing](https://security.googleblog.com/2023/08/ai-powered-fuzzing-breaking-bug-hunting.html)
- [Google Security Blog: Leveling Up Fuzzing](https://security.googleblog.com/2024/11/leveling-up-fuzzing-finding-more.html)
