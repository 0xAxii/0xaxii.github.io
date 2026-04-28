---
title: "OverTheWire Bandit 0->25"
published: 2026-04-28
description: "OverTheWire Bandit Level 0부터 Level 24까지 풀이를 정리했다"
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
---

# Level 0

![image.png](bandit/image.png)

![image.png](bandit/image%201.png)

주어진 정보대로 ssh에 연결하면 된다.

```bash
ssh 사용자명@서버주소 -p 포트번호
```

를 쳐서 접속할 수 있다.

```bash
axii@fedora:~/bandit$ ssh bandit0@bandit.labs.overthewire.org -p 2220
The authenticity of host '[bandit.labs.overthewire.org]:2220 ([13.63.65.121]:2220)' can't be established.
ED25519 key fingerprint is SHA256:C2ihUBV7ihnV1wUXRb4RrEcLfXC5CXlhmAAM/urerLY.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '[bandit.labs.overthewire.org]:2220' (ED25519) to the list of known hosts.
                         _                     _ _ _   
                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

backend: gibson-0
bandit0@bandit.labs.overthewire.org's password: 

      ,----..            ,----,          .---.
     /   /   \         ,/   .`|         /. ./|
    /   .     :      ,`   .'  :     .--'.  ' ;
   .   /   ;.  \   ;    ;     /    /__./ \ : |
  .   ;   /  ` ; .'___,/    ,' .--'.  '   \' .
  ;   |  ; \ ; | |    :     | /___/ \ |    ' '
  |   :  | ; | ' ;    |.';  ; ;   \  \;      :
  .   |  ' ' ' : `----'  |  |  \   ;  `      |
  '   ;  \; /  |     '   :  ;   .   \    .\  ;
   \   \  ',  /      |   |  '    \   \   ' \ |
    ;   :    /       '   :  |     :   '  |--"
     \   \ .'        ;   |.'       \   \ ;
  www. `---` ver     '---' he       '---" ire.org

Welcome to OverTheWire!

If you find any problems, please report them to the #wargames channel on
discord or IRC.

--[ Playing the games ]--

  This machine might hold several wargames.
  If you are playing "somegame", then:

    * USERNAMES are somegame0, somegame1, ...
    * Most LEVELS are stored in /somegame/.
    * PASSWORDS for each level are stored in /etc/somegame_pass/.

  Write-access to homedirectories is disabled. It is advised to create a
  working directory with a hard-to-guess name in /tmp/.  You can use the
  command "mktemp -d" in order to generate a random and hard to guess
  directory in /tmp/.  Read-access to both /tmp/ is disabled and to /proc
  restricted so that users cannot snoop on eachother. Files and directories
  with easily guessable or short names will be periodically deleted! The /tmp
  directory is regularly wiped.
  Please play nice:

    * don't leave orphan processes running
    * don't leave exploit-files laying around
    * don't annoy other players
    * don't post passwords or spoilers
    * again, DONT POST SPOILERS!
      This includes writeups of your solution on your blog or website!

--[ Tips ]--

  This machine has a 64bit processor and many security-features enabled
  by default, although ASLR has been switched off.  The following
  compiler flags might be interesting:

    -m32                    compile for 32bit
    -fno-stack-protector    disable ProPolice
    -Wl,-z,norelro          disable relro

  In addition, the execstack tool can be used to flag the stack as
  executable on ELF binaries.

  Finally, network-access is limited for most levels by a local
  firewall.

--[ Tools ]--

 For your convenience we have installed a few useful tools which you can find
 in the following locations:

    * gef (https://github.com/hugsy/gef) in /opt/gef/
    * pwndbg (https://github.com/pwndbg/pwndbg) in /opt/pwndbg/
    * gdbinit (https://github.com/gdbinit/Gdbinit) in /opt/gdbinit/
    * pwntools (https://github.com/Gallopsled/pwntools)
    * radare2 (http://www.radare.org/)

--[ More information ]--

  For more information regarding individual wargames, visit
  http://www.overthewire.org/wargames/

  For support, questions or comments, contact us on discord or IRC.

  Enjoy your stay!

bandit0@bandit:~$                                           
```

처음 접속하는 서버라 접속할지 여부를 묻고 yes를 치면 비밀번호를 입력하라 하는데 주어진대로 bandit0을 입력하면 된다.

```bash
    * USERNAMES are somegame0, somegame1, ...
    * Most LEVELS are stored in /somegame/.
    * PASSWORDS for each level are stored in /etc/somegame_pass/.
```

여기서 마지막에 있는 pw는 /etc/게임명_pass에 있다는 정보가 중요해 보인다.

```bash
bandit0@bandit:~$ cd etc
-bash: cd: etc: No such file or directory
bandit0@bandit:~$ ls
readme
bandit0@bandit:~$ cat readme
Congratulations on your first steps into the bandit game!!
Please make sure you have read the rules at https://overthewire.org/rules/
If you are following a course, workshop, walkthrough or other educational activity,
please inform the instructor about the rules as well and encourage them to
contribute to the OverTheWire community so we can keep these games free!

The password you are looking for is: <redacted>
```

아마 Level 0이라 그냥 readme에 두었나보다.

# Level 1

![image.png](bandit/image%202.png)

```bash
axii@fedora:~/bandit$ ssh bandit1@bandit.labs.overthewire.org -p 2220

bandit1@bandit:~$ ls -al
total 24
-rw-r-----   1 bandit2 bandit1   33 Apr  3 15:17 -
drwxr-xr-x   2 root    root    4096 Apr  3 15:17 .
drwxr-xr-x 150 root    root    4096 Apr  3 15:20 ..
-rw-r--r--   1 root    root     220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root    root    3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root    root     807 Mar 31  2024 .profile
bandit1@bandit:~$ cat -
^C
```

서버 들어갈 때 뜨는 안내문은 Level 0과 같아서 앞으로도 생략하겠다. 

Level 0에서 얻은 pw로 접속했다.

ls를 입력해서 디렉토리 파악을 해봤는데 -라는 이름의 파일이 있었다.

cat -로 읽으려하자 아무것도 뜨지않길래 ctrl+c로 끊었다.

문제 안내에서 cat 명령어 설명으로 걸려있는 링크에 가봤다.

![image.png](bandit/image%203.png)

파일이 -면 표준입력을 받는다고 되어있다.

```bash
bandit1@bandit:~$ cat ./-
<redacted>
```

그래서 현재 디렉토리의 -파일이라고 경로로 찍어주니 제대로 출력이 되었다.

# Level 2

![image.png](bandit/image%204.png)

```bash
axii@fedora:~/bandit$ ssh bandit2@bandit.labs.overthewire.org -p 2220

bandit2@bandit:~$ ls -al
total 24
drwxr-xr-x   2 root    root    4096 Apr  3 15:17 .
drwxr-xr-x 150 root    root    4096 Apr  3 15:20 ..
-rw-r--r--   1 root    root     220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root    root    3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root    root     807 Mar 31  2024 .profile
-rw-r-----   1 bandit3 bandit2   33 Apr  3 15:17 --spaces in this filename--
bandit2@bandit:~$ cat ./--spaces\ in\ this\ filename-- 
<redacted>
```

Level 1과 같이 경로를 찍어주니 작동한다.

# Level 3

![image.png](bandit/image%205.png)

```bash
axii@fedora:~/bandit$ ssh bandit3@bandit.labs.overthewire.org -p 2220

bandit3@bandit:~$ ls -al
total 24
drwxr-xr-x   3 root root 4096 Apr  3 15:18 .
drwxr-xr-x 150 root root 4096 Apr  3 15:20 ..
-rw-r--r--   1 root root  220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root root 3851 Apr  3 15:10 .bashrc
drwxr-xr-x   2 root root 4096 Apr  3 15:18 inhere
-rw-r--r--   1 root root  807 Mar 31  2024 .profile
bandit3@bandit:~$ cd inhere/
bandit3@bandit:~/inhere$ ls
bandit3@bandit:~/inhere$ ls -al
total 12
drwxr-xr-x 2 root    root    4096 Apr  3 15:18 .
drwxr-xr-x 3 root    root    4096 Apr  3 15:18 ..
-rw-r----- 1 bandit4 bandit3   33 Apr  3 15:18 ...Hiding-From-You
bandit3@bandit:~/inhere$ cat ..
../                 ...Hiding-From-You  
bandit3@bandit:~/inhere$ cat ...Hiding-From-You 
<redacted>
```

리눅스에서 .으로 시작하는 파일은 숨김파일이라 ls로는 안보이고 ls -al로 찾고 읽어냈다.

# Level 4

![image.png](bandit/image%206.png)

```bash
axii@fedora:~/bandit$ ssh bandit4@bandit.labs.overthewire.org -p 2220

bandit4@bandit:~$ ls -al
total 24
drwxr-xr-x   3 root root 4096 Apr  3 15:18 .
drwxr-xr-x 150 root root 4096 Apr  3 15:20 ..
-rw-r--r--   1 root root  220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root root 3851 Apr  3 15:10 .bashrc
drwxr-xr-x   2 root root 4096 Apr  3 15:18 inhere
-rw-r--r--   1 root root  807 Mar 31  2024 .profile
bandit4@bandit:~$ cd inhere/
bandit4@bandit:~/inhere$ ls -al
total 48
drwxr-xr-x 2 root    root    4096 Apr  3 15:18 .
drwxr-xr-x 3 root    root    4096 Apr  3 15:18 ..
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file00
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file01
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file02
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file03
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file04
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file05
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file06
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file07
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file08
-rw-r----- 1 bandit5 bandit4   33 Apr  3 15:18 -file09
bandit4@bandit:~/inhere$ cat ./-file0
cat: ./-file0: No such file or directory
bandit4@bandit:~/inhere$ cat ./-file00
��y�er`�v>/�ܿa@.�'m�������bandit4@bandit:~/inhere$ cat ./-file01
�3��P�WDQ�-^c@�򍣦-�#/Erttbandit4@bandit:~/inhere$ cat ./-file02
4t�:Oz�l�)���Lm�L�
                   Y�l��9�0��Mbandit4@bandit:~/inhere$ cat ./-file03
��~��ɢ܎Ց��;Kde{f
                   +<>�bandit4@bandit:~/inhere$ cat ./-file04
�-�v��������hH�X��i>*�I�~�aP�8Qbandit4@bandit:~/inhere$ cat ./-file05
        VN�F��#��ژ�:է����Vd�Z��כ�#�bandit4@bandit:~/inhere$ cat ./-file06
o"ُ֛�� ,�i�M�
             -g@x,��v���z�bandit4@bandit:~/inhere$ cat ./-file07
<redacted>
bandit4@bandit:~/inhere$ cat ./-file08
��uB�{N����ފ�!-��s��$aA�1mbandit4@bandit:~/inhere$ cat ./-file09
�OP�vV�}�H�:�I�%�#�X�
�}�bandit4@bandit:~/inhere$ 
```

사람이 읽을 수 있는게 pw라 하니 

```bash
bandit4@bandit:~/inhere$ cat ./-file07
<redacted>
```

이게 pw일것이다.

풀이 후 좀더 생각해보니 

```bash
bandit4@bandit:~/inhere$ file ./*
./-file00: data
./-file01: data
./-file02: data
./-file03: DOS executable (COM), start instruction 0x8c887e10 c3ee96c9
./-file04: data
./-file05: data
./-file06: data
./-file07: ASCII text
./-file08: data
./-file09: data
```

이렇게 먼저 확인했으면 삽질을 안했어도 됐을것이다.

# Level 5

![image.png](bandit/image%207.png)

```bash
axii@fedora:~/bandit$ ssh bandit5@bandit.labs.overthewire.org -p 2220

bandit5@bandit:~$ ls -al
total 24
drwxr-xr-x   3 root root    4096 Apr  3 15:18 .
drwxr-xr-x 150 root root    4096 Apr  3 15:20 ..
-rw-r--r--   1 root root     220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root root    3851 Apr  3 15:10 .bashrc
drwxr-x---  22 root bandit5 4096 Apr  3 15:18 inhere
-rw-r--r--   1 root root     807 Mar 31  2024 .profile
bandit5@bandit:~$ cd inhere/
bandit5@bandit:~/inhere$ ls -al
total 88
drwxr-x--- 22 root bandit5 4096 Apr  3 15:18 .
drwxr-xr-x  3 root root    4096 Apr  3 15:18 ..
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere00
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere01
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere02
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere03
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere04
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere05
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere06
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere07
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere08
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere09
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere10
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere11
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere12
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere13
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere14
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere15
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere16
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere17
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere18
drwxr-x---  2 root bandit5 4096 Apr  3 15:18 maybehere19
bandit5@bandit:~/inhere$ file ./*
./maybehere00: directory
./maybehere01: directory
./maybehere02: directory
./maybehere03: directory
./maybehere04: directory
./maybehere05: directory
./maybehere06: directory
./maybehere07: directory
./maybehere08: directory
./maybehere09: directory
./maybehere10: directory
./maybehere11: directory
./maybehere12: directory
./maybehere13: directory
./maybehere14: directory
./maybehere15: directory
./maybehere16: directory
./maybehere17: directory
./maybehere18: directory
./maybehere19: directory
bandit5@bandit:~/inhere$ find . -size 1033c ! -excutable
find: unknown predicate `-excutable'
bandit5@bandit:~/inhere$ find . -size 1033c ! -executable
./maybehere07/.file2
bandit5@bandit:~/inhere$ cat ./maybehere07/.file2
<redacted>
```

뭔가 find로 검색해야겠다는건 알겠는데 정확한 옵션이 생각이 안나서 주어진 find의 링크로 가서 찾았다.

```
-size
    n[cwbkMG]
  File uses less than, more than or exactly n units of space,
      rounding up. The following suffixes can be used:
      
`c'
  for bytes
  
! expr
  True if expr is false. This character will also usually need
      protection from interpretation by the shell.
  
-executable
  Matches files which are executable and directories which are searchable
      (in a file name resolution sense) by the current user. This takes into
      account access control lists and other permissions artefacts which the
      -perm test ignores. This test makes use of the access(2)
      system call, and so can be fooled by NFS servers which do UID mapping (or
      root-squashing), since many systems implement access(2) in the
      client's kernel and so cannot make use of the UID mapping information held
      on the server. Because this test is based only on the result of the
      access(2) system call, there is no guarantee that a file for which
      this test succeeds can actually be executed.
```

# Level 6

![image.png](bandit/image%208.png)

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

# Level 7

![image.png](bandit/image%209.png)

```bash
axii@fedora:~/bandit$ ssh bandit7@bandit.labs.overthewire.org -p 2220

bandit7@bandit:~$ ls -al             
total 4108
drwxr-xr-x   2 root    root       4096 Apr  3 15:18 .
drwxr-xr-x 150 root    root       4096 Apr  3 15:20 ..
-rw-r--r--   1 root    root        220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root    root       3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit8 bandit7 4184396 Apr  3 15:18 data.txt
-rw-r--r--   1 root    root        807 Mar 31  2024 .profile
bandit7@bandit:~$ grep millionth data.txt 
millionth       <redacted>
```

grep으로 millionth가 있는 줄을 찾았다.

# Level 8

![image.png](bandit/image%2010.png)

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

풀이방법을 고민하던 중 주어진 명령어 힌트를 통해 명령어들 사용법을 보던 중 uniq명령어 설명에서 다음과 같은 내용을 발견했다.

```bash
'uniq' does not detect repeated lines unless they are adjacent.
    You may want to sort the input first, or use 'sort -u' without
    'uniq'.
```

uniq 명령어는 반복되는 줄에서만 단독을 탐지못하므로 먼저 정렬을 하라는 말이 있었다. 따라서 sort 명령어로 정렬 후 파이프라인으로 결과를 uniq에 전달하면 된다.

[https://manpages.ubuntu.com/manpages/resolute/man1/sort.1.html](https://manpages.ubuntu.com/manpages/resolute/man1/sort.1.html)

[https://manpages.ubuntu.com/manpages/resolute/man1/uniq.1.html](https://manpages.ubuntu.com/manpages/resolute/man1/uniq.1.html)

# Level 9

![image.png](bandit/image%2011.png)

```bash
axii@fedora:~/bandit$ ssh bandit9@bandit.labs.overthewire.org -p 2220

bandit9@bandit:~$ ls -al
total 40
drwxr-xr-x   2 root     root     4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root     4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root     3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit10 bandit9 19382 Apr  3 15:17 data.txt
-rw-r--r--   1 root     root      807 Mar 31  2024 .profile
bandit9@bandit:~$ strings data.txt | grep "="
 ========== the
I\=Ow
V?L=
%3=VZ
========== password
={M\
========== is
=Dvq
=n/N
========== <redacted>
zX]%=
]\{=
```

strings로 문자열만 추출한 후 =가 포함된 문자열만 grep으로 뽑아내면 된다.

# Level 10

![image.png](bandit/image%2012.png)

```bash
axii@fedora:~/bandit$ ssh bandit10@bandit.labs.overthewire.org -p 2220

bandit10@bandit:~$ ls -al
total 24
drwxr-xr-x   2 root     root     4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root     4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root     3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit11 bandit10   69 Apr  3 15:17 data.txt
-rw-r--r--   1 root     root      807 Mar 31  2024 .profile
bandit10@bandit:~$ base64 -d data.txt 
The password is <redacted>
```

![image.png](bandit/image%2013.png)

다음과 같이 디코딩 해줄수 있다.

# Level 11

![image.png](bandit/image%2014.png)

```bash
axii@fedora:~/bandit$ ssh bandit11@bandit.labs.overthewire.org -p 2220

bandit11@bandit:~$ ls -al
total 24
drwxr-xr-x   2 root     root     4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root     4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root     3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit12 bandit11   49 Apr  3 15:17 data.txt
-rw-r--r--   1 root     root      807 Mar 31  2024 .profile
bandit11@bandit:~$ cat data.txt 
Gur cnffjbeq vf <redacted>
```

설명대로 13칸씩 치환된것같다.

힌트로 나온 명령어들의 사용법을 서치하다가 tr로 해결 가능할 것 같은데 어떻게 사용해야 할지를 모르겠어서 tr명령어 치환의 응용으로 좀더 서치했다.

[https://zidarn87.tistory.com/137](https://zidarn87.tistory.com/137) 이 블로그가 도움이 크게 되었다.

A+13=N이니까 

```bash
bandit11@bandit:~$ cat data.txt | tr 'A-Za-z' 'N-ZA-Mn-za-m'
The password is <redacted>
```

다음과 같이 tr을 사용하면 된다.

A-Z까지의 문자를 N-ZA-M로 치환.

# Level 12

![image.png](bandit/image%2015.png)

```bash
axii@fedora:~/bandit$ ssh bandit12@bandit.labs.overthewire.org -p 2220

bandit12@bandit:~$ ls -al
total 24
drwxr-xr-x   2 root     root     4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root     4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root     3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit13 bandit12 2637 Apr  3 15:17 data.txt
-rw-r--r--   1 root     root      807 Mar 31  2024 .profile
bandit12@bandit:~$ mktemp -d
/tmp/tmp.7vZuBJsuwi
bandit12@bandit:~$ cp data.txt /tmp/tmp.7vZuBJsuwi
bandit12@bandit:~$ cd /tmp/tmp.7vZuBJsuwi
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ ls
data.txt
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file data.txt 
data.txt: ASCII text
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ xxd -r data.txt > file
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file file 
file: gzip compressed data, was "data2.bin", last modified: Fri Apr  3 15:17:36 2026, max compression, from Unix, original size modulo 2^32 576
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ gzip -d file >file1
gzip: file: unknown suffix -- ignored
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ ls -al              
total 764
drwx------     2 bandit12 bandit12   4096 Apr 28 03:20 .
drwxrwx-wt 13166 root     root     765952 Apr 28 03:21 ..
-rw-r-----     1 bandit12 bandit12   2637 Apr 28 03:15 data.txt
-rw-rw-r--     1 bandit12 bandit12    609 Apr 28 03:17 file
-rw-rw-r--     1 bandit12 bandit12      0 Apr 28 03:20 file1
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ rm file1
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ mv file file.gz 
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ gzip -d file.gz        
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ ls -al
total 764
drwx------     2 bandit12 bandit12   4096 Apr 28 03:22 .
drwxrwx-wt 13166 root     root     765952 Apr 28 03:22 ..
-rw-r-----     1 bandit12 bandit12   2637 Apr 28 03:15 data.txt
-rw-rw-r--     1 bandit12 bandit12    576 Apr 28 03:17 file
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file file 
file: bzip2 compressed data, block size = 900k
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ mv file file.bz2
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ bzip2 -d file.bz2 
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file file 
file: gzip compressed data, was "data4.bin", last modified: Fri Apr  3 15:17:36 2026, max compression, from Unix, original size modulo 2^32 20480
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ mv file file.gz
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ gzip -d file.gz   
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ fil
filan             file              filefrag          filegone-bpfcc    filelife-bpfcc    fileslower-bpfcc  filetop-bpfcc     
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file file 
file: POSIX tar archive (GNU)
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ cat file 
data5.bin0000644000000000000000000002400015163755020011244 0ustar  rootrootdata6.bin0000644000000000000000000000033715163755020011254 0ustar  rootrootBZh91AY&SY�$����j@@�}�� [#�t!�$�Phd�4��d4h�dɦ�'X�B�c�@�͟M�u�%l*b"�C���p\��d�E �Q��.n9�����V7<R�U���_T�4�ՙ�I�@b̶б���k�]m     �0
��H�B)�+t �p��֮T��ȒT��$|��.�p� 2�Hbandit12@bandit:/tmp/tmp.7vZuBJsuwi$ tar -xf file
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ ls -al
total 792
drwx------     2 bandit12 bandit12   4096 Apr 28 03:25 .
drwxrwx-wt 13166 root     root     765952 Apr 28 03:25 ..
-rw-r--r--     1 bandit12 bandit12  10240 Apr  3 15:17 data5.bin
-rw-r-----     1 bandit12 bandit12   2637 Apr 28 03:15 data.txt
-rw-rw-r--     1 bandit12 bandit12  20480 Apr 28 03:17 file
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file file 
file: POSIX tar archive (GNU)
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file data5.bin 
data5.bin: POSIX tar archive (GNU)
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ tar -xf data5.bin
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ ls -al
total 796
drwx------     2 bandit12 bandit12   4096 Apr 28 03:27 .
drwxrwx-wt 13167 root     root     765952 Apr 28 03:27 ..
-rw-r--r--     1 bandit12 bandit12  10240 Apr  3 15:17 data5.bin
-rw-r--r--     1 bandit12 bandit12    223 Apr  3 15:17 data6.bin
-rw-r-----     1 bandit12 bandit12   2637 Apr 28 03:15 data.txt
-rw-rw-r--     1 bandit12 bandit12  20480 Apr 28 03:17 file
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file data6.bin 
data6.bin: bzip2 compressed data, block size = 900k
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ rm file     
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ mv data6.bin file.bz2
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ bzip2 -d file.bz2 
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file file
file: POSIX tar archive (GNU)
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ tar -xf file
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ ls -al
total 788
drwx------     2 bandit12 bandit12   4096 Apr 28 03:28 .
drwxrwx-wt 13166 root     root     765952 Apr 28 03:28 ..
-rw-r--r--     1 bandit12 bandit12  10240 Apr  3 15:17 data5.bin
-rw-r--r--     1 bandit12 bandit12     79 Apr  3 15:17 data8.bin
-rw-r-----     1 bandit12 bandit12   2637 Apr 28 03:15 data.txt
-rw-r--r--     1 bandit12 bandit12  10240 Apr  3 15:17 file
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file data8.bin 
data8.bin: gzip compressed data, was "data9.bin", last modified: Fri Apr  3 15:17:36 2026, max compression, from Unix, original size modulo 2^32 49
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ rm file 
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ mv data8.bin file.gz
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ gzip -d file.gz 
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ file file
file: ASCII text
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ cat file 
The password is <redacted>
bandit12@bandit:/tmp/tmp.7vZuBJsuwi$ 
```

문제 설명대로 엄청난 압축으로 포장되어있다.

중요한 명령어는 3개였다

gzip -d, bzip2 -d, tar -xf

각각 gzip, bzip2, tar 압축을 푸는 명령어다.

# Level 13

![image.png](bandit/image%2016.png)

```bash
axii@fedora:~/bandit$ ssh bandit13@bandit.labs.overthewire.org -p 2220

bandit13@bandit:~$ ls -al
total 28
drwxr-xr-x   2 root     root     4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root     4096 Apr  3 15:20 ..
-rw-r--r--   1 root     root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root     3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit14 bandit13  467 Apr  3 15:17 HINT
-rw-r--r--   1 root     root      807 Mar 31  2024 .profile
-rw-r-----   1 bandit14 bandit13 1679 Apr  3 15:17 sshkey.private
bandit13@bandit:~$ cat HINT 
If you have trouble with this level, note the following:

1) As for all other levels, this level has a website with information:
   https://overthewire.org/wargames/bandit/bandit14.html
2) No, the level is not broken. To verify, see:
   https://status.overthewire.org/
3) The current version of OverTheWire prevents logging in from one
   level to another via localhost. Log out, and see 1)
4) If you get errors, read the error message on your screen.
   We mean it!
bandit13@bandit:~$ 
```

비밀번호 대신 SSH 개인키를 통해서 접속하는것 같다. 예전에 한번 해봤던 기억이 있는데 명령어가 기억이 안나서 서치해봤다.

[https://code-boki.tistory.com/142](https://code-boki.tistory.com/142) 이 블로그에서 도움을 받았다.

```bash
axii@fedora:~/bandit$ ssh bandit13@bandit.labs.overthewire.org -p 2220

bandit13@bandit:~$ ssh -i sshkey.private bandit14@bandit.labs.overthewire.org -p 2220
The authenticity of host '[bandit.labs.overthewire.org]:2220 ([127.0.0.1]:2220)' can't be established.
ED25519 key fingerprint is SHA256:C2ihUBV7ihnV1wUXRb4RrEcLfXC5CXlhmAAM/urerLY.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Could not create directory '/home/bandit13/.ssh' (Permission denied).
Failed to add the host to the list of known hosts (/home/bandit13/.ssh/known_hosts).
                         _                     _ _ _   
                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

!!! You are trying to log into this SSH server with a password on port 2220 from localhost.
!!! Connecting from localhost is blocked to conserve resources.
!!! Please log out and log in again.

backend: gibson-0
Received disconnect from 127.0.0.1 port 2220:2: no authentication methods enabled
Disconnected from 127.0.0.1 port 2220
bandit13@bandit:~$ 
```

ssh 접속을 하고 그 안에서 14로 바로 ssh 접속을 하려 하니 문제가 생겼다. scp 명령어를 통해 개인키 파일을 다운로드 받고 로컬에서 접속하자.

```bash
axii@fedora:~/bandit$ scp -P 2220 bandit13@bandit.labs.overthewire.org:sshkey.private .
                         _                     _ _ _   
                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

backend: gibson-0
bandit13@bandit.labs.overthewire.org's password: 
sshkey.private                                                                                                                                     100% 1679     2.1KB/s   00:00    
axii@fedora:~/bandit$ ls
sshkey.private
```

```bash
axii@fedora:~/bandit$ ssh -i sshkey.private bandit14@bandit.labs.overthewire.org -p 2220
                         _                     _ _ _   
                        | |__   __ _ _ __   __| (_) |_ 
                        | '_ \ / _` | '_ \ / _` | | __|
                        | |_) | (_| | | | | (_| | | |_ 
                        |_.__/ \__,_|_| |_|\__,_|_|\__|
                                                       

                      This is an OverTheWire game server. 
            More information on http://www.overthewire.org/wargames

backend: gibson-0
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
@         WARNING: UNPROTECTED PRIVATE KEY FILE!          @
@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@
Permissions 0640 for 'sshkey.private' are too open.
It is required that your private key files are NOT accessible by others.
This private key will be ignored.
Load key "sshkey.private": bad permissions
bandit14@bandit.labs.overthewire.org's password: 
```

이번엔 개인키 권한이 너무 널널하게 되어있어서 거부당했다.

chmod로 나한테만 rw권한을 주고 재시도하자.

```bash
axii@fedora:~/bandit$ chmod 600 sshkey.private
axii@fedora:~/bandit$ ssh -i sshkey.private bandit14@bandit.labs.overthewire.org -p 2220

bandit14@bandit:~$ cat /etc/bandit_pass/bandit14
<redacted>
bandit14@bandit:~$ 
```

# Level 14

![image.png](bandit/image%2017.png)

```bash
axii@fedora:~/bandit$ ssh bandit14@bandit.labs.overthewire.org -p 2220

bandit14@bandit:~$ ls -al
total 24
drwxr-xr-x   3 root root 4096 Apr  3 15:17 .
drwxr-xr-x 150 root root 4096 Apr  3 15:20 ..
-rw-r--r--   1 root root  220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root root 3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root root  807 Mar 31  2024 .profile
drwxr-xr-x   2 root root 4096 Apr  3 15:17 .ssh
bandit14@bandit:~$ nc localhost 30000
<redacted>
Correct!
<redacted>
```

설명대로 로컬호스트 30000번 포트에 접속한 후 Level 14 비밀번호를 제출했다.

# Level 15

![image.png](bandit/image%2018.png)

```bash
axii@fedora:~/bandit$ ssh bandit15@bandit.labs.overthewire.org -p 2220
                       
bandit15@bandit:~$ nc localhost 30001
<redacted>
```

이번엔 당연히?도 nc로는 다음 pw를 주지 않는다.

```bash
bandit15@bandit:~$ openssl s_client -connect localhost : 30001 
s_client: Use -help for summary.
bandit15@bandit:~$ openssl s_client -connect localhost:30001  
CONNECTED(00000003)
Can't use SSL_get_servername
depth=0 CN = SnakeOil
verify error:num=18:self-signed certificate
verify return:1
depth=0 CN = SnakeOil
verify return:1
---
Certificate chain
 0 s:CN = SnakeOil
   i:CN = SnakeOil
   a:PKEY: rsaEncryption, 4096 (bit); sigalg: RSA-SHA256
   v:NotBefore: Jun 10 03:59:50 2024 GMT; NotAfter: Jun  8 03:59:50 2034 GMT
---
Server certificate
-----BEGIN CERTIFICATE-----
MIIFBzCCAu+gAwIBAgIUBLz7DBxA0IfojaL/WaJzE6Sbz7cwDQYJKoZIhvcNAQEL
BQAwEzERMA8GA1UEAwwIU25ha2VPaWwwHhcNMjQwNjEwMDM1OTUwWhcNMzQwNjA4
MDM1OTUwWjATMREwDwYDVQQDDAhTbmFrZU9pbDCCAiIwDQYJKoZIhvcNAQEBBQAD
ggIPADCCAgoCggIBANI+P5QXm9Bj21FIPsQqbqZRb5XmSZZJYaam7EIJ16Fxedf+
jXAv4d/FVqiEM4BuSNsNMeBMx2Gq0lAfN33h+RMTjRoMb8yBsZsC063MLfXCk4p+
09gtGP7BS6Iy5XdmfY/fPHvA3JDEScdlDDmd6Lsbdwhv93Q8M6POVO9sv4HuS4t/
jEjr+NhE+Bjr/wDbyg7GL71BP1WPZpQnRE4OzoSrt5+bZVLvODWUFwinB0fLaGRk
GmI0r5EUOUd7HpYyoIQbiNlePGfPpHRKnmdXTTEZEoxeWWAaM1VhPGqfrB/Pnca+
vAJX7iBOb3kHinmfVOScsG/YAUR94wSELeY+UlEWJaELVUntrJ5HeRDiTChiVQ++
wnnjNbepaW6shopybUF3XXfhIb4NvwLWpvoKFXVtcVjlOujF0snVvpE+MRT0wacy
tHtjZs7Ao7GYxDz6H8AdBLKJW67uQon37a4MI260ADFMS+2vEAbNSFP+f6ii5mrB
18cY64ZaF6oU8bjGK7BArDx56bRc3WFyuBIGWAFHEuB948BcshXY7baf5jjzPmgz
mq1zdRthQB31MOM2ii6vuTkheAvKfFf+llH4M9SnES4NSF2hj9NnHga9V08wfhYc
x0W6qu+S8HUdVF+V23yTvUNgz4Q+UoGs4sHSDEsIBFqNvInnpUmtNgcR2L5PAgMB
AAGjUzBRMB0GA1UdDgQWBBTPo8kfze4P9EgxNuyk7+xDGFtAYzAfBgNVHSMEGDAW
gBTPo8kfze4P9EgxNuyk7+xDGFtAYzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
DQEBCwUAA4ICAQAKHomtmcGqyiLnhziLe97Mq2+Sul5QgYVwfx/KYOXxv2T8ZmcR
Ae9XFhZT4jsAOUDK1OXx9aZgDGJHJLNEVTe9zWv1ONFfNxEBxQgP7hhmDBWdtj6d
taqEW/Jp06X+08BtnYK9NZsvDg2YRcvOHConeMjwvEL7tQK0m+GVyQfLYg6jnrhx
egH+abucTKxabFcWSE+Vk0uJYMqcbXvB4WNKz9vj4V5Hn7/DN4xIjFko+nREw6Oa
/AUFjNnO/FPjap+d68H1LdzMH3PSs+yjGid+6Zx9FCnt9qZydW13Miqg3nDnODXw
+Z682mQFjVlGPCA5ZOQbyMKY4tNazG2n8qy2famQT3+jF8Lb6a4NGbnpeWnLMkIu
jWLWIkA9MlbdNXuajiPNVyYIK9gdoBzbfaKwoOfSsLxEqlf8rio1GGcEV5Hlz5S2
txwI0xdW9MWeGWoiLbZSbRJH4TIBFFtoBG0LoEJi0C+UPwS8CDngJB4TyrZqEld3
rH87W+Et1t/Nepoc/Eoaux9PFp5VPXP+qwQGmhir/hv7OsgBhrkYuhkjxZ8+1uk7
tUWC/XM0mpLoxsq6vVl3AJaJe1ivdA9xLytsuG4iv02Juc593HXYR8yOpow0Eq2T
U5EyeuFg5RXYwAPi7ykw1PW7zAPL4MlonEVz+QXOSx6eyhimp1VZC11SCg==
-----END CERTIFICATE-----
subject=CN = SnakeOil
issuer=CN = SnakeOil
---
No client certificate CA names sent
Peer signing digest: SHA256
Peer signature type: RSA-PSS
Server Temp Key: X25519, 253 bits
---
SSL handshake has read 2103 bytes and written 373 bytes
Verification error: self-signed certificate
---
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Server public key is 4096 bit
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
Early data was not sent
Verify return code: 18 (self-signed certificate)
---
---
Post-Handshake New Session Ticket arrived:
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Session-ID: 5B3DBB536B4471FE345190BBB659DA1DE97A04D9F505836DB2827A8DE32EC520
    Session-ID-ctx: 
    Resumption PSK: EEC77BDCEA811CD579FA902DD20A6A01C546D81A1F865EB88980656FFDE8DA285A1CC91ADDC4DE57B5C2A7FDFF16416E
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 56 c8 74 c7 4e 15 76 27-f6 8a 4a d4 f1 9c d6 e1   V.t.N.v'..J.....
    0010 - 95 2d bc fc 3a 62 10 ab-60 cd f5 8a 5c 49 f2 d6   .-..:b..`...\I..
    0020 - e5 2d 47 83 a3 ab e5 a5-90 7e c3 11 cc 89 84 61   .-G......~.....a
    0030 - 54 66 5c e7 97 dd b4 fb-c6 8d 3f 7a f6 3f 56 32   Tf\.......?z.?V2
    0040 - 13 32 4c 1d 8d 6f 6c bc-25 d9 c7 35 de 8e f2 c6   .2L..ol.%..5....
    0050 - 27 08 74 e1 bd b3 62 54-9f c3 4b 01 3b 00 bd cd   '.t...bT..K.;...
    0060 - 68 b1 42 1a 0e 6b 30 50-73 ac 79 cf f6 54 e2 2a   h.B..k0Ps.y..T.*
    0070 - 39 df 2a 6a 77 2e cd e2-1d 2b 49 42 65 30 e9 ff   9.*jw....+IBe0..
    0080 - d6 12 0e e5 6a 8f bb 3a-d1 ca 2a 77 fe 0c 82 e2   ....j..:..*w....
    0090 - 0f f1 a5 9d 30 9e 6d 1f-2c aa 64 49 94 66 ab 60   ....0.m.,.dI.f.`
    00a0 - f0 14 c9 cd fb 0b 57 ac-e4 1a 83 9e 92 6f b4 fc   ......W......o..
    00b0 - 73 60 a2 0c ca 97 c0 16-f7 81 0b 1b 02 c9 2b 95   s`............+.
    00c0 - 5f 64 4d e1 a0 16 ef b9-b7 4b 89 da 0e 79 39 8e   _dM......K...y9.
    00d0 - 7a 80 bb 42 41 f5 4a db-4d 9b 85 82 f2 37 e0 3b   z..BA.J.M....7.;

    Start Time: 1777348754
    Timeout   : 7200 (sec)
    Verify return code: 18 (self-signed certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK
---
Post-Handshake New Session Ticket arrived:
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Session-ID: D4EDF7520C5DA257DD3539B73758610BF9148AD01629A95682C36D2ADFCA1EC6
    Session-ID-ctx: 
    Resumption PSK: F49305FFEB7700DB0BCCD38272455008CA08C675A5B27887A42CCD4924B91B5440B6BD1A0BC1AB62C4D1FBAEABDD0320
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 56 c8 74 c7 4e 15 76 27-f6 8a 4a d4 f1 9c d6 e1   V.t.N.v'..J.....
    0010 - 9b 6a db a2 ba da 77 db-d8 58 84 41 f7 1a 78 e6   .j....w..X.A..x.
    0020 - ed f5 c5 e4 e1 45 f4 c2-0d 5e 28 53 1e 17 3d 10   .....E...^(S..=.
    0030 - 32 6c 06 06 13 33 77 b7-2a 52 8d ec 7f 33 5f 7c   2l...3w.*R...3_|
    0040 - 52 f7 f4 b4 7a 01 07 93-ea e2 e5 0b bd 58 bc 9f   R...z........X..
    0050 - 8d 85 c8 9a 3d 3b 31 ac-59 2c 1d 21 26 b9 98 38   ....=;1.Y,.!&..8
    0060 - bf 50 6d 7d 90 ba db 49-87 e5 41 ac 9e 0a d4 36   .Pm}...I..A....6
    0070 - 69 16 68 c7 ca 9e 40 88-bb 15 b5 59 b8 65 de 0c   i.h...@....Y.e..
    0080 - 6b a1 e0 12 5a 8a 87 42-b9 82 b8 32 3c e5 e1 60   k...Z..B...2<..`
    0090 - e3 63 cb 82 ad ba 62 10-5a fa 41 54 f8 67 8a 3c   .c....b.Z.AT.g.<
    00a0 - 8f 1c 9e 8c 9b 4a 88 e7-d2 18 15 1a e6 33 84 6e   .....J.......3.n
    00b0 - 1c 0b 0a 84 f0 7e 27 4f-59 c7 04 be 24 b4 6c 42   .....~'OY...$.lB
    00c0 - 70 3f fa e4 e1 39 52 4b-01 65 9d 53 be b6 a4 2c   p?...9RK.e.S...,
    00d0 - 6d 77 78 41 39 70 a2 71-ab d3 cc 6b 84 bf 14 f0   mwxA9p.q...k....

    Start Time: 1777348754
    Timeout   : 7200 (sec)
    Verify return code: 18 (self-signed certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK
<redacted>
Correct!
<redacted>

closed
bandit15@bandit:~$ 
```

ssl/tls 암호화가 적혀있고, openssl 명령어가 있길래  [https://halinstudy.tistory.com/43](https://halinstudy.tistory.com/43) 이 블로그 글에서 도움받아서 ssl 연결하여 성공했다.

s_client를 쓰면 ssl/tls 연결을 할수있다.

# Level 16

![image.png](bandit/image%2019.png)

nmap 명령어를 이용해서 열려있는 포트를 스캔해보자.

```bash
bandit16@bandit:~$ nmap -p 31000-32000 localhost            
Starting Nmap 7.94SVN ( https://nmap.org ) at 2026-04-28 04:24 UTC
Nmap scan report for localhost (127.0.0.1)
Host is up (0.00019s latency).
Not shown: 996 closed tcp ports (conn-refused)
PORT      STATE SERVICE
31046/tcp open  unknown
31518/tcp open  unknown
31691/tcp open  unknown
31790/tcp open  unknown
31960/tcp open  unknown

Nmap done: 1 IP address (1 host up) scanned in 0.05 seconds
```

16번 비밀번호가 `<redacted>`

```bash
bandit16@bandit:~$ openssl s_client -connect localhost:31046
CONNECTED(00000003)
4067F0F7FF7F0000:error:0A0000F4:SSL routines:ossl_statem_client_read_transition:unexpected message:../ssl/statem/statem_clnt.c:398:
---
no peer certificate available
---
No client certificate CA names sent
---
SSL handshake has read 293 bytes and written 300 bytes
Verification: OK
---
New, (NONE), Cipher is (NONE)
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
Early data was not sent
Verify return code: 0 (ok)
---
bandit16@bandit:~$ openssl s_client -connect localhost:31518
CONNECTED(00000003)
Can't use SSL_get_servername
depth=0 CN = SnakeOil
verify error:num=18:self-signed certificate
verify return:1
depth=0 CN = SnakeOil
verify return:1
---
Certificate chain
 0 s:CN = SnakeOil
   i:CN = SnakeOil
   a:PKEY: rsaEncryption, 4096 (bit); sigalg: RSA-SHA256
   v:NotBefore: Jun 10 03:59:50 2024 GMT; NotAfter: Jun  8 03:59:50 2034 GMT
---
Server certificate
-----BEGIN CERTIFICATE-----
MIIFBzCCAu+gAwIBAgIUBLz7DBxA0IfojaL/WaJzE6Sbz7cwDQYJKoZIhvcNAQEL
BQAwEzERMA8GA1UEAwwIU25ha2VPaWwwHhcNMjQwNjEwMDM1OTUwWhcNMzQwNjA4
MDM1OTUwWjATMREwDwYDVQQDDAhTbmFrZU9pbDCCAiIwDQYJKoZIhvcNAQEBBQAD
ggIPADCCAgoCggIBANI+P5QXm9Bj21FIPsQqbqZRb5XmSZZJYaam7EIJ16Fxedf+
jXAv4d/FVqiEM4BuSNsNMeBMx2Gq0lAfN33h+RMTjRoMb8yBsZsC063MLfXCk4p+
09gtGP7BS6Iy5XdmfY/fPHvA3JDEScdlDDmd6Lsbdwhv93Q8M6POVO9sv4HuS4t/
jEjr+NhE+Bjr/wDbyg7GL71BP1WPZpQnRE4OzoSrt5+bZVLvODWUFwinB0fLaGRk
GmI0r5EUOUd7HpYyoIQbiNlePGfPpHRKnmdXTTEZEoxeWWAaM1VhPGqfrB/Pnca+
vAJX7iBOb3kHinmfVOScsG/YAUR94wSELeY+UlEWJaELVUntrJ5HeRDiTChiVQ++
wnnjNbepaW6shopybUF3XXfhIb4NvwLWpvoKFXVtcVjlOujF0snVvpE+MRT0wacy
tHtjZs7Ao7GYxDz6H8AdBLKJW67uQon37a4MI260ADFMS+2vEAbNSFP+f6ii5mrB
18cY64ZaF6oU8bjGK7BArDx56bRc3WFyuBIGWAFHEuB948BcshXY7baf5jjzPmgz
mq1zdRthQB31MOM2ii6vuTkheAvKfFf+llH4M9SnES4NSF2hj9NnHga9V08wfhYc
x0W6qu+S8HUdVF+V23yTvUNgz4Q+UoGs4sHSDEsIBFqNvInnpUmtNgcR2L5PAgMB
AAGjUzBRMB0GA1UdDgQWBBTPo8kfze4P9EgxNuyk7+xDGFtAYzAfBgNVHSMEGDAW
gBTPo8kfze4P9EgxNuyk7+xDGFtAYzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
DQEBCwUAA4ICAQAKHomtmcGqyiLnhziLe97Mq2+Sul5QgYVwfx/KYOXxv2T8ZmcR
Ae9XFhZT4jsAOUDK1OXx9aZgDGJHJLNEVTe9zWv1ONFfNxEBxQgP7hhmDBWdtj6d
taqEW/Jp06X+08BtnYK9NZsvDg2YRcvOHConeMjwvEL7tQK0m+GVyQfLYg6jnrhx
egH+abucTKxabFcWSE+Vk0uJYMqcbXvB4WNKz9vj4V5Hn7/DN4xIjFko+nREw6Oa
/AUFjNnO/FPjap+d68H1LdzMH3PSs+yjGid+6Zx9FCnt9qZydW13Miqg3nDnODXw
+Z682mQFjVlGPCA5ZOQbyMKY4tNazG2n8qy2famQT3+jF8Lb6a4NGbnpeWnLMkIu
jWLWIkA9MlbdNXuajiPNVyYIK9gdoBzbfaKwoOfSsLxEqlf8rio1GGcEV5Hlz5S2
txwI0xdW9MWeGWoiLbZSbRJH4TIBFFtoBG0LoEJi0C+UPwS8CDngJB4TyrZqEld3
rH87W+Et1t/Nepoc/Eoaux9PFp5VPXP+qwQGmhir/hv7OsgBhrkYuhkjxZ8+1uk7
tUWC/XM0mpLoxsq6vVl3AJaJe1ivdA9xLytsuG4iv02Juc593HXYR8yOpow0Eq2T
U5EyeuFg5RXYwAPi7ykw1PW7zAPL4MlonEVz+QXOSx6eyhimp1VZC11SCg==
-----END CERTIFICATE-----
subject=CN = SnakeOil
issuer=CN = SnakeOil
---
No client certificate CA names sent
Peer signing digest: SHA256
Peer signature type: RSA-PSS
Server Temp Key: X25519, 253 bits
---
SSL handshake has read 2103 bytes and written 373 bytes
Verification error: self-signed certificate
---
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Server public key is 4096 bit
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
Early data was not sent
Verify return code: 18 (self-signed certificate)
---
---
Post-Handshake New Session Ticket arrived:
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Session-ID: A10660AFF6046278F4084724F95C62E6B35DDC2CAF7288498E4642C0C2E09FF4
    Session-ID-ctx: 
    Resumption PSK: B32096DE20096F070FE976C4963DD820B6CF8DEC09073123A6AF5E80B8606095577642CED79F7E9EB61EE0D6EC3E1327
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 68 13 9b 72 7d 9a 61 41-77 f8 ea f1 51 42 4f 6f   h..r}.aAw...QBOo
    0010 - 87 75 ee 2f 37 10 a4 d2-e3 ad 57 8a e3 1d 40 9a   .u./7.....W...@.
    0020 - 76 74 3b 2a 21 c5 75 16-c4 bf 36 bd d8 da 26 ac   vt;*!.u...6...&.
    0030 - 99 af 5b 31 00 04 13 3d-90 c5 aa 71 6d c1 88 d5   ..[1...=...qm...
    0040 - 9f 7f 12 4b d1 33 9c 96-09 47 cd 6c fe 17 95 9a   ...K.3...G.l....
    0050 - f4 62 7b 77 33 4d f4 7d-d3 b8 7b 47 ca ff 6b ed   .b{w3M.}..{G..k.
    0060 - 95 db c3 dc c9 d0 14 6c-c0 36 8b 24 81 0f c7 13   .......l.6.$....
    0070 - 87 79 ec 62 5a 6a 95 c5-35 4f a7 0b 1d b4 4d f8   .y.bZj..5O....M.
    0080 - 4e 07 59 02 b1 ae 85 06-f6 42 c5 69 f9 b7 fe 2b   N.Y......B.i...+
    0090 - ac 7e 61 5b 47 47 bf 57-9a 66 6a 85 d0 02 a9 72   .~a[GG.W.fj....r
    00a0 - cb c7 d9 26 70 00 37 d0-c1 1b d5 b3 9f ae 5e 49   ...&p.7.......^I
    00b0 - 15 5c 6e e3 6d 67 a7 75-bc 17 a5 75 a7 3f fc be   .\n.mg.u...u.?..
    00c0 - 20 70 ef a2 b1 e0 9f 38-6b ba 66 59 74 78 7f 02    p.....8k.fYtx..
    00d0 - 4d b2 93 31 12 1c ee 14-f0 e5 f2 1a be 53 a3 3f   M..1.........S.?

    Start Time: 1777350316
    Timeout   : 7200 (sec)
    Verify return code: 18 (self-signed certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK
---
Post-Handshake New Session Ticket arrived:
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Session-ID: 4C9F715371AE31DD7EC283EFAB6AC6418CCB104A1C4E1FFFE937FCE7336D1C2D
    Session-ID-ctx: 
    Resumption PSK: 7118ED857750E90297E13A81245C937E2E8E9E646FC1290913D2A46CAAA53E1010C39546DD46BCE545B40099F240CDC8
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 68 13 9b 72 7d 9a 61 41-77 f8 ea f1 51 42 4f 6f   h..r}.aAw...QBOo
    0010 - a0 08 aa 06 fc 37 b4 b4-b9 0d a5 62 3d 23 8a 91   .....7.....b=#..
    0020 - f6 b3 db 9e df 93 3c 84-0e f7 88 10 75 b5 e2 c4   ......<.....u...
    0030 - 18 95 10 cc f0 60 2c ba-90 b0 b6 0b e2 58 00 e7   .....`,......X..
    0040 - 02 ee 1e b2 6d 27 2c 17-eb e7 1b 6d cc 56 c4 6a   ....m',....m.V.j
    0050 - 6a 19 10 53 84 e3 46 39-58 c8 93 98 b8 b8 e6 63   j..S..F9X......c
    0060 - 58 90 bf 0c 2a b1 96 d3-e2 72 bc cb 76 c8 81 8f   X...*....r..v...
    0070 - f4 09 94 3d c5 91 dc 6a-48 62 cc 6b a5 92 0e 1e   ...=...jHb.k....
    0080 - 73 55 cd c4 76 94 c2 a9-b3 84 d1 c5 96 3f df d0   sU..v........?..
    0090 - bf dc 94 99 ec 92 e2 c5-24 4b 3e 9a 23 c1 21 1c   ........$K>.#.!.
    00a0 - 60 0c 79 f7 5f 2b 17 6c-24 ef e8 15 c4 7b d7 4d   `.y._+.l$....{.M
    00b0 - da ea 91 ea 29 09 95 e7-ca ac 08 5a 65 2d a1 d5   ....)......Ze-..
    00c0 - 45 49 f5 ad b6 cd e8 7c-dc 0d 0a 32 f2 78 80 77   EI.....|...2.x.w
    00d0 - 89 f2 d1 d0 11 6d d7 65-c9 dc 76 27 d9 31 23 e8   .....m.e..v'.1#.

    Start Time: 1777350316
    Timeout   : 7200 (sec)
    Verify return code: 18 (self-signed certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK
<redacted>
KEYUPDATE
closed
bandit16@bandit:~$ 
```

31046은 아니고 31518은 뭔가 되긴 했는데 문제 설명에 있던것처럼 keyupdate가 떴다.

찾아보니 openssl s_client를 인터렉티브형으로 사용하면 k가 맨 앞일때 keyupdate라는게 실행되는 것 같다.

따라서 파이프라인으로 안전하게 보내자.

```bash
bandit16@bandit:~$ cat /etc/bandit_pass/bandit16 | openssl s_client -connect localhost:31790
CONNECTED(00000003)
Can't use SSL_get_servername
depth=0 CN = SnakeOil
verify error:num=18:self-signed certificate
verify return:1
depth=0 CN = SnakeOil
verify return:1
---
Certificate chain
 0 s:CN = SnakeOil
   i:CN = SnakeOil
   a:PKEY: rsaEncryption, 4096 (bit); sigalg: RSA-SHA256
   v:NotBefore: Jun 10 03:59:50 2024 GMT; NotAfter: Jun  8 03:59:50 2034 GMT
---
Server certificate
-----BEGIN CERTIFICATE-----
MIIFBzCCAu+gAwIBAgIUBLz7DBxA0IfojaL/WaJzE6Sbz7cwDQYJKoZIhvcNAQEL
BQAwEzERMA8GA1UEAwwIU25ha2VPaWwwHhcNMjQwNjEwMDM1OTUwWhcNMzQwNjA4
MDM1OTUwWjATMREwDwYDVQQDDAhTbmFrZU9pbDCCAiIwDQYJKoZIhvcNAQEBBQAD
ggIPADCCAgoCggIBANI+P5QXm9Bj21FIPsQqbqZRb5XmSZZJYaam7EIJ16Fxedf+
jXAv4d/FVqiEM4BuSNsNMeBMx2Gq0lAfN33h+RMTjRoMb8yBsZsC063MLfXCk4p+
09gtGP7BS6Iy5XdmfY/fPHvA3JDEScdlDDmd6Lsbdwhv93Q8M6POVO9sv4HuS4t/
jEjr+NhE+Bjr/wDbyg7GL71BP1WPZpQnRE4OzoSrt5+bZVLvODWUFwinB0fLaGRk
GmI0r5EUOUd7HpYyoIQbiNlePGfPpHRKnmdXTTEZEoxeWWAaM1VhPGqfrB/Pnca+
vAJX7iBOb3kHinmfVOScsG/YAUR94wSELeY+UlEWJaELVUntrJ5HeRDiTChiVQ++
wnnjNbepaW6shopybUF3XXfhIb4NvwLWpvoKFXVtcVjlOujF0snVvpE+MRT0wacy
tHtjZs7Ao7GYxDz6H8AdBLKJW67uQon37a4MI260ADFMS+2vEAbNSFP+f6ii5mrB
18cY64ZaF6oU8bjGK7BArDx56bRc3WFyuBIGWAFHEuB948BcshXY7baf5jjzPmgz
mq1zdRthQB31MOM2ii6vuTkheAvKfFf+llH4M9SnES4NSF2hj9NnHga9V08wfhYc
x0W6qu+S8HUdVF+V23yTvUNgz4Q+UoGs4sHSDEsIBFqNvInnpUmtNgcR2L5PAgMB
AAGjUzBRMB0GA1UdDgQWBBTPo8kfze4P9EgxNuyk7+xDGFtAYzAfBgNVHSMEGDAW
gBTPo8kfze4P9EgxNuyk7+xDGFtAYzAPBgNVHRMBAf8EBTADAQH/MA0GCSqGSIb3
DQEBCwUAA4ICAQAKHomtmcGqyiLnhziLe97Mq2+Sul5QgYVwfx/KYOXxv2T8ZmcR
Ae9XFhZT4jsAOUDK1OXx9aZgDGJHJLNEVTe9zWv1ONFfNxEBxQgP7hhmDBWdtj6d
taqEW/Jp06X+08BtnYK9NZsvDg2YRcvOHConeMjwvEL7tQK0m+GVyQfLYg6jnrhx
egH+abucTKxabFcWSE+Vk0uJYMqcbXvB4WNKz9vj4V5Hn7/DN4xIjFko+nREw6Oa
/AUFjNnO/FPjap+d68H1LdzMH3PSs+yjGid+6Zx9FCnt9qZydW13Miqg3nDnODXw
+Z682mQFjVlGPCA5ZOQbyMKY4tNazG2n8qy2famQT3+jF8Lb6a4NGbnpeWnLMkIu
jWLWIkA9MlbdNXuajiPNVyYIK9gdoBzbfaKwoOfSsLxEqlf8rio1GGcEV5Hlz5S2
txwI0xdW9MWeGWoiLbZSbRJH4TIBFFtoBG0LoEJi0C+UPwS8CDngJB4TyrZqEld3
rH87W+Et1t/Nepoc/Eoaux9PFp5VPXP+qwQGmhir/hv7OsgBhrkYuhkjxZ8+1uk7
tUWC/XM0mpLoxsq6vVl3AJaJe1ivdA9xLytsuG4iv02Juc593HXYR8yOpow0Eq2T
U5EyeuFg5RXYwAPi7ykw1PW7zAPL4MlonEVz+QXOSx6eyhimp1VZC11SCg==
-----END CERTIFICATE-----
subject=CN = SnakeOil
issuer=CN = SnakeOil
---
No client certificate CA names sent
Peer signing digest: SHA256
Peer signature type: RSA-PSS
Server Temp Key: X25519, 253 bits
---
SSL handshake has read 2103 bytes and written 373 bytes
Verification error: self-signed certificate
---
New, TLSv1.3, Cipher is TLS_AES_256_GCM_SHA384
Server public key is 4096 bit
Secure Renegotiation IS NOT supported
Compression: NONE
Expansion: NONE
No ALPN negotiated
Early data was not sent
Verify return code: 18 (self-signed certificate)
---
KEYUPDATE
---
Post-Handshake New Session Ticket arrived:
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Session-ID: A02BEB9374E8D0755B834B52E0D184D8F8F62D1ADA7DE95836EC3886B3CF8D36
    Session-ID-ctx: 
    Resumption PSK: 4A25D9FEBA6E217066D5748A2C3BD06142A284F3142582DA92CC60BC876EB601945A3562A9BB1DB88988F08FFDF6E1E8
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 5f 48 6b 1e f4 2f 61 c2-f7 de 09 f9 4c 8c 21 01   _Hk../a.....L.!.
    0010 - 26 7d f9 78 58 08 ad e1-08 a6 c8 21 6d 62 08 cf   &}.xX......!mb..
    0020 - 7a 83 15 2a 80 70 03 28-b9 b6 d1 c6 bc aa c5 4d   z..*.p.(.......M
    0030 - 7b 79 4c 9c 9c 27 72 f2-bb b3 64 44 20 85 1f 54   {yL..'r...dD ..T
    0040 - 6d 75 3b e9 22 5b 65 5e-f7 04 3e 14 25 fc cf 32   mu;."[e^..>.%..2
    0050 - 8f 3a 1c 7d 8b 23 cd 90-ff 2a ce 74 8d a9 71 45   .:.}.#...*.t..qE
    0060 - de 8c 54 0d 08 bb ee 3a-ca d5 00 5b a9 bd 7b 2a   ..T....:...[..{*
    0070 - a7 69 f9 fd 60 da af d4-58 c3 5e aa 1c b8 2d e7   .i..`...X.^...-.
    0080 - 43 27 16 35 e0 bc 4b 2b-d6 1a db ac e0 36 db b7   C'.5..K+.....6..
    0090 - de 3b 4c c5 b5 36 bc 28-7c 57 85 a8 99 0f a5 03   .;L..6.(|W......
    00a0 - 99 67 27 31 8e 91 e8 d9-34 88 d5 ba 6c ed b3 7c   .g'1....4...l..|
    00b0 - c4 3d 92 fc 18 08 d3 10-61 cc d9 1b 52 d0 ee a9   .=......a...R...
    00c0 - 56 6e 26 a6 e5 e1 5b 1f-8b 84 08 c9 c6 46 be 76   Vn&...[......F.v
    00d0 - f6 0a 21 2d e9 d9 60 4f-39 81 87 b4 47 44 8d bf   ..!-..`O9...GD..

    Start Time: 1777350766
    Timeout   : 7200 (sec)
    Verify return code: 18 (self-signed certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK
---
Post-Handshake New Session Ticket arrived:
SSL-Session:
    Protocol  : TLSv1.3
    Cipher    : TLS_AES_256_GCM_SHA384
    Session-ID: C254A41D8F16E0F7C5DB2C0FB855348FF23571482EED8D175A227703FBF0C4A4
    Session-ID-ctx: 
    Resumption PSK: 4950D2CF4B753BCDF29961448FF6908D1C476C70D6A8B7BD3158C6DB402E7E3CA6B33F1041F86330A87E4BCF5C2BDF55
    PSK identity: None
    PSK identity hint: None
    SRP username: None
    TLS session ticket lifetime hint: 300 (seconds)
    TLS session ticket:
    0000 - 5f 48 6b 1e f4 2f 61 c2-f7 de 09 f9 4c 8c 21 01   _Hk../a.....L.!.
    0010 - 2d 71 b2 4f ad a5 01 c7-2b 83 96 4d ce 06 3d f3   -q.O....+..M..=.
    0020 - 65 11 e6 7c 00 23 55 12-d1 90 6d 5c ad 0f fb c5   e..|.#U...m\....
    0030 - 76 77 c1 57 b5 c9 64 87-9a fb f1 e2 3d 8a a2 91   vw.W..d.....=...
    0040 - 7c 37 4b 67 8a 46 cd 9b-80 0c 56 67 03 17 a2 ad   |7Kg.F....Vg....
    0050 - 43 d9 c5 8e 6e 9e 7b ba-97 3b a8 3c 23 cf cc f0   C...n.{..;.<#...
    0060 - 8c db db 88 35 3d 63 a2-92 3c 19 93 23 a5 0b 46   ....5=c..<..#..F
    0070 - e3 06 0d ec 52 63 e2 6e-06 3b 3b c7 e3 8a 8b 4c   ....Rc.n.;;....L
    0080 - 08 b8 39 97 d5 6a 59 ff-87 d3 c6 09 fa 29 3d 2b   ..9..jY......)=+
    0090 - 6f 19 73 d8 c4 4f 6f b2-a2 c4 cf dd 58 6d 28 cf   o.s..Oo.....Xm(.
    00a0 - 42 aa 48 c1 88 f2 3a 4a-64 55 62 e6 4e c7 31 6a   B.H...:JdUb.N.1j
    00b0 - 13 8f 53 01 03 fb 98 b6-8d 03 27 6a c0 c0 c2 2a   ..S.......'j...*
    00c0 - e9 56 95 3b a9 2b a5 08-73 9c c8 fa 02 03 9c ac   .V.;.+..s.......
    00d0 - 3d 57 8a ca c7 b1 ae a5-33 f8 4b 11 36 3c 95 ca   =W......3.K.6<..

    Start Time: 1777350766
    Timeout   : 7200 (sec)
    Verify return code: 18 (self-signed certificate)
    Extended master secret: no
    Max Early Data: 0
---
read R BLOCK
DONE
```

파이프라인으로 보내도 똑같은거 같다. keyupdate 기능을 아예 끄는게 좋아보여서 찾아보니 -quiet로 끌 수 있다.

```bash
bandit16@bandit:~$ cat /etc/bandit_pass/bandit16 | openssl s_client -connect localhost:31790 -quiet
Can't use SSL_get_servername
depth=0 CN = SnakeOil
verify error:num=18:self-signed certificate
verify return:1
depth=0 CN = SnakeOil
verify return:1
Correct!
-----BEGIN RSA PRIVATE KEY-----
<redacted private key>
-----END RSA PRIVATE KEY-----
```

# Level 17

![image.png](bandit/image%2020.png)

rsa 암호를 저장해두고 아까처럼 600으로 권한 설정후 접속해주자.

```bash
axii@fedora:~/bandit$ vi key17
axii@fedora:~/bandit$ chmod 600 key17 
axii@fedora:~/bandit$ ssh -i key17 bandit17@bandit.labs.overthewire.org -p 2220
                     
bandit17@bandit:~$ 
```

```bash
bandit17@bandit:~$ ls -al
total 36
drwxr-xr-x   3 root     root     4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root     4096 Apr  3 15:20 ..
-rw-r-----   1 bandit17 bandit17   33 Apr  3 15:17 .bandit16.password
-rw-r--r--   1 root     root      220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root     3851 Apr  3 15:10 .bashrc
-rw-r-----   1 bandit18 bandit17 3300 Apr  3 15:17 passwords.new
-rw-r-----   1 bandit18 bandit17 3300 Apr  3 15:17 passwords.old
-rw-r--r--   1 root     root      807 Mar 31  2024 .profile
drwxr-xr-x   2 root     root     4096 Apr  3 15:17 .ssh
bandit17@bandit:~$ diff passwords.new passwords.old
42c42
< <redacted>
---
> <redacted>
```

diff 명령어로 변경된 부분을 확인해보자.

따라서 비밀번호는 `<redacted>` 이다.

# Level 18

![image.png](bandit/image%2021.png)

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

# Level 19

![image.png](bandit/image%2022.png)

```bash
axii@fedora:~/bandit$ ssh bandit19@bandit.labs.overthewire.org -p 2220

bandit19@bandit:~$ ls -al
total 36
drwxr-xr-x   2 root     root      4096 Apr  3 15:17 .
drwxr-xr-x 150 root     root      4096 Apr  3 15:20 ..
-rwsr-x---   1 bandit20 bandit19 14888 Apr  3 15:17 bandit20-do
-rw-r--r--   1 root     root       220 Mar 31  2024 .bash_logout
-rw-r--r--   1 root     root      3851 Apr  3 15:10 .bashrc
-rw-r--r--   1 root     root       807 Mar 31  2024 .profile
bandit19@bandit:~$ file bandit20-do 
bandit20-do: setuid ELF 32-bit LSB executable, Intel 80386, version 1 (SYSV), dynamically linked, interpreter /lib/ld-linux.so.2, BuildID[sha1]=d9b51170e04af1b03902f80228afa7a973330f86, for GNU/Linux 3.2.0, not stripped
bandit19@bandit:~$ ./bandit20-do 
Run a command as another user.
  Example: ./bandit20-do whoami
bandit19@bandit:~$ ./bandit20-do whoami
bandit20
bandit19@bandit:~$ cat /etc/bandit_pass/bandit20
cat: /etc/bandit_pass/bandit20: Permission denied
bandit19@bandit:~$ ./bandit20-do cat /etc/bandit_pass/bandit20
<redacted>
```

./bandit20-do [명령어]를 하면 bandit20 권한으로 명령어를 실행해주는 파일같다.

# Level 20

![image.png](bandit/image%2023.png)

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

nc로 포트를 열고 20번 비밀번호를 그 포트에 보낸다음에 suconnect를 그 포트로 열어야 하는것같다.

처음에 포트 열었다가 백그라운드로 돌리려했는데 순서가 꼬여서 실패하고 다시열었다

명령어 끝에 &를 붙이면 백그라운드로 실행되므로 nc로 포트를 백그라운드로 열고 그 포트로 suconnect를 실행했다.

 

# Level 21

![image.png](bandit/image%2024.png)

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

# Level 22

![image.png](bandit/image%2025.png)

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

# Level 23

![image.png](bandit/image%2026.png)

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

분당 한번 bandit24의 권한으로 /usr/bin/cronjob_bandit24.sh 스크립트를 실행한다.

/usr/bin/cronjob_bandit24.sh를 해석해보면 다음과 같다.

shopt는 shell 옵션을 끄고 켤 수 있는 명령어다. 

shopt -s [옵션명]으로 키고 shopt -u [옵션명]으로 끌 수 있다.

nullglob 옵션은 *같은 glob 패턴이 매칭되지 않았을때 null로 남겨두는 옵션이다.

예시

```bash
shopt -u nullglob
echo *.txt 
*.txt

shopt -s nullglob
echo *.txt
```

myname은 bandit24다.

이후 /var/spool/bandit24/foo로 디렉토리 이동

* .*로 일반파일과 숨김파일을 전부 i에 넣고, .(현재 디렉토리)와 ..(상위 디렉토리)는 제외한다.

이후 파일별 소유자명을 owner변수에 저장하고 해당 소유자(owner)가 bandit23인 일반파일이면 실행한다.

timout은 60초

이후 파일을 삭제한다.

정리하자면 현재 디렉토리의 파일중에서 소유자가 bandit23인 일반파일만 bandit 24권한으로 실행하고 전체삭제한다는 뜻이다.

그럼 문제 설명에서 나와있다시피 제작해야할 스크립트는 /var/spool/bandit24/foo에 bandit23을 소유자로 하는 일반파일로 만들어야한다. 그 내용은 /etc/bandit_pass/bandit24의 내용을 읽어서 tmp에 넣어야한다.

풀이 스크립트는 mktemp -d를 통해 만든 tmp 디렉토리 안에다가 만들었다.

명령어 기록이 vi 쓰느라 날라가서 history로 쳤던 명령어만 첨부하겠다.

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

# Level 24

![image.png](bandit/image%2027.png)

```bash
axii@fedora:~/bandit$ ssh bandit24@bandit.labs.overthewire.org -p 2220

bandit24@bandit:~$ nc localhost 30002
I am the pincode checker for user bandit25. Please enter the password for user bandit24 and the secret pincode on a single line, separated by a space.
<redacted> 0001
Wrong! Please enter the correct current password and pincode. Try again.
<redacted> 0002
Wrong! Please enter the correct current password and pincode. Try again.
```

주어진대로 한번 연결 후 여러번 입력해도 괜찮다.

```python
from pwn import *
p=remote("localhost", 30002)

for i in range(10000):
    p.sendline(f"<redacted> {i:04d}".encode())

for l in p.recvall().decode().splitlines():
    if "Wrong" not in l:
        print(l)
```

굳이 스크립트가 아니라 pwntools 쓰는게 더 간단해 보였다.

따라서 다음과 같이 보내자.

```python
bandit24@bandit:/tmp/tmp.zyqWWpDiAK$ python3 sol.py 
Warning: _curses.error: setupterm: could not find terminal

Terminal features will not be available.  Consider setting TERM variable to your current terminal name (or xterm).
[x] Opening connection to localhost on port 30002
[x] Opening connection to localhost on port 30002: Trying 127.0.0.1
[+] Opening connection to localhost on port 30002: Done
[x] Receiving all data
[x] Receiving all data: 0B
[x] Receiving all data: 4.00KB
[x] Receiving all data: 8.00KB
[x] Receiving all data: 12.00KB
[x] Receiving all data: 16.00KB
[x] Receiving all data: 20.00KB
[x] Receiving all data: 24.00KB
[x] Receiving all data: 28.00KB
[x] Receiving all data: 32.00KB
[x] Receiving all data: 36.00KB
[x] Receiving all data: 40.00KB
[x] Receiving all data: 44.00KB
[x] Receiving all data: 48.00KB
[x] Receiving all data: 52.00KB
[x] Receiving all data: 56.00KB
[x] Receiving all data: 60.00KB
[x] Receiving all data: 64.00KB
[x] Receiving all data: 68.00KB
[x] Receiving all data: 72.00KB
[x] Receiving all data: 76.00KB
[x] Receiving all data: 80.00KB
[x] Receiving all data: 84.00KB
[x] Receiving all data: 88.00KB
[x] Receiving all data: 92.00KB
[x] Receiving all data: 96.00KB
[x] Receiving all data: 100.00KB
[x] Receiving all data: 104.00KB
[x] Receiving all data: 108.00KB
[x] Receiving all data: 112.00KB
[x] Receiving all data: 116.00KB
[x] Receiving all data: 120.00KB
[x] Receiving all data: 124.00KB
[x] Receiving all data: 128.00KB
[x] Receiving all data: 132.00KB
[x] Receiving all data: 136.00KB
[x] Receiving all data: 140.00KB
[x] Receiving all data: 144.00KB
[x] Receiving all data: 148.00KB
[x] Receiving all data: 152.00KB
[x] Receiving all data: 156.00KB
[x] Receiving all data: 160.00KB
[x] Receiving all data: 164.00KB
[x] Receiving all data: 168.00KB
[x] Receiving all data: 172.00KB
[x] Receiving all data: 176.00KB
[x] Receiving all data: 180.00KB
[x] Receiving all data: 184.00KB
[x] Receiving all data: 188.00KB
[x] Receiving all data: 192.00KB
[x] Receiving all data: 196.00KB
[x] Receiving all data: 200.00KB
[x] Receiving all data: 204.00KB
[x] Receiving all data: 208.00KB
[x] Receiving all data: 212.00KB
[x] Receiving all data: 216.00KB
[x] Receiving all data: 220.00KB
[x] Receiving all data: 224.00KB
[x] Receiving all data: 228.00KB
[x] Receiving all data: 232.00KB
[x] Receiving all data: 236.00KB
[x] Receiving all data: 240.00KB
[x] Receiving all data: 244.00KB
[x] Receiving all data: 248.00KB
[x] Receiving all data: 252.00KB
[x] Receiving all data: 256.00KB
[x] Receiving all data: 260.00KB
[x] Receiving all data: 264.00KB
[x] Receiving all data: 268.00KB
[x] Receiving all data: 272.00KB
[x] Receiving all data: 276.00KB
[x] Receiving all data: 280.00KB
[x] Receiving all data: 284.00KB
[x] Receiving all data: 288.00KB
[x] Receiving all data: 292.00KB
[x] Receiving all data: 296.00KB
[x] Receiving all data: 300.00KB
[x] Receiving all data: 304.00KB
[x] Receiving all data: 308.00KB
[x] Receiving all data: 312.00KB
[x] Receiving all data: 316.00KB
[x] Receiving all data: 320.00KB
[x] Receiving all data: 324.00KB
[x] Receiving all data: 328.00KB
[x] Receiving all data: 332.00KB
[x] Receiving all data: 336.00KB
[x] Receiving all data: 340.00KB
[x] Receiving all data: 344.00KB
[x] Receiving all data: 348.00KB
[x] Receiving all data: 352.00KB
[x] Receiving all data: 356.00KB
[x] Receiving all data: 360.00KB
[x] Receiving all data: 364.00KB
[x] Receiving all data: 368.00KB
[x] Receiving all data: 372.00KB
[x] Receiving all data: 376.00KB
[x] Receiving all data: 380.00KB
[x] Receiving all data: 384.00KB
[x] Receiving all data: 388.00KB
[x] Receiving all data: 392.00KB
[x] Receiving all data: 396.00KB
[x] Receiving all data: 400.00KB
[x] Receiving all data: 404.00KB
[x] Receiving all data: 408.00KB
[x] Receiving all data: 409.50KB
[x] Receiving all data: 413.50KB
[x] Receiving all data: 417.50KB
[x] Receiving all data: 421.50KB
[x] Receiving all data: 425.50KB
[x] Receiving all data: 429.50KB
[x] Receiving all data: 433.50KB
[x] Receiving all data: 437.50KB
[x] Receiving all data: 441.50KB
[x] Receiving all data: 445.50KB
[x] Receiving all data: 449.50KB
[x] Receiving all data: 453.50KB
[x] Receiving all data: 457.50KB
[x] Receiving all data: 461.50KB
[x] Receiving all data: 465.50KB
[x] Receiving all data: 469.50KB
[x] Receiving all data: 473.50KB
[x] Receiving all data: 477.50KB
[x] Receiving all data: 481.50KB
[x] Receiving all data: 485.50KB
[x] Receiving all data: 489.50KB
[x] Receiving all data: 493.50KB
[x] Receiving all data: 497.50KB
[x] Receiving all data: 501.50KB
[x] Receiving all data: 505.50KB
[x] Receiving all data: 509.50KB
[x] Receiving all data: 513.50KB
[x] Receiving all data: 517.50KB
[x] Receiving all data: 521.50KB
[x] Receiving all data: 525.50KB
[x] Receiving all data: 529.50KB
[x] Receiving all data: 533.50KB
[x] Receiving all data: 537.00KB
[x] Receiving all data: 541.00KB
[x] Receiving all data: 545.00KB
[x] Receiving all data: 549.00KB
[x] Receiving all data: 553.00KB
[x] Receiving all data: 557.00KB
[x] Receiving all data: 561.00KB
[x] Receiving all data: 565.00KB
[x] Receiving all data: 569.00KB
[x] Receiving all data: 573.00KB
[x] Receiving all data: 577.00KB
[x] Receiving all data: 581.00KB
[x] Receiving all data: 585.00KB
[x] Receiving all data: 585.36KB
[+] Receiving all data: Done (585.36KB)
[*] Closed connection to localhost port 30002
I am the pincode checker for user bandit25. Please enter the password for user bandit24 and the secret pincode on a single line, separated by a space.
Correct!
The password of user bandit25 is <redacted>

bandit24@bandit:/tmp/tmp.zyqWWpDiAK$ 
```
