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
import type { ProviderRouter } from "../providers/router";
import { titleFromPrompt } from "../../../src/lib/chat/title";

/** A single chat message at the engine layer (includes the system role). */
export interface EngineMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Callbacks for a streamed chat completion: a per-token sink + an optional cancellation signal. */
export interface ChatStreamHandlers {
  onToken: (delta: string) => void;
  signal?: AbortSignal;
}

export interface InferenceEngine {
  /** STAGE 3 LLM cleanup. */
  refine: (text: string) => Promise<string>;
  /** Instruction-mode agent (Phase 5 wires the real tool-calling agent). */
  runAgent?: (instruction: string) => Promise<string>;
  /** Multi-turn chat completion (optional; absent on minimal engines). */
  chat?: (messages: EngineMessage[]) => Promise<string>;
  /** Streaming multi-turn chat: fires `onToken` per delta and resolves with the full text. */
  chatStream?: (messages: EngineMessage[], handlers: ChatStreamHandlers) => Promise<string>;
}

export interface InferenceServiceImpl {
  cleanup: (input: string, options?: CleanupOptions) => Promise<CleanupResult>;
  chat: (messages: { role: "user" | "assistant"; content: string }[]) => Promise<{ text: string }>;
}

/** Cleanup token budget: generous so reasoning models (whose reasoning tokens count against the
 *  budget) are not truncated to nothing; still bounded (backend/10 SS4). */
function cleanupMaxTokens(text: string): number {
  return Math.min(8192, Math.max(1024, text.length * 4));
}

export function createInferenceService(
  engine: InferenceEngine,
  router?: ProviderRouter,
): InferenceServiceImpl {
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
        // Stage 3: a cloud-bound `llm.cleanup` slot refines remotely; otherwise the local engine.
        // Cloud failure on this hot path silently falls back to local cleanup (never blocks).
        refine: async (text) => {
          try {
            const cloud = await router?.completeForSlot(
              "llm.cleanup",
              [
                { role: "system", content: resolvePrompt("cleanup") },
                { role: "user", content: text },
              ],
              { maxTokens: cleanupMaxTokens(text) },
            );
            if (cloud != null) return cloud;
          } catch {
            // fall through to the local engine
          }
          return engine.refine(text);
        },
        runAgent: engine.runAgent,
      });

      return { text: result.text, cleaned: result.cleaned, mode: result.mode };
    },
    chat: async (messages) => {
      const full: EngineMessage[] = [
        { role: "system", content: resolvePrompt("chat") },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];
      // A cloud-bound `llm.chat` slot answers remotely (errors surface as IpcError); else local.
      // 16384 matches Microsoft's gpt-5.x example and leaves room for reasoning tokens.
      const cloud = await router?.completeForSlot("llm.chat", full, { maxTokens: 16384 });
      if (cloud != null) return { text: cloud };
      if (!engine.chat) {
        return {
          text: "No chat model is configured. Connect one in Settings -> Language Models -> Chat, or download a local model.",
        };
      }
      return { text: await engine.chat(full) };
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
    const prompt = lastUser?.content ?? "";
    // A titling request still gets a sensible derived title (not an echo) with no model installed.
    const title = titleFromPrompt(prompt);
    if (title != null) return title;
    return `(local stub reply) ${prompt}`.trim();
  },
};
