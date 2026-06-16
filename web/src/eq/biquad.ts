// RBJ "Audio EQ Cookbook" biquad coefficients + magnitude response, at 48 kHz.
// Pure functions — unit-testable, no DOM. Used to DRAW the response curve; the
// device computes its own coefficients from the high-level params we send.
import { FS } from "./types.ts";
import { PeqType } from "../protocol/commands.ts";

export interface Biquad { b0: number; b1: number; b2: number; a0: number; a1: number; a2: number; }

/** Bandwidth (octaves) -> Q, using the cookbook identity (valid across the audio band). */
export function bwOctToQ(bw: number, f0: number, fs = FS): number {
  const w0 = (2 * Math.PI * f0) / fs;
  return 1 / (2 * Math.sinh((Math.LN2 / 2) * bw * (w0 / Math.sin(w0))));
}
/** Q -> bandwidth (octaves). Guards Q≤0 (e.g. a readback of 0) so it can't return ∞/NaN. */
export function qToBwOct(q: number, f0: number, fs = FS): number {
  const w0 = (2 * Math.PI * f0) / fs;
  const bw = (2 / Math.LN2) * Math.asinh(1 / (2 * Math.max(q, 1e-3))) * (Math.sin(w0) / w0);
  return Number.isFinite(bw) ? Math.max(0.05, Math.min(8, bw)) : 1;
}

/** Biquad coefficients for a PEQ band (allpass types return the identity = flat magnitude). */
export function coeffsFor(freqHz: number, gainDb: number, bwOct: number, type: number, fs = FS): Biquad {
  const w0 = (2 * Math.PI * freqHz) / fs;
  const cw = Math.cos(w0), sw = Math.sin(w0);
  const A = Math.pow(10, gainDb / 40);
  const alpha = sw * Math.sinh((Math.LN2 / 2) * bwOct * (w0 / sw)); // BW-derived alpha
  const sqA = Math.sqrt(A);
  switch (type) {
    case PeqType.PEAK:
      return { b0: 1 + alpha * A, b1: -2 * cw, b2: 1 - alpha * A,
               a0: 1 + alpha / A, a1: -2 * cw, a2: 1 - alpha / A };
    case PeqType.LOW_SHELF:
      return { b0: A * ((A + 1) - (A - 1) * cw + 2 * sqA * alpha), b1: 2 * A * ((A - 1) - (A + 1) * cw),
               b2: A * ((A + 1) - (A - 1) * cw - 2 * sqA * alpha),
               a0: (A + 1) + (A - 1) * cw + 2 * sqA * alpha, a1: -2 * ((A - 1) + (A + 1) * cw),
               a2: (A + 1) + (A - 1) * cw - 2 * sqA * alpha };
    case PeqType.HIGH_SHELF:
      return { b0: A * ((A + 1) + (A - 1) * cw + 2 * sqA * alpha), b1: -2 * A * ((A - 1) + (A + 1) * cw),
               b2: A * ((A + 1) + (A - 1) * cw - 2 * sqA * alpha),
               a0: (A + 1) - (A - 1) * cw + 2 * sqA * alpha, a1: 2 * ((A - 1) - (A + 1) * cw),
               a2: (A + 1) - (A - 1) * cw - 2 * sqA * alpha };
    case PeqType.LOW_PASS:
      return { b0: (1 - cw) / 2, b1: 1 - cw, b2: (1 - cw) / 2, a0: 1 + alpha, a1: -2 * cw, a2: 1 - alpha };
    case PeqType.HIGH_PASS:
      return { b0: (1 + cw) / 2, b1: -(1 + cw), b2: (1 + cw) / 2, a0: 1 + alpha, a1: -2 * cw, a2: 1 - alpha };
    default: // ALLPASS1/ALLPASS2: unity magnitude (phase-only) -> identity for the magnitude plot
      return { b0: 1, b1: 0, b2: 0, a0: 1, a1: 0, a2: 0 };
  }
}

/** |H(e^jw)| in dB at angular frequency w (= 2π f / fs). */
export function magnitudeDb(c: Biquad, w: number): number {
  const cw = Math.cos(w), c2 = Math.cos(2 * w), sw = Math.sin(w), s2 = Math.sin(2 * w);
  const nr = c.b0 + c.b1 * cw + c.b2 * c2, ni = -(c.b1 * sw + c.b2 * s2);
  const dr = c.a0 + c.a1 * cw + c.a2 * c2, di = -(c.a1 * sw + c.a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}
