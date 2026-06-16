<script lang="ts">
  // Explicit per-band PEQ controls (freq / gain / Q-bandwidth / type / bypass) —
  // the discoverable counterpart to dragging handles on the graph. Same store
  // commit path, so the graph and these stay in sync.
  import { device } from "../state/device.svelte.ts";
  import { DEFAULT_BAND_FREQS } from "../state/model.ts";
  import Param from "./Param.svelte";
  let { index }: { index: number } = $props();

  const eq = $derived(device.ch(index).eq!);
  const TYPES = [
    { v: 0, l: "Peak" }, { v: 1, l: "Lo Shelf" }, { v: 2, l: "Hi Shelf" },
    { v: 3, l: "Lo Pass" }, { v: 4, l: "Hi Pass" }, { v: 5, l: "AllP 1" }, { v: 6, l: "AllP 2" },
  ];
  const bandHue = (i: number) => `hsl(${(i * 51) % 360} 75% 62%)`;
  const fHz = (v: number) => (v < 1000 ? v.toFixed(0) : (v / 1000).toFixed(2));

  const commit = (i: number) => device.commitPeqBand(index, i);
  const toggleBypass = (i: number) => { eq.bands[i]!.bypass = !eq.bands[i]!.bypass; commit(i); };
</script>

<div class="bands">
  {#each eq.bands as b, i (i)}
    <div class="band" class:byp={b.bypass}>
      <button class="num" style="--c:{bandHue(i)}" onclick={() => toggleBypass(i)} title={b.bypass ? "Bypassed — click to enable" : "Click to bypass"}>{i + 1}</button>
      <select class="sel" bind:value={b.type} onchange={() => commit(i)} aria-label="Band {i + 1} type">
        {#each TYPES as t (t.v)}<option value={t.v}>{t.l}</option>{/each}
      </select>
      <Param label="Freq" bind:value={b.freqHz} min={20} max={20000} log unit={b.freqHz < 1000 ? "Hz" : "kHz"} format={fHz} reset={DEFAULT_BAND_FREQS[i] ?? 1000} onchange={() => commit(i)} />
      <Param label="Gain" bind:value={b.gainDb} min={-18} max={18} step={0.5} unit="dB" reset={0} onchange={() => commit(i)} />
      <Param label="BW" bind:value={b.bwOct} min={0.05} max={4} step={0.05} unit="oct" reset={1} onchange={() => commit(i)} />
    </div>
  {/each}
</div>

<style>
  /* one vertical strip per band, spread across the graph width (graphic-EQ style) */
  .bands { display: flex; gap: .4rem; padding: .6rem 0; align-items: flex-start; }
  .band { flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; align-items: center; gap: .4rem;
          padding: .5rem .3rem; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-panel); }
  .band.byp { opacity: .45; }
  .num { width: 30px; height: 30px; padding: 0; border-radius: 50%; border: 2px solid var(--c);
         background: color-mix(in oklab, var(--c) 22%, transparent); color: var(--text); font-weight: 700; font-size: .8rem; cursor: pointer; }
  .band.byp .num { background: transparent; }
  .sel { width: 100%; max-width: 88px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--line);
         border-radius: 6px; font: inherit; font-size: .72rem; padding: .25rem; }
</style>
