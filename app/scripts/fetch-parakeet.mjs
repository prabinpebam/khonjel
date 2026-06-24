#!/usr/bin/env node
/**
 * fetch-parakeet — download the prebuilt sherpa-onnx runtime + an exported NVIDIA Parakeet model so
 * Khonjel's Parakeet speech-to-text engine (electron/main/stt/parakeet*.ts) works. Open-source:
 * the binary comes from the official k2-fsa/sherpa-onnx GitHub releases; the model parts come from
 * the csukuangfj Hugging Face mirror as INDIVIDUAL files (no in-app archive extraction). Targets are
 * git-ignored (vendor/parakeet/ + models/<id>/). Idempotent.
 *
 *   node scripts/fetch-parakeet.mjs                      # CPU runtime + v3 int8 model (recommended)
 *   node scripts/fetch-parakeet.mjs --model=v2-int8      # English-only v2
 *   node scripts/fetch-parakeet.mjs --provider=cuda      # CUDA runtime archive (GPU)
 *   node scripts/fetch-parakeet.mjs --archive-url=<url>  # override the binary archive
 *
 * After it finishes, the Electron app auto-detects vendor/parakeet/sherpa-onnx-offline(.exe) +
 * the model directory and the Parakeet engine goes live (see stt/parakeet-runtime.ts).
 *
 * NOTE: the exact release asset name + per-file checksums must be verified/pinned at build time
 * (parakeet-integration-plan.md §3, §8); this script is the developer convenience that lands the
 * byte-identical files the in-app downloader also pins.
 */
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
  statSync,
  copyFileSync,
} from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const VENDOR_DIR = join(APP_DIR, "vendor", "parakeet");
const MODELS_DIR = join(APP_DIR, "models");

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

// Binaries live in a *version* release; the repo's /releases/latest points at an asr-models tag, so
// pin the version (override with --tag=vX.Y.Z). Verified asset names for v1.13.3 (see fetch script PR).
const BIN_TAG = args.get("tag") ?? "v1.13.3";
const PROVIDER = args.get("provider") === "cuda" ? "cuda" : "cpu";
const SKIP_MODEL = args.get("skip-model") === "true";
const MODEL_VARIANT = args.get("model") ?? "v3-int8"; // v3-int8 (25 EU langs) | v2-int8 (English)

const HF = "https://huggingface.co";
const MODEL_ID = `sherpa-onnx-nemo-parakeet-tdt-0.6b-${MODEL_VARIANT}`;
const MODEL_REPO = `${HF}/csukuangfj/${MODEL_ID}/resolve/main`;
// The four parts the runtime points --encoder/--decoder/--joiner/--tokens at (plan §3.2).
const MODEL_FILES = ["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"];

const UA = { "User-Agent": "khonjel-fetch-parakeet" };

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
        process.stderr.write(
          `\r    ${pct}%  (${(done / 1048576).toFixed(0)}/${(total / 1048576).toFixed(0)} MB)   `,
        );
      }
    }
  });
  await pipeline(body, createWriteStream(part));
  process.stderr.write("\n");
  renameSync(part, dest);
}

/** Extract a .zip (Expand-Archive) or a .tar.* (bsdtar, present on Win10+ / mac / linux). */
function extractArchive(archivePath, destDir) {
  if (/\.zip$/i.test(archivePath) && process.platform === "win32") {
    execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Expand-Archive -Path '${archivePath}' -DestinationPath '${destDir}' -Force`,
      ],
      { stdio: "inherit" },
    );
    return;
  }
  // `tar` understands .tar.bz2 (bsdtar bundles bzip2) on every supported platform.
  execFileSync("tar", ["-xf", archivePath, "-C", destDir], { stdio: "inherit" });
}

function offlineExe() {
  const name = process.platform === "win32" ? "sherpa-onnx-offline.exe" : "sherpa-onnx-offline";
  const dirs = [VENDOR_DIR, join(VENDOR_DIR, "bin")];
  return dirs.map((d) => join(d, name)).find((p) => existsSync(p));
}

/** Recursively find the directory that holds the sherpa executables in the extracted tree. */
function findBinDir(root) {
  const exe = process.platform === "win32" ? "sherpa-onnx-offline.exe" : "sherpa-onnx-offline";
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    if (entries.some((e) => e.isFile() && e.name === exe)) return dir;
    for (const e of entries) if (e.isDirectory()) stack.push(join(dir, e.name));
  }
  return undefined;
}

async function fetchBinary() {
  if (offlineExe()) {
    console.log(`[binary] already present: ${offlineExe()}`);
    return;
  }
  mkdirSync(VENDOR_DIR, { recursive: true });
  const tag = BIN_TAG;
  // CPU: the shared (dynamic onnxruntime) Release build that bundles the executables + DLLs.
  const suffix = PROVIDER === "cuda" ? "win-x64-cuda" : "win-x64-shared-MD-Release";
  const archiveName = `sherpa-onnx-${tag}-${suffix}.tar.bz2`;
  const url =
    args.get("archive-url") ??
    `https://github.com/k2-fsa/sherpa-onnx/releases/download/${tag}/${archiveName}`;
  const archive = join(VENDOR_DIR, archiveName);
  console.log(`[binary] downloading ${archiveName} (${tag}, ${PROVIDER})`);
  await download(url, archive);
  console.log(`[binary] extracting -> ${VENDOR_DIR}`);
  extractArchive(archive, VENDOR_DIR);

  // Flatten: copy the executables + shared libs from the nested release folder up to vendor/parakeet/.
  if (!offlineExe()) {
    const binDir = findBinDir(VENDOR_DIR);
    if (!binDir) throw new Error("sherpa-onnx-offline not found after extraction (check --archive-url)");
    for (const entry of readdirSync(binDir, { withFileTypes: true })) {
      if (entry.isFile()) copyFileSync(join(binDir, entry.name), join(VENDOR_DIR, entry.name));
    }
  }
  if (!offlineExe()) throw new Error("sherpa-onnx-offline not found after flattening");
  console.log(`[binary] ready: ${offlineExe()}`);
}

async function fetchModel() {
  const modelDir = join(MODELS_DIR, MODEL_ID);
  mkdirSync(modelDir, { recursive: true });
  for (const file of MODEL_FILES) {
    const dest = join(modelDir, file);
    if (existsSync(dest) && statSync(dest).size > 0) {
      console.log(`[model] already present: ${file}`);
      continue;
    }
    console.log(`[model] downloading ${MODEL_ID}/${file}`);
    await download(`${MODEL_REPO}/${file}`, dest);
  }
  console.log(`[model] ready: ${modelDir}`);
}

async function main() {
  console.log(`fetch-parakeet: provider=${PROVIDER}, model=${MODEL_ID}`);
  await fetchBinary();
  if (SKIP_MODEL) {
    console.log("\n[model] skipped (--skip-model). Download the model in-app, or rerun without the flag.");
  } else {
    await fetchModel();
  }
  console.log(
    "\nDone. Launch the app (npm run electron); Parakeet will use the local sherpa-onnx model.",
  );
}

main().catch((err) => {
  console.error(`\nfetch-parakeet failed: ${err.message}`);
  process.exit(1);
});
