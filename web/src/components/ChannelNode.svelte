<script lang="ts">
  // One channel as a patch-board node: a compact button when idle, expanding in place
  // into its full settings when selected. Inputs show gate; outputs show EQ + dynamics.
  import { device } from "../state/device.svelte.ts";
  import { OUT_BASE } from "../state/model.ts";
  import Meter from "./Meter.svelte";
  import ChannelHeader from "./ChannelHeader.svelte";
  import GatePanel from "./GatePanel.svelte";
  import EqGraph from "./EqGraph.svelte";
  import CrossoverPanel from "./CrossoverPanel.svelte";
  import BandList from "./BandList.svelte";
  import CompressorPanel from "./CompressorPanel.svelte";
  import DelayPanel from "./DelayPanel.svelte";
  import EqTools from "./EqTools.svelte";

  let { index }: { index: number } = $props();
  const ch = $derived(device.ch(index));
  const open = $derived(device.selected === index);
  const wire = $derived(ch.isOutput ? `out-${index - OUT_BASE}` : `in-${index}`);

  function onEqCommit(kind: "band" | "hpf" | "lpf", band?: number) {
    if (kind === "band" && band != null) device.commitPeqBand(index, band);
    else if (kind === "hpf") device.commitHpf(index);
    else device.commitLpf(index);
  }
</script>

<section class="node" class:open data-wire={wire} style="--c:var(--ch-{index})">
  {#if open}
    <button class="titlebar" onclick={() => device.collapse()} title="Collapse" aria-label="Collapse {ch.name}">
      <span class="cdot"></span><span class="tname">{ch.name}</span><span class="chev">▴</span>
    </button>
    <ChannelHeader index={index} />
    {#if ch.isOutput && ch.eq}
      <EqGraph bind:eq={ch.eq} onCommit={onEqCommit} />
      <CrossoverPanel index={index} />
      <details><summary>PEQ bands</summary><BandList index={index} /></details>
      <details><summary>Compressor</summary><CompressorPanel index={index} /></details>
      <details><summary>Delay</summary><DelayPanel index={index} /></details>
      <details><summary>Copy / Link EQ</summary><EqTools index={index} /></details>
    {:else}
      <details><summary>Gate</summary><GatePanel index={index} /></details>
    {/if}
  {:else}
    <button class="collapsed" onclick={() => (device.selected = index)} title="Open {ch.name}">
      <span class="cdot"></span><span class="cname">{ch.name}</span>
      <span class="mini"><Meter level={ch.meter} horizontal /></span>
      {#if ch.mute}<span class="tag">M</span>{/if}{#if ch.polarity}<span class="tag">Ø</span>{/if}
    </button>
  {/if}
</section>

<style>
  .node { flex: 0 0 auto; min-width: 0; min-height: 40px; max-width: min(900px, 100%); }
  .node.open { display: flex; flex-direction: column; gap: .4rem; padding: .4rem .5rem; max-width: min(900px, 100%);
    border: 1px solid var(--c); border-radius: var(--radius); background: var(--bg-panel);
    box-shadow: 0 0 0 1px var(--c), 0 0 18px -9px var(--c); }
  /* keep every section within the node's width (flex-column stretch would otherwise size
     children to their max-content and overflow the constrained node) */
  .node.open > :global(*) { min-width: 0; max-width: 100%; box-sizing: border-box; }
  .collapsed { width: 100%; display: flex; align-items: center; gap: .45rem; text-align: left; min-height: 40px; }
  .cdot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); flex-shrink: 0; }
  .cname { flex: 1; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mini { width: 52px; flex-shrink: 0; }
  .tag { font-size: .65rem; color: var(--warn); font-weight: 700; }
  .titlebar { display: flex; align-items: center; gap: .5rem; width: 100%; text-align: left;
    padding: .35rem .6rem; border-color: var(--c); background: color-mix(in oklab, var(--c) 12%, var(--bg-elev)); }
  .titlebar:hover { background: color-mix(in oklab, var(--c) 20%, var(--bg-elev)); }
  .titlebar .cdot { width: 10px; height: 10px; border-radius: 50%; background: var(--c); flex-shrink: 0; }
  .tname { flex: 1; font-weight: 600; }
  .chev { color: var(--text-dim); font-size: .9rem; }
  details summary { cursor: pointer; font-size: .82rem; color: var(--text-dim); padding: .25rem 0; }
  details[open] summary { color: var(--text); }
</style>
