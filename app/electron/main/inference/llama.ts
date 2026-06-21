/**
 * llama.cpp inference engine (child-process / HTTP wrapper).
 *
 * Khonjel talks to a local **llama-server** (the prebuilt llama.cpp HTTP server) over its
 * OpenAI-compatible `/v1/chat/completions` endpoint, rather than linking a native node module.
 * This sidesteps the Electron/Node ABI problem entirely: the binary is a standalone executable
 * managed as a child process (see ./llama-server.ts), and this module is just an HTTP client.
 *
 * The request/response shaping is PURE (BE1-tested); the HTTP transport is injected so the engine
 * is unit-tested without a running server. The composition root wires the real `fetch` + a
 * deterministic fallback so a missing/down model never blocks the user (the pipeline also guards).
 * See backend/03 SS4 + 10 (local inference) and inference/prompts.ts for the system prompts.
 */
import type { InferenceEngine } from "../services/inference";
import { resolvePrompt } from "./prompts";

export interface LlamaChatOptions {
  systemPrompt: string;
  userText: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

/** PURE: the OpenAI-compatible chat body llama-server accepts at /v1/chat/completions. */
export function buildLlamaChatBody(opts: LlamaChatOptions): Record<string, unknown> {
  return {
    model: opts.model ?? "local",
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userText },
    ],
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 512,
    stream: false,
  };
}

/** PURE: extract the assistant message text from a llama-server chat completion response. */
export function parseLlamaChatResponse(json: unknown): string {
  const content = (json as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message
    ?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("llama-server returned no completion text");
  }
  return content.trim();
}

/** Minimal HTTP surface so the transport (real `fetch` or a test fake) is injectable. */
export interface HttpResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}
export type HttpFetch = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<HttpResponse>;

export interface LlamaEngineOptions {
  /** Base URL of the running llama-server, e.g. http://127.0.0.1:8080 */
  endpoint: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Injected for tests; defaults to the global fetch. */
  fetchFn?: HttpFetch;
  /** Injected for tests; defaults to the shared prompt resolver. */
  resolvePromptFn?: typeof resolvePrompt;
}

async function chat(opts: LlamaEngineOptions, systemPrompt: string, userText: string): Promise<string> {
  const fetchFn = opts.fetchFn ?? (globalThis as unknown as { fetch: HttpFetch }).fetch;
  const url = `${opts.endpoint.replace(/\/+$/, "")}/v1/chat/completions`;
  const res = await fetchFn(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(
      buildLlamaChatBody({
        systemPrompt,
        userText,
        model: opts.model,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      }),
    ),
  });
  if (!res.ok) {
    throw new Error(`llama-server error ${res.status}: ${await res.text()}`);
  }
  return parseLlamaChatResponse(await res.json());
}

/** A real LLM engine backed by a local llama-server. `refine`/`runAgent` use Khonjel's prompts. */
export function createLlamaEngine(opts: LlamaEngineOptions): InferenceEngine {
  const resolve = opts.resolvePromptFn ?? resolvePrompt;
  return {
    refine: (text) => chat(opts, resolve("cleanup"), text),
    runAgent: (instruction) => chat(opts, resolve("voiceAgent"), instruction),
  };
}

/**
 * Wrap a primary engine so any failure (server down, model missing, timeout) silently falls back
 * to a secondary engine -- the deterministic stub -- instead of throwing. This keeps cleanup at
 * "deterministic" quality (filler removal, capitalization) even with no model, and upgrades to LLM
 * quality when the server is up. `refine` therefore never rejects.
 */
export function withFallback(primary: InferenceEngine, fallback: InferenceEngine): InferenceEngine {
  return {
    refine: async (text) => {
      try {
        return await primary.refine(text);
      } catch {
        return fallback.refine(text);
      }
    },
    runAgent: async (instruction) => {
      try {
        if (primary.runAgent) return await primary.runAgent(instruction);
      } catch {
        // fall through to the fallback engine
      }
      return fallback.runAgent ? fallback.runAgent(instruction) : instruction;
    },
  };
}
