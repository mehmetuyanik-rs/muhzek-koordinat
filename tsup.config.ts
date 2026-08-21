import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/koordinat.ts", "src/crs.ts", "src/yukseklik.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  target: "es2022",
});
