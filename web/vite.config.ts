import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// base: "./" for the Android WebView build (VITE_TARGET=android — assets resolve
// under the WebViewAssetLoader path); "/opendsp-4x4/" for the GitHub Pages project
// site; "/" for local dev.
export default defineConfig(({ command }) => ({
  base: process.env.VITE_TARGET === "android" ? "./" : command === "build" ? "/opendsp-4x4/" : "/",
  plugins: [svelte()],
}));
