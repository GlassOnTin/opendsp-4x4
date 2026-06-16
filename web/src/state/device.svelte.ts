// Reactive device state + controller. UI mutates this (instant), and each change
// is debounced + sent through the (serialized) transport. Engineering-unit params
// are converted to wire values via the Calibration seam.
import { WebHidTransport } from "../transport/webhid.ts";
import { NativeTransport } from "../transport/native.ts";
import { Dsp } from "../dsp.ts";
import { defaultCalibration, type Calibration } from "../eq/calibration.ts";
import { getLevelsFrame, gainRawToDb } from "../protocol/control.ts";
import { thresholdRawToDb, samplesToMs, rawToQ, peqIndexToHz } from "../protocol/blocks.ts";
import { levelsFromReply, reconstructPresetImage, parsePresetImage } from "../protocol/readback.ts";
import { makeChannels, OUT_BASE, DEFAULT_BAND_FREQS, type Channel } from "./model.ts";
import type { ChannelEq } from "../eq/types.ts";

const DEFAULTS_KEY = "opendsp-defaults";

export class DeviceStore {
  connected = $state(false);
  productName = $state("");
  version = $state("");
  error = $state("");
  presetName = $state("");
  hasDefaults = $state(typeof localStorage !== "undefined" && localStorage.getItem(DEFAULTS_KEY) !== null);
  channels = $state<Channel[]>(makeChannels());
  routing = $state<number[]>([0x01, 0x02, 0x04, 0x08]); // Out1..4 input masks (default diagonal)
  selected = $state(-1); // selected channel index; -1 = nothing open (collapsed overview on load)
  eqLink = $state<Record<number, number>>({}); // output index -> linked partner (symmetric); EQ edits mirror

  private dsp: Dsp | null = null;
  private cal: Calibration = defaultCalibration;
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private meterTimer?: ReturnType<typeof setInterval>;

  lastReadback: ReturnType<typeof parsePresetImage> | null = null; // raw readback (debug/calibration)

  get selectedChannel(): Channel | undefined { return this.channels[this.selected]; }
  ch(index: number): Channel { return this.channels[index]!; }
  /** Collapse the open node → all-collapsed patch-board overview. */
  collapse(): void { this.selected = -1; }

  /** Connect via the device picker (needs a user gesture). On Android the native
   *  bridge replaces the picker — open() raises the system USB-permission dialog. */
  async connect(): Promise<void> {
    try { await this._bind(NativeTransport.supported() ? new NativeTransport() : await WebHidTransport.request()); }
    catch (e) { this.error = (e as Error).message; }
  }

  /** Reconnect to an already-granted device without prompting (call on page load). */
  async autoConnect(): Promise<void> {
    try {
      if (NativeTransport.supported()) {
        if (NativeTransport.connected()) await this._bind(new NativeTransport()); // attach intent pre-grants permission
        return;
      }
      await this._bind(await WebHidTransport.existing());
    } catch (e) { this.error = (e as Error).message; }
  }

  private async _bind(t: WebHidTransport | NativeTransport | null): Promise<void> {
    if (!t) return;
    await t.open();
    this.dsp = new Dsp(t);
    this.version = await this.dsp.getVersion(); // self-wakes (0x10 then 0x13)
    this.productName = t.productName;
    this.connected = true;
    this.error = "";
    try { await this.hydrate(); } catch { /* readback is best-effort; UI keeps defaults */ }
    this.startMeters();
  }

  /** Read the 9 channel-state pages on connect → mirror preset name, channel names, gains. */
  private async hydrate(): Promise<void> {
    if (!this.dsp) return;
    const pages: Uint8Array[] = [];
    for (let i = 0; i < 9; i++) {
      const data = await this.dsp.channelState(i); // [idx, ...50B]
      pages[data[0] ?? i] = data.slice(1, 51);
    }
    const pr = parsePresetImage(reconstructPresetImage(pages));
    this.lastReadback = pr; // raw readback kept for calibration/debug (no extra device I/O)
    this.presetName = pr.presetName;
    pr.inputs.forEach((c, i) => {
      const ch = this.ch(i);
      if (c.name) ch.name = c.name;
      ch.gainDb = gainRawToDb(c.gainRaw);
      ch.polarity = c.polarity;
      ch.gate = { attackMs: c.gate.atkRaw, releaseMs: c.gate.relRaw, holdMs: c.gate.holdRaw, thresholdDb: thresholdRawToDb(c.gate.thrRaw) };
    });
    pr.outputs.forEach((c, i) => {
      const ch = this.ch(OUT_BASE + i);
      if (c.name) ch.name = c.name;
      ch.gainDb = gainRawToDb(c.gainRaw);
      ch.polarity = c.polarity;
      ch.delayMs = samplesToMs(c.delaySamples);
      this.routing[i] = c.routingMask; // mirror the device's real input→output routing
      ch.comp = {
        ratioIndex: c.comp.ratioIndex, kneeDb: c.comp.kneeRaw,
        attackMs: c.comp.atkRaw, releaseMs: c.comp.relRaw, thresholdDb: thresholdRawToDb(c.comp.thrRaw),
      };
      if (ch.eq) {
        ch.eq.hpf = { freqHz: this.cal.xoverRawToHz(c.hpfRaw), slope: c.hpfSlope };
        ch.eq.lpf = { freqHz: this.cal.xoverRawToHz(c.lpfRaw), slope: c.lpfSlope };
        ch.eq.bands = c.bands.map((bd) => {
          const freqHz = peqIndexToHz(bd.freqIdx);
          return {
            freqHz, type: bd.type, bypass: false,
            gainDb: this.cal.peqGainRawToDb(bd.gainRaw, bd.type),
            bwOct: this.cal.qToBwOct(rawToQ(bd.qRaw), freqHz),
          };
        });
      }
    });
  }

  /** DEBUG: dump the live channel-state records as hex (full records, to diff Out1 vs Out2). */
  async _dumpRecords(): Promise<Record<string, string>> {
    if (!this.dsp) return {};
    const pages: Uint8Array[] = [];
    for (let i = 0; i < 9; i++) { const d = await this.dsp.channelState(i); pages[d[0] ?? i] = d.slice(1, 51); }
    const img = reconstructPresetImage(pages);
    const hex = (o: number, n: number) => Array.from(img.slice(o, o + n), (b) => b.toString(16).padStart(2, "0")).join(" ");
    const out: Record<string, string> = {};
    [112, 186, 260, 334].forEach((b, i) => { const h = hex(b, 74); out[`OUT${i + 1}`] = h; console.log(`OUT${i + 1} @${b}: ${h}`); });
    [16, 40, 64, 88].forEach((b, i) => { const h = hex(b, 24); out[`IN${"ABCD"[i]}`] = h; console.log(`IN${"ABCD"[i]} @${b}: ${h}`); });
    return out;
  }

  /** Poll the device's 8 I/O levels (~10 Hz) into channel meters. */
  private startMeters(): void {
    this.stopMeters();
    let busy = false; // skip a tick if the previous poll hasn't replied — avoids piling up the transport
    this.meterTimer = setInterval(() => {
      if (!this.dsp || busy) return;
      busy = true;
      void this.dsp.send(getLevelsFrame()).then((r) => {
        const lv = levelsFromReply(r);
        if (lv) for (let i = 0; i < 8; i++) this.ch(i).meter = lv[i]!;
      }).catch(() => {}).finally(() => { busy = false; });
    }, 100);
  }
  private stopMeters(): void { if (this.meterTimer) { clearInterval(this.meterTimer); this.meterTimer = undefined; } }

  /** Debounce by key; coalesces rapid changes (e.g. a fader/EQ drag) into one send. */
  private commit(key: string, fn: () => void, delay = 40): void {
    const prev = this.timers.get(key);
    if (prev) clearTimeout(prev);
    this.timers.set(key, setTimeout(() => {
      this.timers.delete(key);
      if (this.dsp) void Promise.resolve().then(fn).catch(() => {});
    }, delay));
  }

  // --- channel basics ---
  setGainDb(i: number, db: number): void { this.ch(i).gainDb = db; this.commit(`gain${i}`, () => this.dsp!.setLevelDb(i, db)); }
  setMute(i: number, on: boolean): void { this.ch(i).mute = on; this.commit(`mute${i}`, () => this.dsp!.mute(i, on), 0); }
  setPolarity(i: number, inv: boolean): void { this.ch(i).polarity = inv; this.commit(`pol${i}`, () => this.dsp!.setPolarity(i, inv), 0); }

  // --- EQ (commit reads the already-mutated band; UI mutates eq directly for instant draw) ---
  commitPeqBand(i: number, band: number): void {
    this.sendPeqBand(i, band);
    const p = this.eqLink[i];
    if (p !== undefined && this.ch(p).eq) {
      Object.assign(this.ch(p).eq!.bands[band]!, $state.snapshot(this.ch(i).eq!.bands[band]!));
      this.sendPeqBand(p, band);
    }
  }
  private sendPeqBand(i: number, band: number): void {
    const b = this.ch(i).eq!.bands[band]!;
    this.commit(`peq${i}.${band}`, () => this.dsp!.peqBand(i, band, {
      freqHz: b.freqHz, q: this.cal.bwOctToQ(b.bwOct, b.freqHz),
      gainRaw: this.cal.peqGainDbToRaw(b.gainDb, b.type), type: b.type, bypass: b.bypass,
    }));
  }
  commitHpf(i: number): void { this.sendHpf(i); const p = this.eqLink[i]; if (p !== undefined && this.ch(p).eq) { this.ch(p).eq!.hpf = { ...$state.snapshot(this.ch(i).eq!.hpf) }; this.sendHpf(p); } }
  commitLpf(i: number): void { this.sendLpf(i); const p = this.eqLink[i]; if (p !== undefined && this.ch(p).eq) { this.ch(p).eq!.lpf = { ...$state.snapshot(this.ch(i).eq!.lpf) }; this.sendLpf(p); } }
  private sendHpf(i: number): void { const x = this.ch(i).eq!.hpf; this.commit(`hpf${i}`, () => this.dsp!.crossoverHpf(i, this.cal.xoverHzToRaw(x.freqHz), x.slope)); }
  private sendLpf(i: number): void { const x = this.ch(i).eq!.lpf; this.commit(`lpf${i}`, () => this.dsp!.crossoverLpf(i, this.cal.xoverHzToRaw(x.freqHz), x.slope)); }

  /** Reset one PEQ band to its default (centre freq, 0 dB, 1 oct, peak). */
  resetBand(i: number, band: number): void {
    const b = this.ch(i).eq!.bands[band]!;
    b.freqHz = DEFAULT_BAND_FREQS[band] ?? 1000; b.gainDb = 0; b.bwOct = 1; b.type = 0; b.bypass = false;
    this.commitPeqBand(i, band);
  }
  /** Copy a whole channel's EQ (7 bands + crossover) to another output and push it. */
  copyEqTo(src: number, dst: number): void {
    const s = this.ch(src).eq; if (!s || !this.ch(dst).eq) return;
    this.ch(dst).eq = structuredClone($state.snapshot(s)) as ChannelEq;
    this.pushEq(dst);
  }
  private pushEq(i: number): void {
    const eq = this.ch(i).eq; if (!eq) return;
    for (let b = 0; b < eq.bands.length; b++) this.sendPeqBand(i, b);
    this.sendHpf(i); this.sendLpf(i);
  }
  /** Link two outputs' EQ so edits to either mirror to the other (and sync b←a now). */
  linkEq(a: number, b: number): void {
    this.eqLink = { ...this.eqLink, [a]: b, [b]: a };
    this.copyEqTo(a, b);
  }
  unlinkEq(a: number): void {
    const b = this.eqLink[a]; const next = { ...this.eqLink };
    delete next[a]; if (b !== undefined) delete next[b];
    this.eqLink = next;
  }

  // --- dynamics / delay / routing ---
  setDelayMs(i: number, ms: number): void { this.ch(i).delayMs = ms; this.commit(`delay${i}`, () => this.dsp!.delayMs(i, ms)); }
  commitComp(i: number): void { const c = this.ch(i).comp!; this.commit(`comp${i}`, () => this.dsp!.compressor(i, c)); }
  commitGate(i: number): void { const g = this.ch(i).gate!; this.commit(`gate${i}`, () => this.dsp!.gate(i, g)); }
  setRouting(outIndex: number, mask: number): void { this.routing[outIndex - 0x04] = mask; this.commit(`route${outIndex}`, () => this.dsp!.routing(outIndex, mask), 0); }

  // --- global ---
  recallPreset(slot: number): void { if (this.dsp) void this.dsp.recallPreset(slot); }
  storePreset(slot: number): void { if (this.dsp) void this.dsp.storePreset(slot); }
  testTone(source: number, freqIndex = 0): void { if (this.dsp) void this.dsp.testTone(source, freqIndex); }
  setPassword(pw: string): void { if (this.dsp) void this.dsp.setPassword(pw); }

  // --- defaults snapshot (browser localStorage; not a device preset slot) ---
  saveDefaults(): void {
    try {
      localStorage.setItem(DEFAULTS_KEY, JSON.stringify({ channels: this.channels, routing: this.routing }));
      this.hasDefaults = true;
    } catch { /* storage unavailable */ }
  }
  async restoreDefaults(): Promise<void> {
    let raw: string | null = null;
    try { raw = localStorage.getItem(DEFAULTS_KEY); } catch { /* ignore */ }
    if (!raw) return;
    const snap = JSON.parse(raw) as { channels: Channel[]; routing: number[] };
    this.channels = snap.channels;
    this.routing = snap.routing;
    await this.pushAll();
  }
  /** Re-send every channel's full state to the device (Restore Defaults). Meters paused to avoid contention. */
  async pushAll(): Promise<void> {
    if (!this.dsp) return;
    this.stopMeters();
    try {
      for (let i = 0; i < this.channels.length; i++) {
        const ch = this.channels[i]!;
        await this.dsp.setLevelDb(i, ch.gainDb);
        await this.dsp.setPolarity(i, ch.polarity);
        await this.dsp.mute(i, ch.mute);
        if (ch.gate) await this.dsp.gate(i, ch.gate);
        if (ch.isOutput) {
          if (ch.delayMs != null) await this.dsp.delayMs(i, ch.delayMs);
          if (ch.comp) await this.dsp.compressor(i, ch.comp);
          await this.dsp.routing(i, this.routing[i - OUT_BASE] ?? 0);
          if (ch.eq) {
            await this.dsp.crossoverHpf(i, this.cal.xoverHzToRaw(ch.eq.hpf.freqHz), ch.eq.hpf.slope);
            await this.dsp.crossoverLpf(i, this.cal.xoverHzToRaw(ch.eq.lpf.freqHz), ch.eq.lpf.slope);
            for (let band = 0; band < ch.eq.bands.length; band++) {
              const b = ch.eq.bands[band]!;
              await this.dsp.peqBand(i, band, {
                freqHz: b.freqHz, q: this.cal.bwOctToQ(b.bwOct, b.freqHz),
                gainRaw: this.cal.peqGainDbToRaw(b.gainDb, b.type), type: b.type, bypass: b.bypass,
              });
            }
          }
        }
      }
    } finally { this.startMeters(); }
  }
}

export const device = new DeviceStore();
