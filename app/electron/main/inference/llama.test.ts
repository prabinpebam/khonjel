// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  buildLlamaChatBody,
  parseLlamaChatResponse,
  createLlamaEngine,
  withFallback,
  type HttpFetch,
} from "./llama";
import { stubInferenceEngine } from "../services/inference";

describe("buildLlamaChatBody", () => {
  it("builds an OpenAI-compatible system+user message body", () => {
    const body = buildLlamaChatBody({ systemPrompt: "S", userText: "U" });
    expect(body.messages).toEqual([
      { role: "system", content: "S" },
      { role: "user", content: "U" },
    ]);
    expect(body.stream).toBe(false);
  });
});

describe("parseLlamaChatResponse", () => {
  it("extracts and trims the assistant message", () => {
    expect(parseLlamaChatResponse({ choices: [{ message: { content: "  hi  " } }] })).toBe("hi");
  });

  it("throws when there is no completion text", () => {
    expect(() => parseLlamaChatResponse({ choices: [] })).toThrow();
    expect(() => parseLlamaChatResponse({})).toThrow();
  });
});

describe("createLlamaEngine", () => {
  it("POSTs to /v1/chat/completions with the resolved system prompt and returns the completion", async () => {
    let calledUrl = "";
    let calledBody = "";
    const fetchFn: HttpFetch = async (url, init) => {
      calledUrl = url;
      calledBody = init.body;
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "Cleaned." } }] }),
        text: async () => "",
      };
    };
    const engine = createLlamaEngine({
      endpoint: "http://127.0.0.1:8080/",
      fetchFn,
      resolvePromptFn: () => "SYS",
    });
    const out = await engine.refine("raw text");
    expect(out).toBe("Cleaned.");
    expect(calledUrl).toBe("http://127.0.0.1:8080/v1/chat/completions");
    const parsed = JSON.parse(calledBody) as { messages: { role: string; content: string }[] };
    expect(parsed.messages[0]).toEqual({ role: "system", content: "SYS" });
    expect(parsed.messages[1]).toEqual({ role: "user", content: "raw text" });
  });

  it("rejects on a non-ok response", async () => {
    const fetchFn: HttpFetch = async () => ({
      ok: false,
      status: 500,
      json: async () => ({}),
      text: async () => "boom",
    });
    const engine = createLlamaEngine({ endpoint: "http://x", fetchFn });
    await expect(engine.refine("x")).rejects.toThrow(/500/);
  });
});

describe("withFallback", () => {
  it("uses the primary engine when it succeeds", async () => {
    const primary = { refine: async () => "PRIMARY" };
    const out = await withFallback(primary, stubInferenceEngine).refine("um the the thing");
    expect(out).toBe("PRIMARY");
  });

  it("falls back to deterministic cleanup when the primary throws", async () => {
    const primary = {
      refine: async () => {
        throw new Error("server down");
      },
    };
    const out = await withFallback(primary, stubInferenceEngine).refine("um so the the thing");
    expect(out).toBe("So the thing.");
  });
});
