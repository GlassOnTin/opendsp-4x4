import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRequest, parseFrame, frameChecksum, DLE, STX, ETX } from "../src/protocol/frame.ts";
import { muteFrame, recallPresetFrame, levelRawFrame, polarityFrame, gainDbToRaw, gainRawToDb } from "../src/protocol/control.ts";
import { commandName, Command, Channel } from "../src/protocol/commands.ts";

const hex = (b: Uint8Array, n = b.length) => Array.from(b.slice(0, n), (x) => x.toString(16).padStart(2, "0")).join(" ");

// ---- golden vectors: frames observed on the wire (one control at a time) ----

test("GOLDEN: level poll 0x40 reproduces the captured frame", () => {
  // captured: 10 02 00 01 01 40 10 03 41  (then stale tail)
  assert.equal(hex(buildRequest(Command.READBACK_LEVELS), 9), "10 02 00 01 01 40 10 03 41");
});

test("GOLDEN: mute Output 1 reproduces the captured frame", () => {
  // captured: code 0x35 data '04 01' -> 10 02 00 01 03 35 04 01 10 03 33
  assert.equal(hex(muteFrame(Channel.OUT_1, true), 11), "10 02 00 01 03 35 04 01 10 03 33");
  assert.equal(hex(muteFrame(Channel.OUT_1, false), 11), "10 02 00 01 03 35 04 00 10 03 32");
});

test("GOLDEN: recall preset 2 frames correctly", () => {
  // captured: code 0x20 data '02'
  const f = recallPresetFrame(2);
  assert.equal(f[5], Command.RECALL_PRESET);
  assert.equal(f[6], 0x02);
  assert.equal(f[0], DLE); assert.equal(f[1], STX);
});

test("GOLDEN: polarity invert/normal Output 1 (0x36) matches capture", () => {
  // captured: code 0x36 data '04 01' (invert) / '04 00' (normal)
  assert.equal(hex(polarityFrame(Channel.OUT_1, true), 8), "10 02 00 01 03 36 04 01");
  assert.equal(hex(polarityFrame(Channel.OUT_1, false), 8), "10 02 00 01 03 36 04 00");
});

test("gain dB<->raw calibration (0dB=281, +12dB=400, 10 units/dB)", () => {
  assert.equal(gainDbToRaw(0), 281);
  assert.equal(gainDbToRaw(12), 400);   // clamped at max (281+120=401 -> 400)
  assert.equal(gainDbToRaw(-6), 221);
  assert.equal(gainDbToRaw(-100), 0);   // floored
  assert.equal(Math.round(gainRawToDb(281)), 0);
  assert.equal(gainRawToDb(291), 1);
});

test("level frame carries chan + 16-bit LE value", () => {
  const f = levelRawFrame(Channel.OUT_1, 0x0118);
  // 10 02 00 01 04 34 04 18 01 10 03 cksum
  assert.equal(hex(f, 9), "10 02 00 01 04 34 04 18 01");
});

test("frames are padded to the 64-byte interrupt report", () => {
  assert.equal(buildRequest(Command.READBACK_LEVELS).length, 64);
});

test("checksum = XOR(payload) ^ 1 (matches captured 0x41 for the poll)", () => {
  assert.equal(frameChecksum([0x00, 0x01, 0x01, 0x40]), 0x41);
});

test("round-trip: parseFrame recovers a wrapped payload + checksum ok", () => {
  const f = buildRequest(0x35, Uint8Array.of(0x04, 0x01));
  const { payload, checksumOk } = parseFrame(f);
  assert.ok(checksumOk);
  assert.deepEqual([...payload], [0x00, 0x01, 0x03, 0x35, 0x04, 0x01]);
});

test("0x10 in command/data is carried RAW (no DLE escaping) — hardware regression", () => {
  // GET_STATUS (code 0x10) must NOT be doubled to 10 10; correct: 10 02 00 01 01 10 10 03 11
  assert.equal(hex(buildRequest(0x10), 9), "10 02 00 01 01 10 10 03 11");
  // a 0x10 data byte round-trips raw via the length-based parser
  const f = buildRequest(0x34, Uint8Array.of(0x04, 0x10, 0x00));
  const { payload, checksumOk } = parseFrame(f);
  assert.ok(checksumOk);
  assert.deepEqual([...payload], [0x00, 0x01, 0x04, 0x34, 0x04, 0x10, 0x00]);
});

test("command naming", () => {
  assert.equal(commandName(0x35), "MUTE");
  assert.equal(commandName(0x40), "READBACK_LEVELS");
  assert.equal(commandName(0x99), "UNKNOWN_0x99");
});
