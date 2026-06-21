// @vitest-environment node
import { describe, it, expect } from "vitest";
import { testConnection } from "./test";
import type { ConnectionProfile } from "../../../src/services/ports";

const conn: ConnectionProfile = {
  id: "azure-prod",
  kind: "azure-openai",
  baseEndpoint: "https://res.cognitiveservices.azure.com",
  apiVersion: "2025-03-01-preview",
  authMode: "bearer-token",
};

describe("testConnection", () => {
  it("returns ok when the ping succeeds", async () => {
    const result = await testConnection(conn, "SECRET", "gpt-5.4", async () => ({
      choices: [{ message: { content: "pong" } }],
    }));
    expect(result.ok).toBe(true);
  });

  it("returns a message when the request fails", async () => {
    const result = await testConnection(conn, "SECRET", "gpt-5.4", async () => {
      throw new Error("HTTP 401 Unauthorized");
    });
    expect(result.ok).toBe(false);
    expect(result.message).toContain("401");
  });

  it("guards a missing connection or target", async () => {
    expect((await testConnection(undefined, "", "x", async () => ({}))).ok).toBe(false);
    expect((await testConnection(conn, "", "", async () => ({}))).ok).toBe(false);
  });
});
