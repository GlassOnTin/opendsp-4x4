import { test } from "node:test";
import assert from "node:assert/strict";
import { frameWrap, parseReply } from "../src/protocol/frame.ts";
import { getVersionFrame, readPresetNameFrame, readChannelFrame, finalizeFrame } from "../src/protocol/control.ts";
import { Command } from "../src/protocol/commands.ts";

const hex = (b: Uint8Array, n = b.length) => Array.from(b.slice(0, n), (x) => x.toString(16).padStart(2, "0")).join(" ");

test("parseReply extracts version from the real 0x13 reply payload", () => {
  // captured reply payload: 01 00 10 13 "4x4MINIPRO V010"
  const payload = [0x01, 0x00, 0x10, 0x13, ...new TextEncoder().encode("4x4MINIPRO V010")];
  const r = parseReply(Uint8Array.from(frameWrap(payload)));
  assert.ok(r.checksumOk);
  assert.equal(r.code, Command.GET_VERSION);
  assert.equal(new TextDecoder().decode(r.data), "4x4MINIPRO V010");
});

test("parseReply extracts preset name from the real 0x29 reply ([slot, name])", () => {
  const payload = [0x01, 0x00, 0x10, 0x29, 0x01, ...new TextEncoder().encode("PEQ1_1k_6db   ")];
  const r = parseReply(Uint8Array.from(frameWrap(payload)));
  assert.equal(r.code, Command.READ_PRESET_NAME);
  assert.equal(r.data[0], 0x01); // slot
  assert.equal(new TextDecoder().decode(r.data.slice(1)).trimEnd(), "PEQ1_1k_6db");
});

test("GOLDEN startup query frames", () => {
  assert.equal(hex(getVersionFrame(), 6), "10 02 00 01 01 13");
  assert.equal(hex(readPresetNameFrame(1), 7), "10 02 00 01 02 29 01");
  assert.equal(hex(readChannelFrame(0), 7), "10 02 00 01 02 27 00");
  assert.equal(hex(finalizeFrame(), 6), "10 02 00 01 01 12");
});
