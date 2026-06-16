<script lang="ts">
  import { device } from "../state/device.svelte.ts";
  const INS = ["A", "B", "C", "D"];
  const OUTS = ["1", "2", "3", "4"];
  const on = (row: number, col: number) => (device.routing[row]! & (1 << col)) !== 0;
  const toggle = (row: number, col: number) => device.setRouting(0x04 + row, device.routing[row]! ^ (1 << col));
</script>

<div class="wrap">
  <table class="matrix">
    <thead><tr><th></th>{#each INS as n (n)}<th style="--c:var(--ch-{INS.indexOf(n)})"><span class="cdot"></span>In {n}</th>{/each}</tr></thead>
    <tbody>
      {#each OUTS as o, row (o)}
        <tr>
          <th style="--c:var(--ch-{4 + row})"><span class="cdot"></span>Out {o}</th>
          {#each INS as _, col (col)}
            <td><button class="cell" class:on={on(row, col)} onclick={() => toggle(row, col)} aria-label="In {INS[col]} → Out {o}"></button></td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
  <p class="muted">Tap a cell to route an input to an output.</p>
</div>

<style>
  .wrap { padding: .8rem 0; display: flex; flex-direction: column; align-items: center; }
  .matrix { border-collapse: collapse; }
  th, td { padding: 4px; text-align: center; font-size: .8rem; }
  th { color: var(--text-dim); font-weight: 600; }
  .cdot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--c); margin-right: 4px; }
  .cell { width: 40px; height: 32px; padding: 0; border-radius: 6px; }
  .cell.on { background: var(--accent); border-color: var(--accent); box-shadow: var(--glow); }
</style>
