---
title: "OverTheWire Bandit Level 19 -> 20"
published: 2026-04-28
description: "OverTheWire Bandit Level 19에서 Level 20로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 19 -> 20
![image.png](../bandit/image%2022.png)

```bash
axii@fedora:~/bandit$ ssh bandit19@bandit.labs.overthewire.org -p 2220

bandit19@bandit:~$ ls -al
total 36
drwxr-xr-x   2 root     root      4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root      4096 Apr  3 15:20 ..
-rwsr-x---   1 bandit20 bandit19 14888 Apr  3 15:17 bandit20-do
-rw-r--r--   1 root     root       220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root      3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root     root       807 Mar 31  2024 .profile
bandit19@bandit:~$ file bandit20-do 
bandit20-do: setuid ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux.so.2, BuildID[sha1]=d9b51170e04af1b03902f80228afa7a973330f86, for GNU/Linux 3.2.0, not stripped
bandit19@bandit:~$ ./bandit20-do 
Run a command as another user.
  Example: ./bandit20-do whoami
bandit19@bandit:~$ ./bandit20-do whoami
bandit20
bandit19@bandit:~$ cat /etc/bandit_pass/bandit20
cat: /etc/bandit_pass/bandit20: Permission denied
bandit19@bandit:~$ ./bandit20-do cat /etc/bandit_pass/bandit20
<redacted>
```

./bandit20-do [명령어]를 하면 bandit20 권한으로 명령어를 실행해주는 파일같다.
