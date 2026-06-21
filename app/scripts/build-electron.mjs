#!/usr/bin/env node
/**
 * build-electron — compile the TypeScript Electron main + preload to the .cjs files Electron
 * loads (electron/main.cjs, electron/preload.cjs). esbuild bundles each entry; `electron` is
 * left external (provided at runtime). Pure shared seam code (contract/dispatch/zod) is bundled
 * into main.cjs; the renderer never sees it. See backend/14-implementation-plan.md (T0.1).
 */
import { build } from "esbuild";

const common = {
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  logLevel: "info",
  // Provided by the Electron runtime; never bundle these.
  external: ["electron"],
};

await build({ ...common, entryPoints: ["electron/main/main.ts"], outfile: "electron/main.cjs" });
await build({ ...common, entryPoints: ["electron/main/preload.ts"], outfile: "electron/preload.cjs" });

console.log("build-electron: emitted electron/main.cjs + electron/preload.cjs");
