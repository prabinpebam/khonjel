/**
 * BE: createLlamaEngine.chatStream — token-by-token SSE consumption over an injected stream fetch.
 * Locks the contract the main-process chat manager relies on (onToken per delta, resolve full text,
 * throw on a non-ok response). Transport is faked; no llama-server needed.
 */
import { describe, expect, it } from "vitest";
import { createLlamaEngine, withFallback, type StreamHttpResponse } from "./llama";
import { stubInferenceEngine } from "../services/inference";

function fakeStream(chunks: string[]): StreamHttpResponse {
  return {
    ok: true,
    status: 200,
    text: async () => "",
    body: (async function* () {
      const enc = new TextEncoder();
      for (const c of chunks) yield enc.encode(c);
    })(),
  };
}

describe("createLlamaEngine.chatStream", () => {
  it("fires onToken per delta (even when split across chunks) and resolves the full text", async () => {
    const engine = createLlamaEngine({
      endpoint: "http://127.0.0.1:8080",
      streamFetchFn: async () =>
        fakeStream([
          'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n',
          "data: [DONE]\n\n",
        ]),
    });
    const tokens: string[] = [];
    const full = await engine.chatStream?.([{ role: "user", content: "hi" }], {
      onToken: (d) => tokens.push(d),
    });
    expect(tokens).toEqual(["Hel", "lo"]);
    expect(full).toBe("Hello");
  });

  it("throws on a non-ok response", async () => {
    const engine = createLlamaEngine({
      endpoint: "http://127.0.0.1:8080",
      streamFetchFn: async () => ({ ok: false, status: 500, text: async () => "boom", body: null }),
    });
    await expect(
      engine.chatStream?.([{ role: "user", content: "x" }], { onToken: () => undefined }),
    ).rejects.toThrow("500");
  });

  it("sends the bearer token + stream:true in the request", async () => {
    let sentBody = "";
    let sentAuth = "";
    const engine = createLlamaEngine({
      endpoint: "http://127.0.0.1:8080",
      apiKey: "secret",
      streamFetchFn: async (_url, init) => {
        sentBody = init.body;
        sentAuth = init.headers["Authorization"] ?? "";
        return fakeStream(["data: [DONE]\n\n"]);
      },
    });
    await engine.chatStream?.([{ role: "user", content: "hi" }], { onToken: () => undefined });
    expect(sentAuth).toBe("Bearer secret");
    expect(JSON.parse(sentBody)).toMatchObject({ stream: true });
  });
});

describe("withFallback.chatStream", () => {
  it("degrades to the fallback's single-shot reply when the primary stream fails", async () => {
    const flaky = createLlamaEngine({
      endpoint: "http://127.0.0.1:8080",
      streamFetchFn: async () => {
        throw new Error("server down");
      },
    });
    const engine = withFallback(flaky, stubInferenceEngine);
    const tokens: string[] = [];
    const full = await engine.chatStream?.([{ role: "user", content: "hi there" }], {
      onToken: (d) => tokens.push(d),
    });
    expect(full).toContain("stub reply");
    expect(tokens.join("")).toBe(full);
  });

  it("re-throws when the caller aborted (no silent degrade)", async () => {
    const controller = new AbortController();
    controller.abort();
    const flaky = createLlamaEngine({
      endpoint: "http://127.0.0.1:8080",
      streamFetchFn: async () => {
        throw new Error("aborted");
      },
    });
    const engine = withFallback(flaky, stubInferenceEngine);
    await expect(
      engine.chatStream?.([{ role: "user", content: "hi" }], {
        onToken: () => undefined,
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});
