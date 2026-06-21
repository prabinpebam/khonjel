import { describe, it, expect } from "vitest";
import { resolveActiveModel } from "./useActiveModel";
import type { ConnectionProfile, ModelInfo } from "@services/ports";

const models: ModelInfo[] = [
  {
    id: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    name: "Qwen2.5 1.5B Instruct",
    sizeLabel: "1.1 GB",
    recommended: false,
  },
];

const connections: ConnectionProfile[] = [
  {
    id: "azure-transcribe",
    kind: "azure-openai",
    baseEndpoint: "https://example.cognitiveservices.azure.com",
    apiVersion: "2024-12-01-preview",
    authMode: "api-key-header",
    model: "whisper",
  },
];

describe("resolveActiveModel", () => {
  it("local: resolves the catalog display name", () => {
    expect(
      resolveActiveModel("local", "qwen2.5-1.5b-instruct-q4_k_m.gguf", "", "", models, connections),
    ).toEqual({ scope: "Local", model: "Qwen2.5 1.5B Instruct", isLocal: true });
  });

  it("local: falls back to the raw id when not in the catalog", () => {
    expect(resolveActiveModel("local", "mystery-id", "", "", models, connections).model).toBe(
      "mystery-id",
    );
  });

  it("enterprise: resolves the bound connection + target deployment (the Azure case)", () => {
    expect(
      resolveActiveModel(
        "enterprise",
        "qwen2.5-1.5b-instruct-q4_k_m.gguf",
        "azure-transcribe",
        "gpt-4o-transcribe",
        models,
        connections,
      ),
    ).toEqual({ scope: "azure-openai", model: "gpt-4o-transcribe", isLocal: false });
  });

  it("routed: uses the connection's default model when no target override", () => {
    expect(
      resolveActiveModel("providers", "", "azure-transcribe", "", models, connections),
    ).toEqual({ scope: "azure-openai", model: "whisper", isLocal: false });
  });

  it("routed: falls back to the bound connection name when the list has not loaded yet", () => {
    // The sidebar can resolve before its connections list has loaded; the bound id still reads clearly.
    expect(
      resolveActiveModel("enterprise", "", "azure-transcribe", "gpt-4o-transcribe", models, []),
    ).toEqual({ scope: "azure-transcribe", model: "gpt-4o-transcribe", isLocal: false });
  });

  it("routed: falls back to Cloud / Not set when nothing is bound", () => {
    expect(resolveActiveModel("enterprise", "", "", "", models, connections)).toEqual({
      scope: "Cloud",
      model: "Not set",
      isLocal: false,
    });
  });
});
