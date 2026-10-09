---
title: "OverTheWire Bandit Level 14 -> 15"
description: "OverTheWire Bandit Level 14 to Level 15 writeup"
---

## Level 14 -> 15
![image.png](../bandit/image%2017.png)

```bash
axii@fedora:~/bandit$ ssh bandit14@bandit.labs.overthewire.org -p 2220

bandit14@bandit:~$ ls -al
total 24
drwxr-xr-x   3 root root 4096 Apr  3 15:17 .
drwxr-xr-x 150 root root 4096 Apr  3 15:20 ..
-rw-r--r--   1 root root  220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root root 3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root root  807 Mar 31  2024 .profile
drwxr-xr-x   2 root root 4096 Apr  3 15:17 .ssh
bandit14@bandit:~$ nc localhost 30000
<redacted>
Correct!
<redacted>
```

As the instructions say, I connected to port 30000 on localhost and submitted the Level 14 password.
