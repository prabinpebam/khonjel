/**
 * Backend provisioning (gpu-acceleration 02 §3). Acquires an artifact's parts (resumable + hash
 * verified), extracts them, asserts the expected files, and atomically activates the install — or
 * fails cleanly leaving the previous backend untouched. The IO (download/extract/fs) is injected so
 * the orchestration is BE1-testable; the node root binds the real downloader + unzip + fs.
 *
 * Safety: an unpinned artifact is REFUSED before any network access (we never run unverified code),
 * and disk is pre-flighted so we never start an unwinnable download.
 */
import { artifactSize, isPinned, type BackendArtifact } from "./manifest";

export type ProvisionFailCode =
  | "not_pinned"
  | "insufficient_disk"
  | "download_failed"
  | "missing_files"
  | "locked"
  | "unknown";

export class ProvisionError extends Error {
  code: ProvisionFailCode;
  constructor(code: ProvisionFailCode, message: string) {
    super(message);
    this.name = "ProvisionError";
    this.code = code;
  }
}

export interface ProvisionProgress {
  bytesDone: number;
  bytesTotal: number;
  message: string;
}

export interface ProvisionIo {
  /** Free bytes on the volume that holds the runtime dir. */
  freeDiskBytes(): number;
  /** Resumable download that verifies the file against `sha256` (throws on mismatch/network error). */
  download(url: string, destPath: string, sha256: string, onProgress?: (bytesDone: number) => void): Promise<void>;
  extractZip(zipPath: string, destDir: string): Promise<void>;
  fileExists(path: string): boolean;
  ensureDir(path: string): void;
  /** fsync + atomic rename of the staging dir to its final, immutable location. */
  atomicActivate(stagingDir: string, finalDir: string): void;
  removeDir(path: string): void;
  now(): string;
  onProgress?(event: ProvisionProgress): void;
}

/** Free-space check: total download + ~2x the largest zip for extraction headroom. */
export function diskPreflight(freeBytes: number, a: BackendArtifact): { ok: boolean; requiredBytes: number } {
  const { downloadBytes } = artifactSize(a);
  const largest = a.parts.reduce((max, p) => Math.max(max, p.bytes), 0);
  const requiredBytes = downloadBytes + largest * 2;
  return { ok: freeBytes >= requiredBytes, requiredBytes };
}

function fileNameOf(url: string): string {
  const segments = url.split("/");
  return segments[segments.length - 1] || "part.zip";
}

/**
 * Acquire + install an artifact into `<engineDir>/<backend>-<version>`. Resolves with its dir.
 *
 * Integrity: a pinned artifact is hash-verified (defense in depth). When `allowUnpinned` is set the
 * installer accepts an as-yet-unpinned artifact at the SAME integrity floor as the in-app CPU engine
 * installer (HTTPS + allow-listed host, enforced by the injected `download`, plus the post-extract
 * `expectFiles` assertion). Real sha256 pins are filled at release to upgrade this to full pinning.
 */
export async function installArtifact(
  a: BackendArtifact,
  engineDir: string,
  io: ProvisionIo,
  opts: { allowUnpinned?: boolean } = {},
): Promise<{ dir: string }> {
  if (!isPinned(a) && !opts.allowUnpinned) {
    throw new ProvisionError("not_pinned", "GPU support isn't available in this version yet.");
  }
  const pre = diskPreflight(io.freeDiskBytes(), a);
  if (!pre.ok) {
    throw new ProvisionError("insufficient_disk", "There isn't enough free disk space to set up GPU support.");
  }

  const finalDir = `${engineDir}/${a.backend}-${a.version}`;
  const staging = `${finalDir}.staging`;
  io.ensureDir(staging);

  try {
    const total = artifactSize(a).downloadBytes;
    let done = 0;
    for (let i = 0; i < a.parts.length; i++) {
      const partItem = a.parts[i];
      if (!partItem) continue;
      const fileName = fileNameOf(partItem.url);
      try {
        await io.download(partItem.url, `${staging}/${fileName}`, partItem.sha256, (bytesDone) =>
          io.onProgress?.({ bytesDone: done + bytesDone, bytesTotal: total, message: `Downloading GPU support (${i + 1} of ${a.parts.length})` }),
        );
      } catch {
        throw new ProvisionError("download_failed", "The GPU files couldn't be downloaded or verified.");
      }
      done += partItem.bytes;
    }

    for (const partItem of a.parts) {
      await io.extractZip(`${staging}/${fileNameOf(partItem.url)}`, staging);
    }

    const missing = a.expectFiles.filter((f) => !io.fileExists(`${staging}/${f}`));
    if (missing.length > 0) {
      throw new ProvisionError(
        "missing_files",
        "The GPU files didn't extract correctly. Your security software may have blocked them.",
      );
    }

    io.atomicActivate(staging, finalDir);
    return { dir: finalDir };
  } catch (err) {
    io.removeDir(staging);
    if (err instanceof ProvisionError) throw err;
    throw new ProvisionError("unknown", "Couldn't finish setting up GPU support.");
  }
}
