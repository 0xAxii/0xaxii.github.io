---
title: "OverTheWire Bandit Level 8 -> 9"
description: "OverTheWire Bandit Level 8 to Level 9 writeup"
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

While thinking about how to solve this, I was going through the usage of the hinted commands and found the following in the description of the uniq command.

```bash
'uniq' does not detect repeated lines unless they are adjacent.
    You may want to sort the input first, or use 'sort -u' without
    'uniq'.
```

It says uniq only detects a single occurrence among repeated lines when they are adjacent, so you should sort first. So I sorted with the sort command and piped the result to uniq.

[https://manpages.ubuntu.com/manpages/resolute/man1/sort.1.html](https://manpages.ubuntu.com/manpages/resolute/man1/sort.1.html)

[https://manpages.ubuntu.com/manpages/resolute/man1/uniq.1.html](https://manpages.ubuntu.com/manpages/resolute/man1/uniq.1.html)
