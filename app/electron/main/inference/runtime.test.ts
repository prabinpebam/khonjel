// @vitest-environment node
import { describe, expect, it } from "vitest";
import path from "node:path";
import { resolveModelPath } from "./runtime";

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

function pathModule(value: string): string {
  return path.normalize(value);
}
