<script lang="ts">
  import { device } from "../state/device.svelte.ts";
  let pw = $state("");
  let done = $state(false);
  function set() { device.setPassword(pw); done = true; setTimeout(() => (done = false), 1500); }
</script>

<div class="lock">
  <span class="muted">Lock password</span>
  <input class="mono" maxlength="4" placeholder="1234" bind:value={pw} />
  <button disabled={!device.connected || pw.length !== 4} onclick={set}>Set</button>
  {#if done}<span class="ok">✓ set</span>{/if}
</div>

<style>
  .lock { display: flex; align-items: center; gap: .4rem; font-size: .85rem; }
  input { width: 5ch; background: var(--bg-elev); color: var(--text); border: 1px solid var(--line); border-radius: 6px; padding: .3rem; text-align: center; letter-spacing: .2em; }
  .ok { color: var(--good); }
</style>
