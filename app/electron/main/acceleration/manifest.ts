/**
 * The backend artifact manifest (gpu-acceleration 02 §2). The single source of truth for which
 * engine build variants exist, where to fetch them, their pinned hashes, and the files that must be
 * present after extraction. PURE data + helpers (no IO), so it is BE1-validated.
 *
 * Security (audit F1): every part is sha256-pinned. Hashes are populated at release time by
 * downloading the asset once and recording its digest (mirrors scripts/verify-model-pins.mjs).
 * Until a part is pinned its `sha256` is "" and {@link unpinnedArtifacts} flags it; provisioning
 * (provision.ts) REFUSES to install an unpinned artifact, so we can never run unverified code.
 */
import type { AccelerationEngine, Backend } from "../../../src/services/ports";

export interface BackendArtifactPart {
  /** Official llama.cpp / whisper.cpp release asset (https, allowlisted host). */
  url: string;
  /** Pinned sha256 (lowercase hex). "" = not yet pinned (provisioning refuses it). */
  sha256: string;
  /** Approximate size, for honest download/disk copy + pre-flight. */
  bytes: number;
  /** `engine` = the build zip; `redist` = a required redistributable (e.g. CUDA cudart). */
  role: "engine" | "redist";
}

export interface BackendArtifact {
  engine: AccelerationEngine;
  backend: Backend;
  /** Engine release tag, e.g. "b9744" / "v1.9.1". */
  version: string;
  os: "win32" | "darwin" | "linux";
  arch: "x64" | "arm64";
  parts: BackendArtifactPart[];
  /** Files that MUST exist after extraction for the install to be considered complete. */
  expectFiles: string[];
  /** Soft driver gate surfaced as a tip; the probe is the hard gate. */
  minDriver?: { nvidia?: string; amd?: string };
  notes?: string;
}

/** Hosts we will fetch backend artifacts from. GitHub release downloads redirect to the objects CDN. */
export const BACKEND_ALLOWED_HOSTS = ["github.com", "objects.githubusercontent.com", "huggingface.co"];

const LLAMA_TAG = "b9744";
const WHISPER_TAG = "v1.9.1";
const llama = (asset: string) => `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_TAG}/${asset}`;
const whisper = (asset: string) => `https://github.com/ggml-org/whisper.cpp/releases/download/${WHISPER_TAG}/${asset}`;

const MIB = 1024 * 1024;
const part = (url: string, bytes: number, role: BackendArtifactPart["role"] = "engine"): BackendArtifactPart => ({
  url,
  sha256: "",
  bytes,
  role,
});

/**
 * The shipped backend set. Hashes are pinned at release time (see file header). Sizes are
 * approximate and only drive the download/disk copy + pre-flight, not verification.
 */
export const BACKEND_MANIFEST: BackendArtifact[] = [
  // ---- llama.cpp : Windows x64 ----
  { engine: "llama", backend: "cpu", version: LLAMA_TAG, os: "win32", arch: "x64", parts: [part(llama("llama-b9744-bin-win-cpu-x64.zip"), 90 * MIB)], expectFiles: ["llama-server.exe"] },
  { engine: "llama", backend: "vulkan", version: LLAMA_TAG, os: "win32", arch: "x64", parts: [part(llama("llama-b9744-bin-win-vulkan-x64.zip"), 180 * MIB)], expectFiles: ["llama-server.exe", "ggml-vulkan.dll"] },
  {
    engine: "llama",
    backend: "cuda-12.4",
    version: LLAMA_TAG,
    os: "win32",
    arch: "x64",
    parts: [part(llama("llama-b9744-bin-win-cuda-12.4-x64.zip"), 300 * MIB), part(llama("cudart-llama-bin-win-cuda-12.4-x64.zip"), 320 * MIB, "redist")],
    expectFiles: ["llama-server.exe", "ggml-cuda.dll"],
    minDriver: { nvidia: "551.78" },
  },
  // ---- llama.cpp : macOS arm64 (Metal is in the base build) ----
  { engine: "llama", backend: "metal", version: LLAMA_TAG, os: "darwin", arch: "arm64", parts: [part(llama("llama-b9744-bin-macos-arm64.zip"), 120 * MIB)], expectFiles: ["llama-server"] },
  { engine: "llama", backend: "cpu", version: LLAMA_TAG, os: "darwin", arch: "arm64", parts: [part(llama("llama-b9744-bin-macos-arm64.zip"), 120 * MIB)], expectFiles: ["llama-server"] },
  // ---- llama.cpp : Linux x64 ----
  { engine: "llama", backend: "cpu", version: LLAMA_TAG, os: "linux", arch: "x64", parts: [part(llama("llama-b9744-bin-ubuntu-x64.zip"), 95 * MIB)], expectFiles: ["llama-server"] },
  { engine: "llama", backend: "vulkan", version: LLAMA_TAG, os: "linux", arch: "x64", parts: [part(llama("llama-b9744-bin-ubuntu-vulkan-x64.zip"), 185 * MIB)], expectFiles: ["llama-server", "libggml-vulkan.so"] },
  {
    engine: "llama",
    backend: "cuda-12.4",
    version: LLAMA_TAG,
    os: "linux",
    arch: "x64",
    parts: [part(llama("llama-b9744-bin-ubuntu-cuda-12.4-x64.zip"), 310 * MIB), part(llama("cudart-llama-bin-linux-cuda-12.4-x64.zip"), 330 * MIB, "redist")],
    expectFiles: ["llama-server", "libggml-cuda.so"],
    minDriver: { nvidia: "550.54" },
  },

  // ---- whisper.cpp : Windows x64 ----
  { engine: "whisper", backend: "cpu", version: WHISPER_TAG, os: "win32", arch: "x64", parts: [part(whisper("whisper-bin-x64.zip"), 40 * MIB)], expectFiles: ["whisper-cli.exe"] },
  {
    engine: "whisper",
    backend: "cuda-12.4",
    version: WHISPER_TAG,
    os: "win32",
    arch: "x64",
    // whisper.cpp's Windows cuBLAS zip is self-contained: it bundles the CUDA runtime DLLs
    // (cudart64 / cublas64) next to whisper-cli.exe, so there is no separate cudart redist part.
    parts: [part(whisper("whisper-cublas-12.4.0-bin-x64.zip"), 150 * MIB)],
    expectFiles: ["whisper-cli.exe", "ggml-cuda.dll"],
    minDriver: { nvidia: "551.78" },
  },
  // ---- whisper.cpp : macOS arm64 + Linux x64 (CPU floor) ----
  { engine: "whisper", backend: "metal", version: WHISPER_TAG, os: "darwin", arch: "arm64", parts: [part(whisper("whisper-bin-macos-arm64.zip"), 45 * MIB)], expectFiles: ["whisper-cli"] },
  { engine: "whisper", backend: "cpu", version: WHISPER_TAG, os: "darwin", arch: "arm64", parts: [part(whisper("whisper-bin-macos-arm64.zip"), 45 * MIB)], expectFiles: ["whisper-cli"] },
  { engine: "whisper", backend: "cpu", version: WHISPER_TAG, os: "linux", arch: "x64", parts: [part(whisper("whisper-bin-ubuntu-x64.zip"), 42 * MIB)], expectFiles: ["whisper-cli"] },
];

export interface ArtifactQuery {
  engine: AccelerationEngine;
  backend: Backend;
  os: "win32" | "darwin" | "linux";
  arch: string;
}

export function findArtifact(registry: BackendArtifact[], q: ArtifactQuery): BackendArtifact | undefined {
  return registry.find((a) => a.engine === q.engine && a.backend === q.backend && a.os === q.os && a.arch === q.arch);
}

/** Total download bytes (all parts) + an estimated installed footprint. */
export function artifactSize(a: BackendArtifact): { downloadBytes: number; diskBytes: number } {
  const downloadBytes = a.parts.reduce((n, p) => n + p.bytes, 0);
  return { downloadBytes, diskBytes: Math.round(downloadBytes * 1.7) };
}

/** Structural invariants checked in CI (BE1) and intended for a release gate. */
export function manifestStructuralIssues(registry: BackendArtifact[]): string[] {
  const issues: string[] = [];
  for (const a of registry) {
    const id = `${a.engine}/${a.backend}/${a.os}/${a.arch}`;
    if (!a.version) issues.push(`${id}: missing version`);
    if (a.parts.length === 0) issues.push(`${id}: no parts`);
    if (a.expectFiles.length === 0) issues.push(`${id}: no expectFiles`);
    for (const p of a.parts) {
      if (!p.url.startsWith("https://")) issues.push(`${id}: non-https url ${p.url}`);
      else {
        let host: string | undefined;
        try {
          host = new URL(p.url).host;
        } catch {
          host = undefined;
        }
        if (!host || !BACKEND_ALLOWED_HOSTS.includes(host)) issues.push(`${id}: host not allowlisted (${host ?? p.url})`);
      }
      if (p.bytes <= 0) issues.push(`${id}: non-positive size`);
    }
    // llama.cpp ships the CUDA runtime as a SEPARATE cudart zip, so its CUDA backends must carry a
    // redist part. whisper.cpp's cuBLAS zip bundles cudart, so it legitimately ships none.
    if (a.engine === "llama" && a.backend.startsWith("cuda") && !a.parts.some((p) => p.role === "redist")) {
      issues.push(`${id}: CUDA backend is missing the cudart redistributable part`);
    }
  }
  return issues;
}

/** Artifacts that still need a sha256 pinned before they can be installed at runtime. */
export function unpinnedArtifacts(registry: BackendArtifact[]): BackendArtifact[] {
  return registry.filter((a) => a.parts.some((p) => p.sha256 === ""));
}

/** True only when every part of an artifact carries a pinned sha256. */
export function isPinned(a: BackendArtifact): boolean {
  return a.parts.length > 0 && a.parts.every((p) => p.sha256.length === 64);
}
