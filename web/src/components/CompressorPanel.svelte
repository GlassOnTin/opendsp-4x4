<script lang="ts">
  import { device } from "../state/device.svelte.ts";
  import Param from "./Param.svelte";
  import { Ratio } from "../protocol/commands.ts";
  let { index }: { index: number } = $props();
  const c = $derived(device.ch(index).comp!);
  const commit = () => device.commitComp(index);
</script>

<div class="panel">
  <Param label="Threshold" bind:value={c.thresholdDb} min={-90} max={20} step={0.5} unit="dB" onchange={commit} />
  <div class="param">
    <span class="lbl">Ratio</span>
    <select class="sel" value={c.ratioIndex} onchange={(e) => { c.ratioIndex = +(e.currentTarget as HTMLSelectElement).value; commit(); }}>
      {#each Ratio as r, i (i)}<option value={i}>{r}</option>{/each}
    </select>
  </div>
  <Param label="Knee" bind:value={c.kneeDb} min={0} max={12} step={1} unit="dB" onchange={commit} />
  <Param label="Attack" bind:value={c.attackMs} min={1} max={999} step={1} unit="ms" onchange={commit} />
  <Param label="Release" bind:value={c.releaseMs} min={10} max={3000} step={10} unit="ms" onchange={commit} />
</div>

<style>
  .panel { display: flex; gap: .8rem; flex-wrap: wrap; padding: .8rem 0; }
  .param { display: flex; flex-direction: column; gap: .25rem; width: 100px; }
  .lbl { font-size: .7rem; color: var(--text-dim); text-align: center; }
  .sel { height: 64px; background: var(--bg-elev); color: var(--text); border: 1px solid var(--line); border-radius: 8px; font: inherit; text-align: center; }
</style>
