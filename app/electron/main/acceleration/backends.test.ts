// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  backendKey,
  emptyIndex,
  recordInstalled,
  activate,
  quarantine,
  rollbackTarget,
  pruneRetention,
  removeGpuBackends,
} from "./backends";

const installed = (dir: string) => ({ backend: "cuda-12.4" as const, version: "b9744", dir });

describe("backends index", () => {
  it("records an install as 'installed' (not active)", () => {
    const idx = recordInstalled(emptyIndex("llama"), installed("/r/llama/cuda-12.4-b9744"));
    const key = backendKey("cuda-12.4", "b9744");
    expect(idx.installed[key]?.state).toBe("installed");
    expect(idx.active).toBeUndefined();
  });

  it("activate sets active + last-known-good and demotes the previous active", () => {
    let idx = recordInstalled(emptyIndex("llama"), { backend: "cpu", version: "b9744", dir: "/r/llama/cpu-b9744" });
    idx = activate(idx, backendKey("cpu", "b9744"));
    idx = recordInstalled(idx, installed("/r/llama/cuda-12.4-b9744"));
    idx = activate(idx, backendKey("cuda-12.4", "b9744"));
    expect(idx.active).toBe(backendKey("cuda-12.4", "b9744"));
    expect(idx.lastKnownGood).toBe(backendKey("cuda-12.4", "b9744"));
    expect(idx.installed[backendKey("cpu", "b9744")]?.state).toBe("installed");
    expect(idx.installed[backendKey("cuda-12.4", "b9744")]?.state).toBe("active");
  });

  it("quarantine marks the backend + records the reason; rollback target is the LKG", () => {
    let idx = recordInstalled(emptyIndex("llama"), { backend: "cpu", version: "b9744", dir: "/r/llama/cpu-b9744" });
    idx = activate(idx, backendKey("cpu", "b9744")); // cpu is LKG
    idx = recordInstalled(idx, installed("/r/llama/cuda-12.4-b9744"));
    idx = quarantine(idx, backendKey("cuda-12.4", "b9744"), { code: "oom", message: "out of memory" });
    expect(idx.installed[backendKey("cuda-12.4", "b9744")]?.state).toBe("quarantined");
    expect(idx.installed[backendKey("cuda-12.4", "b9744")]?.lastError?.code).toBe("oom");
    expect(rollbackTarget(idx)).toBe(backendKey("cpu", "b9744"));
  });

  it("rollbackTarget falls back to CPU when the LKG itself is quarantined", () => {
    let idx = recordInstalled(emptyIndex("llama"), { backend: "cpu", version: "b9744", dir: "/r/llama/cpu-b9744" });
    idx = recordInstalled(idx, installed("/r/llama/cuda-12.4-b9744"));
    idx = activate(idx, backendKey("cuda-12.4", "b9744")); // cuda is LKG
    idx = quarantine(idx, backendKey("cuda-12.4", "b9744"), { code: "crashed", message: "x" });
    expect(rollbackTarget(idx)).toBe(backendKey("cpu", "b9744"));
  });

  it("pruneRetention keeps active + last-known-good + cpu and removes the rest", () => {
    let idx = recordInstalled(emptyIndex("llama"), { backend: "cpu", version: "b9744", dir: "/r/llama/cpu-b9744" });
    idx = recordInstalled(idx, { backend: "vulkan", version: "b9744", dir: "/r/llama/vulkan-b9744" });
    idx = activate(idx, backendKey("vulkan", "b9744")); // vulkan active+LKG
    idx = recordInstalled(idx, installed("/r/llama/cuda-12.4-b9744"));
    idx = activate(idx, backendKey("cuda-12.4", "b9744")); // cuda active+LKG; vulkan now neither
    const { index, removedDirs } = pruneRetention(idx);
    expect(removedDirs).toContain("/r/llama/vulkan-b9744");
    expect(index.installed[backendKey("vulkan", "b9744")]).toBeUndefined();
    expect(index.installed[backendKey("cpu", "b9744")]).toBeDefined();
    expect(index.installed[backendKey("cuda-12.4", "b9744")]).toBeDefined();
  });

  it("supersedes an old engine version: activating v2 prunes the v1 dir", () => {
    let idx = recordInstalled(emptyIndex("llama"), { backend: "cuda-12.4", version: "b9744", dir: "/r/llama/cuda-12.4-b9744" });
    idx = activate(idx, backendKey("cuda-12.4", "b9744"));
    idx = recordInstalled(idx, { backend: "cuda-12.4", version: "b9999", dir: "/r/llama/cuda-12.4-b9999" });
    idx = activate(idx, backendKey("cuda-12.4", "b9999"));
    const { index, removedDirs } = pruneRetention(idx);
    expect(removedDirs).toContain("/r/llama/cuda-12.4-b9744");
    expect(index.installed[backendKey("cuda-12.4", "b9744")]).toBeUndefined();
  });

  it("removeGpuBackends reverts to CPU and removes every GPU backend dir", () => {
    let idx = recordInstalled(emptyIndex("llama"), { backend: "cpu", version: "b9744", dir: "/r/llama/cpu-b9744" });
    idx = recordInstalled(idx, installed("/r/llama/cuda-12.4-b9744"));
    idx = activate(idx, backendKey("cuda-12.4", "b9744"));
    const { index, removedDirs } = removeGpuBackends(idx);
    expect(removedDirs).toContain("/r/llama/cuda-12.4-b9744");
    expect(index.active).toBe(backendKey("cpu", "b9744"));
    expect(index.installed[backendKey("cuda-12.4", "b9744")]).toBeUndefined();
    expect(index.installed[backendKey("cpu", "b9744")]).toBeDefined();
  });
});
