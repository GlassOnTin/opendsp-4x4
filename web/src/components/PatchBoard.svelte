<script lang="ts">
  // The patch board: inputs (left) and outputs (right) as expand-in-place nodes, with
  // patch-cable wires between them, and the routing grid below. The active side's column
  // grows; the idle side stays a compact strip whose buttons spread to span the height.
  import { device } from "../state/device.svelte.ts";
  import { OUT_BASE } from "../state/model.ts";
  import ChannelNode from "./ChannelNode.svelte";
  import RoutingMatrix from "./RoutingMatrix.svelte";
  import WireOverlay from "./WireOverlay.svelte";
</script>

<div class="board" class:out-active={device.selectedChannel?.isOutput} class:none-active={device.selected < 0}>
  <WireOverlay />
  <div class="col ins">
    {#each [0, 1, 2, 3] as i (i)}<ChannelNode index={i} />{/each}
  </div>
  <div class="gutter"></div>
  <div class="col outs">
    {#each [0, 1, 2, 3] as o (o)}<ChannelNode index={OUT_BASE + o} />{/each}
  </div>
</div>

<details class="routing" open>
  <summary>Routing matrix</summary>
  <RoutingMatrix />
</details>

<style>
  /* active side grows up to 900px; idle side is a fixed strip; the flexible middle column
     is the wire gutter and soaks up any extra width on wide viewports */
  .board { display: grid; grid-template-columns: var(--in-w) minmax(90px, 1fr) var(--out-w); gap: .8rem;
    align-items: stretch; position: relative; padding: 1rem; --in-w: minmax(0, 900px); --out-w: 150px; }
  .board.out-active { --in-w: 150px; --out-w: minmax(0, 900px); }
  .board.none-active { --in-w: 150px; --out-w: 150px; } /* nothing open: compact overview */
  .col { display: flex; flex-direction: column; min-width: 0; gap: .5rem; z-index: 1;
         justify-content: space-around; align-items: stretch; }
  .gutter { z-index: 0; }
  .routing { margin: 0 1rem 1rem; }
  .routing > summary { cursor: pointer; color: var(--text-dim); font-size: .85rem; padding: .35rem 0; }
  .routing[open] > summary { color: var(--text); }
</style>
