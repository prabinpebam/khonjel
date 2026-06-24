// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import { createRuntimeInstaller, runtimeArtifact, type RuntimeInstallIO } from "./runtime-install";

function fakeIO(present: Set<string> = new Set()): { io: RuntimeInstallIO; present: Set<string>; calls: { url?: string; zip?: string } } {
  const calls: { url?: string; zip?: string } = {};
  const io: RuntimeInstallIO = {
    resolveLatestTag: vi.fn(async () => "vTEST"),
    downloadFile: vi.fn(async (url, dest) => {
      calls.url = url;
      calls.zip = dest;
    }),
    extractZip: vi.fn((_zip, dir) => {
      // simulate the binary appearing after extraction
      present.add(join(dir, "whisper-cli.exe"));
      present.add(join(dir, "llama-server.exe"));
    }),
    exists: (p) => present.has(p),
    ensureDir: vi.fn(),
  };
  return { io, present, calls };
}

describe("runtimeArtifact", () => {
  it("resolves Windows x64 whisper + llama, and nothing on unsupported platforms", () => {
    expect(runtimeArtifact("whisper", "win32", "x64")?.binaries).toContain("whisper-cli.exe");
    expect(runtimeArtifact("llama", "win32", "x64")?.binaries).toContain("llama-server.exe");
    expect(runtimeArtifact("whisper", "darwin", "arm64")).toBeUndefined();
    expect(runtimeArtifact("parakeet", "win32", "x64")).toBeUndefined();
  });
});

describe("createRuntimeInstaller", () => {
  it("downloads the resolved-tag asset, extracts it, and verifies the binary", async () => {
    const { io, calls } = fakeIO();
    const inst = createRuntimeInstaller({ runtimeDir: "/rt", platform: "win32", arch: "x64", io });
    await inst.install("whisper", () => {});
    expect(io.resolveLatestTag).toHaveBeenCalled();
    expect(calls.url).toContain("whisper.cpp/releases/download/vTEST/whisper-bin-x64.zip");
    expect(calls.zip).toBe(join("/rt", "whisper", "whisper-bin-x64.zip"));
    expect(io.extractZip).toHaveBeenCalled();
  });

  it("is a no-op when the binary is already present", async () => {
    const present = new Set([join("/rt", "llama", "llama-server.exe")]);
    const { io } = fakeIO(present);
    const inst = createRuntimeInstaller({ runtimeDir: "/rt", platform: "win32", arch: "x64", io });
    expect(inst.isInstalled("llama")).toBe(true);
    await inst.install("llama", () => {});
    expect(io.downloadFile).not.toHaveBeenCalled();
  });

  it("throws when the binary is missing after extraction", async () => {
    const { io } = fakeIO();
    io.extractZip = vi.fn(); // extraction yields nothing
    const inst = createRuntimeInstaller({ runtimeDir: "/rt", platform: "win32", arch: "x64", io });
    await expect(inst.install("whisper", () => {})).rejects.toThrow(/could not be set up/);
  });

  it("throws on a platform without an auto-install artifact", async () => {
    const { io } = fakeIO();
    const inst = createRuntimeInstaller({ runtimeDir: "/rt", platform: "darwin", arch: "arm64", io });
    await expect(inst.install("whisper", () => {})).rejects.toThrow(/isn't available/);
  });
});
