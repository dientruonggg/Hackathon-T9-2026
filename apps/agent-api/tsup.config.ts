import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "es2022",
  clean: true,
  splitting: false,
  noExternal: ["@vlc/contracts"],
});
