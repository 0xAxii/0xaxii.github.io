---
title: "HyperSonic CTF 2026 prob 1 Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 prob 1 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Reversing"]
draft: false
listed: false
---

***SSG Writeup***

# prob 1

## 개요

`prob 1`은 일부 구간이 난수로 덮인 레코드 데이터에서 flag를 복원하는 reversing 문제입니다. 제공된 실행 파일을 확인해 보면 파일 전체를 암호화하는 구조가 아니라, 원본을 복사한 뒤 일정한 주기마다 일부 구간을 난수로 덮어씁니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `reversing`
- 목표: 난수로 덮이지 않은 레코드 데이터에서 flag가 들어 있는 구조를 찾아 복원합니다.

풀이에서 먼저 확인할 부분은 덮어쓰기 규칙입니다. 복호화 키를 찾는 문제가 아니라, 어떤 위치가 난수로 바뀌었고 어떤 위치가 그대로 남았는지 계산한 뒤 남은 데이터에서 파일 시스템 구조를 복구해야 합니다.

## 문제 분석

먼저 글에서 사용할 용어를 정리합니다.

- `ENC`: 한 번에 난수로 덮어쓰는 길이입니다. 값은 `524288`바이트입니다.
- `SKIP`: 각 주기에서 그대로 두고 건너뛰는 길이입니다. 값은 `9961472`바이트입니다.
- `STRIDE`: 덮어쓰기 주기입니다. `SKIP + ENC`이므로 `10485760`바이트입니다.
- `frame`: 레코드 데이터 안에 들어 있는 raw LZO1X 압축 스트림입니다.
- `directory block`: ext4 디렉터리 엔트리가 들어 있는 `4096`바이트 블록입니다.
- `inode`: ext4 파일 시스템에서 파일이나 디렉터리를 가리키는 번호입니다.
- `name`: 디렉터리 엔트리의 이름입니다. 이 문제에서는 한 글자짜리 디렉터리 이름들이 flag 메시지를 구성합니다.

PyInstaller로 묶인 실행 파일의 Python 바이트코드를 보면 다음 흐름을 확인할 수 있습니다.

```python
ENC = 524288
SKIP = 9961472
STRIDE = SKIP + ENC
BUF = 1048576


def overwrite_pattern(f, offset, length):
    f.seek(offset)
    chunk = os.urandom(BUF)
    remaining = length
    while remaining > 0:
        n = min(BUF, remaining)
        f.write(chunk[:n])
        remaining -= n


def make_output_name(path):
    if not path.endswith(".records") and not path.endswith(".record_ids"):
        raise ValueError("not a .records or .record_ids file: " + path)
    return path + ".ENC"


def encrypt(path):
    out = make_output_name(path)
    shutil.copy2(path, out)
    size = os.path.getsize(out)

    with open(out, "r+b") as f:
        offset = 0
        while offset < size:
            offset += SKIP
            if offset >= size:
                break

            length = min(ENC, size - offset)
            overwrite_pattern(f, offset, length)
            offset += ENC

    return out
```

`overwrite_pattern`은 `os.urandom`으로 만든 데이터를 그대로 씁니다. 따라서 덮인 구간은 복구할 수 있는 암호문이 아니라 원래 내용이 사라진 구간으로 봐야 합니다. 다만 덮어쓰기 위치가 고정되어 있으므로 남아 있는 구간을 선별할 수 있습니다.

난수로 덮인 위치는 다음 조건으로 계산됩니다.

```text
9961472 <= offset % 10485760 < 10485760
```

즉 `10`MiB마다 앞의 `9.5`MiB는 남아 있고, 마지막 `512`KiB는 난수로 바뀝니다.

레코드 데이터를 살펴보면 난수로 덮이지 않은 구간에서 raw LZO1X 스트림을 찾을 수 있습니다. 정상적으로 압축 해제되는 스트림은 `8192`바이트를 출력했고, 이 출력은 `4096`바이트 ext4 블록 두 개로 나눌 수 있었습니다.

ext4 디렉터리 엔트리는 다음 구조로 파싱했습니다.

```text
inode     : uint32
rec_len   : uint16
name_len  : uint8
file_type : uint8
name      : name_len 바이트
```

디렉터리 블록으로 인정하려면 `rec_len`이 블록 범위를 벗어나지 않아야 하고, 첫 두 엔트리가 `.`와 `..`이어야 합니다. 이 조건을 만족하는 블록들을 모으면 디렉터리 `inode`와 자식 엔트리의 관계를 복구할 수 있습니다.

복구된 디렉터리 중 루트 근처의 흐름은 다음과 같습니다.

```text
root
  home -> inode 16

home
  kyouki -> inode 121

home/kyouki
  .bash_logout
  .profile
  .bashrc
  .ssh
  .cache
  f -> inode 2548
  .sudo_as_admin_successful
  .bash_history
```

여기서 `f`가 눈에 띕니다. 복구된 파일 시스템의 `home/kyouki/f`부터 따라가면 각 디렉터리에는 자식 디렉터리가 하나씩만 있고, 그 이름이 모두 한 글자입니다.

## 핵심 아이디어

이 문제의 풀이 방향은 덮인 구간을 복호화하는 것이 아니라, 아직 남아 있는 압축 블록을 모아 파일 시스템의 일부 구조를 재구성하는 것입니다.

실행 파일 분석으로 난수로 덮인 위치를 정확히 계산할 수 있습니다. 이 위치를 제외하고 raw LZO1X 스트림을 시도하면, 일부 스트림에서 ext4 디렉터리 블록이 나옵니다. 각 디렉터리 블록은 자신의 `inode`를 `.` 엔트리에 담고 있으므로, 이를 기준으로 `inode -> children` 형태의 사전을 만들 수 있습니다.

그 다음에는 복구된 파일 시스템의 `home/kyouki/f`에서 시작하는 디렉터리 체인을 따라갑니다. 일반적인 파일 내용에서 flag 문자열을 찾는 방식이 아니라, 디렉터리 이름 자체가 메시지입니다. 자식이 하나뿐인 디렉터리를 계속 따라가며 `name`을 이어 붙이면 `flag is ...` 형태의 문장이 만들어집니다.

## 풀이 과정

### Step 1. 덮어쓰기 구간 계산

실행 파일은 대상 파일을 복사한 뒤 `SKIP`만큼 이동하고, 그 위치부터 최대 `ENC`바이트를 난수로 덮습니다. 이후 다시 `ENC`만큼 이동한 상태에서 같은 작업을 반복합니다.

따라서 어떤 물리 `offset`이 난수로 덮였는지는 다음 함수로 판정할 수 있습니다.

```python
ENC = 524288
SKIP = 9961472
STRIDE = 10485760


def corrupt(offset):
    rel = offset % STRIDE
    return SKIP <= rel < SKIP + ENC
```

이 단계의 결과로 스캔 중 건너뛰어야 할 영역이 정해집니다. 난수로 덮인 위치에서 압축 해제를 시도하면 우연히 일부 바이트가 맞더라도 신뢰하기 어렵기 때문에, `solver`에서는 먼저 `corrupt(offset)`으로 제외했습니다.

### Step 2. raw LZO1X 스트림 복원

레코드 데이터는 고정 크기 슬롯 안에 압축 스트림이 들어 있는 형태로 보였습니다. 스캔은 `0x4000`바이트 단위 슬롯에서 시작하고, 내부에서는 `0x200`바이트 간격으로 후보 `offset`을 잡았습니다.

후보 위치에서 raw LZO1X 압축 해제를 시도했을 때 다음 조건을 만족하면 유효한 `frame`으로 보았습니다.

```text
압축 해제가 EOF marker에서 끝난다.
출력 길이가 8192바이트다.
```

`8192`바이트 출력은 ext4 블록 두 개로 나눌 수 있습니다. 각 절반을 `directory block` 후보로 두고, ext4 디렉터리 엔트리 형식에 맞는지 검사했습니다.

### Step 3. ext4 디렉터리 관계 수집

디렉터리 블록을 파싱하면 `.` 엔트리에서 현재 디렉터리의 `inode`를 얻고, 나머지 엔트리에서 자식 목록을 얻습니다.

```text
entries[0] = "."  -> 현재 디렉터리 inode
entries[1] = ".." -> 부모 디렉터리 inode
entries[2:]       -> 자식 엔트리
```

같은 `inode`에 대한 블록이 여러 번 발견될 수 있으므로, 자식 목록이 더 많이 복구된 쪽을 남겼습니다. 이 과정을 거치면 `dirs[inode] = children` 형태의 관계를 얻습니다.

이 관계에서 루트 디렉터리 아래 `home`, 그 아래 `kyouki`를 확인할 수 있었습니다. 이후 `home/kyouki`의 자식 중 `f`가 flag 메시지의 시작점으로 보였습니다.

### Step 4. 한 글자 디렉터리 체인 추적

`f`의 `inode`부터 시작해 자식 디렉터리를 따라가면 각 단계마다 자식이 하나뿐입니다. 이름을 이어 붙이면 다음과 같은 체인이 됩니다.

```text
f/l/a/g/ /i/s/ /H/S/{/d/0/c/0/c/b/4/6/0/7/2/0/e/6/f/2/1/d/e/1/d/c/c/f/e/b/3/4/c/a/b/9/1/d/1/c/4/9/9/0/d/b/f/3/4/5/2/f/5/a/9/a/2/0/9/5/b/9/4/3/0/f/a/e/}
```

슬래시는 경로 구분을 보여주기 위해 넣은 표기입니다. 실제로는 각 디렉터리의 `name`을 그대로 이어 붙입니다.

```text
flag is HS{d0c0cb460720e6f21de1dccfeb34cab91d1c4990dbf3452f5a9a2095b9430fae}
```

## Exploit / Solver

최종 `solver`는 다음 순서로 동작합니다.

1. 난수로 덮인 `offset`을 건너뜁니다.
2. 후보 `offset`에서 raw LZO1X 압축 해제를 시도합니다.
3. `8192`바이트 출력의 각 `4096`바이트 절반을 ext4 디렉터리 블록으로 파싱합니다.
4. `home/kyouki/f`의 `inode`를 찾습니다.
5. 자식이 하나뿐인 디렉터리 체인을 따라가며 이름을 이어 붙입니다.

아래는 풀이에 필요한 핵심 루틴입니다. `decompress`는 raw LZO1X 스트림을 풀어 `output`, `consumed`, `eof`를 돌려주는 함수입니다.

```python
from __future__ import annotations

import re
import struct
import sys

from lzo1x_raw import decompress


SLOT = 0x4000
SECTOR = 0x200
SCAN_START = 0x6700000
SCAN_END = 0x6810000

ENC = 524288
SKIP = 9961472
STRIDE = 10485760


def corrupt(offset: int) -> bool:
    rel = offset % STRIDE
    return SKIP <= rel < SKIP + ENC


def align_sector(n: int) -> int:
    return (n + SECTOR - 1) & ~(SECTOR - 1)


def valid_name(name: bytes) -> bool:
    if not name or name in (b".", b".."):
        return True
    if b"\x00" in name or b"/" in name:
        return False
    return all(32 <= b < 127 for b in name)


def parse_dir_block(block: bytes):
    entries = []
    pos = 0

    while pos + 8 <= len(block):
        inode, rec_len, name_len, file_type = struct.unpack_from("<IHBB", block, pos)
        if rec_len < 8 or rec_len % 4 or pos + rec_len > len(block):
            return None

        if inode:
            if name_len > rec_len - 8 or file_type > 7:
                return None
            name = block[pos + 8 : pos + 8 + name_len]
            if not valid_name(name):
                return None
            entries.append((inode, file_type, name))
        else:
            if not (rec_len == 12 and name_len == 0 and file_type in (0, 0xDE)):
                return None

        pos += rec_len

    return entries if pos == len(block) else None


def collect_directories(records_path: str):
    dirs = {}

    with open(records_path, "rb") as f:
        slot = SCAN_START - (SCAN_START % SLOT)
        while slot < SCAN_END:
            if corrupt(slot):
                slot += SLOT
                continue

            f.seek(slot)
            buf = f.read(SLOT + 0x3000)
            rel = 4

            while rel < SLOT and rel + 16 <= len(buf):
                offset = slot + rel
                if (
                    offset < SCAN_START
                    or offset >= SCAN_END
                    or corrupt(offset)
                    or buf[rel : rel + 16].count(0) == 16
                ):
                    rel += SECTOR
                    continue

                try:
                    res = decompress(buf[rel:], max_out=8192)
                except Exception:
                    rel += SECTOR
                    continue

                if res.eof and len(res.output) == 8192:
                    for base in (0, 4096):
                        entries = parse_dir_block(res.output[base : base + 4096])
                        if (
                            not entries
                            or len(entries) < 2
                            or entries[0][2] != b"."
                            or entries[1][2] != b".."
                        ):
                            continue

                        inode = entries[0][0]
                        children = entries[2:]
                        if inode not in dirs or len(children) > len(dirs[inode]):
                            dirs[inode] = children

                    rel += align_sector(res.consumed + 4)
                else:
                    rel += SECTOR

            slot += SLOT

    return dirs


def find_child(dirs, parent: int, name: bytes) -> int:
    for inode, _file_type, child_name in dirs[parent]:
        if child_name == name:
            return inode
    raise RuntimeError(f"missing child {name!r}")


def recover_message(records_path: str) -> str:
    dirs = collect_directories(records_path)

    home = find_child(dirs, 2, b"home")
    user = find_child(dirs, home, b"kyouki")
    current = find_child(dirs, user, b"f")

    parts = ["f"]
    seen = set()

    while current not in seen:
        seen.add(current)
        children = dirs.get(current, [])
        if not children:
            break
        if len(children) != 1:
            raise RuntimeError(f"unexpected branch at inode {current}")

        current, _file_type, name = children[0]
        parts.append(name.decode("latin1"))

    return "".join(parts)


def main() -> int:
    message = recover_message(sys.argv[1])
    match = re.search(r"HS\{[^}]+\}", message)
    if not match:
        raise RuntimeError(f"flag not found in {message!r}")

    print(message)
    print(match.group(0))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

## 결과

solver를 실행하면 복원된 메시지와 flag가 함께 출력됩니다.

```text
flag is HS{d0c0cb460720e6f21de1dccfeb34cab91d1c4990dbf3452f5a9a2095b9430fae}
HS{d0c0cb460720e6f21de1dccfeb34cab91d1c4990dbf3452f5a9a2095b9430fae}
```

flag는 다음과 같습니다.

```text
HS{d0c0cb460720e6f21de1dccfeb34cab91d1c4990dbf3452f5a9a2095b9430fae}
```
