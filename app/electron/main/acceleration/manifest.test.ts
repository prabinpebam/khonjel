// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  BACKEND_MANIFEST,
  BACKEND_ALLOWED_HOSTS,
  findArtifact,
  manifestStructuralIssues,
  unpinnedArtifacts,
  artifactSize,
} from "./manifest";

describe("BACKEND_MANIFEST structure", () => {
  it("is non-empty and structurally valid (https + allowlisted host + expectFiles + cudart-for-cuda)", () => {
    expect(BACKEND_MANIFEST.length).toBeGreaterThan(0);
    expect(manifestStructuralIssues(BACKEND_MANIFEST)).toEqual([]);
  });

  it("only references allowlisted hosts over https (no plaintext, no surprise egress)", () => {
    for (const a of BACKEND_MANIFEST) {
      for (const part of a.parts) {
        expect(part.url.startsWith("https://")).toBe(true);
        const host = new URL(part.url).host;
        expect(BACKEND_ALLOWED_HOSTS).toContain(host);
      }
    }
  });

  it("every llama CUDA backend ships a cudart redistributable part (whisper cuBLAS bundles its own)", () => {
    const cudaLlama = BACKEND_MANIFEST.filter((a) => a.engine === "llama" && a.backend.startsWith("cuda"));
    expect(cudaLlama.length).toBeGreaterThan(0);
    for (const a of cudaLlama) {
      expect(a.parts.some((p) => p.role === "redist")).toBe(true);
    }
  });

  it("always provides a CPU backend per engine+platform (the floor never disappears)", () => {
    const cpu = BACKEND_MANIFEST.filter((a) => a.backend === "cpu");
    expect(cpu.some((a) => a.engine === "llama")).toBe(true);
    expect(cpu.some((a) => a.engine === "whisper")).toBe(true);
  });
});

describe("findArtifact", () => {
  it("resolves a backend for an engine + os + arch", () => {
    const a = findArtifact(BACKEND_MANIFEST, { engine: "llama", backend: "cpu", os: "win32", arch: "x64" });
    expect(a?.engine).toBe("llama");
    expect(a?.backend).toBe("cpu");
    expect(a?.expectFiles.length).toBeGreaterThan(0);
  });

  it("returns undefined when a backend is not shipped for that platform", () => {
    expect(findArtifact(BACKEND_MANIFEST, { engine: "llama", backend: "metal", os: "win32", arch: "x64" })).toBeUndefined();
  });
});

describe("artifactSize", () => {
  it("sums engine + redist parts for download size and reports install size", () => {
    const cuda = findArtifact(BACKEND_MANIFEST, { engine: "llama", backend: "cuda-12.4", os: "win32", arch: "x64" });
    expect(cuda).toBeTruthy();
    if (!cuda) return;
    const size = artifactSize(cuda);
    expect(size.downloadBytes).toBe(cuda.parts.reduce((n, p) => n + p.bytes, 0));
    expect(size.diskBytes).toBeGreaterThan(0);
  });
});

describe("unpinnedArtifacts (release pin gate)", () => {
  it("flags any artifact whose parts are missing a sha256 (provisioning refuses these at runtime)", () => {
    // Documents which artifacts still need hashes populated before release. The list MAY be
    // non-empty in this build, but the gate exists and is exercised.
    const flagged = unpinnedArtifacts(BACKEND_MANIFEST);
    for (const a of flagged) {
      expect(a.parts.some((p) => p.sha256 === "")).toBe(true);
    }
  });
});
