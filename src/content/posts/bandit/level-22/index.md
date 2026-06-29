---
title: "OverTheWire Bandit Level 22 -> 23"
published: 2026-04-28
description: "OverTheWire Bandit Level 22에서 Level 23로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 22 -> 23
![image.png](../bandit/image%2025.png)

```bash
axii@fedora:~/bandit$ ssh bandit22@bandit.labs.overthewire.org -p 2220

bandit22@bandit:~$ cd /etc/cron.d
bandit22@bandit:/etc/cron.d$ ls
behemoth4_cleanup  clean_tmp  cronjob_bandit22  cronjob_bandit23  cronjob_bandit24  e2scrub_all  leviathan5_cleanup  manpage3_resetpw_job  otw-tmp-dir  sysstat
bandit22@bandit:/etc/cron.d$ cat cronjob_bandit23
@reboot bandit23 /usr/bin/cronjob_bandit23.sh  &> /dev/null
* * * * * bandit23 /usr/bin/cronjob_bandit23.sh  &> /dev/null
bandit22@bandit:/etc/cron.d$ cat /usr/bin/cronjob_bandit23.sh
#!/bin/bash

myname=$(whoami)
mytarget=$(echo I am user $myname | md5sum | cut -d ' ' -f 1)

echo "Copying passwordfile /etc/bandit_pass/$myname to /tmp/$mytarget"

cat /etc/bandit_pass/$myname > /tmp/$mytarget
```

21번과 도입부는 비슷해서 진행했다.

매 분마다 bandit23 권한으로 /usr/bin/cronjob_bandit23.sh를 실행한다. myname은 bandit23의 whoami 권한일것이므로 myname=bandit23 일 것이고, 따라서 mytarget문자열을 구해보자.

“I am user bandit23”이라는 문자열을 md5sum으로 해시해서 공백이전 첫번째만 가져온다.

그게 mytarget이고, /tmp/mytarget에 23번 pw를 복사한다.

```bash
bandit22@bandit:/etc/cron.d$ echo "I am user bandit23" | md5sum | cut -d ' ' -f 1
8ca319486bfbbc3663ea0fbe81326349
bandit22@bandit:/etc/cron.d$ cat /tmp/8ca319486bfbbc3663ea0fbe81326349
<redacted>
```

해당 파일을 찾아서 읽는다.
