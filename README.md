# openDSP-4x4 — portable control for the t.racks DSP 4x4 Mini Pro

Open-source, cross-platform control software for the **the t.racks DSP 4x4 Mini Pro**
(a 4-in/4-out XLR DSP that ships with Windows-only editor software).

![openDSP-4x4 web app: a patch-board view with input/output nodes, patch cables, and an interactive 7-band parametric EQ](docs/screenshot.png)

**[▶ Open the web app](https://glassontin.github.io/opendsp-4x4/)** — runs entirely in
Chrome/Edge over WebHID; nothing to install. Plug the DSP in over USB and click *Connect*.

Goals:
- **Portable GUI** on desktop (Linux/Windows/macOS) and **Android over USB-OTG** — control
  the DSP from a phone/tablet at a gig.
- Eventual **full editor parity**: PEQ, crossovers, delays, limiters, gain/mute, routing,
  presets.
- Clean, strongly-typed, well-separated codebase; everything driven by one documented
  protocol.

## Status — WebHID app working and verified on hardware.

The device is a USB-HID device (`0168:0821`) using 64-byte interrupt reports. The control
protocol was developed **clean-room**, by observing the device's USB-HID traffic and probing
it directly (write a known value, read it back, match the bytes); see [`PROTOCOL.md`](PROTOCOL.md).
The protocol is the single source of truth and is implemented per-platform:

- **`web/`** — TypeScript + **WebHID** desktop app (Chrome/Edge). Zero-install. Routing,
  gain/mute/polarity, 7-band PEQ, crossovers, compressor, gate, delay, presets, live meters
  and full device-state readback are implemented and **live-verified on the hardware**.
  Known gaps: PEQ Q scaling is provisional and gate timing isn't yet calibrated to ms.
- **KMP + Compose app** — Kotlin Multiplatform for **Android (USB-OTG)** + desktop. The only
  path that reaches the device on Android. *(planned — reuses the same protocol spec)*

## Repo layout
- `PROTOCOL.md` — the wire protocol (frame format, command codes, data model).
- `web/` — TypeScript protocol codec + WebHID app.

## Legal
Independent, **clean-room** interoperability implementation: the control protocol was
developed solely by observing the device's USB-HID interface. "the t.racks" is a trademark
of Thomann; this project is not affiliated with or endorsed by Thomann.

Licensed under **GNU AGPL-3.0-or-later** (see `LICENSE`) — strong copyleft: any
distributed or network-served derivative must publish its source under the same terms.

    Copyright (C) 2026 Ian Williams
    This program is free software: you can redistribute it and/or modify it under the
    terms of the GNU Affero General Public License as published by the Free Software
    Foundation, either version 3 of the License, or (at your option) any later version.
