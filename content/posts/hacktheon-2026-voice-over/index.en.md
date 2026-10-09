---
title: "Hacktheon Sejong 2026 Quals Voice Over Writeup"
description: "Hacktheon Sejong 2026 Quals Voice Over writeup"
---

# Voice Over

### Summary

The server scores an uploaded wav on both text similarity and speaker similarity. I matched the target sentence with TTS, then reversed the reference voice and appended it at low volume so it only contributed to the speaker embedding. That got both scores over the threshold.

### Analysis

The check uses two values.

```text
text_similarity    >= 0.8
speaker_similarity >= 0.8
```

Synthesizing the target sentence with plain TTS gives enough text similarity but low speaker similarity. Submitting the reference wav as-is gives high speaker similarity, but the transcript differs, so text similarity drops.

So I made the reference voice sound meaningless to ASR while keeping its speaker characteristics for the speaker embedding. With the reversed reference wav appended at low volume after the target TTS, ASR mostly recognizes the target sentence from the TTS at the front. The reversed reference at the end barely leaks into the transcript but still affects speaker verification.

With `sample_003` reversed, a volume of about `0.12` worked well. Too low and speaker similarity falls short; too high and the ASR transcript gets polluted. The successful submission scored speaker similarity `0.8026` and text similarity `0.8859`.

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
