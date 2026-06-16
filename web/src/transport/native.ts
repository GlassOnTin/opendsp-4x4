// Native USB transport for the Android WebView shell. The Kotlin side exposes a
// synchronous byte pipe as window.AndroidUsb and pushes inbound reports back via
// window.__dsp_onReport. All request/retry timing lives here — identical to
// webhid.ts — so only the write call and report source differ between platforms.
import type { DspTransport } from "./transport.ts";

interface AndroidUsbBridge {
  open(): void;             // finds the device + raises the system permission dialog; result flows back via __dsp_onState
  write(b64: string): void; // OUT endpoint; frame bytes as base64
  close(): void;
  isConnected(): boolean;
}

type Host = {
  AndroidUsb?: AndroidUsbBridge;
  __dsp_onReport?: (b64: string) => void;
  __dsp_onState?: (connected: boolean) => void;
};
const host = (): Host => globalThis as unknown as Host;

const toB64 = (b: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]!);
  return btoa(s);
};
const fromB64 = (s: string): Uint8Array => {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

export class NativeTransport implements DspTransport {
  private listeners = new Set<(r: Uint8Array) => void>();
  private pending: ((r: Uint8Array | null) => void) | null = null;
  private chain: Promise<unknown> = Promise.resolve();
  private _open = false;
  private openWaiter: (() => void) | null = null;

  /** True when running inside the Android shell (bridge injected). */
  static supported(): boolean { return typeof host().AndroidUsb !== "undefined"; }
  /** True when the device is already open (attach intent pre-grants permission). */
  static connected(): boolean { return host().AndroidUsb?.isConnected() ?? false; }

  get isOpen(): boolean { return this._open; }
  get productName(): string { return "DSP 4x4 Mini Pro"; }

  async open(): Promise<void> {
    const bridge = host().AndroidUsb;
    if (!bridge) throw new Error("Android USB bridge unavailable");
    host().__dsp_onReport = (b64) => this.handleReport(fromB64(b64));
    host().__dsp_onState = (connected) => {
      this._open = connected;
      if (connected && this.openWaiter) { const w = this.openWaiter; this.openWaiter = null; w(); }
    };
    if (bridge.isConnected()) { this._open = true; return; }
    // open() pops the permission dialog; the connection completes asynchronously via __dsp_onState.
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { this.openWaiter = null; reject(new Error("USB permission/connect timeout")); }, 30000);
      this.openWaiter = () => { clearTimeout(timer); resolve(); };
      bridge.open();
    });
  }

  async close(): Promise<void> {
    host().__dsp_onReport = undefined;
    host().__dsp_onState = undefined;
    host().AndroidUsb?.close();
    this._open = false;
  }

  private handleReport(bytes: Uint8Array): void {
    if (this.pending) {
      const resolve = this.pending;
      this.pending = null;
      resolve(bytes);
    }
    for (const cb of this.listeners) cb(bytes);
  }

  onReport(cb: (r: Uint8Array) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  // Serialize requests: each awaits the previous, so a debounced burst can't race
  // the single-pending reply slot (one in-flight transaction at a time).
  async request(frame: Uint8Array, timeoutMs = 1200): Promise<Uint8Array> {
    const run = this.chain.then(() => this.sendOne(frame, timeoutMs));
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  private async sendOne(frame: Uint8Array, timeoutMs: number): Promise<Uint8Array> {
    const bridge = host().AndroidUsb;
    if (!bridge || !this._open) throw new Error("device not open");
    // The device drops the reply to the first transaction after open, so retry a
    // few times with a short per-attempt timeout (matches webhid.ts behaviour).
    const perMs = 400;
    const b64 = toB64(frame);
    for (let i = 0; i * perMs < timeoutMs; i++) {
      const reply = new Promise<Uint8Array | null>((resolve) => {
        this.pending = resolve;
        setTimeout(() => { if (this.pending === resolve) { this.pending = null; resolve(null); } }, perMs);
        try { bridge.write(b64); }
        catch { if (this.pending === resolve) { this.pending = null; resolve(null); } }
      });
      const r = await reply;
      if (r) return r;
    }
    throw new Error("reply timeout");
  }
}
