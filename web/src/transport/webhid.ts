// WebHID transport for desktop Chrome/Edge. The device is a no-report-ID HID
// with 64-byte interrupt in/out, so we use sendReport(0, ...) and the
// `inputreport` event. (WebHID is desktop-only; Android needs the native build.)
import type { DspTransport } from "./transport.ts";

export const VENDOR_ID = 0x0168;
export const PRODUCT_ID = 0x0821;
const REPORT_ID = 0; // device uses no report IDs

export class WebHidTransport implements DspTransport {
  private listeners = new Set<(r: Uint8Array) => void>();
  private pending: ((r: Uint8Array | null) => void) | null = null;
  private chain: Promise<unknown> = Promise.resolve();

  static supported(): boolean {
    return typeof navigator !== "undefined" && "hid" in navigator;
  }

  /** Prompt the user to pick the DSP. MUST be called from a user gesture (click). */
  static async request(): Promise<WebHidTransport | null> {
    if (!WebHidTransport.supported())
      throw new Error("WebHID unavailable — use Chrome/Edge on desktop (not Firefox/Safari/Android).");
    const devices = await navigator.hid.requestDevice({
      filters: [{ vendorId: VENDOR_ID, productId: PRODUCT_ID }],
    });
    const dev = devices[0];
    return dev ? new WebHidTransport(dev) : null;
  }

  /** Reconnect to an already-granted device without prompting (e.g. on page load). */
  static async existing(): Promise<WebHidTransport | null> {
    if (!WebHidTransport.supported()) return null;
    const dev = (await navigator.hid.getDevices())
      .find((d) => d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID);
    return dev ? new WebHidTransport(dev) : null;
  }

  private constructor(private readonly device: HIDDevice) {}

  get isOpen(): boolean { return this.device.opened; }
  get productName(): string { return this.device.productName || "DSP 4x4 Mini Pro"; }

  async open(): Promise<void> {
    if (!this.device.opened) await this.device.open();
    this.device.addEventListener("inputreport", this.handleReport);
  }

  async close(): Promise<void> {
    this.device.removeEventListener("inputreport", this.handleReport);
    if (this.device.opened) await this.device.close();
  }

  private handleReport = (e: HIDInputReportEvent): void => {
    const bytes = new Uint8Array(e.data.buffer, e.data.byteOffset, e.data.byteLength);
    if (this.pending) {
      const resolve = this.pending;
      this.pending = null;
      resolve(bytes);
    }
    for (const cb of this.listeners) cb(bytes);
  };

  onReport(cb: (r: Uint8Array) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  // Serialize requests: each awaits the previous, so a debounced burst can't race
  // the single-pending reply slot (the transport handles one in-flight at a time).
  async request(frame: Uint8Array, timeoutMs = 1200): Promise<Uint8Array> {
    const run = this.chain.then(() => this.sendOne(frame, timeoutMs));
    this.chain = run.then(() => undefined, () => undefined);
    return run;
  }

  private async sendOne(frame: Uint8Array, timeoutMs: number): Promise<Uint8Array> {
    if (!this.device.opened) throw new Error("device not open");
    // The device drops the reply to the first transaction after open, so retry
    // a few times with a short per-attempt timeout (matches the editor's behaviour).
    const perMs = 400;
    for (let i = 0; i * perMs < timeoutMs; i++) {
      const reply = new Promise<Uint8Array | null>((resolve) => {
        this.pending = resolve;
        setTimeout(() => { if (this.pending === resolve) { this.pending = null; resolve(null); } }, perMs);
        // cast: TS 5.7 types Uint8Array<ArrayBufferLike>; sendReport wants BufferSource
        void this.device.sendReport(REPORT_ID, frame as BufferSource).catch(() => {
          if (this.pending === resolve) { this.pending = null; resolve(null); }
        });
      });
      const r = await reply;
      if (r) return r;
    }
    throw new Error("reply timeout");
  }
}
