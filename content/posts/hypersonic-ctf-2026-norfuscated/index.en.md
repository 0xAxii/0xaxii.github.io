---
title: "HyperSonic CTF 2026 NORfuscated Writeup"
description: "HyperSonic CTF 2026 NORfuscated writeup"
---

# NORfuscated

## Overview

`NORfuscated` is a reversing challenge whose input-validation logic is built as a circuit of NOR gates. The provided binary is a stripped 64-bit PIE ELF. The program takes an input and then prints either `Wrong!` or `Correct!`.

The conditions are as follows.

- Category: `reversing`
- Goal: find a `68`-byte input that makes `Correct!` print.
- Input requirement: after stripping the newline, the length must be exactly `68` bytes.

Validation runs through a serialized Boolean circuit. Nothing compares strings directly: the input bits feed into the circuit, and the program checks whether the final output bit is `1`.

## Challenge analysis

Notation used below:

- `wire[i]`: the value of `wire` number `i` in the Boolean circuit.
- `gate`: a NOR `gate` in the form `(dst, a, b)`.
- `input_groups`: a list indicating which `wire` each bit of each input byte maps to.
- `outputs`: the list of `wire`s read as the final output.

The output strings visible directly in the program are as follows.

```text
Enter flag:
Wrong!
Correct!
```

The strings alone don't reveal any comparison against the answer. The actual validation flow checks the input length, places the input bits onto the circuit's input `wire`s, and evaluates the NOR `gate`s in order.

In the circuit, each `gate` performs the following operation.

```text
wire[dst] = NOT (wire[a] OR wire[b])
```

Every operation is a single NOR, so the entire validation logic can be turned into a set of Boolean constraints over the input bits.

The serialized circuit data has the following format.

```text
u32 gate_count
gate_count * (u32 dst, u32 a, u32 b)
u32 output_count
output_count * u32 output_wire
u32 input_group_count
input_group_count * (u32 bit_count, bit_count * u32 input_wire)
```

The parse results are as follows.

```text
gate_count        = 344048
output_count      = 1
output_wire       = 344592
input_group_count = 68
bits per group    = 8
input_bits        = 544
```

Looking at the parse results, the `68`-byte input expands into a total of `544` input bits, which pass through many NOR `gate`s and converge into a single output `wire`. The task is to find an input that makes `wire[344592]` true.

## Core idea

Each NOR `gate`'s input-output relationship is a single Boolean constraint, so instead of reversing the program directly, I turned the whole circuit into a SAT problem.

There are `344048` `gate`s in total, but the ones that do not affect the final output `wire` can be skipped. Starting from `outputs` and following each `gate`'s input `wire`s backward, we can obtain the set of `wire`s needed to compute the output. We then add only the `gate`s in this set to the `solver`.

The strategy:

```text
1. Parse the circuit data.
2. Trace back only the wires that affect the final output wire.
3. Represent the 68-byte input as z3.BitVec.
4. Connect each input bit to its corresponding wire.
5. Add the NOR gates as Boolean constraints.
6. Ask the solver to make the final output wire true.
```

The recovered input must be a string that is actually submittable, so I also added a printable-ASCII constraint to the `solver`. Even with this restriction, it returned `sat` and passed validation.

## Solution walkthrough

### Step 1. Checking the input length and output condition

The validation logic strips the newline and then checks whether the input length is `0x44`, i.e. `68` bytes. If the length doesn't match, it never reaches the circuit evaluation.

So the value the `solver` must produce is `68` bytes. Each byte is split into `8` bits and connected to a total of `544` circuit input `wire`s.

### Step 2. Parsing the serialized circuit

The circuit data is stored like an array of `u32` values. First comes the `gate` count, then the 3 values `(dst, a, b)` repeat. After that come the output `wire` list and the input-bit mapping.

After parsing, the first byte connects to `wire[1]` through `wire[8]`, the second byte connects to `wire[9]` through `wire[16]`, and so on. There is a single final output, and the target `wire` is `344592`.

With the information from this stage, the `solver` connects the input bytes it represents as `z3.BitVec` to the circuit `wire`s.

### Step 3. Tracing the `gate`s needed for the output `wire`

We could put all `gate`s into the `solver` and still solve it, but that adds many unnecessary constraints. So, starting from `output_wire`, we find the `gate` that produces that `wire`, then trace back that `gate`'s inputs `a` and `b`.

Repeating this gives the set of `wire`s that affect the final output. Then, iterating over the `gate`s, we add a constraint only when `dst` is in this set.

### Step 4. Converting to NOR constraints

Each input byte is made as a `z3.BitVec`, and according to `input_groups` is mapped bit by bit onto a Boolean `wire`.

```text
wire[input_wire] = selected input bit is 1
```

Then each NOR `gate` is turned into the following Boolean expression.

```text
wire[dst] = Not(Or(wire[a], wire[b]))
```

Finally, adding the condition that `wire[344592]` is `true` lets the `solver` find a `68`-byte input that satisfies it.

## Exploit / Solver

The `solver` parses the circuit, picks only the `gate`s needed for the output, converts them into `z3` constraints, then recovers the byte values from the model. For the start offset and length of the circuit data, I used `0x4FFC` and `0x3F08E0`, which were determined during analysis.

```python
import struct

import z3


RODATA_OFF = 0x4FFC
RODATA_LEN = 0x3F08E0
INPUT_LEN = 68


def parse_circuit(program):
    blob = program[RODATA_OFF : RODATA_OFF + RODATA_LEN]
    pos = 0

    gate_count = struct.unpack_from("<I", blob, pos)[0]
    pos += 4

    gates = []
    for _ in range(gate_count):
        gates.append(struct.unpack_from("<III", blob, pos))
        pos += 12

    output_count = struct.unpack_from("<I", blob, pos)[0]
    pos += 4
    outputs = list(struct.unpack_from(f"<{output_count}I", blob, pos))
    pos += 4 * output_count

    input_group_count = struct.unpack_from("<I", blob, pos)[0]
    pos += 4

    input_groups = []
    for _ in range(input_group_count):
        bit_count = struct.unpack_from("<I", blob, pos)[0]
        pos += 4
        input_groups.append(list(struct.unpack_from(f"<{bit_count}I", blob, pos)))
        pos += 4 * bit_count

    return gates, outputs, input_groups


def output_cone(gates, outputs):
    by_dest = {dst: (a, b) for dst, a, b in gates}
    needed = set(outputs)
    stack = list(outputs)

    while stack:
        dst = stack.pop()
        if dst not in by_dest:
            continue

        for src in by_dest[dst]:
            if src not in needed:
                needed.add(src)
                stack.append(src)

    return needed


def solve(program):
    gates, outputs, input_groups = parse_circuit(program)
    needed = output_cone(gates, outputs)

    bytes_ = [z3.BitVec(f"b{i}", 8) for i in range(INPUT_LEN)]
    solver = z3.Solver()

    for b in bytes_:
        solver.add(b >= 0x20, b <= 0x7E)

    wires = {}
    for byte_index, group in enumerate(input_groups):
        for bit_index, wire in enumerate(group):
            if wire in needed:
                bit = z3.Extract(bit_index, bit_index, bytes_[byte_index])
                wires[wire] = bit == 1

    for dst, a, b in gates:
        if dst in needed:
            wires[dst] = z3.Not(z3.Or(wires[a], wires[b]))

    solver.add(wires[outputs[0]] == True)

    if solver.check() != z3.sat:
        raise RuntimeError("unsat")

    model = solver.model()
    return bytes(model.eval(b, model_completion=True).as_long() for b in bytes_)
```

This code does not emulate the validation function. It extracts only the `gate` relationships and turns them into constraints for the `solver`. Because the serialization order of the NOR `gate`s matches the evaluation order, we can build the constraints by filling in the needed `wire`s from the front.

## Result

Feeding the input the `solver` recovered into the program passes validation as follows.

```text
HS{f89020f327be2051d14b23b5d26bf7433c86a499d3ec3f5b06d88a67e58c2d3e}
Correct!
```

The flag is as follows.

```text
HS{f89020f327be2051d14b23b5d26bf7433c86a499d3ec3f5b06d88a67e58c2d3e}
```
