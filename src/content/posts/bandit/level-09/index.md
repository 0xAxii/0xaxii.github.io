---
title: "OverTheWire Bandit Level 9 -> 10"
published: 2026-04-28
description: "OverTheWire Bandit Level 9에서 Level 10로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 9 -> 10
![image.png](../bandit/image%2011.png)

```bash
axii@fedora:~/bandit$ ssh bandit9@bandit.labs.overthewire.org -p 2220

bandit9@bandit:~$ ls -al
total 40
drwxr-xr-x   2 root     root     4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root     4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root     3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit10 bandit9 19382 Apr  3 15:17 data.txt
-rw-r--r--   1 root     root      807 Mar 31  2024 .profile
bandit9@bandit:~$ strings data.txt | grep "="
 ========== the
I\=Ow
V?L=
%3=VZ
========== password
={M\
========== is
=Dvq
=n/N
========== <redacted>
zX]%=
]\{=
```

strings로 문자열만 추출한 후 =가 포함된 문자열만 grep으로 뽑아내면 된다.
