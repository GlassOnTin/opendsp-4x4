import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// base is "/opendsp-4x4/" for the GitHub Pages project site, "/" for local dev
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/opendsp-4x4/" : "/",
  plugins: [svelte()],
}));
