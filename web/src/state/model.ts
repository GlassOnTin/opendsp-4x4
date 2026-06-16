// High-level device model (engineering units). Mirrors the editor: 4 inputs
// (A–D) + 4 outputs (1–4); outputs have PEQ/crossover/delay/compressor, inputs
// have a noise gate. Channel index = device address (in 0x00–03, out 0x04–07).
import type { ChannelEq, PeqBand } from "../eq/types.ts";
import { PeqType, Slope } from "../protocol/commands.ts";

export interface Compressor { thresholdDb: number; ratioIndex: number; kneeDb: number; attackMs: number; releaseMs: number; }
export interface Gate { thresholdDb: number; attackMs: number; holdMs: number; releaseMs: number; }

export interface Channel {
  index: number;      // 0x00..0x07
  name: string;
  isOutput: boolean;
  gainDb: number;
  mute: boolean;
  polarity: boolean;  // invert
  meter: number;      // 0..1 (live level)
  eq?: ChannelEq;     // outputs
  delayMs?: number;   // outputs
  comp?: Compressor;  // outputs
  gate?: Gate;        // inputs
}

export interface PresetSlot { slot: number; name: string; }

export const OUT_BASE = 0x04;
const IN_NAMES = ["In A", "In B", "In C", "In D"];
const OUT_NAMES = ["Out 1", "Out 2", "Out 3", "Out 4"];

export function defaultBand(freqHz = 1000): PeqBand {
  return { freqHz, gainDb: 0, bwOct: 1, type: PeqType.PEAK, bypass: true };
}
// Sensible per-band default centre frequencies (used for new channels + dbl-click reset).
export const DEFAULT_BAND_FREQS = [60, 150, 400, 1000, 2500, 6000, 12000];

export function defaultEq(): ChannelEq {
  return {
    bands: DEFAULT_BAND_FREQS.map((f) => defaultBand(f)),
    hpf: { freqHz: 20, slope: Slope.BYPASS },
    lpf: { freqHz: 20000, slope: Slope.BYPASS },
  };
}
export function defaultChannel(index: number): Channel {
  const isOutput = index >= OUT_BASE;
  return {
    index, isOutput,
    name: isOutput ? OUT_NAMES[index - OUT_BASE]! : IN_NAMES[index]!,
    gainDb: 0, mute: false, polarity: false, meter: 0,
    eq: isOutput ? defaultEq() : undefined,
    delayMs: isOutput ? 0 : undefined,
    comp: isOutput ? { thresholdDb: 20, ratioIndex: 0, kneeDb: 0, attackMs: 50, releaseMs: 500 } : undefined,
    gate: isOutput ? undefined : { thresholdDb: -90, attackMs: 50, holdMs: 100, releaseMs: 500 },
  };
}
export function makeChannels(): Channel[] {
  return Array.from({ length: 8 }, (_, i) => defaultChannel(i));
}
export const channelAccent = (index: number) => `var(--ch-${index})`;
