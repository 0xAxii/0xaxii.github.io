---
title: "OverTheWire Bandit Level 21 -> 22"
published: 2026-04-28
description: "OverTheWire Bandit Level 21에서 Level 22로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 21 -> 22
![image.png](../bandit/image%2024.png)

```bash
axii@fedora:~/bandit$ ssh bandit21@bandit.labs.overthewire.org -p 2220

bandit21@bandit:~$ ls -al
total 24
drwxr-xr-x   2 root     root     4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root     4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root     3851 Apr  3 15:10 .bashrc
-r--------   1 bandit21 bandit21   33 Apr  3 15:17 .prevpass
-rw-r--r--   1 root     root      807 Mar 31  2024 .profile
bandit21@bandit:~$ cd /etc/cron.d
bandit21@bandit:/etc/cron.d$ ls
behemoth4_cleanup  clean_tmp  cronjob_bandit22  cronjob_bandit23  cronjob_bandit24  e2scrub_all  leviathan5_cleanup  manpage3_resetpw_job  otw-tmp-dir  sysstat
bandit21@bandit:/etc/cron.d$ cat cronjob_bandit22
@reboot bandit22 /usr/bin/cronjob_bandit22.sh &> /dev/null
* * * * * bandit22 /usr/bin/cronjob_bandit22.sh &> /dev/null
bandit21@bandit:/etc/cron.d$ cat /usr/bin/cronjob_bandit22.sh
#!/bin/bash
chmod 644 /tmp/t7O6lds9S0RqQh9aMcz6ShpAoZKF7fgv
cat /etc/bandit_pass/bandit22 > /tmp/t7O6lds9S0RqQh9aMcz6ShpAoZKF7fgv
bandit21@bandit:/etc/cron.d$ cat /tmp/t7O6lds9S0RqQh9aMcz6ShpAoZKF7fgv
<redacted>
bandit21@bandit:/etc/cron.d$ 
```

문제가 알려준대로 /etc/cron.d로 이동했다.

cronjob_bandit22가 있길래 읽어봤다.

매 분마다 bandit22 권한으로  /usr/bin/cronjob_bandit22.sh를 실행한다는 스크립트다.

이번엔 /usr/bin/cronjob_bandit22.sh을 읽어보자.

22번 pw를 /tmp/t7O6lds9S0RqQh9aMcz6ShpAoZKF7fgv에 복사해두는 스크립트다.

tmp/t7O6lds9S0RqQh9aMcz6ShpAoZKF7fgv를 읽어보면 22번 pw가 나온다.
