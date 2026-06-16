<script lang="ts">
  import { device } from "../state/device.svelte.ts";
  import Param from "./Param.svelte";
  let { index }: { index: number } = $props();
  const g = $derived(device.ch(index).gate!);
  const commit = () => device.commitGate(index);
</script>

<div class="panel">
  <Param label="Threshold" bind:value={g.thresholdDb} min={-90} max={0} step={0.5} unit="dB" onchange={commit} />
  <Param label="Attack" bind:value={g.attackMs} min={1} max={999} step={1} unit="ms" onchange={commit} />
  <Param label="Hold" bind:value={g.holdMs} min={10} max={999} step={1} unit="ms" onchange={commit} />
  <Param label="Release" bind:value={g.releaseMs} min={1} max={3000} step={10} unit="ms" onchange={commit} />
</div>

<style>
  .panel { display: flex; gap: .8rem; flex-wrap: wrap; padding: .8rem 0; }
</style>
