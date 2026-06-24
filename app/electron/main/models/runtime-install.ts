/**
 * In-app engine-runtime installer (07 / parakeet P4). The local models (whisper.cpp ggml, llama.cpp
 * gguf, sherpa-onnx) are useless without their engine BINARY, which is large and platform-specific,
 * so it is fetched on demand the first time a local model is set up. This mirrors the proven dev
 * scripts (scripts/fetch-whisper.mjs + fetch-llama.mjs) EXACTLY — same release URLs and extraction —
 * but runs inside the app so "Download recommended setup" is truly seamless.
 *
 * The orchestration is PURE (BE1-tested): the network + filesystem + unzip are injected as
 * `RuntimeInstallIO`; `nodeRuntimeInstallIO` wires the real ones. Binaries land in
 * `<userData>/runtime/<engine>/`, which is exactly where `makeEngineReady` looks.
 */
import { join } from "node:path";
import type { ModelManifest } from "./catalog";

export type RuntimeEngine = ModelManifest["engine"];

export interface RuntimeArtifact {
  /** GitHub "latest release" API for the engine. */
  releasesApi: string;
  /** Tag to use if the API is unreachable / rate-limited. */
  fallbackTag: string;
  /** Release asset download URL for a resolved tag. */
  assetUrl: (tag: string) => string;
  /** On-disk archive name. */
  archiveName: (tag: string) => string;
  /** Candidate executable names that prove the engine is installed (checked in dir + dir/Release). */
  binaries: string[];
}

// Windows x64 (the packaged target). Mirrors scripts/fetch-whisper.mjs + fetch-llama.mjs.
const WINDOWS_X64: Partial<Record<RuntimeEngine, RuntimeArtifact>> = {
  whisper: {
    releasesApi: "https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest",
    fallbackTag: "v1.9.1",
    assetUrl: (tag) => `https://github.com/ggml-org/whisper.cpp/releases/download/${tag}/whisper-bin-x64.zip`,
    archiveName: () => "whisper-bin-x64.zip",
    binaries: ["whisper-cli.exe", "main.exe"],
  },
  llama: {
    releasesApi: "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest",
    fallbackTag: "b9744",
    assetUrl: (tag) => `https://github.com/ggml-org/llama.cpp/releases/download/${tag}/llama-${tag}-bin-win-cpu-x64.zip`,
    archiveName: (tag) => `llama-${tag}-bin-win-cpu-x64.zip`,
    binaries: ["llama-server.exe"],
  },
};

/** The release artifact for an engine on this platform, or undefined when auto-install isn't supported. */
export function runtimeArtifact(
  engine: RuntimeEngine,
  platform: NodeJS.Platform,
  arch: string,
): RuntimeArtifact | undefined {
  if (platform === "win32" && (arch === "x64" || arch === "ia32")) return WINDOWS_X64[engine];
  return undefined; // other platforms/engines: use the fetch:* scripts for now
}

export interface RuntimeInstallIO {
  /** Resolve the latest release tag (falls back when the API is unreachable). */
  resolveLatestTag: (api: string, fallback: string) => Promise<string>;
  /** Stream a URL to `dest`, reporting bytes done / total. */
  downloadFile: (url: string, dest: string, onProgress: (done: number, total: number) => void) => Promise<void>;
  /** Extract a zip into `destDir`. */
  extractZip: (zip: string, destDir: string) => void;
  exists: (path: string) => boolean;
  ensureDir: (dir: string) => void;
}

export interface RuntimeInstaller {
  /** True when the engine binary is already on disk. */
  isInstalled: (engine: RuntimeEngine) => boolean;
  /** Download + extract the engine runtime. Resolves when the binary is present; throws on failure. */
  install: (engine: RuntimeEngine, onProgress: (done: number, total: number) => void) => Promise<void>;
}

export function createRuntimeInstaller(cfg: {
  runtimeDir: string;
  platform: NodeJS.Platform;
  arch: string;
  io: RuntimeInstallIO;
}): RuntimeInstaller {
  const dirOf = (engine: RuntimeEngine): string => join(cfg.runtimeDir, engine);
  const binaryPresent = (dir: string, names: string[]): boolean =>
    [dir, join(dir, "Release")].some((d) => names.some((n) => cfg.io.exists(join(d, n))));

  const isInstalled = (engine: RuntimeEngine): boolean => {
    const art = runtimeArtifact(engine, cfg.platform, cfg.arch);
    return art ? binaryPresent(dirOf(engine), art.binaries) : false;
  };

  return {
    isInstalled,
    install: async (engine, onProgress) => {
      const art = runtimeArtifact(engine, cfg.platform, cfg.arch);
      if (!art) {
        throw new Error("Automatic engine setup isn't available on this platform yet.");
      }
      const dir = dirOf(engine);
      if (binaryPresent(dir, art.binaries)) return; // already installed
      cfg.io.ensureDir(dir);
      const tag = await cfg.io.resolveLatestTag(art.releasesApi, art.fallbackTag);
      const zip = join(dir, art.archiveName(tag));
      await cfg.io.downloadFile(art.assetUrl(tag), zip, onProgress);
      cfg.io.extractZip(zip, dir);
      if (!binaryPresent(dir, art.binaries)) {
        throw new Error("The engine could not be set up (binary missing after extraction).");
      }
    },
  };
}
