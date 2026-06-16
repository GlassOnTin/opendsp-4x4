import { test } from "node:test";
import assert from "node:assert/strict";
import { testToneFrame, setPasswordFrame } from "../src/protocol/control.ts";
import { ToneSource, TONE_FREQS, Command } from "../src/protocol/commands.ts";

const dataOf = (frame: Uint8Array): string => {
  const N = frame[4]!;
  return Array.from(frame.slice(6, 5 + N), (b) => b.toString(16).padStart(2, "0")).join(" ");
};

test("GOLDEN test tone: pink (01 00), white (02 00), sine 50Hz (03 04)", () => {
  assert.equal(dataOf(testToneFrame(ToneSource.PINK)), "01 00");
  assert.equal(dataOf(testToneFrame(ToneSource.WHITE)), "02 00");
  assert.equal(dataOf(testToneFrame(ToneSource.SINE, 4)), "03 04"); // index 4 = 50 Hz
  assert.equal(frameCode(testToneFrame(ToneSource.SINE, 4)), Command.TEST_TONE);
});

test("tone frequency table maps index to Hz", () => {
  assert.equal(TONE_FREQS[0], 20);
  assert.equal(TONE_FREQS[4], 50);
  assert.equal(TONE_FREQS[TONE_FREQS.length - 1], 20000);
});

test("GOLDEN lock password '1234' -> 31 32 33 34", () => {
  assert.equal(dataOf(setPasswordFrame("1234")), "31 32 33 34");
  assert.equal(dataOf(setPasswordFrame("ABCD")), "41 42 43 44");
  assert.equal(frameCode(setPasswordFrame("1234")), Command.SET_PASSWORD);
});

function frameCode(f: Uint8Array): number { return f[5]!; }
