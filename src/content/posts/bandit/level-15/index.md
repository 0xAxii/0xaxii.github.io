---
title: "OverTheWire Bandit Level 15 -> 16"
published: 2026-04-28
description: "OverTheWire Bandit Level 15에서 Level 16로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 15 -> 16
![image.png](../bandit/image%2018.png)

```bash
axii@fedora:~/bandit$ ssh bandit15@bandit.labs.overthewire.org -p 2220
                       
bandit15@bandit:~$ nc localhost 30001
<redacted>
```

이번엔 당연히?도 nc로는 다음 pw를 주지 않는다.

```bash
bandit15@bandit:~$ openssl s_client -connect localhost : 30001 
s_client: Use -help for summary.
bandit15@bandit:~$ openssl s_client -connect localhost:30001  
CONNECTED(00000003)
Can't use SSL_get_servername
depth=0 CN = SnakeOil
verify error:num=18:self-signed certificate
verify return:1
depth=0 CN = SnakeOil
verify return:1
---
Certificate chain
 0 s:CN = SnakeOil
   i:CN = SnakeOil
   a:PKEY: rsaEncryption, 4096 (bit); sigalg: RSA-SHA256
   v:NotBefore: Jun 10 03:59:50 2024 GMT; NotAfter: Jun  8 03:59:50 2034 GMT
---
Server certificate
-----BEGIN CERTIFICATE-----
MIIFBzCCAu+gAwIBAgIUBLz7DBxA0IfojaL/WaJzE6Sbz7cwDQYJKoZIhvcNAQEL
BQAwEzERMA8GA1UEAwwIU25ha2VPaWwwHhcNMjQwNjEwMDM1OTUwWhcNMzQwNjA4
MDM1OTUwWjATMREwDwYDVQQDDAhTbmFrZU9pbDCCAiIwDQYJKoZIhvcNAQEBBQAD
ggIPADCCAgoCggIBANI+P5QXm9Bj21FIPsQqbqZRb5XmSZZJYaam7EIJ16Fxedf+
jXAv4d/FVqiEM4BuSNsNMeBMx2Gq0lAfN33h+RMTjRoMb8yBsZsC063MLfXCk4p+
09gtGP7BS6Iy5XdmfY/fPHvA3JDEScdlDDmd6Lsbdwhv93Q8M6POVO9sv4HuS4t/
jEjr+NhE+Bjr/wDbyg7GL71BP1WPZpQnRE4OzoSrt5+bZVLvODWUFwinB0fLaGRk
GmI0r5EUOUd7HpYyoIQbiNlePGfPpHRKnmdXTTEZEoxeWWAaM1VhPGqfrB/Pnca+
vAJX7iBOb3kHinmfVOScsG/YAUR94wSELeY+UlEWJaELVUntrJ5HeRDiTChiVQ++
wnnjNbepaW6shopybUF3XXfhIb4NvwLWpvoKFXVtcVjlOujF0snVvpE+MRT0wacy
tHtjZs7Ao7GYxDz6H8AdBLKJW67uQon37a4MI260ADFMS+2vEAbNSFP+f6ii5mrB
18cY64ZaF6oU8bjGK7BArDx56bRc3WFyuBIGWAFHEuB948BcshXY7baf5jjzPmgz
mq1zdRthQB31MOM2ii6vuTkheAvKfFf+llH4M9SnES4NSF2hj9NnHga9V08wfhYc
x0W6qu+S8HUdVF+V23yTvUNgz4Q+UoGs4sHSDEsIBFqNvInnpUmtNgcR2L5PAgMB
AAGjUzBRMB0GA1UdDgQWBBTPo8kfze4P9EgxNuyk7+xDGFtAYzAfBgNVHSMEGDAW
gBTPo8kfze4P9EgxNuyk7+xDGFtAYzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
DQEBCwUAA4ICAQAKHomtmcGqyiLnhziLe97Mq2+Sul5QgYVwfx/KYOXxv2T8ZmcR
Ae9XFhZT4jsAOUDK1OXx9aZgDGJHJLNEVTe9zWv1ONFfNxEBxQgP7hhmDBWdtj6d
taqEW/Jp06X+08BtnYK9NZsvDg2YRcvOHConeMjwvEL7tQK0m+GVyQfLYg6jnrhx
egH+abucTKxabFcWSE+Vk0uJYMqcbXvB4WNKz9vj4V5Hn7/DN4xIjFko+nREw6Oa
/AUFjNnO/FPjap+d68H1LdzMH3PSs+yjGid+6Zx9FCnt9qZydW13Miqg3nDnODXw
+Z682mQFjVlGPCA5ZOQbyMKY4tNazG2n8qy2famQT3+jF8Lb6a4NGbnpeWnLMkIu
jWLWIkA9MlbdNXuajiPNVyYIK9gdoBzbfaKwoOfSsLxEqlf8rio1GGcEV5Hlz5S2
txwI0xdW9MWeGWoiLbZSbRJH4TIBFFtoBG0LoEJi0C+UPwS8CDngJB4TyrZqEld3
rH87W+Et1t/Nepoc/Eoaux9PFp5VPXP+qwQGmhir/hv7OsgBhrkYuhkjxZ8+1uk7
tUWC/XM0mpLoxsq6vVl3AJaJe1ivdA9xLytsuG4iv02Juc593HXYR8yOpow0Eq2T
U5EyeuFg5RXYwAPi7ykw1PW7zAPL4MlonEVz+QXOSx6eyhimp1VZC11SCg==
-----END CERTIFICATE-----
subject=CN = SnakeOil
issuer=CN = SnakeOil
---
No client certificate CA names sent
Peer signing digest: SHA256
Peer signature type: RSA-PSS
Server Temp Key: X25519, 253 bits
---
SSL handshake has read 2103 bytes and written 373 bytes
Verification error: self-signed certificate
---
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Server public key is 4096 bit
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
Early data was not sent
Verify return code: 18 (self-signed certificate)
---
---
Post-Handshake New Session Ticket arrived:
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Session-ID: 5B3DBB536B4471FE345190BBB659DA1DE97A04D9F505836DB2827A8DE32EC520
    Session-ID-ctx: 
    Resumption PSK: EEC77BDCEA811CD579FA902DD20A6A01C546D81A1F865EB88980656FFDE8DA285A1CC91ADDC4DE57B5C2A7FDFF16416E
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 56 c8 74 c7 4e 15 76 27-f6 8a 4a d4 f1 9c d6 e1   V.t.N.v'..J.....
    0010 - 95 2d bc fc 3a 62 10 ab-60 cd f5 8a 5c 49 f2 d6   .-..:b..`...\I..
    0020 - e5 2d 47 83 a3 ab e5 a5-90 7e c3 11 cc 89 84 61   .-G......~.....a
    0030 - 54 66 5c e7 97 dd b4 fb-c6 8d 3f 7a f6 3f 56 32   Tf\.......?z.?V2
    0040 - 13 32 4c 1d 8d 6f 6c bc-25 d9 c7 35 de 8e f2 c6   .2L..ol.%..5....
    0050 - 27 08 74 e1 bd b3 62 54-9f c3 4b 01 3b 00 bd cd   '.t...bT..K.;...
    0060 - 68 b1 42 1a 0e 6b 30 50-73 ac 79 cf f6 54 e2 2a   h.B..k0Ps.y..T.*
    0070 - 39 df 2a 6a 77 2e cd e2-1d 2b 49 42 65 30 e9 ff   9.*jw....+IBe0..
    0080 - d6 12 0e e5 6a 8f bb 3a-d1 ca 2a 77 fe 0c 82 e2   ....j..:..*w....
    0090 - 0f f1 a5 9d 30 9e 6d 1f-2c aa 64 49 94 66 ab 60   ....0.m.,.dI.f.`
    00a0 - f0 14 c9 cd fb 0b 57 ac-e4 1a 83 9e 92 6f b4 fc   ......W......o..
    00b0 - 73 60 a2 0c ca 97 c0 16-f7 81 0b 1b 02 c9 2b 95   s`............+.
    00c0 - 5f 64 4d e1 a0 16 ef b9-b7 4b 89 da 0e 79 39 8e   _dM......K...y9.
    00d0 - 7a 80 bb 42 41 f5 4a db-4d 9b 85 82 f2 37 e0 3b   z..BA.J.M....7.;

    Start Time: 1777348754
    Timeout   : 7200 (sec)
    Verify return code: 18 (self-signed certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK
---
Post-Handshake New Session Ticket arrived:
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Session-ID: D4EDF7520C5DA257DD3539B73758610BF9148AD01629A95682C36D2ADFCA1EC6
    Session-ID-ctx: 
    Resumption PSK: F49305FFEB7700DB0BCCD38272455008CA08C675A5B27887A42CCD4924B91B5440B6BD1A0BC1AB62C4D1FBAEABDD0320
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 56 c8 74 c7 4e 15 76 27-f6 8a 4a d4 f1 9c d6 e1   V.t.N.v'..J.....
    0010 - 9b 6a db a2 ba da 77 db-d8 58 84 41 f7 1a 78 e6   .j....w..X.A..x.
    0020 - ed f5 c5 e4 e1 45 f4 c2-0d 5e 28 53 1e 17 3d 10   .....E...^(S..=.
    0030 - 32 6c 06 06 13 33 77 b7-2a 52 8d ec 7f 33 5f 7c   2l...3w.*R...3_|
    0040 - 52 f7 f4 b4 7a 01 07 93-ea e2 e5 0b bd 58 bc 9f   R...z........X..
    0050 - 8d 85 c8 9a 3d 3b 31 ac-59 2c 1d 21 26 b9 98 38   ....=;1.Y,.!&..8
    0060 - bf 50 6d 7d 90 ba db 49-87 e5 41 ac 9e 0a d4 36   .Pm}...I..A....6
    0070 - 69 16 68 c7 ca 9e 40 88-bb 15 b5 59 b8 65 de 0c   i.h...@....Y.e..
    0080 - 6b a1 e0 12 5a 8a 87 42-b9 82 b8 32 3c e5 e1 60   k...Z..B...2<..`
    0090 - e3 63 cb 82 ad ba 62 10-5a fa 41 54 f8 67 8a 3c   .c....b.Z.AT.g.<
    00a0 - 8f 1c 9e 8c 9b 4a 88 e7-d2 18 15 1a e6 33 84 6e   .....J.......3.n
    00b0 - 1c 0b 0a 84 f0 7e 27 4f-59 c7 04 be 24 b4 6c 42   .....~'OY...$.lB
    00c0 - 70 3f fa e4 e1 39 52 4b-01 65 9d 53 be b6 a4 2c   p?...9RK.e.S...,
    00d0 - 6d 77 78 41 39 70 a2 71-ab d3 cc 6b 84 bf 14 f0   mwxA9p.q...k....

    Start Time: 1777348754
    Timeout   : 7200 (sec)
    Verify return code: 18 (self-signed certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK
<redacted>
Correct!
<redacted>

closed
bandit15@bandit:~$ 
```

ssl/tls 암호화가 적혀있고, openssl 명령어가 있길래  [https://halinstudy.tistory.com/43](https://halinstudy.tistory.com/43) 이 블로그 글에서 도움받아서 ssl 연결하여 성공했다.

s_client를 쓰면 ssl/tls 연결을 할수있다.
