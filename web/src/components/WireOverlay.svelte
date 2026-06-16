<script lang="ts">
  // Patch-cable overlay: one bezier per routing connection, In-node right edge → Out-node
  // left edge, coloured by input. Measures the [data-wire] node rects relative to the
  // .board container; redraws on routing/selection/layout change. No positioning side-effects.
  import { device } from "../state/device.svelte.ts";

  let svg: SVGSVGElement;
  let tick = $state(0);
  let wires = $state<{ d: string; c: string }[]>([]);

  function pt(sel: string, side: "l" | "r") {
    const host = svg?.parentElement;
    const el = host?.querySelector(sel) as HTMLElement | null;
    if (!host || !el) return null;
    const hr = host.getBoundingClientRect(), r = el.getBoundingClientRect();
    return { x: (side === "l" ? r.left : r.right) - hr.left, y: (r.top + r.bottom) / 2 - hr.top };
  }
  const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    const mx = (a.x + b.x) / 2;
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${mx} ${a.y} ${mx} ${b.y} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };

  function compute() {
    const out: { d: string; c: string }[] = [];
    for (let i = 0; i < 4; i++) {
      const inN = pt(`[data-wire="in-${i}"]`, "r");
      if (!inN) continue;
      const col = `var(--ch-${i})`;
      for (let o = 0; o < 4; o++) {
        if ((device.routing[o] ?? 0) & (1 << i)) {
          const outN = pt(`[data-wire="out-${o}"]`, "l");
          if (outN) out.push({ d: curve(inN, outN), c: col });
        }
      }
    }
    return out;
  }

  $effect(() => {
    void tick; void device.routing.join(","); void device.selected; // deps → recompute
    wires = compute();
  });
  $effect(() => {
    const host = svg?.parentElement;
    const bump = () => tick++;
    const ro = new ResizeObserver(bump);
    if (host) ro.observe(host);
    window.addEventListener("resize", bump);
    requestAnimationFrame(bump); // initial measure after layout
    return () => { ro.disconnect(); window.removeEventListener("resize", bump); };
  });
</script>

<svg bind:this={svg} class="wireoverlay" aria-hidden="true">
  {#each wires as w, i (i)}<path d={w.d} style="stroke:{w.c}" />{/each}
</svg>

<style>
  .wireoverlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; z-index: 0; }
  .wireoverlay path { fill: none; stroke-width: 2.5; opacity: .55; filter: drop-shadow(0 0 4px currentColor); }
</style>
