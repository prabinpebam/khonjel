/**
 * Model-management runtime (composition glue): the real Node implementations of the injected ports
 * the downloader + service need — filesystem, sha-256, free-space, HTTP, and engine detection. Kept
 * out of `service.ts`/`downloader.ts` so those stay native-free and BE1-testable. This file is the
 * only place that touches `fs`/`crypto`/`fetch` for models.
 */
import {
  existsSync,
  statSync,
  mkdirSync,
  rmSync,
  writeSync,
  readFileSync,
  renameSync,
  openSync,
  fsyncSync,
  closeSync,
  statfsSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import type { DownloadFetch, DownloadFs } from "./downloader";
import type { ModelServiceFs } from "./service";
import type { ModelManifest } from "./catalog";

function sizeOf(path: string): number {
  try {
    return statSync(path).size;
  } catch {
    return 0;
  }
}

function removeQuietly(path: string): void {
  try {
    // recursive handles a multi-file model directory; force no-ops when the path is already gone.
    rmSync(path, { recursive: true, force: true });
  } catch {
    // already gone / best-effort
  }
}

function sha256Hex(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function freeBytes(dir: string): number {
  for (const candidate of [dir, dirname(dir)]) {
    try {
      const s = statfsSync(candidate);
      return Number(s.bavail) * Number(s.bsize);
    } catch {
      // try the parent, then give up
    }
  }
  return Number.MAX_SAFE_INTEGER;
}

export function nodeDownloadFs(): DownloadFs {
  // Keep ONE open append handle per .part file for the life of the transfer, so each chunk is a
  // single write() syscall instead of open + write + close. Per-chunk open/close on a multi-GB
  // download is thousands of syscalls that block the main thread. Closed on finalize/removePart and
  // flushed before any size/hash read so the on-disk view is consistent.
  const handles = new Map<string, number>();
  const flush = (partPath: string): void => {
    const fd = handles.get(partPath);
    if (fd !== undefined) {
      try {
        fsyncSync(fd);
      } catch {
        // best-effort
      }
    }
  };
  const closeHandle = (partPath: string): void => {
    const fd = handles.get(partPath);
    if (fd === undefined) return;
    handles.delete(partPath);
    try {
      fsyncSync(fd);
    } catch {
      // best-effort
    }
    try {
      closeSync(fd);
    } catch {
      // best-effort
    }
  };
  return {
    partSize: (partPath) => {
      flush(partPath);
      return sizeOf(partPath);
    },
    appendChunk: (partPath, chunk) => {
      let fd = handles.get(partPath);
      if (fd === undefined) {
        mkdirSync(dirname(partPath), { recursive: true });
        fd = openSync(partPath, "a"); // append: creates if absent, preserves prior bytes (resume)
        handles.set(partPath, fd);
      }
      writeSync(fd, Buffer.from(chunk));
    },
    removePart: (partPath) => {
      closeHandle(partPath);
      removeQuietly(partPath);
    },
    sha256: (partPath) => {
      flush(partPath);
      return sha256Hex(partPath);
    },
    finalize: (partPath, finalPath) => {
      // Close (fsync + close) before renaming — Windows cannot rename a file that is still open.
      closeHandle(partPath);
      renameSync(partPath, finalPath);
    },
  };
}

export function nodeModelFs(): ModelServiceFs {
  return {
    exists: (path) => existsSync(path),
    size: (path) => sizeOf(path),
    ensureDir: (dir) => mkdirSync(dir, { recursive: true }),
    remove: (path) => removeQuietly(path),
    freeBytes: (dir) => freeBytes(dir),
    sha256: (path) => sha256Hex(path),
  };
}

/** Wrap global `fetch` into the downloader's transport shape (web body → Node async iterable). */
export const nodeDownloadFetch: DownloadFetch = async (url, init) => {
  const res = await fetch(url, { headers: init.headers, signal: init.signal, redirect: "follow" });
  const body = res.body
    ? (Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]) as AsyncIterable<Uint8Array>)
    : null;
  return { ok: res.ok, status: res.status, headers: res.headers, body };
};

export interface ModelRuntimeConfig {
  userDataDir: string;
  appDir: string;
  isWindows: boolean;
  env: Record<string, string | undefined>;
}

/** Whether an engine's runtime binary is present (mirrors the stt/inference resolvers). */
export function makeEngineReady(cfg: ModelRuntimeConfig): (engine: ModelManifest["engine"]) => boolean {
  const exe = (name: string) => (cfg.isWindows ? `${name}.exe` : name);
  const anyExists = (paths: string[]) => paths.some((p) => existsSync(p));
  return (engine) => {
    if (engine === "llama") {
      if (cfg.env.KHONJEL_LLAMA_ENDPOINT || cfg.env.KHONJEL_LLAMA_SERVER) return true;
      return anyExists([
        join(cfg.userDataDir, "runtime", "llama", exe("llama-server")),
        join(cfg.appDir, "vendor", "llama", exe("llama-server")),
      ]);
    }
    if (engine === "whisper") {
      if (cfg.env.KHONJEL_WHISPER_BIN) return true;
      const names = cfg.isWindows ? ["whisper-cli.exe", "main.exe"] : ["whisper-cli", "main"];
      const dirs = [
        join(cfg.userDataDir, "runtime", "whisper"),
        join(cfg.userDataDir, "runtime", "whisper", "Release"),
        join(cfg.appDir, "vendor", "whisper"),
        join(cfg.appDir, "vendor", "whisper", "Release"),
      ];
      return anyExists(dirs.flatMap((d) => names.map((n) => join(d, n))));
    }
    // Parakeet (sherpa-onnx): the one-shot CLI or the warm websocket server under vendor/parakeet[/bin].
    if (engine === "parakeet") {
      if (cfg.env.KHONJEL_SHERPA_BIN) return true;
      const bases = ["sherpa-onnx-offline", "sherpa-onnx-offline-websocket-server"];
      const names = cfg.isWindows ? bases.map((b) => `${b}.exe`) : bases;
      const dirs = [
        join(cfg.userDataDir, "runtime", "parakeet"),
        join(cfg.userDataDir, "runtime", "parakeet", "bin"),
        join(cfg.appDir, "vendor", "parakeet"),
        join(cfg.appDir, "vendor", "parakeet", "bin"),
      ];
      return anyExists(dirs.flatMap((d) => names.map((n) => join(d, n))));
    }
    return false;
  };
}

export function modelsDirOf(userDataDir: string): string {
  return join(userDataDir, "models");
}
