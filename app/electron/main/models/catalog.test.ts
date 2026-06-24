// @vitest-environment node
import { describe, it, expect } from "vitest";
import { listModels, recommendedModel, modelManifest } from "./catalog";

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

/** BE1 — the multi-file (Parakeet / sherpa-onnx) manifest (Parakeet integration P2). */
describe("multi-file Parakeet manifest", () => {
  const PARAKEET = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3";

  it("declares the four sherpa-onnx model parts as individually-downloaded files", () => {
    const manifest = modelManifest(PARAKEET);
    expect(manifest?.engine).toBe("parakeet");
    const names = (manifest?.files ?? []).map((f) => f.name);
    expect(names).toEqual(
      expect.arrayContaining([
        "encoder.int8.onnx",
        "decoder.int8.onnx",
        "joiner.int8.onnx",
        "tokens.txt",
      ]),
    );
    // No archive: every part has its own https source (the in-app downloader pulls them one by one).
    for (const file of manifest?.files ?? []) {
      expect(file.sources[0]).toMatch(/^https:\/\//);
    }
  });

  it("installs into a per-model directory (fileName) and leaves single-file sources empty", () => {
    const manifest = modelManifest(PARAKEET);
    expect(manifest?.fileName).toMatch(/parakeet/);
    expect(manifest?.sources).toEqual([]);
  });
});
