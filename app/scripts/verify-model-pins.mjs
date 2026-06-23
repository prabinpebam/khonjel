#!/usr/bin/env node
/**
 * verify-model-pins — reports which local model manifests are missing an integrity pin (sha256).
 *
 * The in-app downloader already VERIFIES a sha256/size when the manifest provides one
 * (electron/main/models/downloader.ts + its tests), and it does so regardless of where the bytes
 * came from (mirror or KHONJEL_MODEL_SOURCES override). The remaining supply-chain task (WS-F1) is
 * to POPULATE a pinned sha256 for every shipped model so a poisoned mirror/MITM cannot deliver a
 * malicious GGUF/GGML. Computing those digests requires downloading each model from its host, so it
 * is a build-time step, not something this repo can do offline.
 *
 * Usage:
 *   node scripts/verify-model-pins.mjs          # report only (exit 0)
 *   STRICT=1 node scripts/verify-model-pins.mjs  # fail (exit 1) if any manifest lacks a pin
 *
 * Wire `STRICT=1` into CI once every manifest is pinned, to keep new models from shipping unpinned.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG = join(APP_DIR, "electron", "main", "models", "catalog.ts");

const src = readFileSync(CATALOG, "utf8");

// Each manifest entry is `"<id>": { engine: ..., fileName: ..., sources: [...] , (sha256?) }`.
// Manifests contain no nested braces, so a non-greedy `{ ... }` capture is reliable here.
const entries = [...src.matchAll(/"([^"]+)":\s*\{([^}]*)\}/g)].filter((m) => /engine:/.test(m[2]));

const pinned = entries.filter((m) => /sha256:/.test(m[2])).map((m) => m[1]);
const missing = entries.filter((m) => !/sha256:/.test(m[2])).map((m) => m[1]);

console.log(`model pins: ${pinned.length}/${entries.length} manifests pinned with sha256`);
if (missing.length > 0) {
  console.log("  unpinned (populate sha256 at build time):");
  for (const id of missing) console.log(`   - ${id}`);
}

if (missing.length > 0 && process.env.STRICT === "1") {
  console.error("verify-model-pins: FAIL (STRICT) — every model manifest must pin a sha256.");
  process.exit(1);
}
