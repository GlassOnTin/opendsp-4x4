# How the Android app works — a WebView + USB-bridge walkthrough

openDSP-4x4 runs on Android by **wrapping the existing web app in a thin WebView** and handing
it a small native USB pipe. This page explains why, and walks through the pieces. It doubles as
a reusable recipe for getting any WebHID/WebUSB app onto a phone when the browser can't reach
the hardware.

## Why a native shell at all?

The web app talks to the DSP with **WebHID**, which only exists in desktop Chrome/Edge. On
Android there is *no* browser path to this device:

- **WebHID** isn't implemented in any Android browser.
- **WebUSB** is implemented, but it **blocks the HID interface class** for security.

So the USB I/O has to be native. Everything else — the UI, the protocol codec, the EQ maths —
is reused unchanged. The whole Android-specific surface is three small Kotlin files plus ~100
lines of TypeScript.

## The one seam that makes this cheap

The codebase keeps a single boundary between the platform-agnostic protocol and the actual I/O,
in [`web/src/transport/transport.ts`](web/src/transport/transport.ts):

```ts
interface DspTransport {
  readonly isOpen: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  request(frame: Uint8Array, timeoutMs?: number): Promise<Uint8Array>; // → next reply report
  onReport(cb: (report: Uint8Array) => void): () => void;
}
```

`webhid.ts` implements it for the desktop. For Android we add **one more implementation** that
sends the same bytes through a bridge. Nothing above the seam changes.

```
     Svelte UI ─ device store ─ Dsp client ─ DspTransport
                                                 │
                   ┌─────────────────────────────┴──────────────────────────┐
              WebHidTransport (desktop)                    NativeTransport (Android)
              device.sendReport / inputreport         window.AndroidUsb  ⇄  Kotlin USB
```

## Step 1 — `NativeTransport` (TypeScript)

[`web/src/transport/native.ts`](web/src/transport/native.ts) is the webhid request/retry chain
with two lines swapped:

- **write:** `device.sendReport(0, frame)` → `window.AndroidUsb.write(base64)`
- **read:** the `inputreport` event → a global callback `window.__dsp_onReport(base64)`

The tricky bit — one in-flight request at a time, plus a ~400 ms-per-attempt retry because the
device drops the reply to the *first* transaction after open — stays in JS so it's
unit-testable. [`web/test/native.test.ts`](web/test/native.test.ts) drives it against a fake
bridge (reply pairing, retry, timeout).

Two more small edits wire it up:

- [`device.svelte.ts`](web/src/state/device.svelte.ts) picks the transport — native bridge
  present → `NativeTransport`, else `WebHidTransport`.
- [`vite.config.ts`](web/vite.config.ts) — `VITE_TARGET=android` sets `base: "./"` so the
  bundle's asset paths resolve under the WebView's asset-loader host.

## Step 2 — the bridge contract

Raw bytes only, carried as base64 strings.

**JS → native** (`@JavascriptInterface`, synchronous):
`AndroidUsb.open()`, `AndroidUsb.write(b64)`, `AndroidUsb.close()`, `AndroidUsb.isConnected()`.

**native → JS** (`evaluateJavascript` on the UI thread):
`window.__dsp_onReport(b64)` per inbound report; `window.__dsp_onState(connected)` on
connect/drop.

That's the whole interface. The Kotlin side is a *dumb byte pipe* — it knows nothing about the
protocol.

## Step 3 — the Kotlin shell (`android/`)

Three small files:

- **[`MainActivity.kt`](android/app/src/main/java/net/opendsp/x4x4/MainActivity.kt)** — a
  full-screen WebView that serves the bundled UI from
  `https://appassets.androidplatform.net/assets/www/` via `WebViewAssetLoader` (offline, and
  avoids `file://` quirks). Wires the bridge in with `addJavascriptInterface(bridge, "AndroidUsb")`.
- **[`UsbHid.kt`](android/app/src/main/java/net/opendsp/x4x4/UsbHid.kt)** — the USB host:
  enumerate by VID/PID (`0x0168` / `0x0821`) → runtime permission → `openDevice` →
  `claimInterface(force = true)` (this detaches the kernel HID driver) → interrupt endpoints
  OUT `0x02` / IN `0x81`. A daemon read thread loops on `bulkTransfer` (Android services
  interrupt endpoints through it too) and forwards each report.
- **[`Bridge.kt`](android/app/src/main/java/net/opendsp/x4x4/Bridge.kt)** — the
  `@JavascriptInterface` methods, base64 ⇄ bytes, and `evaluateJavascript` to push reports/state
  back to the page.

The [manifest](android/app/src/main/AndroidManifest.xml) declares the `usb.host` feature and a
`USB_DEVICE_ATTACHED` intent-filter pointing at
[`device_filter.xml`](android/app/src/main/res/xml/device_filter.xml) (`vendor-id="360"
product-id="2081"` — the same IDs in decimal). Plugging the DSP in then offers to launch the app
*and pre-grants USB permission*.

## Step 4 — the edge-to-edge gotcha

Targeting Android 15 (SDK 35) forces **edge-to-edge**: the WebView draws under the status and
nav bars, so the page's top row lands beneath the clock. Padding the WebView *view* doesn't help
— Chromium ignores view padding for its content viewport (its `innerHeight` stays the full
screen height). The fix is to read the system-bar insets and feed them to CSS:

```kotlin
ViewCompat.setOnApplyWindowInsetsListener(webView) { _, insets ->
    val bars = insets.getInsets(
        WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
    // px → CSS px (÷ density), then push into the page on the UI thread:
    safeTopPx = bars.top / density; safeBottomPx = bars.bottom / density
    applyInsets() // evaluateJavascript: documentElement.style.setProperty('--safe-top', …)
    WindowInsetsCompat.CONSUMED
}
```

The header reserves `var(--safe-top)` and the bottom bar reserves `var(--safe-bottom)`.

## Step 5 — build & release

One script, [`android/build-apk.sh`](android/build-apk.sh), runs the whole chain: build the web
bundle in Android mode → copy `web/dist/*` into `app/src/main/assets/www/` →
`./gradlew assembleDebug`.

Releases are automated. Tag `vX.Y.Z` and
[`.github/workflows/android-release.yml`](.github/workflows/android-release.yml) verifies the web
bundle (typecheck + tests), assembles a **signed** APK (keystore from repo secrets, with a
debug-key fallback so it still builds without them), and publishes a GitHub Release. The signing
secret names are in the workflow header.

## Gotchas worth knowing

- **Use a data-capable OTG cable/adapter.** A charge-only one makes Android report the Type-C
  compliance warning `missing data lines` and *nothing enumerates* — no device in the list, no
  permission dialog. (Isolate it by trying a known-good USB stick on the same adapter.)
- **`claimInterface(force = true)` is required** — without `force` the kernel HID driver keeps the
  interface and the claim fails.
- **Changing the signing key needs an uninstall** — Android refuses to update a package when the
  APK signature changes (e.g. a debug build → a release build).
- **Keep timing/retry in TypeScript.** The Kotlin side stays a byte pipe, so the calibrated
  protocol has one source of truth and the fiddly parts stay unit-testable.

## Status

Verified end-to-end on a Pixel 8 Pro over USB-OTG: attach → permission → version handshake
(`4x4MINIPRO V010`) → full state readback/hydrate → preset recall, routing and live meters.
Released as `v0.2.0`. Open gap: hot-unplug doesn't yet tear down the UI (the desktop WebHID
transport has the same gap).
