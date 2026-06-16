// DSP-block command builders + unit conversions, all derived and validated by
// observing the device's USB traffic (one control at a time).
// See ../../../PROTOCOL.md for the field layouts.
import { buildRequest } from "./frame.ts";
import { Command } from "./commands.ts";

const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff];

// ---- unit conversions ----

/** Threshold (compressor & gate): raw = (dB + 90) * 2. */
export const thresholdDbToRaw = (db: number) => Math.round((db + 90) * 2);
export const thresholdRawToDb = (raw: number) => raw / 2 - 90;

/** Delay: 48 kHz, stored in samples. Max 32640 samples (680 ms). */
export const msToSamples = (ms: number) => Math.max(0, Math.min(32640, Math.round(ms * 48)));
export const samplesToMs = (s: number) => s / 48;

/** PEQ frequency: log index 0..300, 30 steps/octave (0 = 19.7 Hz, 300 = 20.16 kHz) — same
 * scale as the crossover. Capture-verified: editor 40.3 Hz = index 31 = 19.7·2^(31/30). */
export const hzToPeqIndex = (hz: number) =>
  Math.max(0, Math.min(300, Math.round(30 * Math.log2(hz / 19.7))));
export const peqIndexToHz = (i: number) => 19.7 * Math.pow(2, i / 30);

/** PEQ Q: single byte (q8). Scale provisional (default q8=25, not yet swept against the editor). */
export const qToRaw = (q: number) => Math.max(0, Math.min(255, Math.round(q * 10)));
export const rawToQ = (raw: number) => raw / 10;

// ---- block builders (return 64-byte request frames) ----

/** Compressor (full state). thresholdDb e.g. -10; ratioIndex 0..15 (see Ratio). */
export function compressorFrame(
  chan: number,
  o: { ratioIndex: number; kneeDb: number; attackMs: number; releaseMs: number; thresholdDb: number },
): Uint8Array {
  return buildRequest(Command.COMPRESSOR, Uint8Array.of(
    chan & 0xff, o.ratioIndex & 0xff, o.kneeDb & 0xff,
    ...le16(o.attackMs), ...le16(o.releaseMs), ...le16(thresholdDbToRaw(o.thresholdDb)),
  ));
}

/** Gate (full state). */
export function gateFrame(
  chan: number,
  o: { attackMs: number; releaseMs: number; holdMs: number; thresholdDb: number },
): Uint8Array {
  return buildRequest(Command.GATE, Uint8Array.of(
    chan & 0xff,
    ...le16(o.attackMs), ...le16(o.releaseMs), ...le16(o.holdMs), ...le16(thresholdDbToRaw(o.thresholdDb)),
  ));
}

/** Crossover. freqRaw is the device's 16-bit freq index (its Hz scale differs from PEQ; raw for now). */
export function crossoverHpfFrame(chan: number, freqRaw: number, slope: number): Uint8Array {
  return buildRequest(Command.CROSSOVER_HPF, Uint8Array.of(chan & 0xff, ...le16(freqRaw), slope & 0xff));
}
export function crossoverLpfFrame(chan: number, freqRaw: number, slope: number): Uint8Array {
  return buildRequest(Command.CROSSOVER_LPF, Uint8Array.of(chan & 0xff, ...le16(freqRaw), slope & 0xff));
}

/** Delay in samples (use msToSamples for ms). */
export function delayFrame(chan: number, samples: number): Uint8Array {
  return buildRequest(Command.DELAY, Uint8Array.of(chan & 0xff, ...le16(samples)));
}
export const delayMsFrame = (chan: number, ms: number) => delayFrame(chan, msToSamples(ms));

/** Routing: which inputs feed an output. inputMask bits: InA=1, InB=2, InC=4, InD=8. */
export function routingFrame(outChan: number, inputMask: number): Uint8Array {
  return buildRequest(Command.ROUTING, Uint8Array.of(outChan & 0xff, inputMask & 0xff));
}

/**
 * PEQ band. Layout (capture-verified): [chan, band, gain16, freq16, q8, type8, bypass8].
 * gainRaw 16-bit (0..240, 0 dB = 120); freq -> 16-bit log index (30/oct, same as crossover);
 * q -> single byte. NB gain comes first (not the RBJ freq/q/gain order) — verified by an
 * editor gain ramp + a fixed-freq (40.3 Hz) capture.
 */
export function peqBandFrame(
  chan: number, band: number,
  o: { freqHz: number; q: number; gainRaw: number; type: number; bypass?: boolean },
): Uint8Array {
  return buildRequest(Command.PEQ_BAND, Uint8Array.of(
    chan & 0xff, band & 0xff,
    ...le16(o.gainRaw), ...le16(hzToPeqIndex(o.freqHz)),
    qToRaw(o.q) & 0xff, o.type & 0xff, o.bypass ? 1 : 0,
  ));
}
