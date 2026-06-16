import { test } from "node:test";
import assert from "node:assert/strict";
import type { Reply } from "../src/protocol/frame.ts";
import { levelsFromReply, reconstructPresetImage, parsePresetImage } from "../src/protocol/readback.ts";

// 0x40 level reply: 8 channels at data offsets 2,5,8,…,23 (stride 3), order In A–D, Out 1–4.
test("levelsFromReply reads 8 channels at stride-3 offsets", () => {
  const data = new Uint8Array(27);
  const raw = [3, 0, 0, 0, 2, 25, 50, 72]; // In A–D, Out 1–4 (last = full-scale)
  raw.forEach((v, i) => { data[2 + 3 * i] = v; });
  const r: Reply = { code: 0x40, data, checksumOk: true };
  const lv = levelsFromReply(r)!;
  assert.equal(lv.length, 8);
  assert.ok(Math.abs(lv[0]! - 3 / 72) < 1e-9);
  assert.equal(lv[7], 1); // 72/72 clamps to full-scale
});

test("levelsFromReply rejects non-0x40 / short replies", () => {
  assert.equal(levelsFromReply({ code: 0x13, data: new Uint8Array(27), checksumOk: true }), null);
  assert.equal(levelsFromReply({ code: 0x40, data: new Uint8Array(10), checksumOk: true }), null);
});

// 450-byte preset image: name @+2; input records @16/40/64/88 (gain @+18);
// output records @112/186/260/334 (gain @+66).
test("parsePresetImage extracts preset name, channel names, gains", () => {
  const img = new Uint8Array(450);
  const put = (o: number, s: string) => img.set(new TextEncoder().encode(s), o);
  const u16 = (o: number, v: number) => { img[o] = v & 0xff; img[o + 1] = (v >> 8) & 0xff; };
  put(2, "Default Preset");
  put(16, "InA"); u16(16 + 18, 280);   // ≈ 0 dB on the level-raw scale
  put(112, "Out1"); u16(112 + 66, 400); img[112 + 8] = 0x05; // gain ≈ +12 dB, routing InA+InC
  const pr = parsePresetImage(img);
  assert.equal(pr.presetName, "Default Preset");
  assert.equal(pr.inputs[0]!.name, "InA");
  assert.equal(pr.inputs[0]!.gainRaw, 280);
  assert.equal(pr.outputs[0]!.name, "Out1");
  assert.equal(pr.outputs[0]!.gainRaw, 400);
  assert.equal(pr.outputs[0]!.routingMask, 0x05);
});

test("reconstructPresetImage concatenates nine 50-byte pages", () => {
  const pages = Array.from({ length: 9 }, (_, i) => new Uint8Array(50).fill(i + 1));
  const img = reconstructPresetImage(pages);
  assert.equal(img.length, 450);
  assert.equal(img[0], 1);
  assert.equal(img[50], 2);
  assert.equal(img[449], 9);
});
