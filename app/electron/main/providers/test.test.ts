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
  it("chat: pings /chat/completions and returns ok", async () => {
    let url = "";
    const result = await testConnection(
      conn,
      "SECRET",
      "gpt-5.4",
      "chat",
      fakeFetch({
        json: async (req) => {
          url = req.url;
          return { choices: [{ message: { content: "pong" } }] };
        },
      }),
    );
    expect(result.ok).toBe(true);
    expect(url).toContain("/chat/completions");
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
