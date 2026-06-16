import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compressorFrame, gateFrame, crossoverHpfFrame, crossoverLpfFrame,
  delayMsFrame, routingFrame, peqBandFrame,
  thresholdDbToRaw, thresholdRawToDb, msToSamples, hzToPeqIndex, peqIndexToHz, qToRaw,
} from "../src/protocol/blocks.ts";
import { Slope, PeqType, Command } from "../src/protocol/commands.ts";

// data bytes a frame carries (after the 10 02 00 addr N code header, before 10 03)
function dataOf(frame: Uint8Array): string {
  const N = frame[4]!;                 // = 1 + data.length
  return Array.from(frame.slice(6, 5 + N), (b) => b.toString(16).padStart(2, "0")).join(" ");
}
const codeOf = (f: Uint8Array) => f[5];

// ---- golden vectors: real frames captured from the editor ----

test("GOLDEN compressor default frame (04 00 00 31 00 f3 01 db 00)", () => {
  const f = compressorFrame(0x04, { ratioIndex: 0, kneeDb: 0, attackMs: 49, releaseMs: 499, thresholdDb: 19.5 });
  assert.equal(codeOf(f), Command.COMPRESSOR);
  assert.equal(dataOf(f), "04 00 00 31 00 f3 01 db 00");
});

test("GOLDEN gate default frame (00 31 00 f3 01 63 00 01 00)", () => {
  const f = gateFrame(0x00, { attackMs: 49, releaseMs: 499, holdMs: 99, thresholdDb: -89.5 });
  assert.equal(codeOf(f), Command.GATE);
  assert.equal(dataOf(f), "00 31 00 f3 01 63 00 01 00");
});

test("GOLDEN crossover HPF BW-24 (04 50 00 08) and LPF LK-24 (04 2c 01 0a)", () => {
  assert.equal(dataOf(crossoverHpfFrame(0x04, 0x0050, Slope.BW24)), "04 50 00 08");
  assert.equal(dataOf(crossoverLpfFrame(0x04, 0x012c, Slope.LK24)), "04 2c 01 0a");
});

test("GOLDEN delay 5ms -> 240 samples (04 f0 00)", () => {
  assert.equal(dataOf(delayMsFrame(0x04, 5)), "04 f0 00");
});

test("GOLDEN routing Out1 all inputs (04 0f)", () => {
  assert.equal(dataOf(routingFrame(0x04, 0x0f)), "04 0f");
});

test("GOLDEN PEQ band default (04 00 78 00 46 00 0a 04 00)", () => {
  // layout [gain16, freq16, q8, type8, bypass8]: gain raw 120 (=0 dB), freq index 70
  // (≈99 Hz @ 30/oct), q8 10, type High-Pass — capture-verified field order.
  const f = peqBandFrame(0x04, 0, { gainRaw: 120, freqHz: peqIndexToHz(70), q: 1.0, type: PeqType.HIGH_PASS });
  assert.equal(dataOf(f), "04 00 78 00 46 00 0a 04 00");
});

// ---- unit conversions ----

test("threshold (dB+90)*2", () => {
  assert.equal(thresholdDbToRaw(20), 220);
  assert.equal(thresholdDbToRaw(-90), 0);
  assert.equal(thresholdRawToDb(180), 0);     // gate max
});

test("delay 48kHz samples", () => {
  assert.equal(msToSamples(680), 32640);
  assert.equal(msToSamples(5), 240);
});

test("PEQ freq index <-> Hz (30 steps/oct, 19.7Hz base — same scale as crossover)", () => {
  assert.equal(hzToPeqIndex(19.7), 0);
  assert.equal(hzToPeqIndex(20160), 300);
  assert.equal(Math.round(peqIndexToHz(300)), 20173); // ≈ 20.16 kHz
  assert.equal(hzToPeqIndex(40.3), 31); // editor 40.3 Hz = index 31 (the calibration anchor)
});

test("PEQ Q -> q8 (provisional ×10)", () => {
  assert.equal(qToRaw(1.0), 10);
  assert.equal(qToRaw(2.5), 25);
});
