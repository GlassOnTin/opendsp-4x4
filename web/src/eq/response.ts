// Summed channel response (dB) over a log-frequency axis. Cascaded filters
// multiply in magnitude => add in dB.
import { FS, type ChannelEq, type PeqBand } from "./types.ts";
import { coeffsFor, magnitudeDb } from "./biquad.ts";
import { crossoverDb } from "./crossover.ts";
import { PeqType } from "../protocol/commands.ts";

export function logFreqAxis(n = 300, fMin = 20, fMax = 20000): Float64Array {
  const a = new Float64Array(n);
  const r = Math.log10(fMax / fMin);
  for (let i = 0; i < n; i++) a[i] = fMin * Math.pow(10, (r * i) / (n - 1));
  return a;
}

const isFlat = (b: PeqBand) => b.bypass || b.type === PeqType.ALLPASS1 || b.type === PeqType.ALLPASS2;

/** Magnitude (dB) of one band across the axis (zeros if bypassed / allpass). */
export function bandResponseDb(band: PeqBand, freqs: Float64Array, fs = FS): Float64Array {
  const out = new Float64Array(freqs.length);
  if (isFlat(band)) return out;
  const c = coeffsFor(band.freqHz, band.gainDb, band.bwOct, band.type, fs);
  for (let i = 0; i < freqs.length; i++) out[i] = magnitudeDb(c, (2 * Math.PI * (freqs[i] as number)) / fs);
  return out;
}

/** Summed magnitude (dB) of all 7 bands + HPF + LPF. */
export function summedResponseDb(ch: ChannelEq, freqs: Float64Array, fs = FS): Float64Array {
  const out = new Float64Array(freqs.length);
  for (const b of ch.bands) {
    if (isFlat(b)) continue;
    const c = coeffsFor(b.freqHz, b.gainDb, b.bwOct, b.type, fs);
    for (let i = 0; i < freqs.length; i++) out[i] = out[i]! + magnitudeDb(c, (2 * Math.PI * (freqs[i] as number)) / fs);
  }
  for (let i = 0; i < freqs.length; i++) {
    const f = freqs[i] as number;
    out[i] = out[i]! + crossoverDb("hpf", ch.hpf.slope, f, ch.hpf.freqHz) + crossoverDb("lpf", ch.lpf.slope, f, ch.lpf.freqHz);
  }
  return out;
}
