<script lang="ts">
  import { device } from "../state/device.svelte.ts";
  import { TONE_FREQS } from "../protocol/commands.ts";
  let armed = $state(false);
  let source = $state(0);
  let freqIdx = $state(17); // ~1 kHz
  const SOURCES = [{ v: 0, l: "Off" }, { v: 1, l: "Pink" }, { v: 2, l: "White" }, { v: 3, l: "Sine" }];
  function pick(s: number) { if (s !== 0 && !armed) return; source = s; device.testTone(s, freqIdx); }
  function setFreq(i: number) { freqIdx = i; if (source === 3) device.testTone(3, i); }
</script>

<div class="tone">
  <div class="warn">⚠ Test tones output audio at full level — turn speakers down or disconnect them first.</div>
  <label class="arm"><input type="checkbox" bind:checked={armed} /> I understand — enable test tones</label>
  <div class="row">
    {#each SOURCES as s (s.v)}
      <button class:on={source === s.v} disabled={!device.connected || (s.v !== 0 && !armed)} onclick={() => pick(s.v)}>{s.l}</button>
    {/each}
    <select disabled={source !== 3} value={freqIdx} onchange={(e) => setFreq(+(e.currentTarget as HTMLSelectElement).value)}>
      {#each TONE_FREQS as f, i (i)}<option value={i}>{f >= 1000 ? f / 1000 + "k" : f} Hz</option>{/each}
    </select>
  </div>
</div>

<style>
  .tone { display: flex; flex-direction: column; gap: .5rem; }
  .warn { background: #4a1d1d; color: #ffc9c9; padding: .5rem .7rem; border-radius: var(--radius); font-size: .82rem; }
  .arm { font-size: .85rem; display: flex; gap: .4rem; align-items: center; }
  .row { display: flex; gap: .4rem; align-items: center; flex-wrap: wrap; }
  .on { background: var(--bad); color: #fff; border-color: var(--bad); }
  select { background: var(--bg-elev); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: .3rem; }
</style>
