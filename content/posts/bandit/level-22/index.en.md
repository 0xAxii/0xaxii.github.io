---
title: "OverTheWire Bandit Level 22 -> 23"
description: "OverTheWire Bandit Level 22 to Level 23 writeup"
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

The setup is similar to level 21, so I started the same way.

Every minute, /usr/bin/cronjob_bandit23.sh runs with bandit23 privileges. myname should be the output of whoami run as bandit23, so myname=bandit23. From that we can work out the mytarget string.

It hashes the string "I am user bandit23" with md5sum and keeps only the first field before the space.

That is mytarget, and it copies bandit23's password to /tmp/mytarget.

```bash
bandit22@bandit:/etc/cron.d$ echo "I am user bandit23" | md5sum | cut -d ' ' -f 1
8ca319486bfbbc3663ea0fbe81326349
bandit22@bandit:/etc/cron.d$ cat /tmp/8ca319486bfbbc3663ea0fbe81326349
<redacted>
```

Find and read that file.
