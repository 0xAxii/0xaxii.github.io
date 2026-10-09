---
title: "OverTheWire Bandit Level 10 -> 11"
description: "OverTheWire Bandit Level 10 -> 11 writeup"
---

## Level 10 -> 11
![image.png](../bandit/image%2012.png)

```bash
axii@fedora:~/bandit$ ssh bandit10@bandit.labs.overthewire.org -p 2220

bandit10@bandit:~$ ls -al
total 24
drwxr-xr-x   2 root     root     4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root     4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root     3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit11 bandit10   69 Apr  3 15:17 data.txt
-rw-r--r--   1 root     root      807 Mar 31  2024 .profile
bandit10@bandit:~$ base64 -d data.txt 
The password is <redacted>
```

![image.png](../bandit/image%2013.png)

Decoding it as shown above gives the password.
