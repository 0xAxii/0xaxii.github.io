---
title: "OverTheWire Bandit Level 4 -> 5"
published: 2026-04-28
description: "OverTheWire Bandit Level 4에서 Level 5로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 4 -> 5
![image.png](../bandit/image%206.png)

```bash
axii@fedora:~/bandit$ ssh bandit4@bandit.labs.overthewire.org -p 2220

bandit4@bandit:~$ ls -al
total 24
drwxr-xr-x   3 root root 4096 Apr  3 15:18 .
drwxr-xr-x 150 root root 4096 Apr  3 15:20 ..
-rw-r--r--   1 root root  220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root root 3851 Apr  3 15:10 .bashrc
drwxr-xr-x   2 root root 4096 Apr  3 15:18 inhere
-rw-r--r--   1 root root  807 Mar 31  2024 .profile
bandit4@bandit:~$ cd inhere/
bandit4@bandit:~/inhere$ ls -al
total 48
drwxr-xr-x 2 root    root    4096 Apr  3 15:18 .
drwxr-xr-x 3 root    root    4096 Apr  3 15:18 ..
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file00
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file01
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file02
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file03
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file04
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file05
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file06
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file07
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file08
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file09
bandit4@bandit:~/inhere$ cat ./-file0
cat: ./-file0: No such file or directory
bandit4@bandit:~/inhere$ cat ./-file00
��y�er`�v>/�ܿa@.�'m�������bandit4@bandit:~/inhere$ cat ./-file01
�3��P�WDQ�-^c@�򍣦-�#/Erttbandit4@bandit:~/inhere$ cat ./-file02
4t�:Oz�l�)���Lm�L�
                   Y�l��9�0��Mbandit4@bandit:~/inhere$ cat ./-file03
��~��ɢ܎Ց��;Kde{f
                   +<>�bandit4@bandit:~/inhere$ cat ./-file04
�-�v��������hH�X��i>*�I�~�aP�8Qbandit4@bandit:~/inhere$ cat ./-file05
        VN�F��#��ژ�:է����Vd�Z��כ�#�bandit4@bandit:~/inhere$ cat ./-file06
o"ُ֛�� ,�i�M�
             -g@x,��v���z�bandit4@bandit:~/inhere$ cat ./-file07
<redacted>
bandit4@bandit:~/inhere$ cat ./-file08
��uB�{N����ފ�!-��s��$aA�1mbandit4@bandit:~/inhere$ cat ./-file09
�OP�vV�}�H�:�I�%�#�X�
�}�bandit4@bandit:~/inhere$ 
```

사람이 읽을 수 있는게 pw라 하니 

```bash
bandit4@bandit:~/inhere$ cat ./-file07
<redacted>
```

이게 pw일것이다.

풀이 후 좀더 생각해보니 

```bash
bandit4@bandit:~/inhere$ file ./*
./-file00: data
./-file01: data
./-file02: data
./-file03: DOS executable (COM), start instruction 0x8c887e10 c3ee96c9
./-file04: data
./-file05: data
./-file06: data
./-file07: ASCII text
./-file08: data
./-file09: data
```

이렇게 먼저 확인했으면 삽질을 안했어도 됐을것이다.
