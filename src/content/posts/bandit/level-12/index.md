---
title: "OverTheWire Bandit Level 12 -> 13"
published: 2026-04-28
description: "OverTheWire Bandit Level 12에서 Level 13로 가는 문제 풀이."
category: "CTF/Wargame"
tags: ["OverTheWire", "Bandit", "Wargame", "Linux", "SSH"]
listed: false
---

## Level 12 -> 13
![image.png](../bandit/image%2015.png)

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
