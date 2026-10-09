---
title: "HyperSonic CTF 2026 ele Writeup"
description: "HyperSonic CTF 2026 ele writeup"
---

# ele

## Overview

`ele` is a reversing challenge that involves analyzing an Electron-based document viewer. The program takes a license key as input and, on successful validation, decrypts an encrypted PDF and displays it on screen.

The challenge setup:

- Category: `reversing`
- Goal: find the correct license key and PDF decryption key, and check the validation key inside the document.

The key is the decryption request that originates in the renderer. The UI only takes a license key, but the actual validation and decryption happen in the Electron main process.

## Challenge analysis

The objects referred to below:

- `licenseKey`: the license key the user enters in the UI.
- `pdfKey`: the `32`-byte key used for AES decryption.
- `dat`: the entire encrypted PDF resource.
- `iv`: the first `16` bytes of `dat`.
- `ciphertext`: the remaining ciphertext in `dat` after the `iv`.
- `_getLicenseKey()`: the internal function that produces the correct license key.
- `_getPdfKey()`: the internal function that produces the PDF decryption key.

The provided program is an Electron app. Inside the package are the renderer, preload, and main process code, and the PDF is stored encrypted as a separate resource.

The renderer-side flow is simple: it reads the input and calls the API exposed by preload.

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

The preload code passes this call on as the `decrypt-doc` IPC.

```javascript
contextBridge.exposeInMainWorld("secureApi", {
  decrypt: function (licenseKey) {
    return ipcRenderer.invoke("decrypt-doc", licenseKey);
  }
});
```

So the place to analyze is the `decrypt-doc` handler. The main process code had string obfuscation, but the flow boils down to the following.

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

License key validation is a simple comparison against the result of `_getLicenseKey()`, and PDF decryption uses `AES-256-CBC`. So if we obtain the return values of the two internal functions, we can decrypt the PDF without going through the UI.

## Key idea

We do not need to fully restore the obfuscated code into a human-readable form. `_getLicenseKey()` and `_getPdfKey()` already exist inside the main process code and compute the values they need at runtime.

But running the main process code directly in Node trips over Electron objects and runtime environment checks. This part is handled as follows.

```text
1. Mock the electron module.
2. Set process.platform and process.versions.electron to look like an Electron environment.
3. Leave functions that get in the way of analysis, like app.quit() and process.exit(), as no-ops.
4. Run the main process code inside a VM.
5. Expose _getLicenseKey and _getPdfKey on the global object and call them.
```

This lets the original code handle the obfuscated string table and the WASM initialization itself. There is no need to recover every constant by hand; reusing the program's key-generation routines is enough.

## Solution

### Step 1. Confirm the IPC flow from the UI

In the renderer code, the license key the user enters is passed to `window.secureApi.decrypt()`. This function is wired in preload to `ipcRenderer.invoke("decrypt-doc", licenseKey)`.

So the analysis target is the main process's `decrypt-doc` handler, not the UI. The renderer only takes the decryption result as a base64 PDF and attaches it to the screen.

### Step 2. Work out the decryption handler

The `decrypt-doc` handler compares the user input with the result of `_getLicenseKey()`. On a failed comparison it returns `null`, and on success it reads the encrypted resource and decrypts it.

The decryption data structure:

```text
dat[0:16]   = iv
dat[16:]    = ciphertext
algorithm   = aes-256-cbc
key         = _getPdfKey()
```

So the values needed are the string result of `_getLicenseKey()` and the `32`-byte result of `_getPdfKey()`.

### Step 3. Set up an environment to call the internal functions

The main process code assumes it is running as an Electron app. So before running it in a Node VM, I prepared a minimal set of mock objects.

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

I also set `process.platform` to `win32` and `process.versions.electron` to an existing value. The main process code ends with code that opens a window, but the mock above is enough to get past it.

When running the code in the VM, I exposed the internal functions as global objects at the end.

```javascript
const source = mainSource + `
globalThis.__drm = { _getLicenseKey, _getPdfKey };
`;

vm.runInContext(source, context);

const licenseKey = await context.__drm._getLicenseKey();
const pdfKey = await context.__drm._getPdfKey();
```

The execution result is as follows.

```text
License Key : 1A62-5880-C435-52BA
PDF Key     : a79cc71dfa2bdd5a6bd746e484a47351014bb420c3cf0f18f96f7a23db2debc6
```

### Step 4. Decrypt the PDF

Once the keys are obtained, reproduce what the handler did: use the first `16` bytes of the encrypted resource as the `iv` and the rest as the `ciphertext`.

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

The decryption result was a valid PDF, and extracting the PDF text reveals the validation key inside the document.

```text
VALIDATION KEY

    hs{1+1=flag}
```

## Exploit / Solver

The core flow of the solver is to call the internal key-generation functions directly, then decrypt the PDF with the same AES settings. The code below is trimmed down to just the necessary parts.

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

This code does not reimplement the obfuscated main process logic. It calls `_getLicenseKey()` and `_getPdfKey()` from the original code to get the values, then reproduces only the decryption flow we worked out.

## Result

The reproduction result:

```text
License Key : 1A62-5880-C435-52BA
PDF Key     : a79cc71dfa2bdd5a6bd746e484a47351014bb420c3cf0f18f96f7a23db2debc6
Crypto      : AES-256-CBC
```

I confirmed the validation key in the decrypted PDF.

```text
hs{1+1=flag}
```
