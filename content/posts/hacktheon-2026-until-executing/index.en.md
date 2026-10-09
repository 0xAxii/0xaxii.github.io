---
title: "Hacktheon Sejong 2026 Quals Until Executing Writeup"
description: "Hacktheon Sejong 2026 Quals Until Executing writeup"
---

# Until Executing

### Summary

The binary is a stripped OCaml native executable, but `camlMain`, `camlProc_a_engine`, and `camlProc_b_engine` were still present in the dynamic symbols. The actual verifier runs in the child process after `fork()`, not in the parent.

### Analysis

The input must be 64 characters long and drawn from a fixed alphabet.

```text
length   = 64
alphabet = abcdefghijklmnopqrstuvwxyz_0123456789!
```

OCaml immediate integers are encoded as `(n << 1) | 1`. The `0x81` used as the length comparison value in the disassembly means 64.

Both `Proc_a_engine` and `Proc_b_engine` follow an `explode -> run -> collapse` structure. `run` accumulates check closures, and the checks only run in the final `collapse`. The title, Until Executing, refers to this.

Each character is converted from ASCII to its alphabet index, stored as a tagged value.

```text
a -> 1
b -> 3
c -> 5
...
```

I ported the current check and state update of `Proc_b` to Python to prune candidates. The branches shrank quickly until only one remained, and I verified that candidate again against the `Proc_a` checker.

The recovered internal string:

```text
ovajumher0erwkl28_i8eecp!hb5enitsj6ly5hx05qel7a2z1gb6y8vi4fd4l93
```

### Flag

`hacktheon2026{ovajumher0erwkl28_i8eecp!hb5enitsj6ly5hx05qel7a2z1gb6y8vi4fd4l93}`
