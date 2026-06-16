import { test } from "node:test";
import assert from "node:assert/strict";
import { coeffsFor, magnitudeDb, bwOctToQ, qToBwOct } from "../src/eq/biquad.ts";
import { crossoverDb } from "../src/eq/crossover.ts";
import { summedResponseDb, logFreqAxis, bandResponseDb } from "../src/eq/response.ts";
import { makeScales } from "../src/eq/scales.ts";
import { FS, type ChannelEq } from "../src/eq/types.ts";
import { PeqType, Slope } from "../src/protocol/commands.ts";

const dbAt = (f: number, c: ReturnType<typeof coeffsFor>) => magnitudeDb(c, (2 * Math.PI * f) / FS);
const nearestIdx = (f: Float64Array, target: number) => {
  let bi = 0;
  for (let i = 0; i < f.length; i++) if (Math.abs((f[i] as number) - target) < Math.abs((f[bi] as number) - target)) bi = i;
  return bi;
};

test("peak +6dB at 1kHz ≈ +6 at fc, ~flat far away", () => {
  const c = coeffsFor(1000, 6, qToBwOct(1.41, 1000), PeqType.PEAK);
  assert.ok(Math.abs(dbAt(1000, c) - 6) < 0.2, `fc=${dbAt(1000, c)}`);
  assert.ok(Math.abs(dbAt(100, c)) < 1.0);
  assert.ok(Math.abs(dbAt(10000, c)) < 1.0);
});

test("low-pass ≈ -3 dB at fc (Q≈0.707)", () => {
  const c = coeffsFor(1000, 0, qToBwOct(0.707, 1000), PeqType.LOW_PASS);
  assert.ok(Math.abs(dbAt(1000, c) + 3) < 1.0, `${dbAt(1000, c)}`);
});

test("high-shelf asymptotes toward +gain", () => {
  const c = coeffsFor(1000, 8, qToBwOct(1, 1000), PeqType.HIGH_SHELF);
  assert.ok(dbAt(18000, c) > 6.5);
  assert.ok(Math.abs(dbAt(40, c)) < 1.0);
});

test("bandwidth<->Q round-trip; 1 octave ≈ Q 1.41", () => {
  const q = bwOctToQ(1, 1000);
  assert.ok(Math.abs(q - 1.414) < 0.1, `q=${q}`);
  assert.ok(Math.abs(qToBwOct(q, 1000) - 1) < 0.01);
});

test("crossover: Butterworth -3dB at fc, Linkwitz-Riley -6dB at fc", () => {
  assert.ok(Math.abs(crossoverDb("hpf", Slope.BW12, 1000, 1000) + 3.0) < 0.05);
  assert.ok(Math.abs(crossoverDb("lpf", Slope.BW24, 1000, 1000) + 3.0) < 0.05);
  assert.ok(Math.abs(crossoverDb("hpf", Slope.LK24, 1000, 1000) + 6.0) < 0.05);
  assert.equal(crossoverDb("hpf", Slope.BYPASS, 1000, 1000), 0);
});

test("crossover slope: BW24 rolls off ~24 dB/oct below fc", () => {
  const a = crossoverDb("hpf", Slope.BW24, 500, 1000); // 1 octave below fc
  const b = crossoverDb("hpf", Slope.BW24, 250, 1000); // 2 octaves below
  assert.ok(b - a < -20 && b - a > -28, `per-oct≈${b - a}`);
});

test("summed: two +6 dB peaks at same freq ≈ +12 dB", () => {
  const ch: ChannelEq = {
    bands: [
      { freqHz: 1000, gainDb: 6, bwOct: 1, type: PeqType.PEAK, bypass: false },
      { freqHz: 1000, gainDb: 6, bwOct: 1, type: PeqType.PEAK, bypass: false },
    ],
    hpf: { freqHz: 20, slope: Slope.BYPASS },
    lpf: { freqHz: 20000, slope: Slope.BYPASS },
  };
  const f = logFreqAxis(300);
  const r = summedResponseDb(ch, f);
  assert.ok(Math.abs((r[nearestIdx(f, 1000)] as number) - 12) < 0.6);
});

test("bypass / allpass contribute nothing to the curve", () => {
  const f = logFreqAxis(64);
  const bypassed = bandResponseDb({ freqHz: 1000, gainDb: 9, bwOct: 1, type: PeqType.PEAK, bypass: true }, f);
  const allpass = bandResponseDb({ freqHz: 1000, gainDb: 9, bwOct: 1, type: PeqType.ALLPASS1, bypass: false }, f);
  assert.ok(bypassed.every((v) => v === 0));
  assert.ok(allpass.every((v) => v === 0));
});

test("scales invert (log freq, linear dB)", () => {
  const s = makeScales(800, 300);
  assert.ok(Math.abs(s.xToFreq(s.freqToX(1000)) - 1000) < 1e-6);
  assert.ok(Math.abs(s.yToDb(s.dbToY(6)) - 6) < 1e-9);
  assert.ok(Math.abs(s.freqToX(20)) < 1e-9 && Math.abs(s.freqToX(20000) - 800) < 1e-9);
});
