---
title: "HyperSonic CTF 2026 ele Writeup"
published: 2026-06-08
description: "HyperSonic CTF 2026 ele 문제 풀이."
category: "CTF/Wargame"
tags: ["HyperSonic CTF", "CTF", "Writeup", "Reversing"]
draft: false
listed: false
---

***SSG Writeup***

# ele

## 개요

`ele`는 Electron 기반 문서 뷰어를 분석하는 reversing 문제입니다. 프로그램은 라이선스 키를 입력받고, 검증에 성공하면 암호화된 PDF를 복호화해 화면에 표시합니다.

확인한 조건은 다음과 같습니다.

- 카테고리: `reversing`
- 목표: 올바른 라이선스 키와 PDF 복호화 키를 찾아 문서 안의 validation key를 확인합니다.

풀이에서 먼저 볼 부분은 renderer에서 시작되는 복호화 요청입니다. UI는 라이선스 키만 입력받지만, 실제 검증과 복호화는 Electron main process 쪽에서 처리됩니다.

## 문제 분석

먼저 글에서 사용할 대상을 정리하겠습니다.

- `licenseKey`: 사용자가 UI에 입력하는 라이선스 키입니다.
- `pdfKey`: AES 복호화에 쓰이는 `32`바이트 키입니다.
- `dat`: 암호화된 PDF 리소스 전체입니다.
- `iv`: `dat`의 앞 `16`바이트입니다.
- `ciphertext`: `dat`에서 `iv`를 제외한 나머지 암호문입니다.
- `_getLicenseKey()`: 올바른 라이선스 키를 만드는 내부 함수입니다.
- `_getPdfKey()`: PDF 복호화 키를 만드는 내부 함수입니다.

제공된 프로그램은 Electron 앱 구조였습니다. 패키지 내부에는 renderer, preload, main process 코드가 들어 있고, PDF는 별도 리소스로 암호화되어 저장되어 있습니다.

renderer 쪽 흐름은 단순합니다. 입력값을 읽은 뒤 preload에서 노출한 API를 호출합니다.

```javascript
var licenseKey = input.value.trim();

window.secureApi.decrypt(licenseKey).then(function (b64) {
  if (!b64) {
    setMsg("Invalid license key. Validation failed.", "msg-error");
    return;
  }

  pdfEmbed.src = "data:application/pdf;base64," + b64;
});
```

preload 코드는 이 호출을 `decrypt-doc` IPC로 넘깁니다.

```javascript
contextBridge.exposeInMainWorld("secureApi", {
  decrypt: function (licenseKey) {
    return ipcRenderer.invoke("decrypt-doc", licenseKey);
  }
});
```

따라서 분석해야 할 곳은 `decrypt-doc` handler입니다. main process 코드는 문자열 난독화가 걸려 있었지만, 흐름을 정리하면 다음과 같습니다.

```javascript
ipcMain.handle("decrypt-doc", async function (_, userInput) {
  license = await _getLicenseKey();

  if (!userInput || userInput.toUpperCase() !== license) {
    return null;
  }

  dat = fs.readFileSync("encrypted.dat");
  iv = dat.slice(0, 16);
  ciphertext = dat.slice(16);

  key = await _getPdfKey();

  dec = crypto.createDecipheriv("aes-256-cbc", key, iv);
  pdf = Buffer.concat([dec.update(ciphertext), dec.final()]);

  return pdf.toString("base64");
});
```

여기서 확인할 수 있는 부분은 두 가지입니다. 라이선스 키 검증은 `_getLicenseKey()`의 결과와 단순 비교이고, PDF 복호화는 `AES-256-CBC`로 이루어집니다. 즉 내부 함수 두 개의 반환값을 얻으면 UI를 거치지 않고도 PDF를 복호화할 수 있습니다.

## 핵심 아이디어

핵심은 난독화된 코드를 완전히 사람이 읽기 쉬운 형태로 복원하지 않아도 된다는 점입니다. `_getLicenseKey()`와 `_getPdfKey()`는 main process 코드 안에 이미 존재하고, 실행 시점에 필요한 값을 직접 계산합니다.

다만 main process 코드를 그대로 Node에서 실행하면 Electron 객체와 실행 환경 검사가 걸립니다. 이 부분은 다음처럼 처리할 수 있습니다.

```text
1. electron 모듈을 mock한다.
2. process.platform과 process.versions.electron을 Electron 환경처럼 맞춘다.
3. app.quit(), process.exit()처럼 분석에 방해되는 함수는 no-op으로 둔다.
4. main process 코드를 VM 안에서 실행한다.
5. 전역 객체에 _getLicenseKey, _getPdfKey를 노출해 호출한다.
```

이 방식은 난독화된 문자열 테이블과 WASM 관련 초기화까지 원래 코드가 직접 처리하게 둡니다. 분석자가 직접 모든 상수를 복원할 필요가 없고, 프로그램이 쓰는 키 생성 루틴만 재사용하면 됩니다.

## 풀이 과정

### Step 1. UI에서 IPC 흐름 확인

먼저 renderer 코드를 보면 사용자가 입력한 라이선스 키가 `window.secureApi.decrypt()`로 전달됩니다. 이 함수는 preload에서 `ipcRenderer.invoke("decrypt-doc", licenseKey)`로 연결됩니다.

이 단계에서 얻은 정보는 분석 대상이 UI가 아니라 main process의 `decrypt-doc` handler라는 점입니다. renderer는 복호화 결과를 base64 PDF로 받아 화면에 붙이는 역할만 합니다.

### Step 2. 복호화 handler 정리

`decrypt-doc` handler는 사용자 입력과 `_getLicenseKey()` 결과를 비교합니다. 비교에 실패하면 `null`을 반환하고, 성공하면 암호화된 리소스를 읽어 복호화합니다.

복호화 데이터 구조는 다음과 같습니다.

```text
dat[0:16]   = iv
dat[16:]    = ciphertext
algorithm   = aes-256-cbc
key         = _getPdfKey()
```

따라서 필요한 값은 `_getLicenseKey()`의 문자열 결과와 `_getPdfKey()`의 `32`바이트 결과입니다.

### Step 3. 내부 함수 호출 환경 만들기

main process 코드는 Electron 앱으로 실행되는 상황을 가정합니다. 그래서 Node VM에서 실행하기 전에 최소한의 mock 객체를 준비했습니다.

```javascript
function makeElectronMock() {
  return {
    app: {
      quit() {},
      on() {},
      whenReady() {
        return { then() {} };
      }
    },
    BrowserWindow: class {
      constructor() {
        this.webContents = { on() {}, closeDevTools() {} };
      }
      loadFile() {}
      setMenu() {}
      on() {}
    },
    ipcMain: {
      handle(channel, handler) {
        this.channel = channel;
        this.handler = handler;
      }
    }
  };
}
```

또한 `process.platform`은 `win32`로, `process.versions.electron`은 존재하는 값으로 맞췄습니다. main process 코드 끝에는 창을 여는 코드가 있지만, 위 mock으로 충분히 지나갈 수 있습니다.

코드를 VM에서 실행할 때는 마지막에 내부 함수를 전역 객체로 노출했습니다.

```javascript
const source = mainSource + `
globalThis.__drm = { _getLicenseKey, _getPdfKey };
`;

vm.runInContext(source, context);

const licenseKey = await context.__drm._getLicenseKey();
const pdfKey = await context.__drm._getPdfKey();
```

실행 결과는 다음과 같습니다.

```text
License Key : 1A62-5880-C435-52BA
PDF Key     : a79cc71dfa2bdd5a6bd746e484a47351014bb420c3cf0f18f96f7a23db2debc6
```

### Step 4. PDF 복호화

키를 얻은 뒤에는 handler가 하던 작업을 그대로 재현하면 됩니다. 암호화된 리소스의 앞 `16`바이트를 `iv`로 쓰고, 나머지를 `ciphertext`로 둡니다.

```javascript
const dat = fs.readFileSync(encryptedResource);
const iv = dat.subarray(0, 16);
const ciphertext = dat.subarray(16);

const decipher = crypto.createDecipheriv("aes-256-cbc", pdfKey, iv);
const pdf = Buffer.concat([
  decipher.update(ciphertext),
  decipher.final()
]);
```

복호화 결과는 정상 PDF였습니다. PDF 텍스트를 추출하면 validation key가 문서 안에 들어 있습니다.

```text
VALIDATION KEY

    hs{1+1=flag}
```

## Exploit / Solver

solver의 핵심 흐름은 내부 키 생성 함수를 직접 호출한 뒤, 같은 AES 설정으로 PDF를 복호화하는 것입니다. 아래 코드는 필요한 부분만 줄인 형태입니다.

```javascript
const crypto = require("crypto");
const fs = require("fs");
const vm = require("vm");

function makeContext() {
  const electron = makeElectronMock();

  return {
    Buffer,
    WebAssembly,
    console,
    process: {
      env: process.env,
      exit() {},
      platform: "win32",
      resourcesPath: process.cwd(),
      versions: { ...process.versions, electron: "32.0.0" }
    },
    require(name) {
      if (name === "electron") return electron;
      return require(name);
    }
  };
}

async function solve(mainSource, encryptedResource) {
  const context = vm.createContext(makeContext());
  vm.runInContext(
    mainSource + "\nglobalThis.__drm = { _getLicenseKey, _getPdfKey };",
    context
  );

  const licenseKey = await context.__drm._getLicenseKey();
  const pdfKey = await context.__drm._getPdfKey();

  const dat = fs.readFileSync(encryptedResource);
  const iv = dat.subarray(0, 16);
  const ciphertext = dat.subarray(16);

  const decipher = crypto.createDecipheriv("aes-256-cbc", pdfKey, iv);
  const pdf = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return {
    licenseKey,
    pdfKey: pdfKey.toString("hex"),
    pdf
  };
}
```

이 코드는 난독화된 main process 로직을 다시 구현하지 않습니다. 원래 코드 안의 `_getLicenseKey()`와 `_getPdfKey()`를 호출해서 값을 얻고, 확인한 복호화 흐름만 그대로 재현합니다.

## 결과

재현 결과는 다음과 같습니다.

```text
License Key : 1A62-5880-C435-52BA
PDF Key     : a79cc71dfa2bdd5a6bd746e484a47351014bb420c3cf0f18f96f7a23db2debc6
Crypto      : AES-256-CBC
```

복호화된 PDF에서 validation key를 확인했습니다.

```text
hs{1+1=flag}
```
