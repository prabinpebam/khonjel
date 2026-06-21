/**
 * Inference domain service (main process): runs the deterministic-then-LLM cleanup pipeline.
 *
 * The LLM `engine` is INJECTED. Today it is a deterministic stub (`stubInferenceEngine`); the real
 * engine (llama.cpp / a provider via the inference router) plugs into the SAME interface in the
 * Phase 1 runtime without touching this service or the pipeline. See backend/03 §4 + 10.
 */
import type { CleanupOptions, CleanupResult } from "../../../src/services/ports";
import { runPipeline } from "../pipeline/index";
import type { DictionaryRule, SnippetRule } from "../pipeline/types";
import { resolvePrompt } from "../inference/prompts";

/** A single chat message at the engine layer (includes the system role). */
export interface EngineMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface InferenceEngine {
  /** STAGE 3 LLM cleanup. */
  refine: (text: string) => Promise<string>;
  /** Instruction-mode agent (Phase 5 wires the real tool-calling agent). */
  runAgent?: (instruction: string) => Promise<string>;
  /** Multi-turn chat completion (optional; absent on minimal engines). */
  chat?: (messages: EngineMessage[]) => Promise<string>;
}

export interface InferenceServiceImpl {
  cleanup: (input: string, options?: CleanupOptions) => Promise<CleanupResult>;
  chat: (messages: { role: "user" | "assistant"; content: string }[]) => Promise<{ text: string }>;
}

export function createInferenceService(engine: InferenceEngine): InferenceServiceImpl {
  return {
    cleanup: async (input, options = {}) => {
      const dictionary: DictionaryRule[] = (options.dictionary ?? []).map((entry) => ({
        type: entry.type,
        trigger: entry.trigger,
        replacement: entry.replacement,
        term: entry.term,
      }));
      const snippets: SnippetRule[] = (options.snippets ?? []).map((snippet) => ({
        trigger: snippet.trigger,
        expansion: snippet.expansion,
      }));

      const result = await runPipeline(input, {
        dictionary,
        snippets,
        agentName: options.agentName,
        cleanupEnabled: options.cleanupEnabled ?? true,
        refine: engine.refine,
        runAgent: engine.runAgent,
      });

      return { text: result.text, cleaned: result.cleaned, mode: result.mode };
    },
    chat: async (messages) => {
      if (!engine.chat) {
        return {
          text: "No chat model is configured. Connect one in Settings -> Language Models -> Chat, or download a local model.",
        };
      }
      const full: EngineMessage[] = [
        { role: "system", content: resolvePrompt("chat") },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      const text = await engine.chat(full);
      return { text };
    },
  };
}

/**
 * Deterministic placeholder for the real LLM cleanup. Removes simple fillers, collapses
 * whitespace, capitalizes, and ensures end punctuation — enough for the seam + EDD to work today.
 * Replaced by the real engine (same `InferenceEngine` shape) when STT/LLM land in the runtime.
 */
export const stubInferenceEngine: InferenceEngine = {
  refine: async (text) => {
    let cleaned = text
      .replace(/\b(um+|uh+|erm+)\b/gi, "")
      .replace(/\b(\w+)\s+\1\b/gi, "$1")
      .replace(/\s+/g, " ")
      .replace(/\s+([.,!?;:])/g, "$1")
      .trim();
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
      if (!/[.!?]$/.test(cleaned)) cleaned += ".";
    }
    return cleaned;
  },
  runAgent: async (instruction) => `(stub agent) You said: ${instruction}`,
  chat: async (messages) => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    return `(local stub reply) ${lastUser?.content ?? ""}`.trim();
  },
};
