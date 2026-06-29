---
title: "OverTheWire Bandit Level 3 -> 4"
published: 2026-04-28
description: "OverTheWire Bandit Level 3에서 Level 4로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 3 -> 4
![image.png](../bandit/image%205.png)

```bash
axii@fedora:~/bandit$ ssh bandit3@bandit.labs.overthewire.org -p 2220

bandit3@bandit:~$ ls -al
total 24
drwxr-xr-x   3 root root 4096 Apr  3 15:18 .
drwxr-xr-x 150 root root 4096 Apr  3 15:20 ..
-rw-r--r--   1 root root  220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root root 3851 Apr  3 15:10 .bashrc
drwxr-xr-x   2 root root 4096 Apr  3 15:18 inhere
-rw-r--r--   1 root root  807 Mar 31  2024 .profile
bandit3@bandit:~$ cd inhere/
bandit3@bandit:~/inhere$ ls
bandit3@bandit:~/inhere$ ls -al
total 12
drwxr-xr-x 2 root    root    4096 Apr  3 15:18 .
drwxr-xr-x 3 root    root    4096 Apr  3 15:18 ..
-rw-r----- 1 bandit4 bandit3   33 Apr  3 15:18 ...Hiding-From-You
bandit3@bandit:~/inhere$ cat ..
../                 ...Hiding-From-You  
bandit3@bandit:~/inhere$ cat ...Hiding-From-You 
<redacted>
```

리눅스에서 .으로 시작하는 파일은 숨김파일이라 ls로는 안보이고 ls -al로 찾고 읽어냈다.
