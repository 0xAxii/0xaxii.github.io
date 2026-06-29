---
title: "Hacktheon Sejong 2026 Quals plottergeist Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals plottergeist 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "Misc"]
draft: false
listed: false
---

# plottergeist

### Summary

`plottergeist.pcap`에는 plotter motion이 있고 `bench_mic.wav`에는 같은 세션의 소리가 있었다. CoreXY 이동량으로 좌표를 복원한 뒤, wav의 motion 구간 에너지와 첫 이동의 의미를 같이 봐서 `DT=4`를 pen down으로 확정했다.

### Analysis

패킷 안에는 format 힌트가 들어 있다.

```text
FMT:OP|SQ|DT|AM|BM
```

CoreXY 구조라 모터 이동량은 좌표로 바뀐다.

```text
dX = (AM + BM) / 2
dY = (AM - BM) / 2
```

좌표 범위는 `X: 16 ~ 368`, `Y: 4 ~ 10`이었다. 폭은 353, 높이는 7이다.

```text
353 = 59 * 6 - 1
```

5x7 글자에 1픽셀 공백을 붙인 텍스트라고 보면 정확히 맞는다.

남은 문제는 `DT=4`와 `DT=5` 중 어느 쪽이 pen down인지 구분하는 것이었다. wav에서 motion 구간별 고주파 에너지를 비교하면 두 타입의 소리가 갈린다. 처음에는 더 시끄러운 쪽이 pen down처럼 보였지만 첫 motion이 시작 위치로 이동하는 동작이라는 점을 같이 봐야 한다. 첫 motion은 `DT=5`이고 시작 이동에서는 잉크를 찍으면 안 된다. 따라서 `DT=5`가 pen up, `DT=4`가 pen down이다.

렌더링할 때는 `AM=BM=0`인 `DT=4` packet도 버리면 안 된다. 이동량은 없지만 현재 위치에 점 하나를 찍는 명령이다. 이를 포함해 `DT=4`만 그리면 텍스트가 나온다.

![reconstructed](../hacktheon-2026-writeup/dt4_reconstructed_points.png)

### Solver

```python
import itertools
import math
import os
import re
import struct
import heapq
import wave
from collections import defaultdict

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler


PS = open("node_modules/bwip-js/barcode.ps").read()
lines = PS.splitlines()
arr = re.findall(r"\(([0-9]{8})\)", "\n".join(lines[20201:20892]))
patstr = [arr[:2401], arr[2401:]]


def bitsdig(s):
    out = []
    c = 1
    for ch in s:
        out += [c] * int(ch)
        c ^= 1
    return np.array(out, dtype=np.int8)


symbits = [[bitsdig(s) for s in patstr[p]] for p in [0, 1]]
parity = ["1001", "0101", "1100", "0011", "1010", "0110", "1111"]
charmap = list("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-. $/+%") + ["S1", "S2", "F1", "F2", "F3", "NS"]
val = {c: i for i, c in enumerate(charmap[:43])}
combos = re.findall(r"\((..)\)", re.search(r"/code49\.combos \[(.*?)\] readonly def", PS, re.S).group(1))
charvals = {ord(c): i for i, c in enumerate(charmap[:43])}
for asc, pair in enumerate(combos):
    if pair[0] == "1":
        charvals[asc] = [43, val[pair[1]]]
    elif pair[0] == "2":
        charvals[asc] = [44, val[pair[1]]]


def enc_start(s):
    first = charvals[ord(s[0])]
    cws = [first[1]]
    for ch in s[1:]:
        cv = charvals[ord(ch)]
        cws += cv if isinstance(cv, list) else [cv]
    return cws


prefix = enc_start("hacktheon2026{")


def parse_segments():
    p = open("plottergeist.pcap", "rb").read()
    pos = 24
    base = None
    cmds = []
    while pos + 16 <= len(p):
        ts_sec, ts_usec, incl, orig = struct.unpack("<IIII", p[pos : pos + 16])
        pos += 16
        data = p[pos : pos + incl]
        pos += incl
        if len(data) >= 42 and data[12:14] == b"\x08\x00" and data[23] == 17:
            ihl = (data[14] & 15) * 4
            off = 14 + ihl
            sport, dport, ulen, cs = struct.unpack("!HHHH", data[off : off + 8])
            pl = data[off + 8 : off + ulen]
            if base is None:
                base = ts_sec + ts_usec / 1e6
            if sport == 31337 and len(pl) == 10 and pl.endswith(b"~") and pl[0] == 0xA1:
                b = pl[:-1]
                cmds.append(
                    [
                        ts_sec + ts_usec / 1e6 - base,
                        b[1],
                        int.from_bytes(b[2:4], "little"),
                        b[4],
                        int.from_bytes(b[5:7], "big", signed=True),
                        int.from_bytes(b[7:9], "big", signed=True),
                    ]
                )
    segs = []
    x = y = 0
    ymap = {8: 0, 10: 1, 12: 2, 14: 3, 16: 4, 18: 5, 20: 6}
    for idx, c in enumerate(cmds):
        dx = c[4] + c[5]
        dy = c[4] - c[5]
        x2 = x + dx
        y2 = y + dy
        if y == y2 and dx != 0 and y in ymap:
            segs.append((idx, ymap[y], x / 2, x2 / 2, c[3], abs(dx / 2), c[0], cmds[idx + 1][0] if idx + 1 < len(cmds) else c[0] + 0.05))
        x, y = x2, y2
    return segs


segs = parse_segments()
bounds = []
for r in range(7):
    ss = [s for s in segs if s[1] == r]
    bounds.append((min(min(s[2], s[3]) for s in ss), max(max(s[2], s[3]) for s in ss)))


def code_row_bits(row, ccs):
    pstr = parity[row] if row < 6 else "0000"
    b = [0] * 10 + [1, 0]
    for j in range(4):
        b += list(symbits[int(pstr[j])][ccs[2 * j] * 49 + ccs[2 * j + 1]])
    b += [1] * 4 + [0]
    return np.array(b, dtype=np.int8)


def ccs7(cw):
    return cw + [sum(cw) % 49]


CODEMAP = list(reversed(range(7))) if os.environ.get("VFLIP") == "1" else list(range(7))
XFLIP = os.environ.get("HFLIP") == "1"


def obs_bits(code_row, ccs):
    b = code_row_bits(code_row, ccs)
    return b[::-1] if XFLIP else b


known = {CODEMAP[r]: obs_bits(r, ccs7(prefix[7 * r : 7 * r + 7])) for r in range(3)}
w = wave.open("bench_mic.wav", "rb")
fs = w.getframerate()
sig = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(float)
sig -= sig.mean()
sig /= 32768
bands = [(0, 180), (180, 400), (400, 800), (800, 1200), (1200, 1700), (1700, 2400), (2400, 3300), (3300, 3900)]


def raw(off):
    X = []
    for s in segs:
        a = max(0, int((s[6] + off + 0.006) * fs))
        b = min(len(sig), int((s[7] + off - 0.006) * fs))
        ss = sig[a:b]
        spec = np.abs(np.fft.rfft(ss * np.hanning(len(ss)))) ** 2
        freqs = np.fft.rfftfreq(len(ss), 1 / fs)
        tot = spec.sum() + 1e-30
        vals = [np.sqrt(np.mean(ss * ss)), np.mean(abs(ss)), np.max(abs(ss)), (freqs * spec).sum() / tot]
        vals += [spec[(freqs >= lo) & (freqs < hi)].sum() / tot for lo, hi in bands]
        vals += [math.exp(np.mean(np.log(spec + 1e-30))) / (np.mean(spec) + 1e-30), ((ss[:-1] * ss[1:]) < 0).mean()]
        X.append(vals)
    return np.array(X)


Xs = []
for off in [-0.025, -0.02, -0.015, -0.01, -0.005, 0, 0.005, 0.01]:
    X = raw(off)
    R = []
    for col in range(X.shape[1]):
        vals = X[:, col]
        groups = defaultdict(list)
        for v, s in zip(vals, segs):
            groups[(s[1], s[4])].append(v)
        R.append([v - np.median(groups[(s[1], s[4])]) for v, s in zip(vals, segs)])
    Xs.append(np.hstack([X, np.array(R).T]))
Xall = np.hstack(Xs)
idx = []
lab = []
for n, s in enumerate(segs):
    if s[1] in known:
        r = s[1]
        lo, hi = bounds[r]
        x0, x1 = sorted([s[2], s[3]])
        m0 = (x0 - lo) / (hi - lo) * 81
        m1 = (x1 - lo) / (hi - lo) * 81
        num = den = 0
        for k in range(81):
            ov = max(0, min(m1, k + 1) - max(m0, k))
            if ov:
                num += ov * known[r][k]
                den += ov
        f = num / den
        if f > 0.85 or f < 0.15:
            idx.append(n)
            lab.append(1 if f > 0.85 else 0)
if os.environ.get("SIMPLE") == "1":
    simple = raw(float(os.environ.get("SOFF", "-0.02")))[:, int(os.environ.get("SCOL", "8"))]
    groups = defaultdict(list)
    for v, s in zip(simple, segs):
        groups[(s[1], s[4])].append(v)
    pred = np.array([v - np.median(groups[(s[1], s[4])]) for v, s in zip(simple, segs)])
else:
    clf = make_pipeline(StandardScaler(), LogisticRegression(C=0.2, max_iter=2000, class_weight="balanced")).fit(Xall[idx], lab)
    pred = clf.decision_function(Xall)
vals = (pred - np.median(pred)) / (np.std(pred) + 1e-9)
E = np.zeros((7, 81))
W = np.zeros((7, 81))
for v, s in zip(vals, segs):
    r = s[1]
    lo, hi = bounds[r]
    x0, x1 = sorted([s[2], s[3]])
    m0 = (x0 - lo) / (hi - lo) * 81
    m1 = (x1 - lo) / (hi - lo) * 81
    for k in range(max(0, int(m0) - 1), min(81, int(m1) + 2)):
        ov = max(0, min(m1, k + 1) - max(m0, k))
        if ov:
            E[r, k] += v * ov
            W[r, k] += ov
E = np.divide(E, W, out=np.zeros_like(E), where=W > 0)

cache = {}


def score_row(r, ccs):
    plot_r = CODEMAP[r]
    key = (r, tuple(ccs))
    if key not in cache:
        cache[key] = float(np.dot(E[plot_r], 2 * obs_bits(r, ccs) - 1))
    return cache[key]


basew = [1, 9, 31, 26, 2, 12, 17, 23, 37, 18, 22, 6, 27, 44, 15, 43, 39, 11, 13, 5, 41, 33, 36, 8, 4, 32, 3, 19, 40, 25, 29, 10, 24, 30]
wx = [20] + basew[:32]
wy = [16] + basew[1:33]
wz = [38] + basew[2:34]


def lastrow(cws):
    c = []
    for r in range(6):
        c += ccs7(cws[7 * r : 7 * r + 7])
    cr7 = 40

    def cal(w):
        return sum((c[2 * i] * 49 + c[2 * i + 1]) * w[i + 1] for i in range(24))

    wr1 = (cr7 * wz[0] + cal(wz)) % 2401
    wr2 = (cr7 * wy[0] + cal(wy) + wr1 * wy[25]) % 2401
    wr3 = (cr7 * wx[0] + cal(wx) + wr1 * wx[25] + wr2 * wx[26]) % 2401
    lr = [wr1 // 49, wr1 % 49, wr2 // 49, wr2 % 49, wr3 // 49, wr3 % 49, cr7]
    lr.append(sum(lr) % 49)
    return lr


fixed = sum(score_row(r, ccs7(prefix[7 * r : 7 * r + 7])) for r in range(3))


def build_cws(inner):
    c = prefix[:]
    for ch in inner:
        c += [44, 36 if ch == "_" else 10 + ord(ch) - 97]
    c += [44, 41]
    if len(c) > 42:
        return None
    return c + [48] * (42 - len(c))


def sc_inner(inner):
    c = build_cws(inner)
    sc = fixed + sum(score_row(r, ccs7(c[7 * r : 7 * r + 7])) for r in range(3, 6))
    lr = lastrow(c)
    return sc + score_row(6, lr), lr


chars = [chr(97 + i) for i in range(26)] + ["_"]
K = int(os.environ.get("K", "80"))
if os.environ.get("CANDS") or os.environ.get("CANDFILE"):
    if os.environ.get("CANDFILE"):
        cand_iter = [x.strip() for x in open(os.environ["CANDFILE"]) if x.strip()]
    else:
        cand_iter = os.environ["CANDS"].split(",")
    scored = []
    for inner in cand_iter:
        if len(inner) not in (7, 8):
            continue
        sc, lr = sc_inner(inner)
        scored.append((sc, inner, tuple(lr)))
    for sc, inner, lr in sorted(scored, reverse=True)[: int(os.environ.get("TOP", "200"))]:
        print(round(sc, 3), inner, lr)
    raise SystemExit
for L in [7, 8]:
    g1 = []
    for tup in itertools.product(chars, repeat=2):
        part = "".join(tup)
        c = build_cws(part + "a" * (L - 2))
        g1.append((score_row(3, ccs7(c[21:28])), part))
    g1 = heapq.nlargest(K, g1)
    g2 = []
    for tup in itertools.product(chars, repeat=4):
        mid = "".join(tup)
        dummy = "aa" + mid + "a" * max(0, L - 6)
        c = build_cws(dummy)
        g2.append((score_row(4, ccs7(c[28:35])), mid))
    g2 = heapq.nlargest(K, g2)
    n3 = L - 6
    g3 = []
    for tup in itertools.product(chars, repeat=n3):
        tail = "".join(tup)
        dummy = "aaaaaa" + tail
        c = build_cws(dummy)
        g3.append((score_row(5, ccs7(c[35:42])), tail))
    g3 = heapq.nlargest(K, g3)
    top = []
    for _, a in g1:
        for _, b in g2:
            for _, cpart in g3:
                inner = (a + b + cpart)[:L]
                sc, lr = sc_inner(inner)
                item = (sc, inner, tuple(lr))
                if len(top) < 40:
                    heapq.heappush(top, item)
                elif sc > top[0][0]:
                    heapq.heapreplace(top, item)
    print("L", L)
    for sc, inner, lr in sorted(top, reverse=True)[:20]:
        print(round(sc, 3), inner, lr)
```

### Flag

`hacktheon2026{the_plotter_reveals_its_secret_through_sound}`
