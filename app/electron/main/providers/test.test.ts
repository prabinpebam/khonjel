// @vitest-environment node
import { describe, it, expect } from "vitest";
import { testConnection } from "./test";
import type { ConnectionProfile } from "../../../src/services/ports";
import type { ProxyFetch } from "./proxyFetch";

const conn: ConnectionProfile = {
  id: "azure-prod",
  kind: "azure-openai",
  baseEndpoint: "https://res.cognitiveservices.azure.com",
  apiVersion: "2025-03-01-preview",
  authMode: "bearer-token",
};

function fakeFetch(over: Partial<ProxyFetch> = {}): ProxyFetch {
  return {
    json: async () => ({ choices: [{ message: { content: "pong" } }] }),
    transcription: async () => ({ text: "" }),
    ...over,
  };
}

describe("testConnection", () => {
  it("chat: pings /chat/completions without a tight token cap and returns ok", async () => {
    let url = "";
    let body: Record<string, unknown> | undefined;
    const result = await testConnection(
      conn,
      "SECRET",
      "gpt-5.4",
      "chat",
      fakeFetch({
        json: async (req) => {
          url = req.url;
          body = req.body as Record<string, unknown>;
          return { choices: [{ message: { content: "pong" } }] };
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(url).toContain("/chat/completions");
    // No max_completion_tokens: reasoning models would exhaust a tiny cap on reasoning alone.
    expect(body?.max_completion_tokens).toBeUndefined();
  });

  it("transcription: pings /audio/transcriptions (not chat) and returns ok", async () => {
    let url = "";
    const result = await testConnection(
      conn,
      "SECRET",
      "gpt-4o-transcribe",
      "transcription",
      fakeFetch({
        transcription: async (req) => {
          url = req.url;
          return { text: "" };
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(url).toContain("/audio/transcriptions");
    expect(url).not.toContain("/chat/completions");
  });

  it("returns a message when the request fails", async () => {
    const result = await testConnection(
      conn,
      "SECRET",
      "gpt-5.4",
      "chat",
      fakeFetch({
        json: async () => {
          throw new Error("HTTP 404 Resource not found");
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("404");
  });

  it("explains an Azure DeploymentNotFound with actionable guidance", async () => {
    const result = await testConnection(
      conn,
      "SECRET",
      "gpt-54-chat",
      "chat",
      fakeFetch({
        json: async () => {
          throw new Error(
            'HTTP 404 Not Found: {"error":{"code":"DeploymentNotFound","message":"The API deployment for this resource does not exist."}}',
          );
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("gpt-54-chat");
    expect(result.message).toMatch(/Deployments/i);
    expect(result.message).not.toContain("{");
  });

  it("guards a missing connection or target", async () => {
    expect((await testConnection(undefined, "", "x", "chat", fakeFetch())).ok).toBe(false);
    expect((await testConnection(conn, "", "", "chat", fakeFetch())).ok).toBe(false);
  });

  it("flags a missing Azure API version before sending a request", async () => {
    let called = false;
    const result = await testConnection(
      { ...conn, apiVersion: undefined },
      "SECRET",
      "gpt-5.4",
      "chat",
      fakeFetch({
        json: async () => {
          called = true;
          return {};
        },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.message).toContain("API version");
    expect(called, "should not hit the network when config is incomplete").toBe(false);
  });
});
