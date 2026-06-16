import { test } from "node:test";
import assert from "node:assert/strict";
import { NativeTransport } from "../src/transport/native.ts";

const toB64 = (b: Uint8Array) => Buffer.from(b).toString("base64");
const fromB64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));

type G = typeof globalThis & {
  AndroidUsb?: unknown;
  __dsp_onReport?: (b64: string) => void;
  __dsp_onState?: (c: boolean) => void;
};
const g = globalThis as G;

// Install a fake Kotlin bridge. `handler(req, writeCount)` decides how the
// device replies — call g.__dsp_onReport(...) to deliver a report, or do nothing
// to drop the transaction (forces a retry).
function install(handler: (req: Uint8Array, writeCount: number) => void) {
  let connected = true;
  let writes = 0;
  g.AndroidUsb = {
    open() { connected = true; g.__dsp_onState?.(true); },
    close() { connected = false; g.AndroidUsb = undefined; },
    isConnected: () => connected,
    write(b64: string) { handler(fromB64(b64), ++writes); },
  };
}

test("request pairs the next report as its reply", async () => {
  const frame = Uint8Array.from([0x10, 0x02, 0x00, 0x01, 0x01, 0x13]);
  let seen: Uint8Array | null = null;
  install((req) => {
    seen = req;
    g.__dsp_onReport!(toB64(Uint8Array.from([0x01, 0x00, 0x10, 0x13, 0xaa])));
  });
  const t = new NativeTransport();
  await t.open();
  const reply = await t.request(frame);
  assert.deepEqual(Array.from(seen!), Array.from(frame)); // bytes survive the base64 round-trip
  assert.deepEqual(Array.from(reply), [0x01, 0x00, 0x10, 0x13, 0xaa]);
  await t.close();
});

test("onReport delivers unsolicited reports to subscribers", async () => {
  install(() => {});
  const t = new NativeTransport();
  await t.open();
  const got: number[] = [];
  t.onReport((r) => got.push(...r));
  g.__dsp_onReport!(toB64(Uint8Array.from([0x40, 0x01])));
  assert.deepEqual(got, [0x40, 0x01]);
  await t.close();
});

test("retries until a report arrives (device drops the first transaction)", async () => {
  install((_req, n) => { if (n >= 2) g.__dsp_onReport!(toB64(Uint8Array.from([0x42]))); });
  const t = new NativeTransport();
  await t.open();
  const reply = await t.request(Uint8Array.from([0x01]), 1200);
  assert.deepEqual(Array.from(reply), [0x42]);
  await t.close();
});

test("rejects with reply timeout when no report ever arrives", async () => {
  install(() => {});
  const t = new NativeTransport();
  await t.open();
  await assert.rejects(t.request(Uint8Array.from([0x01]), 300), /reply timeout/);
  await t.close();
});
