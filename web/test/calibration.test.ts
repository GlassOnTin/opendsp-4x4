import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultCalibration as c } from "../src/eq/calibration.ts";

// Calibrated from hardware capture of the Windows editor (gain ramp + crossover sweep).
test("PEQ gain: 0 dB = raw 120, ±12 dB = raw 0/240 (0.1 dB/step)", () => {
  assert.equal(c.peqGainDbToRaw(0, 0), 120);
  assert.equal(c.peqGainDbToRaw(12, 0), 240);
  assert.equal(c.peqGainDbToRaw(-12, 0), 0);
  assert.equal(c.peqGainRawToDb(120, 0), 0);
  assert.equal(c.peqGainRawToDb(240, 0), 12);
  assert.equal(c.peqGainRawToDb(0, 0), -12);
});

test("crossover freq: f = 19.7·2^(raw/30), raw 0..300", () => {
  assert.equal(c.xoverHzToRaw(19.7), 0);          // raw 0 = 19.7 Hz
  assert.equal(c.xoverHzToRaw(20172.8), 300);     // raw 300 = 20.16 kHz
  assert.ok(Math.abs(c.xoverRawToHz(1) - 20.16) < 0.1);   // editor showed 20.1
  assert.ok(Math.abs(c.xoverRawToHz(2) - 20.63) < 0.1);   // 20.6
  assert.ok(Math.abs(c.xoverRawToHz(300) - 20173) < 5);
});
