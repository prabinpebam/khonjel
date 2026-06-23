// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyProbeOutcome, applyCrashLoop } from "./lifecycle";
import { activate, backendKey, emptyIndex, recordInstalled } from "./backends";

function withCpuAndCuda() {
  let idx = recordInstalled(emptyIndex("llama"), { backend: "cpu", version: "b9744", dir: "/r/llama/cpu-b9744" });
  idx = activate(idx, backendKey("cpu", "b9744")); // cpu is the floor + LKG
  idx = recordInstalled(idx, { backend: "cuda-12.4", version: "b9744", dir: "/r/llama/cuda-12.4-b9744" });
  return idx;
}

describe("applyProbeOutcome", () => {
  it("activates the backend when the probe passes", () => {
    const out = applyProbeOutcome(withCpuAndCuda(), backendKey("cuda-12.4", "b9744"), true);
    expect(out.activatedKey).toBe(backendKey("cuda-12.4", "b9744"));
    expect(out.index.active).toBe(backendKey("cuda-12.4", "b9744"));
    expect(out.rolledBackTo).toBeUndefined();
  });

  it("quarantines and rolls back to the last-known-good when the probe fails", () => {
    const out = applyProbeOutcome(withCpuAndCuda(), backendKey("cuda-12.4", "b9744"), false, { code: "oom", message: "out of memory" });
    expect(out.index.installed[backendKey("cuda-12.4", "b9744")]?.state).toBe("quarantined");
    expect(out.rolledBackTo).toBe(backendKey("cpu", "b9744"));
    expect(out.index.active).toBe(backendKey("cpu", "b9744"));
  });

  it("quarantines with no rollback target when nothing healthy remains", () => {
    let idx = recordInstalled(emptyIndex("llama"), { backend: "cuda-12.4", version: "b9744", dir: "/r/llama/cuda-12.4-b9744" });
    idx = activate(idx, backendKey("cuda-12.4", "b9744"));
    const out = applyProbeOutcome(idx, backendKey("cuda-12.4", "b9744"), false, { code: "crashed", message: "x" });
    expect(out.rolledBackTo).toBeUndefined();
    expect(out.index.active).toBeUndefined();
  });
});

describe("applyCrashLoop", () => {
  const T = 120_000;
  it("does nothing below the crash threshold", () => {
    let idx = withCpuAndCuda();
    idx = activate(idx, backendKey("cuda-12.4", "b9744"));
    const out = applyCrashLoop(idx, backendKey("cuda-12.4", "b9744"), [190_000], 200_000, 2, T);
    expect(out.demoted).toBe(false);
    expect(out.index.active).toBe(backendKey("cuda-12.4", "b9744"));
  });

  it("demotes a crash-looping backend and rolls back to CPU", () => {
    let idx = withCpuAndCuda();
    idx = activate(idx, backendKey("cuda-12.4", "b9744"));
    const out = applyCrashLoop(idx, backendKey("cuda-12.4", "b9744"), [150_000, 190_000], 200_000, 2, T);
    expect(out.demoted).toBe(true);
    expect(out.rolledBackTo).toBe(backendKey("cpu", "b9744"));
    expect(out.index.installed[backendKey("cuda-12.4", "b9744")]?.state).toBe("quarantined");
    expect(out.index.active).toBe(backendKey("cpu", "b9744"));
  });
});
