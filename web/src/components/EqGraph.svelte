<script lang="ts">
  import { logFreqAxis, summedResponseDb } from "../eq/response.ts";
  import { makeScales } from "../eq/scales.ts";
  import type { ChannelEq } from "../eq/types.ts";
  import { PeqType } from "../protocol/commands.ts";
  import { DEFAULT_BAND_FREQS } from "../state/model.ts";

  let { eq = $bindable(), onCommit }: {
    eq: ChannelEq;
    onCommit?: (kind: "band" | "hpf" | "lpf", index?: number) => void;
  } = $props();

  const W = 760, H = 290, DB = 18;
  const scales = makeScales(W, H, 20, 20000, DB);
  const freqs = logFreqAxis(280, 20, 20000);

  let svgEl: SVGSVGElement;
  let activeBand = $state<number | null>(null);
  let drag = $state<{ kind: "band" | "hpf" | "lpf"; i: number } | null>(null);

  const clampHz = (hz: number) => Math.max(20, Math.min(20000, hz));
  const clampDb = (db: number) => Math.max(-DB, Math.min(DB, db));
  const bandHue = (i: number) => `hsl(${(i * 51) % 360} 75% 62%)`;
  const TYPE_NAME = ["Peak", "LoShelf", "HiShelf", "LoPass", "HiPass", "AllP1", "AllP2"];

  function toPath(f: Float64Array, db: Float64Array): string {
    let d = "";
    for (let i = 0; i < f.length; i++) {
      d += (i ? "L" : "M") + scales.freqToX(f[i]!).toFixed(1) + " " + scales.dbToY(clampDb(db[i]!)).toFixed(1);
    }
    return d;
  }
  function toVb(e: PointerEvent) {
    const r = svgEl.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  }

  const sumPath = $derived(toPath(freqs, summedResponseDb(eq, freqs)));
  const handles = $derived(eq.bands.map((b, i) => ({ i, b, x: scales.freqToX(b.freqHz), y: scales.dbToY(clampDb(b.gainDb)) })));
  const hpfX = $derived(scales.freqToX(eq.hpf.freqHz));
  const lpfX = $derived(scales.freqToX(eq.lpf.freqHz));
  const active = $derived(activeBand != null ? eq.bands[activeBand]! : null);

  function startDrag(kind: "band" | "hpf" | "lpf", i: number, e: PointerEvent) {
    e.preventDefault();
    if (kind === "band") activeBand = i;
    drag = { kind, i };
  }
  function onMove(e: PointerEvent) {
    if (!drag) return;
    const { x, y } = toVb(e);
    const fHz = clampHz(scales.xToFreq(x));
    if (drag.kind === "band") {
      const b = eq.bands[drag.i]!;
      b.freqHz = fHz; b.gainDb = clampDb(scales.yToDb(y)); b.bypass = false;
    } else {
      eq[drag.kind].freqHz = fHz;
    }
    onCommit?.(drag.kind, drag.kind === "band" ? drag.i : undefined);
  }
  function onWheel(e: WheelEvent) {
    if (activeBand == null) return;
    e.preventDefault();
    const b = eq.bands[activeBand]!;
    b.bwOct = Math.max(0.05, Math.min(4, b.bwOct * Math.exp(e.deltaY * 0.0012)));
    onCommit?.("band", activeBand);
  }
  function resetBand(i: number) {
    const b = eq.bands[i]!;
    b.freqHz = DEFAULT_BAND_FREQS[i] ?? 1000; b.gainDb = 0; b.bwOct = 1; b.type = PeqType.PEAK; b.bypass = false;
    onCommit?.("band", i);
  }
  function cycleType(i: number, e: MouseEvent) { e.preventDefault(); const b = eq.bands[i]!; b.type = (b.type + 1) % 7; onCommit?.("band", i); }

  $effect(() => {
    if (!drag) return;
    const mv = (e: PointerEvent) => onMove(e);
    const up = () => { if (drag) { onCommit?.(drag.kind, drag.kind === "band" ? drag.i : undefined); drag = null; } };
    window.addEventListener("pointermove", mv);
    window.addEventListener("pointerup", up);
    return () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); };
  });

  const GRID_F = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  const GRID_DB = [12, 6, 0, -6, -12];
  const fLabel = (f: number) => (f >= 1000 ? `${f / 1000}k` : `${f}`);
</script>

<svg bind:this={svgEl} viewBox="0 0 {W} {H}" class="eq" onwheel={onWheel} role="img" aria-label="EQ response">
  <!-- grid -->
  {#each GRID_F as f}
    <line class="grid" x1={scales.freqToX(f)} y1="0" x2={scales.freqToX(f)} y2={H} />
    <text class="lab" x={scales.freqToX(f) + 3} y={H - 4}>{fLabel(f)}</text>
  {/each}
  {#each GRID_DB as db}
    <line class="grid" class:zero={db === 0} x1="0" y1={scales.dbToY(db)} x2={W} y2={scales.dbToY(db)} />
    <text class="lab" x="3" y={scales.dbToY(db) - 3}>{db > 0 ? "+" : ""}{db}</text>
  {/each}

  <!-- crossover cutoff markers -->
  {#if eq.hpf.slope !== 0}<line class="xo" x1={hpfX} y1="0" x2={hpfX} y2={H} />{/if}
  {#if eq.lpf.slope !== 0}<line class="xo" x1={lpfX} y1="0" x2={lpfX} y2={H} />{/if}

  <!-- summed response -->
  <path class="sum" d={sumPath} />

  <!-- band handles -->
  {#each handles as h (h.i)}
    <circle
      class="handle" class:active={activeBand === h.i} class:bypass={h.b.bypass}
      cx={h.x} cy={h.y} r={activeBand === h.i ? 9 : 7}
      style="--c:{bandHue(h.i)}"
      onpointerdown={(e) => startDrag("band", h.i, e)}
      ondblclick={() => resetBand(h.i)}
      oncontextmenu={(e) => cycleType(h.i, e)}
    />
    <text class="bnum" x={h.x} y={h.y + 3} pointer-events="none">{h.i + 1}</text>
  {/each}

  <!-- crossover handles (X only, at base) -->
  {#if eq.hpf.slope !== 0}
    <rect class="xohandle" x={hpfX - 6} y={H - 16} width="12" height="12" rx="2" onpointerdown={(e) => startDrag("hpf", 0, e)} />
  {/if}
  {#if eq.lpf.slope !== 0}
    <rect class="xohandle" x={lpfX - 6} y={H - 16} width="12" height="12" rx="2" onpointerdown={(e) => startDrag("lpf", 0, e)} />
  {/if}
</svg>

<div class="readout mono">
  {#if active}
    Band {activeBand! + 1} · {TYPE_NAME[active.type]} · {active.freqHz < 1000 ? active.freqHz.toFixed(0) + " Hz" : (active.freqHz / 1000).toFixed(2) + " kHz"}
    · {active.gainDb >= 0 ? "+" : ""}{active.gainDb.toFixed(1)} dB · {active.bwOct.toFixed(2)} oct {active.bypass ? "· (bypassed)" : ""}
  {:else}
    <span class="muted">drag a band · wheel = bandwidth · double-click = reset · right-click = type</span>
  {/if}
</div>

<style>
  .eq { width: 100%; max-width: 900px; height: auto; display: block; background: #0a0d12; border: 1px solid var(--line); border-radius: var(--radius); touch-action: none; }
  .grid { stroke: #1c2430; stroke-width: 1; }
  .grid.zero { stroke: #344256; }
  .xo { stroke: var(--warn); stroke-dasharray: 3 4; opacity: .5; }
  .lab { fill: var(--text-dim); font-size: 11px; font-family: ui-monospace, monospace; }
  .sum { fill: none; stroke: var(--accent); stroke-width: 2.5; filter: drop-shadow(0 0 6px rgba(56,189,248,.5)); }
  .handle { fill: var(--c); stroke: #0a0d12; stroke-width: 2; cursor: grab; transition: r .1s; }
  .handle.active { stroke: #fff; filter: drop-shadow(0 0 6px var(--c)); }
  .handle.bypass { opacity: .3; }
  .bnum { fill: #0a0d12; font-size: 9px; font-weight: 700; text-anchor: middle; font-family: ui-monospace, monospace; }
  .xohandle { fill: var(--warn); stroke: #0a0d12; stroke-width: 1.5; cursor: ew-resize; }
  .readout { padding: .25rem .2rem; font-size: .78rem; }
</style>
