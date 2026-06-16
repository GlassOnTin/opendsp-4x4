// Crossover (Low-Cut/High-Cut) magnitude approximation for drawing. The device
// computes the real coefficients; we render analog-prototype magnitudes that are
// visually faithful across 20 Hz–20 kHz. Bessel is approximated by Butterworth
// (its distinction is phase/group-delay, not magnitude). Returns dB (≤ 0).
import { Slope } from "../protocol/commands.ts";

interface SlopeModel { family: "BW" | "BL" | "LR"; order: number; }

const SLOPE_MODEL: Readonly<Record<number, SlopeModel | undefined>> = {
  [Slope.BYPASS]: undefined,
  [Slope.BW6]: { family: "BW", order: 1 }, [Slope.BL6]: { family: "BL", order: 1 },
  [Slope.BW12]: { family: "BW", order: 2 }, [Slope.BL12]: { family: "BL", order: 2 }, [Slope.LK12]: { family: "LR", order: 2 },
  [Slope.BW18]: { family: "BW", order: 3 }, [Slope.BL18]: { family: "BL", order: 3 },
  [Slope.BW24]: { family: "BW", order: 4 }, [Slope.BL24]: { family: "BL", order: 4 }, [Slope.LK24]: { family: "LR", order: 4 },
};

export function crossoverDb(kind: "hpf" | "lpf", slopeCode: number, f: number, fc: number): number {
  const m = SLOPE_MODEL[slopeCode];
  if (!m || fc <= 0) return 0; // bypass / invalid -> flat
  const x = kind === "hpf" ? fc / f : f / fc; // >1 in the stopband (below fc for HPF, above for LPF)
  const bwMagSq = (n: number) => 1 / (1 + Math.pow(x, 2 * n));
  const magSq = m.family === "LR" ? Math.pow(bwMagSq(m.order / 2), 2) : bwMagSq(m.order);
  return 10 * Math.log10(magSq);
}
