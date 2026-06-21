#!/usr/bin/env node
/**
 * fetch-whisper — download the prebuilt whisper.cpp CLI + a ggml model so Khonjel's speech-to-text
 * engine (electron/main/stt/*) works. Open-source: binary from the official whisper.cpp GitHub
 * releases, weights from the ggerganov/whisper.cpp repo on Hugging Face. Targets are git-ignored
 * (vendor/whisper/ + models/). Idempotent.
 *
 *   node scripts/fetch-whisper.mjs                 # CPU build + ggml-base.en (recommended)
 *   node scripts/fetch-whisper.mjs --model=small.en
 *   node scripts/fetch-whisper.mjs --model-url=<url> --model-file=<name.bin>
 *
 * After it finishes, the Electron app auto-detects vendor/whisper/whisper-cli(.exe) + a ggml model
 * and the transcription service goes live (see stt/runtime.ts).
 */
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR_DIR = join(APP_DIR, "vendor", "whisper");
const MODELS_DIR = join(APP_DIR, "models");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const VARIANT = args.get("variant") ?? "x64"; // x64 | blas-bin-x64
const FALLBACK_TAG = "v1.9.1";
const MODEL_NAME = args.get("model") ?? "base.en";
const MODEL = {
  url:
    args.get("model-url") ??
    `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${MODEL_NAME}.bin`,
  file: args.get("model-file") ?? `ggml-${MODEL_NAME}.bin`,
};

const UA = { "User-Agent": "khonjel-fetch-whisper" };

async function latestTag() {
  try {
    const res = await fetch("https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest", {
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
        process.stderr.write(`\r    ${pct}%  (${(done / 1048576).toFixed(0)}/${(total / 1048576).toFixed(0)} MB)   `);
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

function cliExe() {
  const names = process.platform === "win32" ? ["whisper-cli.exe", "main.exe"] : ["whisper-cli", "main"];
  const dirs = [VENDOR_DIR, join(VENDOR_DIR, "Release")];
  return dirs.flatMap((d) => names.map((n) => join(d, n))).find((p) => existsSync(p));
}

async function fetchBinary() {
  if (cliExe()) {
    console.log(`[binary] already present: ${cliExe()}`);
    return;
  }
  mkdirSync(VENDOR_DIR, { recursive: true });
  const tag = await latestTag();
  const asset = `whisper-${VARIANT}.zip`;
  const url = `https://github.com/ggml-org/whisper.cpp/releases/download/${tag}/whisper-bin-${VARIANT}.zip`;
  const zip = join(VENDOR_DIR, asset);
  console.log(`[binary] downloading whisper-bin-${VARIANT}.zip (${tag})`);
  await download(url, zip);
  console.log(`[binary] extracting -> ${VENDOR_DIR}`);
  extractZip(zip, VENDOR_DIR);
  if (!cliExe()) throw new Error("whisper-cli not found after extraction (check --variant)");
  console.log(`[binary] ready: ${cliExe()}`);
}

async function fetchModel() {
  const dest = join(MODELS_DIR, MODEL.file);
  if (existsSync(dest) && statSync(dest).size > 0) {
    console.log(`[model] already present: ${dest}`);
    return;
  }
  mkdirSync(MODELS_DIR, { recursive: true });
  console.log(`[model] downloading ${MODEL.file}`);
  await download(MODEL.url, dest);
  console.log(`[model] ready: ${dest}`);
}

async function main() {
  console.log(`fetch-whisper: variant=${VARIANT}, model=${MODEL.file}`);
  await fetchBinary();
  await fetchModel();
  console.log("\nDone. Launch the app (npm run electron); transcription will use the local whisper model.");
}

main().catch((err) => {
  console.error(`\nfetch-whisper failed: ${err.message}`);
  process.exit(1);
});
