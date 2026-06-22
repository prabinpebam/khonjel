/**
 * Resumable, integrity-checked file downloader (07 §3). The transport (`fetch`) and the filesystem
 * (`DownloadFs`) are injected, so the whole download → verify → atomic-rename flow is BE1-tested
 * without real network or disk. The composition root wires the real implementations.
 *
 *   - resumes a partial `.part` with an HTTP Range request (the fetch scripts restart from zero);
 *   - verifies size (when `expectedBytes` known) and `sha256` (when pinned) before installing;
 *   - finalizes with fsync + atomic rename `.part → final`.
 */
import type { ModelErrorCode } from "../../../src/services/ports";

export interface DownloadResponse {
  ok: boolean;
  status: number;
  headers: { get: (name: string) => string | null };
  body: AsyncIterable<Uint8Array> | null;
}

export type DownloadFetch = (
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
) => Promise<DownloadResponse>;

/** Minimal filesystem surface the downloader needs (real impl in `runtime.ts`). */
export interface DownloadFs {
  /** Bytes already in the `.part` file (0 when absent). */
  partSize: (partPath: string) => number;
  /** Append a chunk to the `.part` file (creates it if absent). */
  appendChunk: (partPath: string, chunk: Uint8Array) => void;
  /** Discard a `.part` file. */
  removePart: (partPath: string) => void;
  /** Sha-256 hex digest of a file. */
  sha256: (path: string) => string;
  /** fsync + atomic rename `.part → final`. */
  finalize: (partPath: string, finalPath: string) => void;
}

export interface DownloadTask {
  url: string;
  partPath: string;
  finalPath: string;
  expectedBytes?: number;
  sha256?: string;
}

export type DownloadOutcome =
  | { ok: true; bytes: number }
  | { ok: false; code: ModelErrorCode; message: string };

export interface Downloader {
  download: (
    task: DownloadTask,
    onTick: (bytesDone: number, bytesTotal?: number) => void,
    signal: AbortSignal,
  ) => Promise<DownloadOutcome>;
}

function classifyError(err: unknown): { code: ModelErrorCode; message: string } {
  const code = (err as { code?: string } | null)?.code;
  if (code === "ENOSPC") return { code: "disk-full", message: "Not enough disk space." };
  if (code === "EACCES" || code === "EPERM")
    return { code: "permission", message: "Can't write to the model folder." };
  return { code: "offline", message: "Couldn't reach the download server." };
}

export function createDownloader(deps: { fetch: DownloadFetch; fs: DownloadFs }): Downloader {
  return {
    download: async (task, onTick, signal) => {
      try {
        let existing = deps.fs.partSize(task.partPath);
        const headers: Record<string, string> = { "User-Agent": "khonjel" };
        if (existing > 0) headers.Range = `bytes=${existing}-`;

        const res = await deps.fetch(task.url, { headers, signal });

        // A 416 means the .part is already complete (or stale) — re-fetch from scratch to be safe.
        if (res.status === 416) {
          deps.fs.removePart(task.partPath);
          existing = 0;
          return { ok: false, code: "internal", message: "Range not satisfiable; will retry." };
        }
        if (!res.ok) {
          const code: ModelErrorCode =
            res.status === 403 || res.status === 404 || res.status === 410
              ? "source-unavailable"
              : "offline";
          return { ok: false, code, message: `Download server returned ${res.status}.` };
        }
        // Server ignored our Range and is sending the whole file: restart the .part cleanly.
        if (existing > 0 && res.status !== 206) {
          deps.fs.removePart(task.partPath);
          existing = 0;
        }

        const contentLength = Number(res.headers.get("content-length") ?? 0);
        const bytesTotal =
          task.expectedBytes ?? (contentLength > 0 ? existing + contentLength : undefined);

        let done = existing;
        onTick(done, bytesTotal);
        if (res.body) {
          for await (const chunk of res.body) {
            if (signal.aborted) return { ok: false, code: "internal", message: "Cancelled." };
            deps.fs.appendChunk(task.partPath, chunk);
            done += chunk.length;
            onTick(done, bytesTotal);
          }
        }

        // ---- Verify before installing ----
        const finalSize = deps.fs.partSize(task.partPath);
        if (task.expectedBytes != null && finalSize !== task.expectedBytes) {
          deps.fs.removePart(task.partPath);
          return { ok: false, code: "checksum-mismatch", message: "Downloaded file was incomplete." };
        }
        if (task.sha256) {
          const digest = deps.fs.sha256(task.partPath);
          if (digest.toLowerCase() !== task.sha256.toLowerCase()) {
            deps.fs.removePart(task.partPath);
            return { ok: false, code: "checksum-mismatch", message: "Downloaded file failed its integrity check." };
          }
        }
        if (finalSize <= 0) {
          deps.fs.removePart(task.partPath);
          return { ok: false, code: "offline", message: "No data was received." };
        }

        deps.fs.finalize(task.partPath, task.finalPath);
        return { ok: true, bytes: finalSize };
      } catch (err) {
        if (signal.aborted) return { ok: false, code: "internal", message: "Cancelled." };
        return { ok: false, ...classifyError(err) };
      }
    },
  };
}
