import type { CleanupResult, InferenceService } from "@services/ports";

/**
 * Mock inference service — a lightweight deterministic cleanup standing in for the real pipeline +
 * LLM (which run in main under Electron). Mirrors the contract behaviours BE3 checks: already-clean
 * text skips cleanup; messy text is tidied and marked cleaned.
 */
export const mockInferenceService: InferenceService = {
  async cleanup(input, options = {}) {
    const trimmed = input.trim();
    const looksClean = /^[A-Z].*[.!?]$/.test(trimmed);
    if (options.cleanupEnabled === false || looksClean) {
      return { text: trimmed, cleaned: false, mode: "dictation" } satisfies CleanupResult;
    }
    let text = trimmed.replace(/\b(um+|uh+)\b/gi, "").replace(/\s+/g, " ").trim();
    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
      if (!/[.!?]$/.test(text)) text += ".";
    }
    return { text, cleaned: true, mode: "dictation" } satisfies CleanupResult;
  },
  async chat(messages) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    return {
      text: `This is a mock reply. Connect a real model in Settings -> Language Models -> Chat. You said: "${lastUser?.content ?? ""}"`,
    };
  },
};
