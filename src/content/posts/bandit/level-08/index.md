---
title: "OverTheWire Bandit Level 8 -> 9"
published: 2026-04-28
description: "OverTheWire Bandit Level 8에서 Level 9로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 8 -> 9
![image.png](../bandit/image%2010.png)

```bash
axii@fedora:~/bandit$ ssh bandit8@bandit.labs.overthewire.org -p 2220

bandit8@bandit:~$ ls -al
total 56
drwxr-xr-x   2 root    root     4096 Apr  3 15:18 .
drwxr-xr-x 150 root    root     4096 Apr  3 15:20 ..
-rw-r--r--   1 root    root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root    root     3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit9 bandit8 33033 Apr  3 15:18 data.txt
-rw-r--r--   1 root    root      807 Mar 31  2024 .profile
bandit8@bandit:~$ sort data.txt | uniq -u
<redacted>
```

풀이방법을 고민하던 중 주어진 명령어 힌트를 통해 명령어들 사용법을 보던 중 uniq명령어 설명에서 다음과 같은 내용을 발견했다.

```bash
'uniq' does not detect repeated lines unless they are adjacent.
    You may want to sort the input first, or use 'sort -u' without
    'uniq'.
```

uniq 명령어는 반복되는 줄에서만 단독을 탐지못하므로 먼저 정렬을 하라는 말이 있었다. 따라서 sort 명령어로 정렬 후 파이프라인으로 결과를 uniq에 전달하면 된다.

[https://manpages.ubuntu.com/manpages/resolute/man1/sort.1.html](https://manpages.ubuntu.com/manpages/resolute/man1/sort.1.html)

[https://manpages.ubuntu.com/manpages/resolute/man1/uniq.1.html](https://manpages.ubuntu.com/manpages/resolute/man1/uniq.1.html)
