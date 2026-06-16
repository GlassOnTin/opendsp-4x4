# t.racks DSP 4x4 Mini Pro — protocol notes

Clean-room, interoperability-focused notes describing the device's USB-HID control
protocol **as observed on the wire**: framing, command set, data model and unit scalings
were derived by watching the USB traffic and by probing the device directly (write a
distinctive known value, read it back, match the bytes).

## Transport
- USB HID, VID `0x0168` / PID `0x0821`. One interface; two 64-byte **interrupt** endpoints:
  `0x02 OUT` (host→device), `0x81 IN` (device→host). No report IDs. Request/reply.

## Frame format
**Request (host→device):**
```
10 02            DLE STX
00               (reserved/seq)
addr             device address (0x01 on USB)
N                payload length = 1 + data.length  (code byte + data)
code             command code
<data…>          N-1 bytes
10 03            DLE ETX
checksum         = XOR(00, addr, N, code, …data) ^ 1
```
Sent in a 64-byte interrupt OUT report (trailing bytes are stale/ignored). Payload
bytes equal to 0x10 are escaped as `10 10`. Verified: poll `10 02 00 01 01 40 10 03 41`
(0x40, cksum 0x41), mute `10 02 00 01 03 35 04 01 10 03 33`.

**Reply (device→host):**
```
[0]      = 0x02                 frame/type marker
[1]      = id                   device id
[2]      = 0x00
[3]      = N                    payload length (includes the command-code byte)
[4]      = command code         e.g. 0x52 = version reply
[5..3+N] = payload              (N-1 data bytes)
[4+N]    = 0x10                 DLE
[5+N]    = 0x03                 ETX   (so 0x10 0x03 terminates the frame)
[6+N]    = checksum = XOR(bytes[1 .. 3+N]) ^ 1
```
Total frame = N+8 bytes (≤ 64). At the codec layer the reply payload is read as
`[0x01, 0x00, N, code, …data]` (N = 1 + data length).

> Note: a *different* 16-bit one's-complement checksum applies to the unit's RS-232 /
> network transport — don't confuse it with the USB-HID `XOR(bytes)^1` above.

## Confirmed opcode map (observed one control at a time)
| code | command | payload |
|------|---------|---------|
| `0x40` | poll in/out audio **levels** | – (reply carries 8 levels) |
| `0x35` | **mute** | `[chan, on]` |
| `0x36` | **polarity** invert | `[chan, invert]` |
| `0x34` | **level/gain** | `[chan, val16]` raw 0–400; **0 dB=281, +12 dB=400, ~10 units/dB** (linear in normal range, floors at raw 0 ≈ −60 dB) |
| `0x33` | **PEQ band** | `[chan, band, gain16, freq16, q8, type8, bypass8]` (capture-calibrated) |
| `0x26` | **set name** | 14 ASCII bytes |
| `0x21`/`0x20` | **store / recall preset** | `[slot]` |
| `0x27` | indexed readback | `[0..8]` |

Channels: **Output 1 = 0x04** (inputs 0x00–0x03, outputs 0x04–0x07). The full control
set (per-channel gain/mute/polarity, 7-band PEQ, crossover, compressor, gate, delay,
routing, linking) is exposed by the app.

**Full DSP-block opcodes (observed, one control at a time):**
| code | block | payload | notes |
|------|-------|---------|-------|
| `0x30` | compressor | `[chan, ratio, knee, attack16, release16, threshold16]` | ratio idx 0–15 (1:1.0…Limit); knee 0–12 dB; attack/release ms; **threshold raw=(dB+90)·2** |
| `0x31` | crossover LPF | `[chan, freq16, slope]` | **freq Hz = 19.7·2^(raw/30)**, raw 0–300 (30 steps/oct — coarser than PEQ); slope codes below |
| `0x32` | crossover HPF | `[chan, freq16, slope]` | same freq scale as LPF |
| `0x33` | PEQ band | `[chan, band, gain16, freq16, q8, type8, bypass8]` | **gain raw 0–240, 0 dB=120, 0.1 dB/step** (`dB=(raw−120)/10`); **freq = 16-bit log index, Hz=19.7·2^(idx/30)** (idx 0–300, *same scale as crossover*); **q8** single byte (Q scale provisional); type below. NB gain comes first (not RBJ order) — capture-verified (40.3 Hz = idx 31) |
| `0x34` | level/gain | `[chan, val16]` | raw 0–400; **0 dB=281, +12 dB=400, 10/dB** |
| `0x35` | mute | `[chan, on]` | |
| `0x36` | polarity | `[chan, invert]` | |
| `0x38` | delay | `[chan, samples16]` | **48 kHz**; ms=samples/48; max 32640=680 ms |
| `0x3a` | routing | `[out_chan, input_mask]` | bits InA=1,InB=2,InC=4,InD=8 |
| `0x3e` | gate | `[chan, attack16, release16, hold16, threshold16]` | ms; threshold raw=(dB+90)·2 (range 0–180) |
| `0x2f` | lock password | `[4 ASCII]` | default "1234" |
| `0x39` | test tone | `[source, freqIndex]` | source 0=off/input,1=pink,2=white,3=sine; freqIndex 0–30 = 1/3-oct 20 Hz–20 kHz |

**Startup handshake** (observed at editor launch, in order): `0x10`→status byte; `0x13`→version
string `"4x4MINIPRO V010"`; `0x2c`→7-byte config; `0x22`→30-byte flags/link table; `0x14`→flag;
`0x29 [0..29]`→read all 30 preset names (14 ASCII); `0x27 [0..8]`→read all 9 channel state
blocks (reply code `0x24`, 50 bytes each: name + DSP params); `0x12`→finalize (ack `0x01`);
then steady `0x40` level polling. (`0x52` also returns a longer version string, e.g.
`"4x4MINIPRO V010 20230106A"`.)

**Level reply (`0x40`)** — reply `[01,00,N=0x1c,0x40, …27 data bytes]`. 8 channel levels
sit at data offsets `2,5,8,…,23` (stride 3), order **In A–D, Out 1–4**; observed range ≈0–80.
Decoded in `web/src/protocol/readback.ts` (`levelsFromReply`), normalised ÷72 for the meters.

**Channel-state image (`0x27`→`0x24`)** — the nine `0x24` pages each carry `[idx, …50 bytes]`;
concatenating pages 0–8 (50 B each) rebuilds a **450-byte preset image**. All field offsets
below are **probe-verified** (wrote distinctive known values, read back, matched bytes):
- `+0..1` flags · `+2` **preset name** (14 ASCII).
- **input records** (24 B) at `16/40/64/88` (relative offsets): `+0` name (10 B) · `+10` gate
  attack (u16) · `+12` gate release · `+14` gate hold · `+16` gate threshold (raw `(dB+90)·2`) ·
  `+18` gain (u16, level-raw scale) · `+20` polarity (bool) · `+22` channel-id bit.
- **output records** (74 B) at `112/186/260/334`: `+0` name (8 B) · `+8` routing input mask
  (InA=1..InD=8) · `+10` HPF freq raw · `+12` LPF freq raw · `+14` HPF slope · `+15` LPF slope ·
  `+16..57` **7 PEQ bands** × 6 B = `[gain16 (0–240, 0 dB=120), freq16 (log idx /30), q8, type8]` ·
  `+58` comp ratio idx · `+59` comp knee · `+60` comp attack (u16) · `+62` release · `+64`
  threshold (raw) · `+66` gain (u16) · `+68` polarity (bool) · `+70` delay (u16 samples) ·
  `+72` channel-id bit.
- **Mute has NO readback.** Empirically, muting changes *none* of the device's readbacks
  (`0x10`/`0x14`/`0x22`/`0x24`/`0x2c`/`0x40` all unchanged) — mute state is held separately from
  the per-channel record array that `0x27`/`0x24` serializes, and no opcode the editor uses
  exposes it. So neither the editor nor this app can restore mute on connect; both default to
  un-muted. `0x22` is a static `ff ff 00 00…` channel-present/link map, **not** mute. PEQ
  per-band **bypass** also isn't in the image (command-only).

Decoded in `readback.ts` (`parsePresetImage`); the store hydrates every field on connect.

**Calibration** (from editor capture, 2026-06-16): gain (`0x34`), comp/gate threshold,
delay samples@48 kHz, PEQ freq (`19.7·2^(idx/30)`, 30/oct like the crossover), **PEQ gain
(`(raw−120)/10`)**, **crossover freq (`19.7·2^(raw/30)`)**. The PEQ-gain calibration also
revealed the `0x33` gain/freq field order (gain is the 16-bit field first, freq the log index) —
corrected in the codec.

**Slope codes** (`0x31`/`0x32` byte[3]; 0=bypass): `01`BW-6 `02`BL-6 `03`BW-12 `04`BL-12
`05`LK-12 `06`BW-18 `07`BL-18 `08`BW-24 `09`BL-24 `0a`LK-24.
**PEQ types** (`0x33` byte[7]): `0`Peak `1`Low-Shelf `2`High-Shelf `3`Low-Pass `4`High-Pass
`5`Allpass1 `6`Allpass2.

## Implementation
Built + golden-tested in `web/src/protocol/{commands,control,blocks,readback}.ts`. The codec
sends high-level parameters (freq/gain/Q/type); the device computes the biquads internally.

**Remaining gaps:** PEQ Q encoding (`q8`) is golden-confirmed at the values used but its full
range vs the editor's display isn't swept; mute has no readback (defaults un-muted on connect);
a handful of low opcodes seen in the startup handshake are unmapped readback variants.
