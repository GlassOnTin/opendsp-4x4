// The seam for protocol encodings the GUI needs but that aren't fully calibrated.
// Drawing never uses this (it works in dB/Hz/octaves); only emit/readback do —
// so the curve is correct regardless, and Phase A can fill these in without
// touching any component.
import { hzToPeqIndex, peqIndexToHz, qToRaw, rawToQ } from "../protocol/blocks.ts";
import { bwOctToQ, qToBwOct } from "./biquad.ts";

export interface Calibration {
  peqHzToIndex(hz: number): number;
  peqIndexToHz(i: number): number;
  bwOctToQ(bw: number, f0: number): number;
  qToBwOct(q: number, f0: number): number;
  qToRaw(q: number): number;
  rawToQ(raw: number): number;
  // --- TBD (Phase A): calibrate against captures/hardware ---
  peqGainDbToRaw(db: number, type: number): number;
  peqGainRawToDb(raw: number, type: number): number;
  xoverHzToRaw(hz: number): number;
  xoverRawToHz(raw: number): number;
}

// PEQ frequency + Q are calibrated; gain-byte and crossover-Hz are provisional
// placeholders flagged for Phase A (do not rely on their absolute accuracy yet).
export const defaultCalibration: Calibration = {
  peqHzToIndex: hzToPeqIndex,
  peqIndexToHz,
  bwOctToQ,
  qToBwOct,
  qToRaw,
  rawToQ,
  // PEQ gain: 16-bit, 0 dB = 120, 0.1 dB/step, range raw 0..240 (±12 dB).
  // Calibrated from an editor gain ramp (−12→+12 dB ⇒ raw 0→240) + golden default 120 = 0 dB.
  peqGainDbToRaw: (db) => Math.max(0, Math.min(240, Math.round(db * 10 + 120))),
  peqGainRawToDb: (raw) => (raw - 120) / 10,
  // Crossover freq: f = 19.7·2^(raw/30), raw 0..300 (30 steps/oct; PEQ uses 24/oct).
  // Calibrated from an editor HPF sweep (19.7 Hz @ raw 0 … 20.16 kHz @ raw 300).
  xoverHzToRaw: (hz) => Math.max(0, Math.min(300, Math.round(30 * Math.log2(hz / 19.7)))),
  xoverRawToHz: (raw) => 19.7 * Math.pow(2, raw / 30),
};
