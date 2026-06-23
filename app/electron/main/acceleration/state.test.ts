// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildAccelerationState, engineAccelerationOf } from "./state";
import { activate, backendKey, emptyIndex, recordInstalled } from "./backends";

function cpuOnly() {
  let idx = recordInstalled(emptyIndex("llama"), { backend: "cpu", version: "b9744", dir: "/r/llama/cpu-b9744" });
  idx = activate(idx, backendKey("cpu", "b9744"));
  return idx;
}
function gpuActive() {
  let idx = cpuOnly();
  idx = recordInstalled(idx, { backend: "cuda-12.4", version: "b9744", dir: "/r/llama/cuda-12.4-b9744" });
  idx = activate(idx, backendKey("cuda-12.4", "b9744"));
  return idx;
}

describe("engineAccelerationOf", () => {
  it("reports CPU when the active backend is cpu", () => {
    const e = engineAccelerationOf("llama", cpuOnly());
    expect(e.device).toBe("cpu");
    expect(e.message.toLowerCase()).toContain("cpu");
  });
  it("reports GPU when a GPU backend is active", () => {
    const e = engineAccelerationOf("llama", gpuActive());
    expect(e.device).toBe("gpu");
    expect(e.activeBackend).toBe("cuda-12.4");
    expect(e.state).toBe("active");
  });
  it("reports CPU with state 'none' when nothing is installed", () => {
    const e = engineAccelerationOf("whisper", emptyIndex("whisper"));
    expect(e.device).toBe("cpu");
    expect(e.state).toBe("none");
  });
});

describe("buildAccelerationState", () => {
  it("is honest CPU when no GPU backend is active", () => {
    const s = buildAccelerationState({ mode: "auto", llm: cpuOnly(), stt: emptyIndex("whisper"), online: true });
    expect(s.gpuActive).toBe(false);
    expect(s.summary.toLowerCase()).toContain("cpu");
  });

  it("flips gpuActive + summary when an engine is on the GPU", () => {
    const s = buildAccelerationState({ mode: "auto", llm: gpuActive(), stt: emptyIndex("whisper"), online: true });
    expect(s.gpuActive).toBe(true);
    expect(s.summary.toLowerCase()).toMatch(/graphics|gpu/);
    expect(s.llm.device).toBe("gpu");
  });

  it("says acceleration is off in 'off' mode", () => {
    const s = buildAccelerationState({ mode: "off", llm: gpuActive(), stt: emptyIndex("whisper"), online: true });
    expect(s.summary.toLowerCase()).toMatch(/off/);
  });

  it("carries the offline flag through", () => {
    const s = buildAccelerationState({ mode: "auto", llm: cpuOnly(), stt: emptyIndex("whisper"), online: false });
    expect(s.online).toBe(false);
  });
});
