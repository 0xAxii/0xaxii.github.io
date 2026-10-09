---
title: "OverTheWire Bandit Level 3 -> 4"
description: "OverTheWire Bandit Level 3 to Level 4 writeup"
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

In Linux, files starting with `.` are hidden files, so they do not show with `ls`. I found it with `ls -al` and read it out.
