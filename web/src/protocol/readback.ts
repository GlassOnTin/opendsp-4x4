// Decoders for the device's readback replies (decoded from observed traffic):
//  - 0x40 level poll: 8 channel meters at data offsets 2,5,8,…,23 (stride 3).
//  - 0x27/0x24 channel-state: nine 50-byte pages reconstruct the 450-byte preset
//    image (preset name @+2; input records 24B @16/40/64/88; output records 74B
//    @112/186/260/334). Gain: input @+18, output @+66 (16-bit, level-raw scale).
import type { Reply } from "./frame.ts";

const LEVEL_FULLSCALE = 72; // approximate; meter is a relative indicator

/** 8 channel levels (0..1) from a 0x40 reply. Order: In A–D, Out 1–4. */
export function levelsFromReply(r: Reply): number[] | null {
  if (r.code !== 0x40 || r.data.length < 24) return null;
  return Array.from({ length: 8 }, (_, i) => Math.min(1, (r.data[2 + 3 * i] ?? 0) / LEVEL_FULLSCALE));
}

// Record field offsets — all probe-verified against known written values (set
// distinctive values, read back, match). Raw values only; the store applies
// calibration/unit conversions. NOTE: mute is NOT in this image (it's separate
// live state, likely the 0x22 flags table) — not hydrated from here.
export interface PeqBandRaw { gainRaw: number; freqIdx: number; qRaw: number; type: number; }
export interface InputReadback {
  name: string; gainRaw: number; polarity: boolean;
  gate: { atkRaw: number; relRaw: number; holdRaw: number; thrRaw: number };
}
export interface OutputReadback {
  name: string; gainRaw: number; polarity: boolean; routingMask: number; delaySamples: number;
  hpfRaw: number; lpfRaw: number; hpfSlope: number; lpfSlope: number;
  bands: PeqBandRaw[];
  comp: { ratioIndex: number; kneeRaw: number; atkRaw: number; relRaw: number; thrRaw: number };
}
export interface PresetReadback { presetName: string; inputs: InputReadback[]; outputs: OutputReadback[]; }

/** Reconstruct the 450-byte preset image from nine 0x24 pages (data = [idx, …50B]). */
export function reconstructPresetImage(pages: Uint8Array[]): Uint8Array {
  const img = new Uint8Array(450);
  for (let i = 0; i < 9; i++) {
    const p = pages[i];
    if (p && p.length >= 50) img.set(p.subarray(0, 50), i * 50);
  }
  return img;
}

export function parsePresetImage(img: Uint8Array): PresetReadback {
  const str = (o: number, len: number) => new TextDecoder().decode(img.slice(o, o + len)).replace(/\0[\s\S]*$/, "").trim();
  const u16 = (o: number) => (img[o] ?? 0) | ((img[o + 1] ?? 0) << 8);
  const u8 = (o: number) => img[o] ?? 0;

  // input record (24 B): name@0(10) gate@10(atk,rel,hold,thr) gain@18 polarity@20
  const inputs = [16, 40, 64, 88].map((b) => ({
    name: str(b, 10), gainRaw: u16(b + 18), polarity: u8(b + 20) !== 0,
    gate: { atkRaw: u16(b + 10), relRaw: u16(b + 12), holdRaw: u16(b + 14), thrRaw: u16(b + 16) },
  }));

  // output record (74 B): name@0(8) routing@8 hpfFreq@10 lpfFreq@12 hpfSlope@14
  // lpfSlope@15 bands@16(7×[freq16,q16,gain8,type8]) comp@58 gain@66 polarity@68 delay@70
  const outputs = [112, 186, 260, 334].map((b) => ({
    name: str(b, 8), routingMask: u8(b + 8), gainRaw: u16(b + 66), polarity: u8(b + 68) !== 0,
    delaySamples: u16(b + 70), hpfRaw: u16(b + 10), lpfRaw: u16(b + 12), hpfSlope: u8(b + 14), lpfSlope: u8(b + 15),
    bands: Array.from({ length: 7 }, (_, j) => {
      const o = b + 16 + j * 6; // band record: [gain16, freq16, q8, type8]
      return { gainRaw: u16(o), freqIdx: u16(o + 2), qRaw: u8(o + 4), type: u8(o + 5) };
    }),
    comp: { ratioIndex: u8(b + 58), kneeRaw: u8(b + 59), atkRaw: u16(b + 60), relRaw: u16(b + 62), thrRaw: u16(b + 64) },
  }));

  return { presetName: str(2, 14), inputs, outputs };
}
