---
title: "Ethernaut 32 Impersonator"
description: "Ethernaut 32 Impersonator writeup"
---

## Challenge
### Description
SlockDotIt’s new product, ECLocker, integrates IoT gate locks with Solidity smart contracts, utilizing Ethereum ECDSA for authorization.
When a valid signature is sent to the lock, the system emits an Open event, unlocking doors for the authorized controller.
SlockDotIt has hired you to assess the security of this product before its launch.
Can you compromise the system in a way that anyone can open the door?
### Code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "openzeppelin-contracts-08/access/Ownable.sol";

// SlockDotIt ECLocker factory
contract Impersonator is Ownable {
    uint256 public lockCounter;
    ECLocker[] public lockers;

    event NewLock(address indexed lockAddress, uint256 lockId, uint256 timestamp, bytes signature);

    constructor(uint256 _lockCounter) {
        lockCounter = _lockCounter;
    }

    function deployNewLock(bytes memory signature) public onlyOwner {
        // Deploy a new lock
        ECLocker newLock = new ECLocker(++lockCounter, signature);
        lockers.push(newLock);
        emit NewLock(address(newLock), lockCounter, block.timestamp, signature);
    }
}

contract ECLocker {
    uint256 public immutable lockId;
    bytes32 public immutable msgHash;
    address public controller;
    mapping(bytes32 => bool) public usedSignatures;

    event LockInitializated(address indexed initialController, uint256 timestamp);
    event Open(address indexed opener, uint256 timestamp);
    event ControllerChanged(address indexed newController, uint256 timestamp);

    error InvalidController();
    error SignatureAlreadyUsed();

    /// @notice Initializes the contract the lock
    /// @param _lockId uinique lock id set by SlockDotIt's factory
    /// @param _signature the signature of the initial controller
    constructor(uint256 _lockId, bytes memory _signature) {
        // Set lockId
        lockId = _lockId;

        // Compute msgHash
        bytes32 _msgHash;
        assembly {
            mstore(0x00, "\x19Ethereum Signed Message:\n32") // 28 bytes
            mstore(0x1C, _lockId) // 32 bytes
            _msgHash := keccak256(0x00, 0x3c) //28 + 32 = 60 bytes
        }
        msgHash = _msgHash;

        // Recover the initial controller from the signature
        address initialController = address(1);
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, _msgHash) // 32 bytes
            mstore(add(ptr, 32), mload(add(_signature, 0x60))) // 32 byte v
            mstore(add(ptr, 64), mload(add(_signature, 0x20))) // 32 bytes r
            mstore(add(ptr, 96), mload(add(_signature, 0x40))) // 32 bytes s
            pop(
                staticcall(
                    gas(), // Amount of gas left for the transaction.
                    initialController, // Address of `ecrecover`.
                    ptr, // Start of input.
                    0x80, // Size of input.
                    0x00, // Start of output.
                    0x20 // Size of output.
                )
            )
            if iszero(returndatasize()) {
                mstore(0x00, 0x8baa579f) // `InvalidSignature()`.
                revert(0x1c, 0x04)
            }
            initialController := mload(0x00)
            mstore(0x40, add(ptr, 128))
        }

        // Invalidate signature
        usedSignatures[keccak256(_signature)] = true;

        // Set the controller
        controller = initialController;

        // emit LockInitializated
        emit LockInitializated(initialController, block.timestamp);
    }

    /// @notice Opens the lock
    /// @dev Emits Open event
    /// @param v the recovery id
    /// @param r the r value of the signature
    /// @param s the s value of the signature
    function open(uint8 v, bytes32 r, bytes32 s) external {
        address add = _isValidSignature(v, r, s);
        emit Open(add, block.timestamp);
    }

    /// @notice Changes the controller of the lock
    /// @dev Updates the controller storage variable
    /// @dev Emits ControllerChanged event
    /// @param v the recovery id
    /// @param r the r value of the signature
    /// @param s the s value of the signature
    /// @param newController the new controller address
    function changeController(uint8 v, bytes32 r, bytes32 s, address newController) external {
        _isValidSignature(v, r, s);
        controller = newController;
        emit ControllerChanged(newController, block.timestamp);
    }

    function _isValidSignature(uint8 v, bytes32 r, bytes32 s) internal returns (address) {
        address _address = ecrecover(msgHash, v, r, s);
        require (_address == controller, InvalidController());

        bytes32 signatureHash = keccak256(abi.encode([uint256(r), uint256(s), uint256(v)]));
        require (!usedSignatures[signatureHash], SignatureAlreadyUsed());

        usedSignatures[signatureHash] = true;

        return _address;
    }
}
```
## Background

---

ECDSA stands for Elliptic Curve Digital Signature Algorithm.
ECDSA is typically used to provide three guarantees:
- Authentication: verifies that the signature came from the holder of a specific private key
- Integrity: verifies that the message has not been modified
- Non-repudiation: makes it hard to produce the same signature without the private key

ECDSA is not an encryption algorithm. It is used to prove that the holder of a specific private key signed a given message.

---

ECDSA usually works over an elliptic curve defined over a prime field.
The finite field for a prime $p$ is written as follows.
$$
\mathbb{F}_p = \{0,1,2,\dots,p-1\}
$$
Coordinate arithmetic on the curve is done $\bmod p$.
A general elliptic curve looks like this.
$$
E: y^2 \equiv x^3 + ax + b \pmod p
$$
Points on the curve must satisfy the following.
$$
(x,y)\in\mathbb{F}_p^2
$$
On top of that, we add the point at infinity $O$ as the identity element.

---

Points on an elliptic curve have an addition operation.
For points $P=(x_1,y_1), \quad Q=(x_2,y_2)$, $P+Q = (x_3,y_3)$ is computed by the following rules.
First, when P and Q are different, the slope is computed as follows.
$$
\lambda \equiv \frac{y_2-y_1}{x_2-x_1} \pmod p
$$
Division here is done as multiplication by the modular inverse.
$$
\frac{a}{b} \equiv a\cdot b^{-1}\pmod p
$$
The coordinates are computed as follows.
$$
x_3 \equiv \lambda^2 - x_1 - x_2 \pmod p
$$
$$
y_3 \equiv \lambda(x_1-x_3)-y_1 \pmod p
$$

---

Now consider the case where P and Q are equal, i.e. $2P=P+P$.
The slope is as follows.
$$
\lambda \equiv \frac{3x_1^2+a}{2y_1} \pmod p
$$
Each coordinate is computed similarly to the above.
$$
x_3 \equiv \lambda^2 - 2x_1 \pmod p
$$
$$
y_3 \equiv \lambda(x_1-x_3)-y_1 \pmod p
$$

---

In ECDSA, scalar multiplication is computed by repeated point addition.
$$
kG = \underbrace{G+G+\cdots+G}_{k\text{ times}}
$$
where
- $G$: base point
- $k$: an integer
- $kG$: another point on the elliptic curve

This operation is easy to compute, but in the other direction, given
$$
Q = dG
$$
finding d is known to be very hard.
This hardness is the elliptic curve discrete logarithm problem, ECDLP.
ECDSA is based on ECDLP.
To use ECDSA, the curve parameters must be fixed first.
The following values are usually public.
$$
(p,a,b,G,n,h)
$$
Their meanings are as follows.
- $p$: the prime that determines the size of the finite field
- $a, b$: the coefficients of the elliptic curve
- $G$: base point
- $n$: the order of the subgroup generated by $G$
- $h$: cofactor

The order of the subgroup generated by base point G being $n$ means that
$$
nG = \mathcal{O}
$$
and for no smaller positive integer $t$ does
$$
tG = \mathcal{O}
$$
hold.
In ECDSA, $n$ is usually a large prime.
The private key $d$ is a single integer.
$$
d \in \{1,2,\dots,n-1\}
$$
The public key is defined as follows.
$$
Q=dG
$$
Here $Q$ is a point on the elliptic curve.

Computing the public key $Q$ from the private key $d$ is easy.

But finding $d$ given only the public key $Q$ and the base point $G$ is hard.

---

Let $m$ be the message to sign.
ECDSA does not sign the whole message directly; it hashes it first.
$$
e = H(m)
$$
This hash is then interpreted as an integer, usually denoted z.
$$
z = \operatorname{int}(H(m))
$$
If the hash is longer than the bit length of $n$, only the leftmost bits needed are used.

Suppose we sign message $m$ with private key $d$.
First, pick a random integer $k$.
$$
k \in \{1,2,\dots,n-1\}
$$
This $k$ must never be leaked or reused.

Now compute the point $R$.
$$
R = kG
$$
Writing $R$ in coordinates gives the following.
$$
R = (x_R, y_R)
$$
The first signature value $r$ is derived from $x_R$.
$$
r \equiv x_R \pmod n
$$

If $r=0$, a different $k$ must be chosen.

$x_R$ is an element of $\mathbb{F}_p$, but to produce $r$ it is interpreted as an integer and then reduced $\bmod n$.

The second signature value $s$ is computed as follows.
$$
s \equiv k^{-1}(z + rd) \pmod n
$$
If $s = 0$, pick a different $k$ and start over.

The final signature is $(r,s)$.

---

The verifier has the message $m$, the signature $(r,s)$, and the public key $Q$.

The verifier does not know the private key $d$.

First, check that the signature values are within the valid range.
$$
1\le r, s \le n-1
$$
If they are out of range, reject.

Next, compute the message hash and the inverse of $s$.
$$
\begin{aligned}
z &= \operatorname{int}(H(m)) \\
w &\equiv s^{-1} \pmod n
\end{aligned}
$$

From these values the verifier builds $u_1$, $u_2$, and $X$.
$$
\begin{aligned}
u_1 &\equiv zw \pmod n \\
u_2 &\equiv rw \pmod n \\
X &= u_1G + u_2Q
\end{aligned}
$$

Writing $X$ in coordinates gives the following.
$$
X = (x_X, y_X)
$$

For the signature to be valid, the following must hold.
$$
r \equiv x_X \pmod n
$$

Why this verification works can be shown algebraically.
During signing we had the following equation.
$$
s \equiv k^{-1}(z + rd) \pmod n
$$

Multiplying both sides by $k$ gives the following.
$$
ks \equiv z + rd \pmod n
$$

Then multiply both sides by $s^{-1}$.
$$
k \equiv s^{-1}(z+rd) \pmod n
$$

Since verification defines $w = s^{-1}$, we can write this as follows.
$$
k \equiv w(z+rd) \pmod n
$$

Expanding it:
$$
k \equiv wz + wrd \pmod n
$$

The verifier computes $u_1 = zw$ and $u_2 = rw$.
This gives the following relation.
$$
k \equiv u_1 + u_2d \pmod n
$$

Now multiply both sides by $G$.
$$
\begin{aligned}
kG &\equiv (u_1 + u_2d)G \\
   &= u_1G + u_2dG
\end{aligned}
$$

Since the public key is $Q = dG$, this becomes the following.
$$
kG = u_1G + u_2Q
$$

So the point the verifier computes is the following.
$$
X = u_1G + u_2Q = kG = R
$$

In conclusion, the $r$ produced by the signer must equal the $x$ coordinate of the $X$ computed by the verifier.
$$
r = x_R \bmod n = x_X \bmod n
$$

---

The most dangerous part of ECDSA is $k$.
The signing equation is as follows.
$$
s\equiv k^{-1}(z + rd) \pmod n
$$

Solving for the private key $d$ gives the following.
$$
d \equiv r^{-1}(sk - z) \pmod n
$$

So if an attacker knows $k$, they can recover the private key $d$ immediately.

Suppose two messages $m_1$ and $m_2$ are signed with the same $k$.

Let their hashes be $z_1$ and $z_2$, and the signatures be $(r,s_1)$ and $(r,s_2)$.

Using the same $k$ yields the same $R=kG$, and therefore the same $r$.
The signing equations are as follows.
$$
\begin{aligned}
s_1 &\equiv k^{-1}(z_1 + rd) \pmod n \\
s_2 &\equiv k^{-1}(z_2 + rd) \pmod n
\end{aligned}
$$

Subtracting the two cancels out the private key term.
$$
s_1 - s_2 \equiv k^{-1}(z_1-z_2) \pmod n
$$

So $k$ can be computed as follows.
$$
k \equiv \frac{z_1-z_2}{s_1-s_2} \pmod n
$$

Writing modular division as multiplication by the inverse:
$$
k \equiv (z_1-z_2)(s_1-s_2)^{-1} \pmod n
$$

Once $k$ is known, the private key can be recovered as well.
$$
d \equiv r^{-1}(s_1k-z_1) \pmod n
$$

---

By the explanation above, a signature can be verified with $(r, s)$.
Ethereum signatures also carry a $v$ value. Ethereum uses a function like `ecrecover(z, v, r, s)`. `ecrecover` returns the signer's address if the signature is valid, and `address(0)` on failure.

An Ethereum address is derived from the public key.
If the public key is $Q=(x_Q,y_Q)$, the address is determined roughly as follows.
$$
hash = keccak256(x_Q || y_Q)
$$

The last 20 bytes of this `hash` become the address.
So if `ecrecover` can recover the public key $Q$ from a signature, it can also derive the corresponding address.

The catch is that $r$ in the signature comes from the $x$ coordinate of the point $R=kG$ created during signing.

On an elliptic curve, there are usually two points with the same $x$ value: $(x, y)$ and $(x, -y)$.

So $r$ alone does not tell you which of the two is the actual $R$.

The recovery id $v$ tells you which point to use.
In this challenge, as with typical Ethereum signatures, $v$ is either 27 or 28.

## Code analysis

---

`Impersonator` is a factory contract. Only the owner can call `deployNewLock`, which deploys a new `ECLocker`.
```solidity
function deployNewLock(bytes memory signature) public onlyOwner {
    ECLocker newLock = new ECLocker(++lockCounter, signature);
    lockers.push(newLock);
    emit NewLock(address(newLock), lockCounter, block.timestamp, signature);
}
```
The `NewLock` event logs the `signature` as-is. This means an attacker can pull the initial controller's signature used to create the new lock straight from the event logs.

---

Looking at the `ECLocker` constructor, it first builds a fixed message hash per lock.
```solidity
assembly {
    mstore(0x00, "\x19Ethereum Signed Message:\n32")
    mstore(0x1C, _lockId)
    _msgHash := keccak256(0x00, 0x3c)
}
```
So the signed message is the `lockId`. This value is stored in `msgHash`, and the same `msgHash` is used afterwards in `open` and `changeController`.
Next, it extracts `v, r, s` from the `_signature` passed to the constructor and calls `ecrecover`.
```solidity
mstore(ptr, _msgHash)
mstore(add(ptr, 32), mload(add(_signature, 0x60)))
mstore(add(ptr, 64), mload(add(_signature, 0x20)))
mstore(add(ptr, 96), mload(add(_signature, 0x40)))
```
The `ecrecover` precompile takes its input in `(hash, v, r, s)` order, so `_signature` is effectively passed in the usual `(r, s, v)` layout. The recovered address becomes `initialController`, and that address is set as the lock's controller.

---

Next is the signature replay protection.
```solidity
usedSignatures[keccak256(_signature)] = true;
```
The constructor hashes the entire `_signature` bytes and marks it as used. However, the actual verification function hashes the signature differently.
```solidity
bytes32 signatureHash = keccak256(abi.encode([uint256(r), uint256(s), uint256(v)]));
require (!usedSignatures[signatureHash], SignatureAlreadyUsed());
```
The constructor uses `keccak256(_signature)`, while `_isValidSignature` uses `keccak256(abi.encode([r, s, v]))`. Even for the same signature, the bytes being hashed differ, so a signature marked as used in the constructor is not recognized as used by the verification function.
Simply replaying the initial signature from the event works. That said, we can also use the malleability of ECDSA signatures themselves.

---

Both `open` and `changeController` execute as long as `_isValidSignature` passes.
```solidity
function changeController(uint8 v, bytes32 r, bytes32 s, address newController) external {
    _isValidSignature(v, r, s);
    controller = newController;
    emit ControllerChanged(newController, block.timestamp);
}
```
And `_isValidSignature` only checks whether the result of `ecrecover(msgHash, v, r, s)` equals the current `controller`.
```solidity
address _address = ecrecover(msgHash, v, r, s);
require (_address == controller, InvalidController());
```
It does not check that `s` is in the lower half, nor does it use a safe wrapper like OpenZeppelin's `ECDSA.recover`. So we can craft a different form of the signature that recovers to the same signer address.
The attack plan is as follows.
1. Get the initial signature `(r, s, v)` from the `NewLock` event.
2. Either reuse the original signature as-is, or use malleability to craft another valid signature.
3. Use that signature to pass `changeController` and set `controller` to `address(0)`.
4. From then on, anyone can call `open` by submitting an invalid signature that makes `ecrecover` return `address(0)`.

## Solution

Suppose we have the signature obtained from the event.
$$
(r,s,v)
$$

As shown above, simply reusing the original signature is possible.
Here, ECDSA malleability gives a different valid signature.

The point computed during signature verification ultimately comes down to the $x$ coordinate of $R$.

But $R$ and $-R$ differ only in the sign of their $y$ coordinate; their $x$ coordinates are the same.

So if we can produce $-R$ instead of $R$, verification passes with the same $r$.

If the original verification computed
$$
R = s^{-1}zG + s^{-1}rQ
$$
then replacing $s$ with $-s$ gives the following.
$$
(-s)^{-1}zG + (-s)^{-1}rQ = -s^{-1}(zG+rQ) = -R
$$

So replacing $s$ with $-s$ produces $-R$, and since $R$ and $-R$ share the same $x$ coordinate, the check against the same $r$ passes.

$-s$ is not passed as a negative number; it must be represented $\bmod n$.
$$
-s \equiv n - s \pmod n
$$

So the new $s$ value is $n-s$.

Now $v$ must be changed as well.

$v$ takes the values 27 and 28 and indicates which of the two $y$ coordinates $R$ has.

Since we replaced $R$ with $-R$, $v$ must be flipped to the other value.

If $v$ is 27 or 28, the opposite value is computed as follows.
$$
v' = 55 - v
$$

So instead of the original signature, we use the following.
$$
(r,n-s,55-v)
$$

This is a different signature from the original, but it recovers to the same controller address.

### Exploit
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";

interface IECLocker {
    function changeController(uint8 v, bytes32 r, bytes32 s, address newController) external;
}

contract Sol32 is Script {
    uint256 private constant SECP256K1_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        IECLocker target = IECLocker(0x46887e09d735a4E2081A253cD78c656093183bD2);
        bytes memory signature =
            hex"1932cb842d3e27f54f79f7be0289437381ba2410fdefbae36850bee9c41e3b9178489c64a0db16c40ef986beccc8f069ad5041e5b992d76fe76bba057d9abff21b";

        uint8 v;
        bytes32 r;
        bytes32 s;

        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }

        vm.startBroadcast(privateKey);
        target.changeController(55 - v, r, bytes32(SECP256K1_N - uint256(s)), address(0));
        vm.stopBroadcast();
    }
}
```
![screenshot](./image-1.png)
