<script lang="ts">
  import { device } from "../state/device.svelte.ts";
  import Meter from "./Meter.svelte";
  let { index }: { index: number } = $props();
  const ch = $derived(device.ch(index));
</script>

<div class="header" style="--c:var(--ch-{index})">
  <span class="glabel">Gain</span>
  <div class="fader">
    <input type="range" min="-60" max="12" step="0.5" value={ch.gainDb}
           oninput={(e) => device.setGainDb(index, +(e.currentTarget as HTMLInputElement).value)} />
    <span class="db mono">{ch.gainDb >= 0 ? "+" : ""}{ch.gainDb.toFixed(1)} dB</span>
  </div>
  <button class="tgl" class:on={ch.mute} onclick={() => device.setMute(index, !ch.mute)}>Mute</button>
  <button class="tgl" class:on={ch.polarity} onclick={() => device.setPolarity(index, !ch.polarity)}>Ø</button>
  <div class="meter"><Meter level={ch.meter} horizontal /></div>
</div>

<style>
  .header { display: flex; align-items: center; gap: .5rem; padding: .55rem .7rem; background: var(--bg-panel); border: 1px solid var(--line); border-radius: var(--radius); }
  .glabel { font-size: .72rem; color: var(--text-dim); flex-shrink: 0; }
  .fader { flex: 1 1 auto; min-width: 60px; max-width: 240px; display: flex; align-items: center; gap: .5rem; }
  .fader input { flex: 1; min-width: 0; accent-color: var(--c); }
  .db { width: 6ch; flex-shrink: 0; text-align: right; font-size: .8rem; }
  .tgl { flex-shrink: 0; }
  .tgl.on { background: var(--warn); color: #1a1205; border-color: var(--warn); }
  .meter { width: 64px; flex-shrink: 0; }
</style>
