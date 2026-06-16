// Command codes, verified by observing the device's USB traffic (one control
// changed at a time).

export const Command = {
  // --- startup / queries (no payload unless noted) ---
  GET_STATUS: 0x10,    // reply 1 byte (model/status, observed 0x1f)
  INIT_DONE: 0x12,     // finalize handshake; device acks reply code 0x01
  GET_VERSION: 0x13,   // reply ASCII version "4x4MINIPRO V010"
  GET_FLAG: 0x14,      // reply 1 byte
  GET_FLAGS_BLOCK: 0x22, // reply 30-byte flags/link table
  READ_CHANNEL: 0x27,  // [index 0..8] -> reply code 0x24, 50-byte channel state
  READ_PRESET_NAME: 0x29, // [index 0..29] -> reply 14-byte preset name
  GET_CONFIG: 0x2c,    // reply 7-byte config block
  REPLY_CHANNEL: 0x24, // reply code for READ_CHANNEL
  // --- confirmed by capture ---
  RECALL_PRESET: 0x20, // [slot]
  STORE_PRESET: 0x21,  // [slot]
  SET_NAME: 0x26,      // [14 ASCII bytes] (preset/channel name)
  SET_PASSWORD: 0x2f,  // [4 ASCII] lock password (params 0x0d..0x10; default "1234")
  TEST_TONE: 0x39,     // [source, freqIndex] source 0=off/input,1=pink,2=white,3=sine
  COMPRESSOR: 0x30,    // [chan, ratio, knee, attack16, release16, threshold16]
  CROSSOVER_LPF: 0x31, // [chan, freq16, slope]
  CROSSOVER_HPF: 0x32, // [chan, freq16, slope]
  PEQ_BAND: 0x33,      // [chan, band, gain16, freq16, q8, type8, bypass8]
  LEVEL: 0x34,         // [chan, val16] raw 0..400; 0dB=281, +12dB=400, ~10 units/dB
  MUTE: 0x35,          // [chan, on(1)/off(0)]
  POLARITY: 0x36,      // [chan, invert(1)/normal(0)]
  DELAY: 0x38,         // [chan, samples16] @48kHz (ms = samples/48; max 32640 = 680ms)
  GATE: 0x3e,          // [chan, attack16, release16, hold16, threshold16]
  ROUTING: 0x3a,       // [out_chan, input_bitmask] (InA=1,InB=2,InC=4,InD=8)
  READBACK_LEVELS: 0x40, // poll: in/out audio levels (reply carries 8 levels)
  // alternate version query: the device also answers 0x52 with a longer version string
  GET_VERSION_FW: 0x52,
} as const;

// Channel numbering, from capture (Output 1 = 0x04). To confirm for inputs.
export const Channel = {
  IN_A: 0x00, IN_B: 0x01, IN_C: 0x02, IN_D: 0x03,
  OUT_1: 0x04, OUT_2: 0x05, OUT_3: 0x06, OUT_4: 0x07,
} as const;

export const KNOWN_COMMANDS: Readonly<Record<number, string>> = {
  0x10: "GET_STATUS", 0x12: "INIT_DONE", 0x13: "GET_VERSION", 0x14: "GET_FLAG",
  0x20: "RECALL_PRESET", 0x21: "STORE_PRESET", 0x22: "GET_FLAGS_BLOCK", 0x24: "REPLY_CHANNEL",
  0x26: "SET_NAME", 0x27: "READ_CHANNEL", 0x29: "READ_PRESET_NAME", 0x2c: "GET_CONFIG",
  0x2f: "SET_PASSWORD", 0x39: "TEST_TONE",
  0x30: "COMPRESSOR", 0x31: "CROSSOVER_LPF", 0x32: "CROSSOVER_HPF", 0x33: "PEQ_BAND",
  0x34: "LEVEL", 0x35: "MUTE", 0x36: "POLARITY", 0x38: "DELAY", 0x3a: "ROUTING",
  0x3e: "GATE", 0x40: "READBACK_LEVELS", 0x52: "GET_VERSION_FW",
};

/** Crossover slope codes (byte [3] of 0x31/0x32; 0 = bypass). */
export const Slope = {
  BYPASS: 0x00, BW6: 0x01, BL6: 0x02, BW12: 0x03, BL12: 0x04, LK12: 0x05,
  BW18: 0x06, BL18: 0x07, BW24: 0x08, BL24: 0x09, LK24: 0x0a,
} as const;

/** Compressor ratio index (byte [1] of 0x30). */
export const Ratio = [
  "1:1.0", "1:1.1", "1:1.3", "1:1.5", "1:1.7", "1:2.0", "1:2.5", "1:3.0",
  "1:3.5", "1:4.0", "1:5.0", "1:6.0", "1:8.0", "1:10", "1:20", "Limit",
] as const;

/** PEQ band filter type (byte [7] of 0x33). */
export const PeqType = {
  PEAK: 0x00, LOW_SHELF: 0x01, HIGH_SHELF: 0x02, LOW_PASS: 0x03,
  HIGH_PASS: 0x04, ALLPASS1: 0x05, ALLPASS2: 0x06,
} as const;

/** Test-tone source (byte [1] of 0x39). */
export const ToneSource = { OFF: 0, PINK: 1, WHITE: 2, SINE: 3 } as const;

/** Sine test-tone frequencies (Hz) by index (byte [2] of 0x39): 1/3-octave 20Hz–20kHz. */
export const TONE_FREQS = [
  20, 25, 31.5, 40, 50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800,
  1000, 1250, 1600, 2000, 2500, 3150, 4000, 5000, 6300, 8000, 10000, 12500, 16000, 20000,
] as const;

export function commandName(code: number): string {
  return KNOWN_COMMANDS[code] ?? `UNKNOWN_0x${code.toString(16)}`;
}
