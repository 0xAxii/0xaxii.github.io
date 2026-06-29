---
title: "OverTheWire Bandit Level 20 -> 21"
published: 2026-04-28
description: "OverTheWire Bandit Level 20에서 Level 21로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 20 -> 21
![image.png](../bandit/image%2023.png)

```bash
axii@fedora:~/bandit$ ssh bandit20@bandit.labs.overthewire.org -p 2220

bandit20@bandit:~$ ls -al
total 36
drwxr-xr-x   2 root     root      4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root      4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root       220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root      3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root     root       807 Mar 31  2024 .profile
-rwsr-x---   1 bandit21 bandit20 15612 Apr  3 15:17 suconnect
bandit20@bandit:~$ file suconnect 
suconnect: setuid ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux.so.2, BuildID[sha1]=5ebb1e531d5117dae7d435f244411b35d765672f, for GNU/Linux 3.2.0, not stripped
bandit20@bandit:~$ ./suconnect <redacted>
getaddrinfo: Servname not supported for ai_socktype
bandit20@bandit:~$ echo '<redacted>' | nc -l -p 11111
^Z
[1]+  Stopped                 echo '<redacted>' | nc -l -p 11111
bandit20@bandit:~$ ./suconnect 11111                                       
^C
bandit20@bandit:~$ bg
[1]+ echo '<redacted>' | nc -l -p 11111 &
bandit20@bandit:~$ ./suconnect 11111
Could not connect
[1]+  Done                    echo '<redacted>' | nc -l -p 11111
bandit20@bandit:~$ echo '<redacted>' | nc -l -p 22222 &
[1] 27
bandit20@bandit:~$ ./suconnect 22222                                         
Read: <redacted>
Password matches, sending next password
<redacted>
[1]+  Done                    echo '<redacted>' | nc -l -p 22222
bandit20@bandit:~$ 
```

nc로 포트를 열고 20번 비밀번호를 그 포트에 보낸다음에 suconnect를 그 포트로 열어야 하는것같다.

처음에 포트 열었다가 백그라운드로 돌리려했는데 순서가 꼬여서 실패하고 다시열었다

명령어 끝에 &를 붙이면 백그라운드로 실행되므로 nc로 포트를 백그라운드로 열고 그 포트로 suconnect를 실행했다.
