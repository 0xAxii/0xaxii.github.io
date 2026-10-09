---
title: "OverTheWire Bandit Level 21 -> 22"
description: "OverTheWire Bandit Level 21 to 22 writeup"
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

As the challenge said, I moved into /etc/cron.d.

There was a cronjob_bandit22, so I read it.

It's a script that runs /usr/bin/cronjob_bandit22.sh as bandit22 every minute.

Next I read /usr/bin/cronjob_bandit22.sh.

It's a script that copies the Level 22 password into /tmp/t7O6lds9S0RqQh9aMcz6ShpAoZKF7fgv.

Reading /tmp/t7O6lds9S0RqQh9aMcz6ShpAoZKF7fgv gives the Level 22 password.
