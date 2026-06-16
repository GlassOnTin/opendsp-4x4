<script lang="ts">
  import { device } from "../state/device.svelte.ts";
  let slot = $state(0);
</script>

<div class="bar">
  <span class="muted">Preset</span>
  <select bind:value={slot}>
    {#each Array.from({ length: 30 }) as _, i (i)}<option value={i}>{i + 1}</option>{/each}
  </select>
  <button disabled={!device.connected} onclick={() => device.recallPreset(slot)}>Recall</button>
  <button disabled={!device.connected} onclick={() => device.storePreset(slot)}>Store</button>
</div>

<style>
  .bar { display: flex; align-items: center; gap: .4rem; font-size: .85rem; }
  select { background: var(--bg-elev); color: var(--text); border: 1px solid var(--line); border-radius: 6px; font: inherit; padding: .3rem; }
</style>
