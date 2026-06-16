<script lang="ts">
  import { device } from "../state/device.svelte.ts";
  import Param from "./Param.svelte";
  let { index }: { index: number } = $props();
  const ch = $derived(device.ch(index));
  const commit = () => device.setDelayMs(index, ch.delayMs ?? 0);
</script>

<div class="panel">
  <Param label="Delay" bind:value={ch.delayMs} min={0} max={680} step={0.02} unit="ms"
         format={(v) => v.toFixed(2)} onchange={commit} />
  <div class="readout muted mono">
    {((ch.delayMs ?? 0) * 48).toFixed(0)} samples @ 48 kHz · {(((ch.delayMs ?? 0) / 1000) * 343).toFixed(2)} m
  </div>
</div>

<style>
  .panel { display: flex; gap: 1rem; align-items: center; padding: .8rem 0; }
  .readout { font-size: .8rem; }
</style>
