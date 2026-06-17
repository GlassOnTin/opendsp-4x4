<script lang="ts">
  import { device } from "../state/device.svelte.ts";
  let slot = $state(0);
</script>

<div class="bar">
  <select bind:value={slot} title="Preset slot">
    {#each Array.from({ length: 30 }) as _, i (i)}<option value={i}>Preset {i + 1}</option>{/each}
  </select>
  <button disabled={!device.connected} onclick={() => device.recallPreset(slot)}>Recall</button>
  <button disabled={!device.connected} onclick={() => device.storePreset(slot)}>Store</button>
</div>

<style>
  /* stacked column — Preset select over Recall over Store — to save width in the top bar */
  .bar { display: inline-flex; flex-direction: column; gap: .25rem; font-size: .78rem; }
  .bar > :global(*) { width: 100%; box-sizing: border-box; text-align: center; }
  select { background: var(--bg-elev); color: var(--text); border: 1px solid var(--line); border-radius: 6px; font: inherit; padding: .25rem; }
</style>
