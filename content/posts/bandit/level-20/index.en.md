---
title: "OverTheWire Bandit Level 20 -> 21"
description: "OverTheWire Bandit Level 20 to 21 writeup"
---

## Level 20 -> 21
![image.png](../bandit/image%2023.png)

```bash
axii@fedora:~/bandit$ ssh bandit20@bandit.labs.overthewire.org -p 2220

bandit20@bandit:~$ ls -al
total 36
drwxr-xr-x   2 root     root      4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root      4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root       220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root      3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root     root       807 Mar 31  2024 .profile
-rwsr-x---   1 bandit21 bandit20 15612 Apr  3 15:17 suconnect
bandit20@bandit:~$ file suconnect 
suconnect: setuid ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux.so.2, BuildID[sha1]=5ebb1e531d5117dae7d435f244411b35d765672f, for GNU/Linux 3.2.0, not stripped
bandit20@bandit:~$ ./suconnect <redacted>
getaddrinfo: Servname not supported for ai_socktype
bandit20@bandit:~$ echo '<redacted>' | nc -l -p 11111
^Z
[1]+  Stopped                 echo '<redacted>' | nc -l -p 11111
bandit20@bandit:~$ ./suconnect 11111                                       
^C
bandit20@bandit:~$ bg
[1]+ echo '<redacted>' | nc -l -p 11111 &
bandit20@bandit:~$ ./suconnect 11111
Could not connect
[1]+  Done                    echo '<redacted>' | nc -l -p 11111
bandit20@bandit:~$ echo '<redacted>' | nc -l -p 22222 &
[1] 27
bandit20@bandit:~$ ./suconnect 22222                                         
Read: <redacted>
Password matches, sending next password
<redacted>
[1]+  Done                    echo '<redacted>' | nc -l -p 22222
bandit20@bandit:~$ 
```

It seems you need to open a port with nc, send the level 20 password to that port, and then run suconnect against that port.

At first I opened the port and tried to move it to the background, but I got the order wrong and it failed, so I opened it again.

Appending `&` to the end of a command runs it in the background, so I opened the port in the background with nc and then ran suconnect against that port.
