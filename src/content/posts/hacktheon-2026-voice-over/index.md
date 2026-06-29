---
title: "Hacktheon Sejong 2026 Quals Voice Over Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals Voice Over 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "AI"]
draft: false
listed: false
---

# Voice Over

### Summary

서버는 업로드한 wav에서 text similarity와 speaker similarity를 함께 본다. target 문장은 TTS로 맞추고 reference 음성은 reverse한 뒤 낮은 볼륨으로 뒤에 붙여 speaker embedding만 보태는 방식으로 두 threshold를 넘겼다.

### Analysis

검증 기준은 두 값이다.

```text
text_similarity    >= 0.8
speaker_similarity >= 0.8
```

일반 TTS로 target sentence를 합성하면 text similarity는 충분하지만 speaker similarity가 낮다. 반대로 reference wav를 그대로 넣으면 speaker similarity는 높아도 transcript가 달라 text similarity가 떨어진다.

그래서 reference 음성을 ASR에는 의미 없는 소리처럼 만들고 speaker embedding에는 화자 특징이 남도록 처리했다. reference wav를 reverse한 뒤 낮은 볼륨으로 target TTS 뒤에 붙이면 앞쪽 TTS 때문에 ASR은 목표 문장을 주로 인식한다. 뒤쪽 reverse reference는 transcript에는 크게 섞이지 않지만 speaker verification에는 영향을 준다.

`sample_003` reverse 기준으로 볼륨은 `0.12` 정도가 적당했다. 너무 낮으면 speaker similarity가 부족하고 너무 높으면 ASR transcript가 오염된다. 성공한 제출에서는 speaker similarity `0.8026`, text similarity `0.8859`가 나왔다.

### Solver

```bash
curl -sS http://3.37.31.209:8000/api/challenge > challenge.json
target=$(jq -r .target_sentence challenge.json)
token=$(jq -r .token challenge.json)

espeak-ng -v en-us -s 135 -w tts.wav "$target"
ffmpeg -y -loglevel error -i tts.wav -ar 16000 -ac 1 tts_16k.wav

ffmpeg -y -loglevel error -i sample_003.wav -af areverse sample_003_rev.wav
ffmpeg -y -loglevel error -i sample_003_rev.wav -filter:a "volume=0.12" ref.wav

printf "file '%s'\nfile '%s'\n" "$PWD/tts_16k.wav" "$PWD/ref.wav" > concat.txt
ffmpeg -y -loglevel error -f concat -safe 0 -i concat.txt -c copy submit.wav

curl -sS -F audio=@submit.wav -F token="$token" \
  http://3.37.31.209:8000/api/verify | jq .
```

### Flag

`hacktheon2026{b7d30e21e4106a6ca4d451a218f15a97}`
