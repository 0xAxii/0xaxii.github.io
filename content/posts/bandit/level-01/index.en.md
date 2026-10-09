---
title: "OverTheWire Bandit Level 1 -> 2"
description: "OverTheWire Bandit Level 1 to Level 2 writeup"
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

The banner shown when logging into the server is the same as in Level 0, so I'll omit it from here on.

I connected with the password obtained in Level 0.

I ran ls to look around the directory and found a file named -.

When I tried to read it with cat -, nothing showed up, so I interrupted it with ctrl+c.

I went to the link provided in the challenge's cat command description.

![image.png](../bandit/image%203.png)

It says that when the file is -, it reads from standard input.

```bash
bandit1@bandit:~$ cat ./-
<redacted>
```

So when I specified it as the - file in the current directory by path, it printed correctly.
