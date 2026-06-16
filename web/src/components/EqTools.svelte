<script lang="ts">
  // Per-output EQ utilities: copy this output's PEQ+crossover to another, or link
  // two outputs so edits mirror (stereo pair).
  import { device } from "../state/device.svelte.ts";
  import { OUT_BASE } from "../state/model.ts";
  let { index }: { index: number } = $props();

  const others = $derived([0, 1, 2, 3].map((o) => OUT_BASE + o).filter((i) => i !== index));
  const name = (i: number) => device.ch(i).name;
  const linkedTo = $derived(device.eqLink[index]);

  let copyTarget = $state(-1);
  let linkTarget = $state(-1);
  $effect(() => { if (!others.includes(copyTarget)) copyTarget = others[0] ?? OUT_BASE; });
  $effect(() => { if (!others.includes(linkTarget)) linkTarget = others[0] ?? OUT_BASE; });
</script>

<div class="eqtools">
  <div class="grp">
    <span class="lbl">Copy EQ to</span>
    <select bind:value={copyTarget}>{#each others as o (o)}<option value={o}>{name(o)}</option>{/each}</select>
    <button onclick={() => device.copyEqTo(index, copyTarget)} disabled={!device.connected}>Copy</button>
  </div>
  <div class="grp">
    {#if linkedTo !== undefined}
      <span class="lbl on">🔗 Linked with {name(linkedTo)}</span>
      <button onclick={() => device.unlinkEq(index)}>Unlink</button>
    {:else}
      <span class="lbl">Link with</span>
      <select bind:value={linkTarget}>{#each others as o (o)}<option value={o}>{name(o)}</option>{/each}</select>
      <button onclick={() => device.linkEq(index, linkTarget)} disabled={!device.connected}>Link</button>
    {/if}
  </div>
</div>

<style>
  .eqtools { display: flex; gap: 1.5rem; flex-wrap: wrap; padding: .5rem 0; }
  .grp { display: flex; align-items: center; gap: .45rem; }
  .lbl { font-size: .8rem; color: var(--text-dim); }
  .lbl.on { color: var(--accent); }
  .eqtools select { background: var(--bg-elev); color: var(--text); border: 1px solid var(--line); border-radius: 6px; font: inherit; font-size: .82rem; padding: .25rem; }
</style>
