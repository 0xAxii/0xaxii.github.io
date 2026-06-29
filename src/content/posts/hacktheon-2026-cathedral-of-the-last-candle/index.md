---
title: "Hacktheon Sejong 2026 Quals CathedralOfTheLastCandle Writeup"
published: 2026-04-28
description: "Hacktheon Sejong 2026 Quals CathedralOfTheLastCandle 문제 풀이."
category: "CTF/Wargame"
tags: ["Hacktheon Sejong", "CTF", "Writeup", "Misc"]
draft: false
listed: false
---

# CathedralOfTheLastCandle

5x8 격자의 각 칸은 `.` / `*` / `~` 세 상태를 가진다.
각 상태를 0, 1, 2로 두고 mod 3 위에서 계산했다.

문제에서 쓰는 연산은 이렇다.

```text
ring -> [a+b, a+2b]
hush -> [2a+2b, 2a+b] (mod 3)
```

`ring`을 두 번 적용하면 현재 칸과 bonded neighbor가 둘 다 부호 반전된다.
그래서 각 칸에서 `ring`을 두 번 누른 전후 화면 차이를 보면, 현재 칸이 어느 칸과 연결되어 있는지 확인된다.

먼저 snake path로 모든 칸을 방문하면서 상태를 기록했다.
각 칸에서 `ring`을 두 번 실행하고, 바뀐 칸 중 현재 칸이 아닌 칸을 parent로 잡았다.
이렇게 전체 bonded neighbor 관계를 복구하면 rooted tree가 된다.

그다음에는 트리 위에서 모든 값을 0으로 만드는 DP를 짰다.
각 node에서는 “subtree를 모두 0으로 만들었을 때 parent 값이 어떻게 바뀌는지”를 저장했다.

```text
rel[v][parent_before] = parent_after 후보들
```

상태는 처리한 child 집합, 현재 칸 값, parent 값으로 두고 Dijkstra를 돌렸다.
이미 0으로 만든 child에서 `ring`을 두 번 실행하면 child는 0으로 유지되고 현재 칸만 `x -> 2x`로 바뀌는데, 이 전이를 넣어야 안정적으로 풀렸다.

마지막 root `(4,7)`은 제단과 연결되어 있어 `ring`/`hush`로 root 값만 조정할 수 있다.
모든 칸을 0으로 만든 뒤 root에서 `pray`를 실행하면 플래그가 나온다.

익스플로잇 코드

```python
#!/usr/bin/env python3
import re
import socket
from collections import defaultdict
from heapq import heappop, heappush
from itertools import count

HOST = "3.35.223.94"
PORT = 9000
H, W = 5, 8
ROOT = (4, 7)

ANSI_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
TOK_RE = re.compile(r"\[[*~.]\]|[*~.]|\?")
VAL = {".": 0, "*": 1, "~": 2}
SYM = ".*~"


def recv_prompt(sock):
    data = b""
    while True:
        try:
            chunk = sock.recv(4096)
        except socket.timeout:
            break
        if not chunk:
            break
        data += chunk
        if b"> " in data[-200:] or b"HACK" in data or b"flag" in data.lower():
            break
    return data.decode("utf-8", "replace")


def send(sock, cmd):
    sock.sendall((cmd + "\n").encode())
    return recv_prompt(sock)


def parse_screen(out):
    out = ANSI_RE.sub("", out)
    m = re.search(r"Pos:\((\d+),(\d+)\).*Budget:(\d+)", out)
    if not m:
        return None, None, []
    pos = (int(m.group(1)), int(m.group(2)))
    budget = int(m.group(3))
    rows = []
    for line in out.splitlines():
        toks = TOK_RE.findall(line)
        if len(toks) >= W:
            row = []
            for tok in toks[:W]:
                row.append(tok[1] if tok.startswith("[") else tok)
            rows.append(row)
    return pos, budget, rows[-H:]


def visible(rows):
    cells = {}
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            if ch != "?":
                cells[(r, c)] = VAL[ch]
    return cells


def observe(rows, state):
    for cell, value in visible(rows).items():
        state[cell] = value


def snake_moves():
    moves = []
    for r in range(H):
        moves.extend(["go e"] * (W - 1) if r % 2 == 0 else ["go w"] * (W - 1))
        if r != H - 1:
            moves.append("go s")
    return moves


def path_between(src, dst):
    r, c = src
    tr, tc = dst
    moves = []
    while r > tr:
        moves.append("go n")
        r -= 1
    while r < tr:
        moves.append("go s")
        r += 1
    while c > tc:
        moves.append("go w")
        c -= 1
    while c < tc:
        moves.append("go e")
        c += 1
    return moves


def move_pos(pos, cmd):
    r, c = pos
    if cmd == "go n":
        return (r - 1, c)
    if cmd == "go s":
        return (r + 1, c)
    if cmd == "go w":
        return (r, c - 1)
    if cmd == "go e":
        return (r, c + 1)
    return pos


def discover(sock):
    out = recv_prompt(sock)
    state = {}
    parent = {}
    moves = snake_moves()

    for idx in range(H * W):
        pos, budget, rows = parse_screen(out)
        observe(rows, state)
        before = visible(rows)

        out = send(sock, "ring")
        _, _, rows = parse_screen(out)
        observe(rows, state)
        out = send(sock, "ring")
        pos2, _, rows = parse_screen(out)
        observe(rows, state)

        after = visible(rows)
        diffs = [cell for cell in before if before[cell] != after.get(cell)]
        others = [cell for cell in diffs if cell != pos]
        parent[pos] = others[0] if len(others) == 1 else None

        if idx < len(moves):
            out = send(sock, moves[idx])
            _, _, rows = parse_screen(out)
            observe(rows, state)

    return parent, state


def apply_edge_power(a, b, k):
    if k == 0:
        return a, b
    if k == 1:
        return (a + b) % 3, (a + 2 * b) % 3
    if k == 2:
        return (2 * a) % 3, (2 * b) % 3
    if k == 3:
        return (2 * a + 2 * b) % 3, (2 * a + b) % 3
    raise ValueError(k)


def edge_ops(cell, k):
    if k == 0:
        return []
    if k == 1:
        return [(cell, "ring")]
    if k == 2:
        return [(cell, "ring"), (cell, "ring")]
    if k == 3:
        return [(cell, "hush")]
    raise ValueError(k)


def build_children(parent):
    children = defaultdict(list)
    root = None
    for cell, par in parent.items():
        if par is None:
            root = cell
        else:
            children[par].append(cell)
    return root, children


def best_update(table, key, cost, seq):
    old = table.get(key)
    if old is None or cost < old[0]:
        table[key] = (cost, seq)


def solve_plan(parent, state):
    root, children = build_children(parent)
    if root != ROOT:
        raise RuntimeError(f"unexpected root: {root}")

    rel_cache = {}

    def compute_rel(v):
        if v in rel_cache:
            return rel_cache[v]

        rel = {0: {}, 1: {}, 2: {}}
        kids = children[v]
        full = (1 << len(kids)) - 1

        for boundary in range(3):
            start = (0, state[v], boundary)
            pq = []
            serial = count()
            best = {start: (0, [])}
            heappush(pq, (0, next(serial), start))

            while pq:
                cost, _, cur = heappop(pq)
                if best[cur][0] != cost:
                    continue
                mask, a, b = cur
                seq = best[cur][1]

                if mask == full and a == 0:
                    best_update(rel[boundary], b, cost, seq)

                for op, k in (("ring", 1), ("hush", 3)):
                    a2, b2 = apply_edge_power(a, b, k)
                    nxt = (mask, a2, b2)
                    new = (cost + 1, seq + [(v, op)])
                    if nxt not in best or new[0] < best[nxt][0]:
                        best[nxt] = new
                        heappush(pq, (new[0], next(serial), nxt))

                for i, child in enumerate(kids):
                    bit = 1 << i
                    if mask & bit:
                        continue
                    child_rel = compute_rel(child)
                    for a2, (sub_cost, sub_seq) in child_rel.get(a, {}).items():
                        nxt = (mask | bit, a2, b)
                        new = (cost + sub_cost, seq + sub_seq)
                        if nxt not in best or new[0] < best[nxt][0]:
                        best[nxt] = new
                        heappush(pq, (new[0], next(serial), nxt))

                for i, child in enumerate(kids):
                    if not (mask & (1 << i)) or a == 0:
                        continue
                    nxt = (mask, 2 * a % 3, b)
                    flip = [(child, "ring"), (child, "ring")]
                    new = (cost + 2, seq + flip)
                    if nxt not in best or new[0] < best[nxt][0]:
                        best[nxt] = new
                        heappush(pq, (new[0], next(serial), nxt))

        rel_cache[v] = rel
        return rel

    kids = children[root]
    full = (1 << len(kids)) - 1
    start = (0, state[root])
    pq = []
    serial = count()
    seen = {start: (0, [])}
    heappush(pq, (0, next(serial), start))
    best_solution = None

    while pq:
        cost, _, cur = heappop(pq)
        if seen[cur][0] != cost:
            continue
        mask, a = cur
        seq = seen[cur][1]
        if mask == full and a == 0:
            best_solution = (cost, seq)
            break

        for op, a2 in (("ring", (a + 1) % 3), ("hush", (a - 1) % 3)):
            nxt = (mask, a2)
            new = (cost + 1, seq + [(root, op)])
            if nxt not in seen or new[0] < seen[nxt][0]:
                seen[nxt] = new
                heappush(pq, (new[0], next(serial), nxt))

        for i, child in enumerate(kids):
            bit = 1 << i
            if mask & bit:
                continue
            child_rel = compute_rel(child)
            for a2, (sub_cost, sub_seq) in child_rel.get(a, {}).items():
                nxt = (mask | bit, a2)
                new = (cost + sub_cost, seq + sub_seq)
                if nxt not in seen or new[0] < seen[nxt][0]:
                    seen[nxt] = new
                    heappush(pq, (new[0], next(serial), nxt))

        for i, child in enumerate(kids):
            if not (mask & (1 << i)) or a == 0:
                continue
            nxt = (mask, 2 * a % 3)
            flip = [(child, "ring"), (child, "ring")]
            new = (cost + 2, seq + flip)
            if nxt not in seen or new[0] < seen[nxt][0]:
                seen[nxt] = new
                heappush(pq, (new[0], next(serial), nxt))

    if best_solution is None:
        raise RuntimeError("no plan found")
    return best_solution[1]


def command_count_from(pos, ops):
    count = 0
    cur = pos
    for cell, _ in ops:
        count += abs(cur[0] - cell[0]) + abs(cur[1] - cell[1]) + 1
        cur = cell
    count += abs(cur[0] - ROOT[0]) + abs(cur[1] - ROOT[1]) + 1
    return count


def run():
    sock = socket.create_connection((HOST, PORT), timeout=5)
    sock.settimeout(2)

    parent, state = discover(sock)
    ops = solve_plan(parent, state)
    needed = command_count_from(ROOT, ops)
    print(f"mapped={len(parent)} ops={len(ops)} solve_commands={needed}")
    print("state after discovery:")
    for r in range(H):
        print("".join(SYM[state[(r, c)]] for c in range(W)))

    cur = ROOT
    out = ""
    for cell, op in ops:
        for cmd in path_between(cur, cell):
            out = send(sock, cmd)
            cur = move_pos(cur, cmd)
        out = send(sock, op)
    for cmd in path_between(cur, ROOT):
        out = send(sock, cmd)
        cur = move_pos(cur, cmd)
    out = send(sock, "pray")
    print(out)


if __name__ == "__main__":
    run()
```

플래그: `hacktheon2026{db423210b697d95bdb3ae4c2751302283d7dafc25beb10e8ab9fb8863986339e3dd35fbe52ab0ddffdcfb952596394547002d319ffe6725299b9a51455f48fe2ccb0308b7699fe43}`
