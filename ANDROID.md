# Android port — design notes

Goal: control the DSP from a phone/tablet at a gig over **USB-OTG**, reusing the existing web
app rather than rewriting it.

## Why a native shell is required
The web app reaches the device with **WebHID**, which is desktop-only. On Android, no browser API
can reach this device: WebHID isn't implemented there, and WebUSB **blocks the HID interface
class**. So the app must provide USB-host I/O natively.

Rather than rewrite the UI, the Android app is a thin **WebView** that loads the existing web UI
(bundled offline) and supplies byte I/O through a small Kotlin USB layer + a JavaScript bridge.
The UI, protocol codec, and EQ math are reused unchanged.

## The transport seam
Everything above `web/src/transport/transport.ts` is platform-agnostic:

```ts
interface DspTransport {
  readonly isOpen: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  request(frame: Uint8Array, timeoutMs?: number): Promise<Uint8Array>; // → next reply report
  onReport(cb: (report: Uint8Array) => void): () => void;
}
```

`webhid.ts` already keeps the tricky logic in pure JS: one-at-a-time request serialization and a
~400 ms-per-attempt retry (the device drops the reply to the first transaction after open). The
only WebHID-specific lines are `device.sendReport(0, frame)` and the `inputreport` event. A new
`NativeTransport` reuses that logic and swaps those two for the bridge.

## Bridge contract (raw bytes only; bytes as base64 strings)
JS → native (`@JavascriptInterface`, synchronous):
`AndroidUsb.open()`, `AndroidUsb.write(b64)`, `AndroidUsb.close()`, `AndroidUsb.isConnected()`.

Native → JS (`evaluateJavascript` on the UI thread):
`window.__dsp_onReport(b64)` per inbound report; `window.__dsp_onState(connected)` on connect/drop.

## Work breakdown

### Web (small)
- **NEW** `web/src/transport/native.ts` — `NativeTransport implements DspTransport`; reuses
  webhid's request/retry chain; `write` → `window.AndroidUsb.write`; listens on
  `window.__dsp_onReport`/`__dsp_onState`. Active when `"AndroidUsb" in window`.
- **EDIT** `web/src/state/device.svelte.ts` — pick the transport: native bridge present →
  `NativeTransport` (no device picker; `open()` raises the system permission dialog), else
  `WebHidTransport`. The rest of the connect flow (version handshake, hydrate, meters) is unchanged.
- **EDIT** `web/vite.config.ts` — an Android build mode (`VITE_TARGET=android`) sets `base: "./"`
  so assets resolve under the asset-loader path. The existing Pages (`/opendsp-4x4/`) and dev (`/`)
  bases are unchanged.
- **NEW** `web/test/native.test.ts` — drive `NativeTransport` against a fake bridge; assert reply
  pairing and retry/timeout. Existing protocol tests are unaffected.

### Android (`android/`)
```
android/
  settings.gradle.kts, build.gradle.kts, gradle/         Gradle (Kotlin, androidx.webkit)
  app/build.gradle.kts                                   minSdk 24, current targetSdk
  app/src/main/AndroidManifest.xml                       usb.host feature + USB_DEVICE_ATTACHED filter
  app/src/main/res/xml/device_filter.xml                 vendor-id="360" product-id="2081" (0x0168/0x0821)
  app/src/main/java/.../MainActivity.kt                  WebView + WebViewAssetLoader; bridge wiring
  app/src/main/java/.../UsbHid.kt                         open/claim(force)/read-thread/write
  app/src/main/java/.../Bridge.kt                         @JavascriptInterface; base64 <-> bytes
  app/src/main/assets/www/                                <- built web/dist
```
- `WebViewAssetLoader` serves the bundle from `https://appassets.androidplatform.net/assets/www/`
  (offline; avoids `file://` quirks).
- `UsbHid`: `UsbManager` enumerate → runtime permission → `openDevice` → `claimInterface(force=true)`
  (detaches any kernel HID driver) → interrupt endpoints OUT `0x02` / IN `0x81`; a read thread uses
  `bulkTransfer` (Android also services interrupt endpoints through it) and forwards reports.
- The attach intent-filter offers to launch the app on plug-in and pre-grants permission.

### Build glue
One step builds the web bundle in Android mode and copies `web/dist/*` →
`android/app/src/main/assets/www/`, then `./gradlew assembleDebug` produces the APK.

## Validation
1. **De-risk first:** confirm on real hardware that Android can `claimInterface` this HID device and
   exchange a frame — send the level-poll `10 02 00 01 01 40 10 03 41` to EP `0x02` and read EP
   `0x81`; expect a `0x40` level reply. If the interface won't claim, revisit the approach before
   building the APK.
2. Web: `tsc --noEmit` clean; Android-mode `vite build` emits relative-path assets; `native.test.ts`
   passes; existing tests stay green.
3. On device: plug the DSP via USB-OTG → permission dialog → version string read (handshake
   `0x10`→`0x13`) → channel-state pages hydrate → UI populates → meters poll. Toggle a mute and move
   a PEQ band; confirm the device responds.

## Design choices (kept deliberately small)
- No Capacitor and no Compose rewrite — a bare WebView with one bridge is the least code for a
  single-bridge app, and keeps one source of truth for the calibrated protocol.
- No in-app device chooser — the attach filter + system permission dialog handle selection.
- All timing/retry logic stays in TypeScript (unit-testable); the Kotlin side is a dumb byte pipe.

## Status

**Web side: built and verified.** `native.ts`, the `device.svelte.ts` transport pick,
the `VITE_TARGET=android` base, and `native.test.ts` are in place. `tsc --noEmit` is
clean, all 46 tests pass (4 new), and `VITE_TARGET=android vite build` emits relative
`./assets/…` paths.

**Android side: builds, installs, runs.** The Gradle project, manifest, USB-host layer,
bridge, and WebView activity are under `android/`; `android/build-apk.sh` runs the
web-build → asset-sync → `assembleDebug` chain. Built with Gradle 8.11.1 under JDK 17
(Java 25 is too new for Gradle 8.11), SDK at `~/Android/Sdk`, compileSdk 35. On a Pixel
the APK installs, launches without crashing, the WebView renders the offline bundle, and
the web app detects `window.AndroidUsb` (the "WebHID unavailable" banner is suppressed —
`App.svelte` now treats the native bridge as a supported transport).

**Hardware validation: pending — needs the DSP plugged into the phone via USB-OTG.** The
de-risking step (§Validation 1 — can Android `claimInterface` this HID device and exchange a
level-poll frame) and the on-device flow (§3: permission dialog → version handshake → hydrate
→ meters) are untested; the phone's USB-C was occupied by the adb cable during the above.
Known gaps: `UsbHid.open()` with no device found leaves the JS `open()` waiting for the 30 s
timeout (no fast "not found" signal over the connected-boolean bridge); hot-unplug → UI
teardown isn't wired on either transport (webhid has the same gap).
