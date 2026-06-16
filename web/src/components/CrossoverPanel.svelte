<script lang="ts">
  import { device } from "../state/device.svelte.ts";
  import Param from "./Param.svelte";
  let { index }: { index: number } = $props();
  const eq = $derived(device.ch(index).eq!);
  const SLOPES = [
    { v: 0, l: "Bypass" }, { v: 1, l: "BW 6" }, { v: 2, l: "BL 6" }, { v: 3, l: "BW 12" }, { v: 4, l: "BL 12" },
    { v: 5, l: "LR 12" }, { v: 6, l: "BW 18" }, { v: 7, l: "BL 18" }, { v: 8, l: "BW 24" }, { v: 9, l: "BL 24" }, { v: 10, l: "LR 24" },
  ];
  const fHz = (v: number) => (v < 1000 ? `${v.toFixed(0)}` : (v / 1000).toFixed(2));
  const slopeSel = (e: Event, which: "hpf" | "lpf") => {
    eq[which].slope = +(e.currentTarget as HTMLSelectElement).value;
    which === "hpf" ? device.commitHpf(index) : device.commitLpf(index);
  };
</script>

<div class="xo">
  <div class="band">
    <strong class="hd">Low-Cut · HPF</strong>
    <Param label="Freq" bind:value={eq.hpf.freqHz} min={20} max={20000} log unit={eq.hpf.freqHz < 1000 ? "Hz" : "kHz"} format={fHz} onchange={() => device.commitHpf(index)} />
    <select class="sel" value={eq.hpf.slope} onchange={(e) => slopeSel(e, "hpf")}>
      {#each SLOPES as s (s.v)}<option value={s.v}>{s.l}</option>{/each}
    </select>
  </div>
  <div class="band">
    <strong class="hd">High-Cut · LPF</strong>
    <Param label="Freq" bind:value={eq.lpf.freqHz} min={20} max={20000} log unit={eq.lpf.freqHz < 1000 ? "Hz" : "kHz"} format={fHz} onchange={() => device.commitLpf(index)} />
    <select class="sel" value={eq.lpf.slope} onchange={(e) => slopeSel(e, "lpf")}>
      {#each SLOPES as s (s.v)}<option value={s.v}>{s.l}</option>{/each}
    </select>
  </div>
</div>

<style>
  .xo { display: flex; justify-content: space-between; gap: 1.5rem; padding: .4rem 0; }
  .band { display: flex; flex-direction: column; gap: .4rem; align-items: center; }
  .hd { font-size: .8rem; color: var(--text-dim); }
  .sel { background: var(--bg-elev); color: var(--text); border: 1px solid var(--line); border-radius: 6px; font: inherit; padding: .3rem; }
</style>
