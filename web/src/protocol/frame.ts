// Frame codec for the t.racks DSP 4x4 Mini Pro HID protocol.
// Wire format confirmed by observing the device's USB traffic (see ../../../PROTOCOL.md):
//
//   DLE STX | <payload> | DLE ETX | checksum
//   = 0x10 0x02 | payload… | 0x10 0x03 | XOR(payload) ^ 1
//
// Request payload (host->device): [0x00, addr, N, code, ...data]   N = 1 + data.length
// Reply payload (device->host):   [addr, ..., code, ...]           (structure varies by command)
// Payload bytes equal to 0x10 (DLE) are escaped as 0x10 0x10.

export const DLE = 0x10;
export const STX = 0x02;
export const ETX = 0x03;
export const REQUEST_ADDR = 0x01; // device address the editor uses

/** XOR of payload bytes, then ^1 — the protocol's frame checksum. */
export function frameChecksum(payload: ArrayLike<number>): number {
  let x = 0;
  for (let i = 0; i < payload.length; i++) x ^= payload[i]!;
  return (x ^ 1) & 0xff;
}

/**
 * Wrap a payload as DLE-STX … DLE-ETX + checksum. The device does NOT escape
 * 0x10 bytes — it locates the payload by the length field (byte [2] of the
 * payload), and the terminator sits after it. (Confirmed on hardware: a 0x10
 * command/data byte is sent raw; escaping it breaks the frame.)
 */
export function frameWrap(payload: readonly number[]): number[] {
  return [DLE, STX, ...payload.map((b) => b & 0xff), DLE, ETX, frameChecksum(payload)];
}

/**
 * Build a host->device request frame, padded to the 64-byte interrupt report.
 *   payload = [0x00, addr, N, code, ...data]
 */
export function buildRequest(code: number, data: Uint8Array = new Uint8Array(0), addr = REQUEST_ADDR): Uint8Array {
  const N = 1 + data.length;
  const payload = [0x00, addr & 0xff, N & 0xff, code & 0xff, ...data];
  const out = new Uint8Array(64); // zero-padded to the interrupt OUT report size
  out.set(frameWrap(payload), 0);
  return out;
}

export interface Frame {
  /** unescaped payload bytes between STX and the terminating ETX */
  payload: Uint8Array;
  checksumOk: boolean;
}

export interface Reply {
  code: number;
  /** data bytes after the reply's code byte */
  data: Uint8Array;
  checksumOk: boolean;
}

/**
 * Parse a device->host reply. Reply payload layout (confirmed by capture):
 *   [0x01, 0x00, N, code, ...data]   where N = 1 + data.length
 */
export function parseReply(report: Uint8Array): Reply {
  const { payload, checksumOk } = parseFrame(report);
  const N = payload[2] ?? 0;
  return { code: payload[3] ?? 0, data: payload.slice(4, 3 + N), checksumOk };
}

/**
 * Parse a DLE-framed report. The payload length is `N + 3` where `N` is the
 * length field at payload index 2 (report[4]); the DLE-ETX + checksum follow.
 * (Length-based, not escape-scanned — the device never escapes 0x10.)
 */
export function parseFrame(report: Uint8Array): Frame {
  if (report[0] !== DLE || report[1] !== STX) throw new Error("missing DLE STX header");
  const N = report[4] ?? 0;
  const plen = N + 3;
  const payload = report.slice(2, 2 + plen);
  const etxAt = 3 + plen, ckAt = 4 + plen;
  const checksumOk =
    report[2 + plen] === DLE && report[etxAt] === ETX && report[ckAt] === frameChecksum(payload);
  return { payload, checksumOk };
}
