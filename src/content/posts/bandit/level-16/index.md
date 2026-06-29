---
title: "OverTheWire Bandit Level 16 -> 17"
published: 2026-04-28
description: "OverTheWire Bandit Level 16에서 Level 17로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 16 -> 17
![image.png](../bandit/image%2019.png)

nmap 명령어를 이용해서 열려있는 포트를 스캔해보자.

```bash
bandit16@bandit:~$ nmap -p 31000-32000 localhost            
Starting Nmap 7.94SVN ( https://nmap.org ) at 2026-04-28 04:24 UTC
Nmap scan report for localhost (127.0.0.1)
Host is up (0.00019s latency).
Not shown: 996 closed tcp ports (conn-refused)
PORT      STATE SERVICE
31046/tcp open  unknown
31518/tcp open  unknown
31691/tcp open  unknown
31790/tcp open  unknown
31960/tcp open  unknown

Nmap done: 1 IP address (1 host up) scanned in 0.05 seconds
```

16번 비밀번호가 `<redacted>`

```bash
bandit16@bandit:~$ openssl s_client -connect localhost:31046
CONNECTED(00000003)
4067F0F7FF7F0000:error:0A0000F4:SSL routines:ossl_statem_client_read_transition:unexpected message:../ssl/statem/statem_clnt.c:398:
---
no peer certificate available
---
No client certificate CA names sent
---
SSL handshake has read 293 bytes and written 300 bytes
Verification: OK
---
New, (NONE), Cipher is (NONE)
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
Early data was not sent
Verify return code: 0 (ok)
---
bandit16@bandit:~$ openssl s_client -connect localhost:31518
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
    Session-ID: A10660AFF6046278F4084724F95C62E6B35DDC2CAF7288498E4642C0C2E09FF4
    Session-ID-ctx: 
    Resumption PSK: B32096DE20096F070FE976C4963DD820B6CF8DEC09073123A6AF5E80B8606095577642CED79F7E9EB61EE0D6EC3E1327
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 68 13 9b 72 7d 9a 61 41-77 f8 ea f1 51 42 4f 6f   h..r}.aAw...QBOo
    0010 - 87 75 ee 2f 37 10 a4 d2-e3 ad 57 8a e3 1d 40 9a   .u./7.....W...@.
    0020 - 76 74 3b 2a 21 c5 75 16-c4 bf 36 bd d8 da 26 ac   vt;*!.u...6...&.
    0030 - 99 af 5b 31 00 04 13 3d-90 c5 aa 71 6d c1 88 d5   ..[1...=...qm...
    0040 - 9f 7f 12 4b d1 33 9c 96-09 47 cd 6c fe 17 95 9a   ...K.3...G.l....
    0050 - f4 62 7b 77 33 4d f4 7d-d3 b8 7b 47 ca ff 6b ed   .b{w3M.}..{G..k.
    0060 - 95 db c3 dc c9 d0 14 6c-c0 36 8b 24 81 0f c7 13   .......l.6.$....
    0070 - 87 79 ec 62 5a 6a 95 c5-35 4f a7 0b 1d b4 4d f8   .y.bZj..5O....M.
    0080 - 4e 07 59 02 b1 ae 85 06-f6 42 c5 69 f9 b7 fe 2b   N.Y......B.i...+
    0090 - ac 7e 61 5b 47 47 bf 57-9a 66 6a 85 d0 02 a9 72   .~a[GG.W.fj....r
    00a0 - cb c7 d9 26 70 00 37 d0-c1 1b d5 b3 9f ae 5e 49   ...&p.7.......^I
    00b0 - 15 5c 6e e3 6d 67 a7 75-bc 17 a5 75 a7 3f fc be   .\n.mg.u...u.?..
    00c0 - 20 70 ef a2 b1 e0 9f 38-6b ba 66 59 74 78 7f 02    p.....8k.fYtx..
    00d0 - 4d b2 93 31 12 1c ee 14-f0 e5 f2 1a be 53 a3 3f   M..1.........S.?

    Start Time: 1777350316
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
    Session-ID: 4C9F715371AE31DD7EC283EFAB6AC6418CCB104A1C4E1FFFE937FCE7336D1C2D
    Session-ID-ctx: 
    Resumption PSK: 7118ED857750E90297E13A81245C937E2E8E9E646FC1290913D2A46CAAA53E1010C39546DD46BCE545B40099F240CDC8
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 68 13 9b 72 7d 9a 61 41-77 f8 ea f1 51 42 4f 6f   h..r}.aAw...QBOo
    0010 - a0 08 aa 06 fc 37 b4 b4-b9 0d a5 62 3d 23 8a 91   .....7.....b=#..
    0020 - f6 b3 db 9e df 93 3c 84-0e f7 88 10 75 b5 e2 c4   ......<.....u...
    0030 - 18 95 10 cc f0 60 2c ba-90 b0 b6 0b e2 58 00 e7   .....`,......X..
    0040 - 02 ee 1e b2 6d 27 2c 17-eb e7 1b 6d cc 56 c4 6a   ....m',....m.V.j
    0050 - 6a 19 10 53 84 e3 46 39-58 c8 93 98 b8 b8 e6 63   j..S..F9X......c
    0060 - 58 90 bf 0c 2a b1 96 d3-e2 72 bc cb 76 c8 81 8f   X...*....r..v...
    0070 - f4 09 94 3d c5 91 dc 6a-48 62 cc 6b a5 92 0e 1e   ...=...jHb.k....
    0080 - 73 55 cd c4 76 94 c2 a9-b3 84 d1 c5 96 3f df d0   sU..v........?..
    0090 - bf dc 94 99 ec 92 e2 c5-24 4b 3e 9a 23 c1 21 1c   ........$K>.#.!.
    00a0 - 60 0c 79 f7 5f 2b 17 6c-24 ef e8 15 c4 7b d7 4d   `.y._+.l$....{.M
    00b0 - da ea 91 ea 29 09 95 e7-ca ac 08 5a 65 2d a1 d5   ....)......Ze-..
    00c0 - 45 49 f5 ad b6 cd e8 7c-dc 0d 0a 32 f2 78 80 77   EI.....|...2.x.w
    00d0 - 89 f2 d1 d0 11 6d d7 65-c9 dc 76 27 d9 31 23 e8   .....m.e..v'.1#.

    Start Time: 1777350316
    Timeout   : 7200 (sec)
    Verify return code: 18 (self-signed certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK
<redacted>
KEYUPDATE
closed
bandit16@bandit:~$ 
```

31046은 아니고 31518은 뭔가 되긴 했는데 문제 설명에 있던것처럼 keyupdate가 떴다.

찾아보니 openssl s_client를 인터렉티브형으로 사용하면 k가 맨 앞일때 keyupdate라는게 실행되는 것 같다.

따라서 파이프라인으로 안전하게 보내자.

```bash
bandit16@bandit:~$ cat /etc/bandit_pass/bandit16 | openssl s_client -connect localhost:31790
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
KEYUPDATE
---
Post-Handshake New Session Ticket arrived:
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Session-ID: A02BEB9374E8D0755B834B52E0D184D8F8F62D1ADA7DE95836EC3886B3CF8D36
    Session-ID-ctx: 
    Resumption PSK: 4A25D9FEBA6E217066D5748A2C3BD06142A284F3142582DA92CC60BC876EB601945A3562A9BB1DB88988F08FFDF6E1E8
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 5f 48 6b 1e f4 2f 61 c2-f7 de 09 f9 4c 8c 21 01   _Hk../a.....L.!.
    0010 - 26 7d f9 78 58 08 ad e1-08 a6 c8 21 6d 62 08 cf   &}.xX......!mb..
    0020 - 7a 83 15 2a 80 70 03 28-b9 b6 d1 c6 bc aa c5 4d   z..*.p.(.......M
    0030 - 7b 79 4c 9c 9c 27 72 f2-bb b3 64 44 20 85 1f 54   {yL..'r...dD ..T
    0040 - 6d 75 3b e9 22 5b 65 5e-f7 04 3e 14 25 fc cf 32   mu;."[e^..>.%..2
    0050 - 8f 3a 1c 7d 8b 23 cd 90-ff 2a ce 74 8d a9 71 45   .:.}.#...*.t..qE
    0060 - de 8c 54 0d 08 bb ee 3a-ca d5 00 5b a9 bd 7b 2a   ..T....:...[..{*
    0070 - a7 69 f9 fd 60 da af d4-58 c3 5e aa 1c b8 2d e7   .i..`...X.^...-.
    0080 - 43 27 16 35 e0 bc 4b 2b-d6 1a db ac e0 36 db b7   C'.5..K+.....6..
    0090 - de 3b 4c c5 b5 36 bc 28-7c 57 85 a8 99 0f a5 03   .;L..6.(|W......
    00a0 - 99 67 27 31 8e 91 e8 d9-34 88 d5 ba 6c ed b3 7c   .g'1....4...l..|
    00b0 - c4 3d 92 fc 18 08 d3 10-61 cc d9 1b 52 d0 ee a9   .=......a...R...
    00c0 - 56 6e 26 a6 e5 e1 5b 1f-8b 84 08 c9 c6 46 be 76   Vn&...[......F.v
    00d0 - f6 0a 21 2d e9 d9 60 4f-39 81 87 b4 47 44 8d bf   ..!-..`O9...GD..

    Start Time: 1777350766
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
    Session-ID: C254A41D8F16E0F7C5DB2C0FB855348FF23571482EED8D175A227703FBF0C4A4
    Session-ID-ctx: 
    Resumption PSK: 4950D2CF4B753BCDF29961448FF6908D1C476C70D6A8B7BD3158C6DB402E7E3CA6B33F1041F86330A87E4BCF5C2BDF55
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 5f 48 6b 1e f4 2f 61 c2-f7 de 09 f9 4c 8c 21 01   _Hk../a.....L.!.
    0010 - 2d 71 b2 4f ad a5 01 c7-2b 83 96 4d ce 06 3d f3   -q.O....+..M..=.
    0020 - 65 11 e6 7c 00 23 55 12-d1 90 6d 5c ad 0f fb c5   e..|.#U...m\....
    0030 - 76 77 c1 57 b5 c9 64 87-9a fb f1 e2 3d 8a a2 91   vw.W..d.....=...
    0040 - 7c 37 4b 67 8a 46 cd 9b-80 0c 56 67 03 17 a2 ad   |7Kg.F....Vg....
    0050 - 43 d9 c5 8e 6e 9e 7b ba-97 3b a8 3c 23 cf cc f0   C...n.{..;.<#...
    0060 - 8c db db 88 35 3d 63 a2-92 3c 19 93 23 a5 0b 46   ....5=c..<..#..F
    0070 - e3 06 0d ec 52 63 e2 6e-06 3b 3b c7 e3 8a 8b 4c   ....Rc.n.;;....L
    0080 - 08 b8 39 97 d5 6a 59 ff-87 d3 c6 09 fa 29 3d 2b   ..9..jY......)=+
    0090 - 6f 19 73 d8 c4 4f 6f b2-a2 c4 cf dd 58 6d 28 cf   o.s..Oo.....Xm(.
    00a0 - 42 aa 48 c1 88 f2 3a 4a-64 55 62 e6 4e c7 31 6a   B.H...:JdUb.N.1j
    00b0 - 13 8f 53 01 03 fb 98 b6-8d 03 27 6a c0 c0 c2 2a   ..S.......'j...*
    00c0 - e9 56 95 3b a9 2b a5 08-73 9c c8 fa 02 03 9c ac   .V.;.+..s.......
    00d0 - 3d 57 8a ca c7 b1 ae a5-33 f8 4b 11 36 3c 95 ca   =W......3.K.6<..

    Start Time: 1777350766
    Timeout   : 7200 (sec)
    Verify return code: 18 (self-signed certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK
DONE
```

파이프라인으로 보내도 똑같은거 같다. keyupdate 기능을 아예 끄는게 좋아보여서 찾아보니 -quiet로 끌 수 있다.

```bash
bandit16@bandit:~$ cat /etc/bandit_pass/bandit16 | openssl s_client -connect localhost:31790 -quiet
Can't use SSL_get_servername
depth=0 CN = SnakeOil
verify error:num=18:self-signed certificate
verify return:1
depth=0 CN = SnakeOil
verify return:1
Correct!
-----BEGIN RSA PRIVATE KEY-----
<redacted private key>
-----END RSA PRIVATE KEY-----
```
