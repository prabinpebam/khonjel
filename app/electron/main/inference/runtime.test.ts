// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";
import path from "node:path";

const { startLlamaServer } = vi.hoisted(() => ({ startLlamaServer: vi.fn() }));
vi.mock("./llama-server", () => ({ startLlamaServer }));
vi.mock("../acceleration/active-backend", () => ({ activeLlamaGpu: () => undefined }));
vi.mock("node:fs", () => ({
  existsSync: () => true,
  readdirSync: () => ["qwen2.5-1.5b-instruct-q4_k_m.gguf"],
}));

import { createInferenceRuntime, resolveModelPath } from "./runtime";

describe("resolveModelPath", () => {
  it("prefers the selected model id when present", () => {
    const path = resolveModelPath({
      dirs: ["C:/models"],
      selectedModelId: "qwen2.5-3b-instruct-q4_k_m.gguf",
      filesByDir: () => ["qwen2.5-1.5b-instruct-q4_k_m.gguf", "qwen2.5-3b-instruct-q4_k_m.gguf"],
    });
    expect(path).toBe(pathModule("C:/models/qwen2.5-3b-instruct-q4_k_m.gguf"));
  });

  it("falls back to the first GGUF when no selected model exists", () => {
    const path = resolveModelPath({
      dirs: ["C:/models"],
      selectedModelId: "missing.gguf",
      filesByDir: () => ["qwen2.5-1.5b-instruct-q4_k_m.gguf"],
    });
    expect(path).toBe(pathModule("C:/models/qwen2.5-1.5b-instruct-q4_k_m.gguf"));
  });
});

const baseCfg = {
  userDataDir: "/u",
  appDir: "/a",
  isWindows: true,
  env: {} as Record<string, string | undefined>,
};

describe("createInferenceRuntime — local engine VRAM gating", () => {
  beforeEach(() => {
    startLlamaServer.mockReset();
    startLlamaServer.mockImplementation(async () => ({ endpoint: "http://127.0.0.1:0", stop: vi.fn() }));
  });

  it("spawns the local server when an LLM task uses the local engine", async () => {
    const rt = createInferenceRuntime({ ...baseCfg, localEngineNeeded: () => true });
    expect(await rt.start()).toBe("spawned");
    expect(startLlamaServer).toHaveBeenCalledTimes(1);
  });

  it("does NOT load the local model when every LLM task is routed to cloud", async () => {
    const rt = createInferenceRuntime({ ...baseCfg, localEngineNeeded: () => false });
    expect(await rt.start()).toBe("stub");
    expect(startLlamaServer).not.toHaveBeenCalled();
  });

  it("releases a running local server once the last local task switches to cloud", async () => {
    let needed = true;
    const rt = createInferenceRuntime({ ...baseCfg, localEngineNeeded: () => needed });
    expect(await rt.start()).toBe("spawned");
    const { stop } = await startLlamaServer.mock.results[0]!.value;
    needed = false;
    expect(await rt.start()).toBe("stub");
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

function pathModule(value: string): string {
  return path.normalize(value);
}
