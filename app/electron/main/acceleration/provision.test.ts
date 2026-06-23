// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { installArtifact, diskPreflight, ProvisionError, type ProvisionIo } from "./provision";
import type { BackendArtifact } from "./manifest";

const MIB = 1024 * 1024;
const SHA = "a".repeat(64);

function pinnedArtifact(): BackendArtifact {
  return {
    engine: "llama",
    backend: "cuda-12.4",
    version: "b9744",
    os: "win32",
    arch: "x64",
    parts: [
      { url: "https://github.com/x/llama-cuda.zip", sha256: SHA, bytes: 300 * MIB, role: "engine" },
      { url: "https://github.com/x/cudart.zip", sha256: SHA, bytes: 320 * MIB, role: "redist" },
    ],
    expectFiles: ["llama-server.exe", "ggml-cuda.dll"],
    minDriver: { nvidia: "551.78" },
  };
}

function fakeIo(over: Partial<ProvisionIo> = {}): ProvisionIo {
  const present = new Set<string>();
  return {
    freeDiskBytes: () => 100 * 1024 * MIB,
    download: vi.fn(async () => {}),
    extractZip: vi.fn(async (_zip: string, destDir: string) => {
      // simulate a good extraction: drop the expected files into the staging dir
      present.add(`${destDir}/llama-server.exe`);
      present.add(`${destDir}/ggml-cuda.dll`);
    }),
    fileExists: (p: string) => present.has(p),
    ensureDir: vi.fn(),
    atomicActivate: vi.fn(),
    removeDir: vi.fn(),
    now: () => "2026-06-23T00:00:00.000Z",
    ...over,
  };
}

describe("diskPreflight", () => {
  it("passes when free space covers downloads + extraction headroom", () => {
    const a = pinnedArtifact();
    const result = diskPreflight(100 * 1024 * MIB, a);
    expect(result.ok).toBe(true);
    expect(result.requiredBytes).toBeGreaterThan(0);
  });
  it("fails when free space is too low", () => {
    const a = pinnedArtifact();
    expect(diskPreflight(10 * MIB, a).ok).toBe(false);
  });
});

describe("installArtifact", () => {
  it("refuses an unpinned artifact (pin gate) without downloading anything", async () => {
    const a = pinnedArtifact();
    a.parts[0]!.sha256 = ""; // not pinned
    const io = fakeIo();
    await expect(installArtifact(a, "/r/llama", io)).rejects.toMatchObject({ code: "not_pinned" });
    expect(io.download).not.toHaveBeenCalled();
  });

  it("refuses when there is not enough disk space", async () => {
    const io = fakeIo({ freeDiskBytes: () => 1 * MIB });
    await expect(installArtifact(pinnedArtifact(), "/r/llama", io)).rejects.toMatchObject({ code: "insufficient_disk" });
    expect(io.download).not.toHaveBeenCalled();
  });

  it("downloads every part (verifying its hash), extracts, and atomically activates", async () => {
    const io = fakeIo();
    const result = await installArtifact(pinnedArtifact(), "/r/llama", io);
    expect(io.download).toHaveBeenCalledTimes(2);
    expect(io.atomicActivate).toHaveBeenCalledOnce();
    expect(result.dir).toBe("/r/llama/cuda-12.4-b9744");
  });

  it("fails + does NOT activate when an expected file is missing after extraction (rollback)", async () => {
    const io = fakeIo({ extractZip: vi.fn(async () => {}) }); // extracts nothing -> expectFiles missing
    await expect(installArtifact(pinnedArtifact(), "/r/llama", io)).rejects.toMatchObject({ code: "missing_files" });
    expect(io.atomicActivate).not.toHaveBeenCalled();
    expect(io.removeDir).toHaveBeenCalled(); // staging cleaned up
  });

  it("classifies a download failure (hash mismatch / network) as download_failed", async () => {
    const io = fakeIo({
      download: vi.fn(async () => {
        throw new Error("sha256 mismatch");
      }),
    });
    await expect(installArtifact(pinnedArtifact(), "/r/llama", io)).rejects.toMatchObject({ code: "download_failed" });
    expect(io.atomicActivate).not.toHaveBeenCalled();
  });

  it("throws a ProvisionError instance with a user-facing message", async () => {
    const a = pinnedArtifact();
    a.parts[0]!.sha256 = "";
    try {
      await installArtifact(a, "/r/llama", fakeIo());
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ProvisionError);
      expect((err as ProvisionError).message.length).toBeGreaterThan(0);
    }
  });
});
