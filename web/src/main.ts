import { mount } from "svelte";
import App from "./App.svelte";
import { device } from "./state/device.svelte.ts";
import "./theme.css";

const app = mount(App, { target: document.getElementById("app")! });
(globalThis as Record<string, unknown>).device = device; // debug probe handle
void device.autoConnect(); // reconnect to an already-granted device on load (no prompt)
export default app;
