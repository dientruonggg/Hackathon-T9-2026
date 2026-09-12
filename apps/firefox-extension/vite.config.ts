import { defineConfig } from "vite";
import webExtension from "vite-plugin-web-extension";

export default defineConfig(({ command }) => ({
  plugins: [
    webExtension({
      manifest: "manifest.json",
      browser: "firefox",
      disableAutoLaunch: command === "build",
    }),
  ],
  build: { outDir: "dist", emptyOutDir: true },
}));
