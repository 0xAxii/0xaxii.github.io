---
title: "HyperSonic CTF 2026 Mother Writeup"
description: "HyperSonic CTF 2026 Mother writeup"
---

# Mother

## Overview

`Mother` is an Oil-Vinegar style signature challenge over `GF(256)`. The challenge prints the public key, signs any non-target message, and verifies the final submission.

The challenge conditions are as follows.

- Category: `crypto`
- Goal: Forge and submit a valid signature for `b"Vinegar is not an orphan"`, a message the signing oracle refuses to sign.

The first thing to look at is the vinegar variables. Some vinegar coordinates stay fixed across every signature, so the affine subspace the signatures lie in can be recovered. From there, we find the oil space inside that space and sign the target message ourselves.

## Challenge analysis

The parameters in the provided Sage code are as follows.

```python
FF = GF(256)

M = 32
V = 46
N = M + V
K = 30
SIGN_LIMIT = 59
FLAG = os.environ.get("FLAG", "HS{fake_flag}")
```

There are `78` variables in total, `32` equations, and `46` vinegar variables. Signing first picks the vinegar values, then solves a linear system for the remaining `32` oil variables.

The central polynomial generation also shows that there are no oil-oil terms.

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

This function only fills coefficients for rows with index `i` less than `self.v`. In other words, there are no oil-oil quadratic terms in the hidden coordinate system. Once the oil space is recovered, the `P(o)=0` property turns signing into a linear problem.

The vinegar is sampled like this.

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

`mother` is not regenerated as a whole each time. Since `V=46` and `K=30`, the first `16` vinegar coordinates stay the same, and only the last `30` are refreshed by the PRNG.

The signing function picks this vinegar vector and then solves a linear system for the oil variables only.

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

The returned signature is a vector in the public coordinate system. In the hidden coordinate system, however, the first `16` vinegar coordinates are identical across all oracle signatures. So the oracle signatures lie only on a specific affine subspace of the full `78`-dimensional space.

Let `x` be a vector in the hidden coordinate system and `s` the public signature vector returned by the signing function. In the code, `Ti` is the inverse of `T`, so the returned signature satisfies the following.

```text
s = T^-1 x
x = T s
```

So the fact that the first `16` vinegar coordinates are fixed in the hidden coordinate system shows up in the public coordinate system as a direction space mapped through `T^-1`. Below, to avoid a name clash with `H = self.Si * self.hash(msg)` in the code, I call this 62-dimensional direction space `W`.

The target message is blocked from being signed directly.

```python
if msg == b"Vinegar is not an orphan":
    print("right!")
    continue
```
## Core idea

Taking differences of signatures cancels the fixed coordinates. `GF(256)` has characteristic 2, so subtraction and addition are the same.

Let the 59 oracle signatures be `s_0, s_1, ..., s_58` and define the difference space `D` as follows.

```text
D = span(s_i + s_0), 1 <= i <= 58
```

With the signatures I collected, `rank(D)=58`.

In the hidden coordinate system, there are two kinds of variables that can move along signature directions.

- the `30` refreshed vinegar coordinates
- the `32` oil coordinates

So the true signature direction space `W` has dimension `62`.

```text
W = T^-1({0}^16 x F_256^30 x F_256^32)
dim(W) = 30 + 32 = 62
```

However, only 58 difference vectors can be collected, so `D` alone does not determine `W`. The missing part is 4-dimensional.

```text
D <= W
dim(D) = 58
dim(W) = 62
```

The rest of the attack takes four steps.

1. Recover the 62-dimensional space `W` containing `D`.
2. Find part of the oil space (in public coordinates) inside `W`.
3. Use those oil vectors to recover the full oil space.
4. Build the target signature by solving a linear system.

## Solution

### Step 1. Collect the public key and 59 signatures

Running the program prints `n`, `m`, `v`, `k`, and `pubkey`. After that, menu `1. sign` returns signatures for non-target messages.

I collected the public key and signatures in the same session. Since there is no guarantee that the public key is the same across sessions, each public key was only paired with signatures from its own session.

```python
items = []
for i in range(59):
    msg = f"msg-{i}".encode()
    sig = sign_from_oracle(msg)
    if not verify(pub, msg, sig):
        raise RuntimeError(f"signature {i} verification failed")
    items.append({"msg": msg.hex(), "sig": sig.hex()})
```

The difference space `D` is built from the collected signatures.

```python
def build_D_and_Q(sigs):
    base = sigs[0]
    diffs = [list(s + base) for s in sigs[1:]]
    Drows = Matrix(F, diffs).row_space().basis_matrix()
    if Drows.nrows() != 58:
        raise RuntimeError(f"rank(D)={Drows.nrows()}, need 58")
    D = Drows.transpose()
```

Here `s + base` is the signature difference. In characteristic 2, `s - base` and `s + base` are the same.

### Step 2. Build the polar forms

Build the polar form `B_i` from each public quadratic matrix `P_i`.

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

This gives the bilinear part of the quadratic form `P(x)`.

```text
B_i(x, y) = P_i(x + y) + P_i(x) + P_i(y)
```

The rest of the analysis uses random linear combinations of the `B_i` in the public coordinate system.

### Step 3. Recover the 4-dimensional space complementing `D`

Pick an arbitrary complement `Q` of `D` to split the full space.

```text
F_256^78 = D direct_sum Q
dim(D) = 58
dim(Q) = 20
```

The true direction space `W` contains `D` and has dimension `62`. So `W` can be written using some 4-dimensional subspace `E` of `Q`.

```text
W = D direct_sum E
dim(E) = 4
```

In the solver, I appended standard basis vectors one at a time and kept only those that increased the `rank`.

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

What remains is to recover the 4-dimensional space `E` that completes `W` when added to `D`. This uses the rank constraint on the polar form restricted to `W`.

In the hidden coordinate system, `W` consists of `30` active vinegar coordinates and `32` oil coordinates. Since there are no oil-oil terms, restricting a random polar form `B_lambda` to `W` gives the following block structure.

```text
[ A    C ]
[ C^T  0 ]
```

Here `C` is a `30 x 32` matrix. So the restriction of `B_lambda` to `W` has rank at most `60`.

Writing the same form in blocks with respect to the direct sum of `D` and `Q` gives the following.

```text
[ A    C ]
[ C^T  G ]
```

When the restriction of `B_lambda` to `D` is invertible, the Schur complement can be computed.

```text
S = G + C^T A^-1 C
```

Since `W` is the direct sum of `D` and `E`, the rank constraint above reduces to a condition on the Schur complement `S` restricted to `E`.

```text
rank(S restricted to E) <= 2
```

`E` is 4-dimensional and `S` is an alternating form. The condition above is equivalent to the Pfaffian of `S` restricted to `E` being 0.

Let `e1, e2, e3, e4` be a basis of `E`. Restricting `S` to this basis gives a `4 x 4` alternating matrix, whose Pfaffian is a sum of products of the `S(ea, eb)`. Expanding this in the coordinates of `Q`, the coefficients are computed from `S` and the unknowns are the `4 x 4` minors of `E`. These minors are exactly the Plucker coordinates. So each random `B_lambda` gives one linear equation in the Plucker coordinates.

With the coordinates of `Q` labeled `0..19`, there are `4845` Plucker coordinates.

```text
binom(20, 4) = 4845
```

Each random `B_lambda` yields one row of length `4845`.

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

The Pfaffian formula for a 4-dimensional alternating matrix directly gives the row coefficients. Since we are in characteristic 2, signs need no special handling.

The solver stacks enough rows and checks whether the `right_kernel` becomes 1-dimensional.

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

The kernel vector `p` is the Plucker vector of `E`. To turn it back into an actual 4-dimensional subspace, use the following property.

```text
x in E  <=>  x wedge p = 0
```

If `p` is a decomposable Plucker vector coming from a 4-dimensional subspace `E`, then wedging `x` with `p` fails to increase the dimension exactly when `x` belongs to `E`. So `x wedge p = 0` is the condition for `x in E`. In a general exterior algebra each term carries a sign, but here we compute over `GF(2^8)`, where `-` and `+` coincide, so signs need no special handling.

The implementation collects the linear equations arising from this condition for every 5-tuple `J`.

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

Once `E` is known, the full direction space is recovered as `W = D.augment(E)`. In the actual run, I confirmed `rank(W)=62`.

### Step 4. Find an oil plane in the radical over `W`

After recovering `W`, restrict a random polar form to `W` and compute its radical.

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

Only cases where the radical has dimension `2` are used. The two resulting vectors are also checked against the public key to confirm `P(z)=0`. If the check fails, another random polar form is chosen.

The block structure above explains why the radical lies in the oil direction. Splitting `W` into the `30`-dimensional active vinegar part and the `32`-dimensional oil part, a random polar form has the shape `[A C; C^T 0]`. Generically `C` has rank `30`, so the radical condition kills the active vinegar component, leaving oil directions satisfying `C o = 0`. Since `C` is `30 x 32`, this kernel is usually 2-dimensional, and this subspace shows up as an oil plane.

Initially I also tried finding this 2-dimensional oil plane directly with MQ or SAT solvers, but got nothing useful within the time limit. So I took the detour of recovering `W` first and then looking at the radical.

### Step 5. Recover the full oil space

Given two oil vectors `u` and `v` in public coordinates, linear algebra recovers the full oil space. Oil vectors produce no oil-oil terms with each other, so any vector `x` in the oil space satisfies the following.

```text
B_i(u, x) = 0
B_i(v, x) = 0
```

Collecting these for every `i` gives a `64 x 78` linear system.

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

The run gave `dim(full oil)=32`, and every basis vector passed the `P(z)=0` check.

### Step 6. Sign the target message

With the full oil space known, signing works the same as in standard Oil-Vinegar. Pick a complement of the oil space in the public space and choose a random point `x0` on it. Then find the oil-direction correction `o`.

For a quadratic form, the following holds.

```text
P(x0 + o) = P(x0) + B(x0, o) + P(o)
```

If `o` is in the oil space, then `P(o)=0`. So for the target hash `h`, it suffices to solve the following linear equation.

```text
B(x0, o) = h + P(x0)
```

The implementation is as follows.

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

If `L` has full rank, the oil coefficients come from a single linear solve. Otherwise, pick a different `x0` and retry.

## Exploit / Solver

The solver only needs the public key and 59 signatures. The public key is parsed from the printed hex string into `32` matrices of size `78 x 78`, and each signature, a `78`-byte hex string, is converted into a `GF(256)` vector. I did not confirm the exact Sage version.

The solver is structured in the following order.

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

The values observed in the run are as follows.

```text
rank(D) = 58
dim(Q) = 20
Plucker kernel dimension = 1
rank(W) = 62
dim(full oil) = 32
target signature verifies
```

Finally, entering the forged signature in the submit menu passes verification for the target message.

## Result

The submission returned the flag.

```text
HS{I_l0v3_m0th3r_6ut_1_h2te_v1n3gar}
```
