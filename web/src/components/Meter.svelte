<script lang="ts">
  // Level meter (0..1). Vertical by default. Live data arrives in Phase A (0x40 poll).
  let { level = 0, horizontal = false }: { level?: number; horizontal?: boolean } = $props();
  const pct = $derived(Math.max(0, Math.min(1, level)) * 100);
</script>

<div class="meter" class:h={horizontal}>
  <div class="bar" style={horizontal ? `width:${pct}%` : `height:${pct}%`}></div>
</div>

<style>
  .meter { background: #0a0d12; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; position: relative; }
  .meter:not(.h) { width: 8px; height: 100%; min-height: 40px; }
  .meter.h { height: 8px; width: 100%; }
  .bar { position: absolute; background: linear-gradient(0deg, var(--good), var(--warn) 80%, var(--bad)); }
  .meter:not(.h) .bar { bottom: 0; left: 0; right: 0; }
  .meter.h .bar { left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, var(--good), var(--warn) 80%, var(--bad)); }
</style>
