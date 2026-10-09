---
title: "OverTheWire Bandit Level 18 -> 19"
description: "OverTheWire Bandit Level 18 to Level 19 writeup"
---

## Level 18 -> 19
![image.png](../bandit/image%2021.png)

```bash
axii@fedora:~/bandit$ ssh bandit18@bandit.labs.overthewire.org -p 2220

Byebye !
Connection to bandit.labs.overthewire.org closed.
```

As the description says, .bashrc has been modified, so the login kicks you out right away.

```bash
axii@fedora:~/bandit$ scp -P 2220 bandit18@bandit.labs.overthewire.org:readme .
                         _                     _ _ _   
                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

backend: gibson-0
bandit18@bandit.labs.overthewire.org's password: 
readme                                                                                                                                             100%   33     0.0KB/s   00:01    
axii@fedora:~/bandit$ cat readme
<redacted>
```

I downloaded it with scp.
