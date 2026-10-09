---
title: "OverTheWire Bandit Level 11 -> 12"
description: "Writeup for OverTheWire Bandit Level 11 to Level 12"
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

As described, each letter seems to be shifted by 13 positions.

While looking up the hinted commands, I figured `tr` could solve it, but I didn't know how to use it, so I searched more for examples of substitution with `tr`.

[https://zidarn87.tistory.com/137](https://zidarn87.tistory.com/137) This blog was a big help.

Since A+13=N,

```bash
bandit11@bandit:~$ cat data.txt | tr 'A-Za-z' 'N-ZA-Mn-za-m'
The password is <redacted>
```

Use `tr` as above.

This maps A-Z to N-ZA-M.
