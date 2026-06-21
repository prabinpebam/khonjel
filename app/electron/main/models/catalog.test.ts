// @vitest-environment node
import { describe, it, expect } from "vitest";
import { listModels, recommendedModel } from "./catalog";

/** BE1 — the model catalog (Phase 3). */
describe("model catalog", () => {
  it("lists STT and LLM models separately", () => {
    expect(listModels("stt").some((m) => m.id.includes("whisper") || m.id.includes("ggml"))).toBe(true);
    expect(listModels("llm").some((m) => m.id.includes("qwen") || m.id.includes("gguf"))).toBe(true);
  });

  it("every model has an id, name, and size label", () => {
    for (const model of [...listModels("stt"), ...listModels("llm")]) {
      expect(model.id.length).toBeGreaterThan(0);
      expect(model.name.length).toBeGreaterThan(0);
      expect(model.sizeLabel.length).toBeGreaterThan(0);
    }
  });

  it("exposes exactly one recommended model per kind", () => {
    expect(listModels("stt").filter((m) => m.recommended)).toHaveLength(1);
    expect(listModels("llm").filter((m) => m.recommended)).toHaveLength(1);
    expect(recommendedModel("llm")?.recommended).toBe(true);
  });
});
