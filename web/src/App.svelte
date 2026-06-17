<script lang="ts">
  import { device } from "./state/device.svelte.ts";
  import { NativeTransport } from "./transport/native.ts";
  import PatchBoard from "./components/PatchBoard.svelte";
  import PresetBar from "./components/PresetBar.svelte";
  import TestTonePanel from "./components/TestTonePanel.svelte";
  import LockDialog from "./components/LockDialog.svelte";

  // Reachable either via WebHID (desktop) or the Android native USB bridge.
  const supported = NativeTransport.supported() || (typeof navigator !== "undefined" && "hid" in navigator);
  let showSystem = $state(false);
</script>

<header class="top">
  <strong>openDSP-4x4</strong><span class="muted"> · t.racks DSP 4x4 Mini Pro</span>
  <span class="spacer"></span>
  <PresetBar />
  <button class:on={showSystem} onclick={() => (showSystem = !showSystem)}>System ▾</button>
  <span class="dot" class:ok={device.connected}></span>
  <span class="status" class:ok={device.connected}>{device.connected ? device.version || device.productName : device.error || "Not connected"}</span>
  <button class="primary" onclick={() => device.connect()}>{device.connected ? "Reconnect…" : "Connect DSP…"}</button>
</header>

{#if !supported}<div class="warn-box">WebHID isn't available — use <b>Chrome</b> or <b>Edge</b> on desktop.</div>{/if}
{#if showSystem}<div class="system">
  <TestTonePanel /><div class="vline"></div><LockDialog /><div class="vline"></div>
  <div class="defaults">
    <strong class="hd">Defaults <span class="muted">(this browser)</span></strong>
    <div class="drow">
      <button onclick={() => device.saveDefaults()} disabled={!device.connected}>Save current</button>
      <button class="primary" onclick={() => device.restoreDefaults()} disabled={!device.connected || !device.hasDefaults}>Restore</button>
    </div>
    <span class="muted">{device.hasDefaults ? "snapshot saved — Restore re-sends it to the DSP" : "no snapshot yet — Save the current setup first"}</span>
  </div>
</div>{/if}

<PatchBoard />

<footer class="agpl muted">
  openDSP-4x4 · <a href="https://www.gnu.org/licenses/agpl-3.0.html">AGPL-3.0</a> ·
  <a href="https://github.com/GlassOnTin/opendsp-4x4">source</a> · not affiliated with Thomann
</footer>

<style>
  .top { display: flex; align-items: center; gap: .55rem; padding: .6rem 1rem; border-bottom: 1px solid var(--line); background: var(--bg-panel); }
  .spacer { flex: 1; }
  .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--bad); box-shadow: 0 0 8px var(--bad); }
  .dot.ok { background: var(--good); box-shadow: 0 0 8px var(--good); }
  .status { font-size: .82rem; color: var(--text-dim); max-width: 22ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .status.ok { color: var(--good); }
  button.on { border-color: var(--accent); }
  .warn-box { margin: .6rem 1rem; background: #4a2b00; color: #ffd9a0; padding: .55rem .8rem; border-radius: var(--radius); }
  .system { display: flex; gap: 1rem; align-items: center; margin: .6rem 1rem; padding: .7rem .9rem; background: var(--bg-panel); border: 1px solid var(--line); border-radius: var(--radius); flex-wrap: wrap; }
  .vline { width: 1px; align-self: stretch; background: var(--line); }
  .defaults { display: flex; flex-direction: column; gap: .45rem; }
  .defaults .hd { font-size: .82rem; color: var(--text-dim); }
  .drow { display: flex; gap: .4rem; }
  .agpl { padding: .5rem 1rem; border-top: 1px solid var(--line); font-size: .72rem; }
  .agpl a { color: var(--accent); }
</style>
