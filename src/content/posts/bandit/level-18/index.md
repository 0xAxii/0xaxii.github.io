---
title: "OverTheWire Bandit Level 18 -> 19"
published: 2026-04-28
description: "OverTheWire Bandit Level 18에서 Level 19로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 18 -> 19
![image.png](../bandit/image%2021.png)

```bash
axii@fedora:~/bandit$ ssh bandit18@bandit.labs.overthewire.org -p 2220

Byebye !
Connection to bandit.labs.overthewire.org closed.
```

문제 설명대로 .bashrc 파일이 수정되어서 바로 튕긴다.

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

scp로 다운로드해왔다.
