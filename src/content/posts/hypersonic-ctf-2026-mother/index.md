---
title: "HyperSonic CTF 2026 Mother Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 Mother 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Crypto"]
draft: false
listed: false
---

***SSG Writeup***

# Mother

## 개요

`Mother`는 `GF(256)` 위에서 동작하는 Oil-Vinegar 계열 서명 문제입니다. 문제 코드는 공개키를 출력하고, 타깃이 아닌 메시지에 대한 서명을 만들어 주며, 최종 제출값을 검증하는 구조입니다.

문제의 조건은 다음과 같습니다.

- 카테고리: `crypto`
- 목표: 서명 오라클이 직접 서명해 주지 않는 메시지 `b"Vinegar is not an orphan"`의 유효한 서명을 만들어 제출합니다.

풀이에서 먼저 확인할 부분은 vinegar 변수입니다. 서명 과정에서 일부 vinegar 좌표가 모든 서명에서 고정되므로, 서명들이 놓이는 affine subspace를 복구할 수 있습니다. 그 뒤에는 이 공간에서 oil space를 찾아 타깃 메시지를 직접 서명합니다.

## 문제 분석

제공된 Sage 코드에서 파라미터는 다음과 같습니다.

```python
FF = GF(256)

M = 32
V = 46
N = M + V
K = 30
SIGN_LIMIT = 59
FLAG = os.environ.get("FLAG", "HS{fake_flag}")
```

여기서 전체 변수 수는 `78`, 방정식 수는 `32`, vinegar 변수 수는 `46`입니다. 서명할 때는 vinegar를 먼저 고르고, 남은 oil 변수 `32`개를 선형 방정식으로 구합니다.

central polynomial 생성 부분을 보면 oil-oil 항이 없다는 점도 확인할 수 있습니다.

```python
def random_central_polynomial(self):
    F = Matrix(FF, self.n)
    for i in range(self.v):
        for j in range(i, self.v):
            F[i, j] = FF.random_element()
        for j in range(self.v, self.n):
            F[i, j] = FF.random_element()
    return F
```

이 함수는 행 인덱스 `i`가 `self.v`보다 작은 경우만 계수를 채웁니다. 즉 숨겨진 좌표계에서는 oil-oil quadratic term이 없습니다. 나중에 oil space를 복구하면 `P(o)=0` 성질을 이용해 서명 문제를 선형 문제로 바꿀 수 있습니다.

vinegar 샘플링 부분도 중요합니다.

```python
self.mother = random_vector(FF, self.v)

random.seed(str(self.mother[:self.v - k]))
```

```python
def sample_vinegar(self):
    vinegar = list(self.mother)
    for i in range(self.v - self.k, self.v):
        vinegar[i] = FF.from_integer(random.randrange(256))
    return vector(FF, vinegar)
```

`mother` 전체를 매번 새로 생성하지 않는다는 점이 중요합니다. `V=46`, `K=30`이므로 앞의 `16`개 vinegar 좌표는 그대로 남고, 뒤의 `30`개 vinegar 좌표만 PRNG로 갱신됩니다.

서명 함수에서는 이 vinegar를 고른 뒤 oil 변수만 선형 방정식으로 구합니다.

```python
def sign(self, msg):
    H = self.Si * self.hash(msg)

    while True:
        vinegar = self.sample_vinegar()
        x0 = vector(FF, list(vinegar) + [0] * self.m)
        mat = Matrix(FF, [x0 * F for F in self.F])
        A = mat[:, self.v:]

        if A.rank() != self.m:
            continue

        oil = A.solve_right(H - mat * x0)
        x = vector(FF, list(vinegar) + list(oil))
        sig = self.vector_to_bytes(self.Ti * x)

        assert self.verify(msg, sig)
        return sig
```

반환되는 서명은 공개 좌표계의 벡터입니다. 하지만 숨겨진 좌표계로 보면 앞 `16`개의 vinegar 좌표가 모든 오라클 서명에서 같습니다. 따라서 오라클 서명들은 전체 `78`차원 공간에 흩어지지 않고, 특정 affine subspace 위에 놓입니다.

좌표계를 먼저 정리해두면 이후 계산이 더 명확해집니다. 숨겨진 좌표계의 벡터를 `x`, 서명 함수가 반환하는 공개 서명 벡터를 `s`라고 하겠습니다. 코드에서 `Ti`는 `T`의 역행렬이므로 서명 반환값은 다음 관계를 갖습니다.

```text
s = T^-1 x
x = T s
```

즉 숨겨진 좌표계에서 앞 `16`개의 vinegar 좌표가 고정된다는 성질은, 공개 좌표계에서는 `T^-1`로 옮겨진 방향공간으로 나타납니다. 아래에서는 코드 내부의 `H = self.Si * self.hash(msg)`와 이름이 충돌하지 않도록, 이 62차원 방향공간을 `W`라고 부르겠습니다.

제출 대상 메시지는 직접 서명할 수 없도록 막혀 있습니다.

```python
if msg == b"Vinegar is not an orphan":
    print("right!")
    continue
```

따라서 오라클에서 타깃 메시지의 서명을 직접 받는 방식은 사용할 수 없습니다.

## 핵심 아이디어

서명 차이를 보면 고정된 좌표가 사라집니다. `GF(256)`은 characteristic 2이므로 subtraction과 addition이 같습니다.

59개의 오라클 서명을 `s_0, s_1, ..., s_58`이라고 두고, 차이 공간 `D`를 다음처럼 잡습니다.

```text
D = span(s_i + s_0), 1 <= i <= 58
```

실제로 수집한 서명에서는 `rank(D)=58`이 나왔습니다.

숨겨진 좌표계에서 서명 방향으로 움직일 수 있는 변수는 두 종류입니다.

- 갱신되는 vinegar 좌표 `30`개
- oil 좌표 `32`개

따라서 실제 서명 방향 공간 `W`의 차원은 `62`입니다.

```text
W = T^-1({0}^16 x F_256^30 x F_256^32)
dim(W) = 30 + 32 = 62
```

하지만 수집 가능한 차이 벡터는 58개뿐이므로 `D`만으로는 `W`를 전부 알 수 없습니다. 부족한 부분은 4차원입니다.

```text
D <= W
dim(D) = 58
dim(W) = 62
```

이후 목표는 네 단계로 정리됩니다.

1. `D`를 포함하는 62차원 공간 `W`를 복구합니다.
2. `W` 안에서 공개 좌표계의 oil space 일부를 찾습니다.
3. oil vector 일부를 이용해 전체 oil space를 복구합니다.
4. 타깃 메시지의 서명을 선형 방정식으로 만듭니다.

## 풀이 과정

### Step 1. 공개키와 서명 59개 수집

프로그램을 실행하면 `n`, `m`, `v`, `k`, `pubkey`가 출력됩니다. 이후 `1. sign` 메뉴에서 타깃이 아닌 메시지의 서명을 받을 수 있습니다.

공개키와 서명은 같은 실행 세션에서 수집했습니다. 여러 실행 세션의 공개키가 같다고 가정할 수 없으므로, 한 번 받은 공개키에는 같은 세션에서 받은 서명만 대응시켰습니다.

```python
items = []
for i in range(59):
    msg = f"msg-{i}".encode()
    sig = sign_from_oracle(msg)
    if not verify(pub, msg, sig):
        raise RuntimeError(f"signature {i} verification failed")
    items.append({"msg": msg.hex(), "sig": sig.hex()})
```

수집한 서명으로 차이 공간 `D`를 만듭니다.

```python
def build_D_and_Q(sigs):
    base = sigs[0]
    diffs = [list(s + base) for s in sigs[1:]]
    Drows = Matrix(F, diffs).row_space().basis_matrix()
    if Drows.nrows() != 58:
        raise RuntimeError(f"rank(D)={Drows.nrows()}, need 58")
    D = Drows.transpose()
```

`s + base`는 여기서 서명 차이입니다. characteristic 2에서는 `s - base`와 `s + base`가 같습니다.

### Step 2. polar form 구성

공개 quadratic matrix `P_i`에서 polar form `B_i`를 만듭니다.

```python
def build_polar(Ps):
    Bs = []
    for P in Ps:
        B = P + P.transpose()
        for i in range(N):
            B[i, i] = F(0)
        Bs.append(B)
    return Bs
```

이 과정으로 quadratic form `P(x)`의 bilinear part를 얻습니다.

```text
B_i(x, y) = P_i(x + y) + P_i(x) + P_i(y)
```

이후 분석은 공개 좌표계에서 `B_i`들의 무작위 선형결합을 사용합니다.

### Step 3. `D`를 보완하는 4차원 공간 복구

`D`의 complement `Q`를 임의로 잡아 전체 공간을 나눕니다.

```text
F_256^78 = D direct_sum Q
dim(D) = 58
dim(Q) = 20
```

실제 방향 공간 `W`는 `D`를 포함하고 차원이 `62`입니다. 따라서 `Q` 안의 어떤 4차원 부분공간 `E`로 `W`를 표현할 수 있습니다.

```text
W = D direct_sum E
dim(E) = 4
```

풀이 코드에서는 표준기저를 하나씩 붙여 `rank`가 증가하는 열만 골랐습니다.

```python
full = D
qcols = []
rank = full.rank()
for i in range(N):
    col = Matrix(F, N, 1, list(standard_col(i)))
    cand = full.augment(col)
    new_rank = cand.rank()
    if new_rank > rank:
        qcols.append(standard_col(i))
        full = cand
        rank = new_rank
        if len(qcols) == 20:
            break
```

남은 일은 `D`에 붙여 `W`를 완성할 4차원 공간 `E`를 복구하는 것입니다. 여기서는 `W` 위로 제한한 polar form의 rank 제한을 사용합니다.

숨겨진 좌표계에서 `W`는 active vinegar `30`개와 oil `32`개로 구성됩니다. oil-oil 항이 없으므로 무작위 polar form `B_lambda`를 `W`에 제한하면 다음과 같은 블록 형태가 됩니다.

```text
[ A    C ]
[ C^T  0 ]
```

여기서 `C`는 `30 x 32` 행렬입니다. 따라서 `B_lambda`를 `W`에 제한한 행렬의 rank는 최대 `60`입니다.

`D`와 `Q`의 직합 기준에서 같은 form을 블록으로 쓰면 다음과 같습니다.

```text
[ A    C ]
[ C^T  G ]
```

`B_lambda`를 `D`에 제한한 부분이 invertible인 경우 Schur complement를 계산할 수 있습니다.

```text
S = G + C^T A^-1 C
```

`W`가 `D`와 `E`의 직합이므로, 위 rank 제한은 Schur complement `S`를 `E`에 제한했을 때의 조건으로 내려옵니다.

```text
rank(S restricted to E) <= 2
```

`E`는 4차원이고 `S`는 alternating form입니다. 위 조건은 `S`를 `E`에 제한한 form의 Pfaffian이 0이라는 조건과 같습니다.

`E`의 기저를 `e1, e2, e3, e4`라고 두겠습니다. `S`를 이 기저 위에 제한하면 `4 x 4` alternating matrix가 되고, 이 행렬의 Pfaffian은 `S(ea, eb)`들의 곱의 합으로 표현됩니다. 이 값을 `Q` 좌표계에서 전개하면 계수는 `S`에서 계산되고, 미지수는 `E`의 `4 x 4` minor들입니다. 이 minor들이 바로 Plucker 좌표입니다. 따라서 무작위 `B_lambda` 하나는 Plucker 좌표들에 대한 선형 방정식 하나를 줍니다.

`Q`의 좌표를 `0..19`라고 하면 Plucker 좌표는 `4845`개입니다.

```text
binom(20, 4) = 4845
```

무작위 `B_lambda` 하나마다 길이 `4845`의 행 하나를 만들 수 있습니다.

```python
def plucker_row(S):
    row = []
    for a, b, c, d in I4:
        row.append(
            S[a, b] * S[c, d]
            + S[a, c] * S[b, d]
            + S[a, d] * S[b, c]
        )
    return row
```

4차원 alternating matrix의 Pfaffian 공식이 그대로 행의 계수가 됩니다. characteristic 2이므로 부호는 따로 처리하지 않습니다.

풀이 코드에서는 이 행을 충분히 쌓은 뒤 `right_kernel`이 1차원이 되는지 확인했습니다.

```python
def recover_E(Bs, D, Q, initial_rows=4500, check_every=64, max_rows=5600):
    rows = []
    while len(rows) < max_rows:
        Mat = random_polar_combo(Bs)
        A = D.transpose() * Mat * D
        if A.rank() != 58:
            continue

        C = D.transpose() * Mat * Q
        G = Q.transpose() * Mat * Q
        X = A.solve_right(C)
        S = G + C.transpose() * X

        rows.append(plucker_row(S))

        if len(rows) >= initial_rows and len(rows) % check_every == 0:
            R = Matrix(F, rows)
            K = R.right_kernel()
            if K.dimension() == 1:
                p = K.basis()[0]
                Ecoords = recover_E_from_plucker(p)
                E = Q * Ecoords
                if E.rank() != 4:
                    raise RuntimeError(f"rank(E)={E.rank()}, need 4")
                return E
```

kernel 벡터 `p`는 `E`의 Plucker 벡터입니다. 이를 실제 4차원 부분공간으로 되돌릴 때는 다음 성질을 사용합니다.

```text
x in E  <=>  x wedge p = 0
```

`p`가 4차원 부분공간 `E`에서 온 decomposable Plucker 벡터라면, 어떤 벡터 `x`가 `E`에 속할 때만 `x`를 `p`에 wedge해도 차원이 늘어나지 않습니다. 따라서 `x wedge p = 0`이 `x in E`의 조건이 됩니다. 일반적인 exterior algebra에서는 항마다 부호가 붙지만, 여기서는 `GF(2^8)` 위에서 계산하므로 `-`와 `+`가 같아 부호를 따로 처리하지 않아도 됩니다.

구현에서는 모든 5-tuple `J`에 대해 이 조건에서 나오는 선형식을 모읍니다.

```python
def recover_E_from_plucker(p):
    rows = []
    for J in I5:
        row = [ZERO] * 20
        for j in J:
            sub = tuple(x for x in J if x != j)
            row[j] += p[IDX4[sub]]
        rows.append(row)

    M_wedge = Matrix(F, rows)
    K = M_wedge.right_kernel()
    if K.dimension() != 4:
        raise RuntimeError(f"dim(wedge kernel)={K.dimension()}, need 4")
    return K.basis_matrix().transpose()
```

`E`를 얻고 나면 `W = D.augment(E)`로 전체 방향 공간을 복구할 수 있습니다. 실제 실행에서는 `rank(W)=62`를 확인했습니다.

### Step 4. `W` 위 radical에서 oil plane 찾기

`W`를 복구한 뒤에는 무작위 polar form을 `W`에 제한하고 radical을 구합니다.

```python
def recover_oil_plane(Ps, Bs, W, max_tries=512):
    for t in range(max_tries):
        Mat = random_polar_combo(Bs)
        RW = W.transpose() * Mat * W
        K = RW.right_kernel()
        if K.dimension() != 2:
            continue

        UV = W * K.basis_matrix().transpose()
        u = UV.column(0)
        v = UV.column(1)
        if all(public_eval(Ps, z).is_zero() for z in (u, v)):
            return [u, v]

    raise RuntimeError("failed to recover a verified oil plane")
```

여기서는 radical 차원이 `2`인 경우만 사용합니다. 얻은 두 벡터가 실제로 `P(z)=0`을 만족하는지도 공개키로 검증합니다. 검증이 실패하면 다른 무작위 polar form을 선택합니다.

radical이 oil 방향으로 나오는 이유도 앞의 블록 형태에서 확인할 수 있습니다. `W`를 active vinegar `30`차원과 oil `32`차원으로 나누면 무작위 polar form은 `[A C; C^T 0]` 형태입니다. 일반적으로 `C`의 rank가 `30`이므로 radical 조건에서 active vinegar 성분은 사라지고, 남는 조건은 `C o = 0`을 만족하는 oil 방향입니다. `C`가 `30 x 32`이므로 보통 이 kernel은 2차원이고, 이 부분공간이 oil plane으로 나타납니다.

초기에는 이 2차원 oil plane을 MQ나 SAT로 직접 찾는 방식도 시도했지만, 제한 시간 안에서 의미 있는 결과를 얻지 못했습니다. 따라서 먼저 `W`를 복구한 뒤 radical을 보는 방식으로 우회했습니다.

### Step 5. 전체 oil space 복구

공개 좌표계의 oil vector `u`, `v` 두 개를 알면 전체 oil space를 선형대수로 복구할 수 있습니다. oil vector끼리는 oil-oil 항을 만들지 않으므로, oil space의 임의 벡터 `x`는 다음 조건을 만족합니다.

```text
B_i(u, x) = 0
B_i(v, x) = 0
```

이를 모든 `i`에 대해 모으면 `64 x 78` 선형시스템이 됩니다.

```python
def recover_full_oil(Ps, Bs, oil_plane):
    rows = []
    for z in oil_plane:
        for B in Bs:
            rows.append(list(z * B))

    L = Matrix(F, rows)
    K = L.right_kernel()
    if K.dimension() != 32:
        raise RuntimeError(f"dim(full oil)={K.dimension()}, need 32")

    Oil = K.basis_matrix()
    bad = sum(1 for z in Oil.rows() if not public_eval(Ps, z).is_zero())
    if bad:
        raise RuntimeError(f"{bad} recovered oil basis vectors fail P(z)=0")
    return Oil
```

실행 결과 `dim(full oil)=32`가 나왔고, 모든 basis vector가 `P(z)=0` 검증을 통과했습니다.

### Step 6. 타깃 메시지 서명

전체 oil space를 알고 나면 서명 생성은 일반적인 Oil-Vinegar 서명과 같습니다. 공개 공간에서 oil space의 complement를 하나 잡고, 그 위의 점 `x0`를 임의로 고릅니다. 그다음 oil 방향 보정값 `o`를 찾습니다.

quadratic form에 대해 다음 식이 성립합니다.

```text
P(x0 + o) = P(x0) + B(x0, o) + P(o)
```

`o`가 oil space에 있으면 `P(o)=0`입니다. 따라서 타깃 hash `h`에 대해 다음 선형 방정식을 풀면 됩니다.

```text
B(x0, o) = h + P(x0)
```

구현은 다음과 같습니다.

```python
def sign_with_oil(Ps, Bs, Oil, target_msg, max_tries=4096):
    h = hash_vec(target_msg)
    Vc = complement_rows(Oil, N - Oil.nrows())
    oil_rows = list(Oil.rows())

    for t in range(max_tries):
        x0 = vector(F, [ZERO] * N)
        for row in Vc:
            c = rnd()
            if c:
                x0 += c * row

        p0 = public_eval(Ps, x0)
        L = Matrix(F, M, M)
        for i, B in enumerate(Bs):
            xb = x0 * B
            for j, o in enumerate(oil_rows):
                L[i, j] = xb * o

        if L.rank() != M:
            continue

        coeffs = L.solve_right(h + p0)
        sig = vector(F, x0)
        for c, row in zip(coeffs, oil_rows):
            if c:
                sig += c * row

        if public_eval(Ps, sig) == h:
            return sig

    raise RuntimeError("failed to sign with recovered oil space")
```

`L`이 full rank이면 oil coefficient를 한 번의 선형 방정식 풀이로 구할 수 있습니다. 실패하면 다른 `x0`를 선택해 다시 시도합니다.

## Exploit / Solver

solver는 공개키와 59개의 서명만 있으면 됩니다. 공개키는 출력된 hex 문자열을 `78 x 78` 행렬 `32`개로 파싱하고, 서명은 각각 `78`바이트 hex 문자열을 `GF(256)` 벡터로 바꿉니다. 정확한 Sage 버전은 확인하지 못했습니다.

풀이 코드는 다음 순서로 구성됩니다.

```python
def solve(data, args):
    if args.seed is not None:
        random.seed(args.seed)

    Ps = parse_pub(data)
    sigs = parse_sigs(data)
    target_msg = bytes.fromhex(data.get("target_msg", TARGET.hex()))

    Bs = build_polar(Ps)
    D, Q = build_D_and_Q(sigs)

    E = recover_E(
        Bs,
        D,
        Q,
        initial_rows=args.initial_rows,
        check_every=args.check_every,
        max_rows=args.max_rows,
    )
    W = D.augment(E)
    w_rank = W.rank()
    if w_rank != 62:
        raise RuntimeError(f"rank(W)={w_rank}, need 62")

    oil_plane = recover_oil_plane(Ps, Bs, W)
    Oil = recover_full_oil(Ps, Bs, oil_plane)

    sig = sign_with_oil(Ps, Bs, Oil, target_msg)
    return {
        "sig": vec_to_hex(sig),
        "target_msg": target_msg.hex(),
        "rank_D": D.ncols(),
        "rank_W": w_rank,
        "dim_oil": Oil.nrows(),
    }
```

실행 결과 확인한 값은 다음과 같습니다.

```text
rank(D) = 58
dim(Q) = 20
Plucker kernel dimension = 1
rank(W) = 62
dim(full oil) = 32
target signature verifies
```

마지막으로 제출 메뉴에 위조 서명을 입력하면 타깃 메시지 검증을 통과합니다.

## 결과

제출 결과 flag를 확인했습니다.

```text
HS{I_l0v3_m0th3r_6ut_1_h2te_v1n3gar}
```
