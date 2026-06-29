---
title: "OverTheWire Bandit Level 6 -> 7"
published: 2026-04-28
description: "OverTheWire Bandit Level 6에서 Level 7로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 6 -> 7
![image.png](../bandit/image%208.png)

```bash
axii@fedora:~/bandit$ ssh bandit6@bandit.labs.overthewire.org -p 2220

bandit6@bandit:~$ ls -al
total 20
drwxr-xr-x   2 root root 4096 Apr  3 15:17 .
drwxr-xr-x 150 root root 4096 Apr  3 15:20 ..
-rw-r--r--   1 root root  220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root root 3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root root  807 Mar 31  2024 .profile
bandit6@bandit:~$ cd find / -user bandit7 -group bandit6 -size 33c
-bash: cd: too many arguments
bandit6@bandit:~$ find / -user bandit7 -group bandit6 -size 33c   
find: ‘/tmp’: Permission denied
find: ‘/etc/credstore.encrypted’: Permission denied
find: ‘/etc/sudoers.d’: Permission denied
find: ‘/etc/stunnel’: Permission denied
find: ‘/etc/multipath’: Permission denied
find: ‘/etc/ssl/private’: Permission denied
find: ‘/etc/polkit-1/rules.d’: Permission denied
find: ‘/etc/credstore’: Permission denied
find: ‘/etc/xinetd.d’: Permission denied
find: ‘/dev/mqueue’: Permission denied
find: ‘/dev/shm’: Permission denied
find: ‘/snap’: Permission denied
find: ‘/lost+found’: Permission denied
find: ‘/run/pam_pidns’: Permission denied
find: ‘/run/udisks2’: Permission denied
find: ‘/run/chrony’: Permission denied
find: ‘/run/user/11011’: Permission denied
find: ‘/run/user/8002’: Permission denied
find: ‘/run/user/11017’: Permission denied
find: ‘/run/user/11014’: Permission denied
find: ‘/run/user/11008’: Permission denied
find: ‘/run/user/11010’: Permission denied
find: ‘/run/user/11004’: Permission denied
find: ‘/run/user/11009’: Permission denied
find: ‘/run/user/11013’: Permission denied
find: ‘/run/user/11001’: Permission denied
find: ‘/run/user/15000’: Permission denied
find: ‘/run/user/11019’: Permission denied
find: ‘/run/user/11016’: Permission denied
find: ‘/run/user/11015’: Permission denied
find: ‘/run/user/15001’: Permission denied
find: ‘/run/user/5018’: Permission denied
find: ‘/run/user/11006/systemd/inaccessible/dir’: Permission denied
find: ‘/run/user/15006’: Permission denied
find: ‘/run/user/11003’: Permission denied
find: ‘/run/user/14000’: Permission denied
find: ‘/run/user/11002’: Permission denied
find: ‘/run/user/11022’: Permission denied
find: ‘/run/user/15002’: Permission denied
find: ‘/run/user/15005’: Permission denied
find: ‘/run/user/11026’: Permission denied
find: ‘/run/user/11020’: Permission denied
find: ‘/run/user/11007’: Permission denied
find: ‘/run/user/11018’: Permission denied
find: ‘/run/user/11012’: Permission denied
find: ‘/run/user/8003’: Permission denied
find: ‘/run/user/16000’: Permission denied
find: ‘/run/user/11005’: Permission denied
find: ‘/run/user/11000’: Permission denied
find: ‘/run/user/11025’: Permission denied
find: ‘/run/sudo’: Permission denied
find: ‘/run/screen/S-bandit24’: Permission denied
find: ‘/run/screen/S-behemoth3’: Permission denied
find: ‘/run/screen/S-narnia3’: Permission denied
find: ‘/run/screen/S-krypton3’: Permission denied
find: ‘/run/screen/S-bandit19’: Permission denied
find: ‘/run/screen/S-bandit25’: Permission denied
find: ‘/run/screen/S-bandit21’: Permission denied
find: ‘/run/screen/S-bandit22’: Permission denied
find: ‘/run/screen/S-bandit23’: Permission denied
find: ‘/run/screen/S-bandit0’: Permission denied
find: ‘/run/screen/S-bandit20’: Permission denied
find: ‘/run/multipath’: Permission denied
find: ‘/run/cryptsetup’: Permission denied
find: ‘/run/lvm’: Permission denied
find: ‘/run/systemd/propagate/fwupd.service’: Permission denied
find: ‘/run/systemd/propagate/ModemManager.service’: Permission denied
find: ‘/run/systemd/propagate/polkit.service’: Permission denied
find: ‘/run/systemd/propagate/chrony.service’: Permission denied
find: ‘/run/systemd/propagate/systemd-logind.service’: Permission denied
find: ‘/run/systemd/propagate/irqbalance.service’: Permission denied
find: ‘/run/systemd/propagate/systemd-networkd.service’: Permission denied
find: ‘/run/systemd/propagate/systemd-resolved.service’: Permission denied
find: ‘/run/systemd/propagate/systemd-udevd.service’: Permission denied
find: ‘/run/systemd/inaccessible/dir’: Permission denied
find: ‘/run/lock/lvm’: Permission denied
find: ‘/home/drifter6/data’: Permission denied
find: ‘/home/leviathan4/.trash’: Permission denied
find: ‘/home/drifter8/chroot’: Permission denied
find: ‘/home/bandit30-git’: Permission denied
find: ‘/home/bandit29-git’: Permission denied
find: ‘/home/bandit28-git’: Permission denied
find: ‘/home/ubuntu’: Permission denied
find: ‘/home/leviathan0/.backup’: Permission denied
find: ‘/home/bandit27-git’: Permission denied
find: ‘/home/bandit5/inhere’: Permission denied
find: ‘/home/bandit31-git’: Permission denied
find: ‘/proc/tty/driver’: Permission denied
find: ‘/proc/1/task/1/fd’: Permission denied
find: ‘/proc/1/task/1/fdinfo’: Permission denied
find: ‘/proc/1/task/1/ns’: Permission denied
find: ‘/proc/1/fd’: Permission denied
find: ‘/proc/1/map_files’: Permission denied
find: ‘/proc/1/fdinfo’: Permission denied
find: ‘/proc/1/ns’: Permission denied
find: ‘/proc/2/task/2/fd’: Permission denied
find: ‘/proc/2/task/2/fdinfo’: Permission denied
find: ‘/proc/2/task/2/ns’: Permission denied
find: ‘/proc/2/fd’: Permission denied
find: ‘/proc/2/map_files’: Permission denied
find: ‘/proc/2/fdinfo’: Permission denied
find: ‘/proc/2/ns’: Permission denied
find: ‘/proc/18/task/18/fd/6’: No such file or directory
find: ‘/proc/18/task/18/fdinfo/6’: No such file or directory
find: ‘/proc/18/fd/5’: No such file or directory
find: ‘/proc/18/fdinfo/5’: No such file or directory
find: ‘/manpage/manpage3-pw’: Permission denied
find: ‘/var/crash’: Permission denied
find: ‘/var/tmp’: Permission denied
find: ‘/var/log’: Permission denied
find: ‘/var/lib/apt/lists/partial’: Permission denied
find: ‘/var/lib/ubuntu-advantage/apt-esm/var/lib/apt/lists/partial’: Permission denied
find: ‘/var/lib/amazon’: Permission denied
/var/lib/dpkg/info/bandit7.password
find: ‘/var/lib/udisks2’: Permission denied
find: ‘/var/lib/snapd/void’: Permission denied
find: ‘/var/lib/snapd/cookie’: Permission denied
find: ‘/var/lib/polkit-1’: Permission denied
find: ‘/var/lib/private’: Permission denied
find: ‘/var/lib/chrony’: Permission denied
find: ‘/var/lib/update-notifier/package-data-downloads/partial’: Permission denied
find: ‘/var/spool/bandit24’: Permission denied
find: ‘/var/spool/cron/crontabs’: Permission denied
find: ‘/var/spool/rsyslog’: Permission denied
find: ‘/var/cache/apt/archives/partial’: Permission denied
find: ‘/var/cache/private’: Permission denied
find: ‘/var/cache/pollinate’: Permission denied
find: ‘/var/cache/apparmor/70b6ca72.0’: Permission denied
find: ‘/var/cache/ldconfig’: Permission denied
find: ‘/root’: Permission denied
find: ‘/boot/efi’: Permission denied
find: ‘/boot/lost+found’: Permission denied
find: ‘/drifter/drifter14_src/axTLS’: Permission denied
find: ‘/sys/kernel/tracing/osnoise’: Permission denied
find: ‘/sys/kernel/tracing/hwlat_detector’: Permission denied
find: ‘/sys/kernel/tracing/instances’: Permission denied
find: ‘/sys/kernel/tracing/trace_stat’: Permission denied
find: ‘/sys/kernel/tracing/per_cpu’: Permission denied
find: ‘/sys/kernel/tracing/options’: Permission denied
find: ‘/sys/kernel/tracing/rv’: Permission denied
find: ‘/sys/kernel/debug’: Permission denied
find: ‘/sys/fs/pstore’: Permission denied
find: ‘/sys/fs/bpf’: Permission denied
bandit6@bandit:~$ cat /var/lib/dpkg/info/bandit7.password
<redacted>
```

permission denied가 유일하게 안뜬게 /var/lib/dpkg/info/bandit7.password 다.

```
-user uname
  File is owned by user uname (numeric user ID allowed).
-group gname
  File belongs to group gname (numeric group ID allowed).
```

마찬가지로 위의 링크에서 다음을 찾아서 사용했다.
