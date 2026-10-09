---
title: "OverTheWire Bandit Level 2 -> 3"
description: "OverTheWire Bandit Level 2 to Level 3 writeup"
---

## Level 2 -> 3
![image.png](../bandit/image%204.png)

```bash
axii@fedora:~/bandit$ ssh bandit2@bandit.labs.overthewire.org -p 2220

bandit2@bandit:~$ ls -al
total 24
drwxr-xr-x   2 root    root    4096 Apr  3 15:17 .
drwxr-xr-x 150 root    root    4096 Apr  3 15:20 ..
-rw-r--r--   1 root    root     220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root    root    3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root    root     807 Mar 31  2024 .profile
-rw-r-----   1 bandit3 bandit2   33 Apr  3 15:17 --spaces in this filename--
bandit2@bandit:~$ cat ./--spaces\ in\ this\ filename-- 
<redacted>
```

As in Level 1, giving the path works.
