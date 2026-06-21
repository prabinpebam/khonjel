// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildAuthHeaders, buildChatRequest, buildTranscriptionRequest } from "./request";
import type { ConnectionProfile } from "../../../src/services/ports";

/** BE1 — provider request construction (Phase 2). Azure is the strict shape; nothing hardcoded. */

const azure: ConnectionProfile = {
  id: "azure-prod",
  kind: "azure-openai",
  baseEndpoint: "https://my-resource.cognitiveservices.azure.com/",
  apiVersion: "2025-03-01-preview",
  authMode: "api-key-header",
  headerName: "api-key",
};

const openai: ConnectionProfile = {
  id: "openai",
  kind: "openai",
  baseEndpoint: "https://api.openai.com",
  authMode: "bearer-token",
};

describe("buildAuthHeaders", () => {
  it("uses the api-key header (custom name) for api-key-header mode", () => {
    expect(buildAuthHeaders(azure, "SECRET")).toEqual({ "api-key": "SECRET" });
  });
  it("uses Authorization: Bearer for bearer-token / aad", () => {
    expect(buildAuthHeaders(openai, "SECRET")).toEqual({ Authorization: "Bearer SECRET" });
    expect(buildAuthHeaders({ ...azure, authMode: "aad" }, "TOK")).toEqual({ Authorization: "Bearer TOK" });
  });
});

describe("buildChatRequest — Azure", () => {
  const req = buildChatRequest(azure, "gpt-4o-deploy", "SECRET", {
    messages: [{ role: "user", content: "hi" }],
    maxTokens: 16384,
    temperature: 0.3,
  });

  it("routes to the deployment path with the api-version query (trailing slash stripped)", () => {
    expect(req.url).toBe(
      "https://my-resource.cognitiveservices.azure.com/openai/deployments/gpt-4o-deploy/chat/completions?api-version=2025-03-01-preview",
    );
  });
  it("maps maxTokens to max_completion_tokens (not max_tokens)", () => {
    const body = req.body as Record<string, unknown>;
    expect(body.max_completion_tokens).toBe(16384);
    expect(body.max_tokens).toBeUndefined();
  });
  it("sets the api-key header and json content type", () => {
    expect(req.headers["api-key"]).toBe("SECRET");
    expect(req.headers["Content-Type"]).toBe("application/json");
  });
});

describe("buildChatRequest — OpenAI-compatible", () => {
  const req = buildChatRequest(openai, "gpt-4o-mini", "SECRET", {
    messages: [{ role: "user", content: "hi" }],
    maxTokens: 512,
  });
  it("uses the /v1/chat/completions path with the model in the body", () => {
    expect(req.url).toBe("https://api.openai.com/v1/chat/completions");
    const body = req.body as Record<string, unknown>;
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.max_tokens).toBe(512);
    expect(body.max_completion_tokens).toBeUndefined();
  });
});

describe("buildTranscriptionRequest", () => {
  it("builds the Azure deployment transcription URL", () => {
    expect(buildTranscriptionRequest(azure, "gpt-4o-transcribe", "SECRET").url).toBe(
      "https://my-resource.cognitiveservices.azure.com/openai/deployments/gpt-4o-transcribe/audio/transcriptions?api-version=2025-03-01-preview",
    );
  });
  it("builds the OpenAI-compatible transcription URL", () => {
    expect(buildTranscriptionRequest(openai, "whisper-1", "SECRET").url).toBe(
      "https://api.openai.com/v1/audio/transcriptions",
    );
  });
});
