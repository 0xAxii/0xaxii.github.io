---
title: "OverTheWire Bandit Level 1 -> 2"
published: 2026-04-28
description: "OverTheWire Bandit Level 1에서 Level 2로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 1 -> 2
![image.png](../bandit/image%202.png)

```bash
axii@fedora:~/bandit$ ssh bandit1@bandit.labs.overthewire.org -p 2220

bandit1@bandit:~$ ls -al
total 24
-rw-r-----   1 bandit2 bandit1   33 Apr  3 15:17 -
drwxr-xr-x   2 root    root    4096 Apr  3 15:17 .
drwxr-xr-x 150 root    root    4096 Apr  3 15:20 ..
-rw-r--r--   1 root    root     220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root    root    3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root    root     807 Mar 31  2024 .profile
bandit1@bandit:~$ cat -
^C
```

서버 들어갈 때 뜨는 안내문은 Level 0과 같아서 앞으로도 생략하겠다. 

Level 0에서 얻은 pw로 접속했다.

ls를 입력해서 디렉토리 파악을 해봤는데 -라는 이름의 파일이 있었다.

cat -로 읽으려하자 아무것도 뜨지않길래 ctrl+c로 끊었다.

문제 안내에서 cat 명령어 설명으로 걸려있는 링크에 가봤다.

![image.png](../bandit/image%203.png)

파일이 -면 표준입력을 받는다고 되어있다.

```bash
bandit1@bandit:~$ cat ./-
<redacted>
```

그래서 현재 디렉토리의 -파일이라고 경로로 찍어주니 제대로 출력이 되었다.
