// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { buildServerArgs } from "./llama-server";
import { createLlamaEngine } from "./llama";

describe("llama-server api key", () => {
  it("adds --api-key when a token is set", () => {
    const args = buildServerArgs({ binPath: "x", modelPath: "m", apiKey: "tok" });
    expect(args).toContain("--api-key");
    expect(args[args.indexOf("--api-key") + 1]).toBe("tok");
  });

  it("omits --api-key when no token is set", () => {
    expect(buildServerArgs({ binPath: "x", modelPath: "m" })).not.toContain("--api-key");
  });
});

describe("llama engine auth header", () => {
  function captureFetch() {
    const calls: { headers: Record<string, string> }[] = [];
    const fetchFn = vi.fn(async (_url: string, init: { headers: Record<string, string> }) => {
      calls.push({ headers: init.headers });
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "hi" } }] }),
        text: async () => "",
      };
    });
    return { calls, fetchFn };
  }

  it("sends Authorization: Bearer when an apiKey is configured", async () => {
    const { calls, fetchFn } = captureFetch();
    const engine = createLlamaEngine({ endpoint: "http://127.0.0.1:8080", apiKey: "tok", fetchFn });
    await engine.refine("x");
    expect(calls[0]!.headers["Authorization"]).toBe("Bearer tok");
  });

  it("omits Authorization when no apiKey is configured", async () => {
    const { calls, fetchFn } = captureFetch();
    const engine = createLlamaEngine({ endpoint: "http://127.0.0.1:8080", fetchFn });
    await engine.refine("x");
    expect(calls[0]!.headers["Authorization"]).toBeUndefined();
  });
});
