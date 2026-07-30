<script lang="ts">
  // Compact drag-to-adjust numeric control (vertical drag). Two-way via bind:value.
  let { label, value = $bindable(), min, max, step = 1, unit = "", log = false, format, reset, onchange }: {
    label: string; value: number; min: number; max: number;
    step?: number; unit?: string; log?: boolean; format?: (v: number) => string; reset?: number; onchange?: () => void;
  } = $props();

  let startY = 0, startV = 0, dragging = $state(false);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));

  let editing = $state(false);
  let draft: number | null = $state(null);
  function edit() { draft = value; editing = true; }
  function commitEdit() {
    if (!editing) return;
    editing = false;
    if (draft == null || Number.isNaN(draft)) { if (reset === undefined) return; value = reset; }
    else value = clamp(draft);
    onchange?.();
  }
  function editKey(e: KeyboardEvent) {
    if (e.key === "Enter") commitEdit();
    else if (e.key === "Escape") editing = false;
  }
  function focusSelect(node: HTMLInputElement) { node.focus(); node.select(); }

  function down(e: PointerEvent) {
    if (editing) return;
    dragging = true; startY = e.clientY; startV = value;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) {
    if (!dragging) return;
    const f = -(e.clientY - startY) / 180; // fraction of full range per 180px
    if (log) value = clamp(startV * Math.pow(max / min, f));
    else value = clamp(Math.round((startV + f * (max - min)) / step) * step);
    onchange?.();
  }
  function up() { dragging = false; }

  const pct = $derived(log ? (Math.log(value / min) / Math.log(max / min)) * 100 : ((value - min) / (max - min)) * 100);
  const text = $derived(format ? format(value) : value.toFixed(step < 1 ? 1 : 0));
</script>

<div class="param" class:dragging>
  <span class="lbl">{label}</span>
  <div class="dial" role="slider" tabindex="0" aria-label={label} aria-valuenow={value} aria-valuemin={min} aria-valuemax={max}
       title={reset !== undefined ? "drag to adjust · double-click to type · empty ⏎ resets" : "drag to adjust · double-click to type"}
       onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} ondblclick={edit}>
    {#if editing}
      <input class="edit mono" type="number" step="any" {min} {max} bind:value={draft}
             onblur={commitEdit} onkeydown={editKey} use:focusSelect aria-label="{label} value" />
    {:else}
      <div class="fill" style="height:{pct}%"></div>
      <span class="val mono">{text}<span class="u">{unit}</span></span>
    {/if}
  </div>
</div>

<style>
  .param { display: flex; flex-direction: column; gap: .25rem; width: 84px; }
  .lbl { font-size: .7rem; color: var(--text-dim); text-align: center; }
  .dial { position: relative; height: 64px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg-elev);
          overflow: hidden; cursor: ns-resize; display: grid; place-items: center; touch-action: none; }
  .param.dragging .dial { border-color: var(--accent); box-shadow: var(--glow); }
  .fill { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(180deg, transparent, color-mix(in oklab, var(--accent) 30%, transparent)); pointer-events: none; }
  .val { position: relative; font-size: .85rem; font-weight: 600; }
  .u { font-size: .65rem; color: var(--text-dim); margin-left: 1px; }
  .edit { width: 100%; height: 100%; border: 0; background: transparent; color: inherit;
          text-align: center; font-size: .85rem; font-weight: 600; outline: none;
          appearance: textfield; -moz-appearance: textfield; }
  .edit::-webkit-outer-spin-button, .edit::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
</style>
