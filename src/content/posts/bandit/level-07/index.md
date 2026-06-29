---
title: "OverTheWire Bandit Level 7 -> 8"
published: 2026-04-28
description: "OverTheWire Bandit Level 7에서 Level 8로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 7 -> 8
![image.png](../bandit/image%209.png)

```bash
axii@fedora:~/bandit$ ssh bandit7@bandit.labs.overthewire.org -p 2220

bandit7@bandit:~$ ls -al             
total 4108
drwxr-xr-x   2 root    root       4096 Apr  3 15:18 .
drwxr-xr-x 150 root    root       4096 Apr  3 15:20 ..
-rw-r--r--   1 root    root        220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root    root       3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit8 bandit7 4184396 Apr  3 15:18 data.txt
-rw-r--r--   1 root    root        807 Mar 31  2024 .profile
bandit7@bandit:~$ grep millionth data.txt 
millionth       <redacted>
```

grep으로 millionth가 있는 줄을 찾았다.
