---
title: "OverTheWire Bandit Level 11 -> 12"
published: 2026-04-28
description: "OverTheWire Bandit Level 11에서 Level 12로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 11 -> 12
![image.png](../bandit/image%2014.png)

```bash
axii@fedora:~/bandit$ ssh bandit11@bandit.labs.overthewire.org -p 2220

bandit11@bandit:~$ ls -al
total 24
drwxr-xr-x   2 root     root     4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root     4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root     3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit12 bandit11   49 Apr  3 15:17 data.txt
-rw-r--r--   1 root     root      807 Mar 31  2024 .profile
bandit11@bandit:~$ cat data.txt 
Gur cnffjbeq vf <redacted>
```

설명대로 13칸씩 치환된것같다.

힌트로 나온 명령어들의 사용법을 서치하다가 tr로 해결 가능할 것 같은데 어떻게 사용해야 할지를 모르겠어서 tr명령어 치환의 응용으로 좀더 서치했다.

[https://zidarn87.tistory.com/137](https://zidarn87.tistory.com/137) 이 블로그가 도움이 크게 되었다.

A+13=N이니까 

```bash
bandit11@bandit:~$ cat data.txt | tr 'A-Za-z' 'N-ZA-Mn-za-m'
The password is <redacted>
```

다음과 같이 tr을 사용하면 된다.

A-Z까지의 문자를 N-ZA-M로 치환.
