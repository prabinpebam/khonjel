#!/usr/bin/env node
/**
 * fetch-llama — download the prebuilt llama.cpp server binary + a small GGUF model so Khonjel's
 * local LLM engine (electron/main/inference/*) has something real to talk to. Everything here is
 * open-source: binaries from the official llama.cpp GitHub releases, weights from the Qwen GGUF
 * repo on Hugging Face. Targets are git-ignored (vendor/llama/ + models/). Idempotent.
 *
 *   node scripts/fetch-llama.mjs                      # CPU build + Qwen2.5-1.5B (recommended)
 *   node scripts/fetch-llama.mjs --backend=vulkan     # GPU build (most discrete GPUs)
 *   node scripts/fetch-llama.mjs --model-url=<url> --model-file=<name.gguf>
 *
 * After it finishes, the Electron app auto-detects vendor/llama/llama-server(.exe) + models/*.gguf
 * and upgrades dictation cleanup from deterministic to real LLM quality (see inference/runtime.ts).
 */
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR_DIR = join(APP_DIR, "vendor", "llama");
const MODELS_DIR = join(APP_DIR, "models");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const BACKEND = args.get("backend") ?? "cpu"; // cpu | vulkan | cuda-12.4 | cuda-13.3
const FALLBACK_TAG = "b9744";

const DEFAULT_MODEL = {
  url: "https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf",
  file: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
};
const MODEL = {
  url: args.get("model-url") ?? DEFAULT_MODEL.url,
  file: args.get("model-file") ?? DEFAULT_MODEL.file,
};

const UA = { "User-Agent": "khonjel-fetch-llama" };

async function latestTag() {
  try {
    const res = await fetch("https://api.github.com/repos/ggml-org/llama.cpp/releases/latest", {
      headers: UA,
    });
    if (!res.ok) return FALLBACK_TAG;
    const json = await res.json();
    return typeof json.tag_name === "string" ? json.tag_name : FALLBACK_TAG;
  } catch {
    return FALLBACK_TAG;
  }
}

async function download(url, dest) {
  const part = `${dest}.part`;
  const res = await fetch(url, { headers: UA, redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} for ${url}`);
  const total = Number(res.headers.get("content-length") ?? 0);
  let done = 0;
  let lastPct = -1;
  const body = Readable.fromWeb(res.body);
  body.on("data", (chunk) => {
    done += chunk.length;
    if (total > 0) {
      const pct = Math.floor((done / total) * 100);
      if (pct !== lastPct && pct % 5 === 0) {
        lastPct = pct;
        const mb = (done / 1048576).toFixed(0);
        const tot = (total / 1048576).toFixed(0);
        process.stderr.write(`\r    ${pct}%  (${mb}/${tot} MB)   `);
      }
    }
  });
  await pipeline(body, createWriteStream(part));
  process.stderr.write("\n");
  renameSync(part, dest);
}

function extractZip(zipPath, destDir) {
  if (process.platform === "win32") {
    execFileSync(
      "powershell",
      ["-NoProfile", "-Command", `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`],
      { stdio: "inherit" },
    );
  } else {
    execFileSync("unzip", ["-o", zipPath, "-d", destDir], { stdio: "inherit" });
  }
}

function serverExe() {
  return join(VENDOR_DIR, process.platform === "win32" ? "llama-server.exe" : "llama-server");
}

async function fetchBinary() {
  if (existsSync(serverExe())) {
    console.log(`[binary] already present: ${serverExe()}`);
    return;
  }
  mkdirSync(VENDOR_DIR, { recursive: true });
  const tag = await latestTag();
  const asset = `llama-${tag}-bin-win-${BACKEND}-x64.zip`;
  const url = `https://github.com/ggml-org/llama.cpp/releases/download/${tag}/${asset}`;
  const zip = join(VENDOR_DIR, asset);
  console.log(`[binary] downloading ${asset}`);
  await download(url, zip);
  console.log(`[binary] extracting -> ${VENDOR_DIR}`);
  extractZip(zip, VENDOR_DIR);
  if (!existsSync(serverExe())) {
    throw new Error(`llama-server not found after extracting ${asset} (check --backend)`);
  }
  console.log(`[binary] ready: ${serverExe()}`);
}

async function fetchModel() {
  const dest = join(MODELS_DIR, MODEL.file);
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`[model] already present: ${dest}`);
    return;
  }
  mkdirSync(MODELS_DIR, { recursive: true });
  console.log(`[model] downloading ${MODEL.file} (~1 GB, first run only)`);
  await download(MODEL.url, dest);
  console.log(`[model] ready: ${dest}`);
}

async function main() {
  console.log(`fetch-llama: backend=${BACKEND}, model=${MODEL.file}`);
  await fetchBinary();
  await fetchModel();
  console.log("\nDone. Launch the app (npm run electron) and dictation cleanup will use the local LLM.");
}

main().catch((err) => {
  console.error(`\nfetch-llama failed: ${err.message}`);
  process.exit(1);
});
