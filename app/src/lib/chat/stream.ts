import type { ChatTokenEvent } from "@services/ports";

export interface StreamState {
  /** The visible answer (reasoning stripped out). */
  fullText: string;
  /** Accumulated reasoning / chain-of-thought (the content of a <think> block). */
  reasoning: string;
  status: "streaming" | "complete" | "stopped" | "error";
  error?: string;
}

export function initialStreamState(): StreamState {
  return { fullText: "", reasoning: "", status: "streaming" };
}

/**
 * Split a (possibly partial) completion into reasoning + answer. Reasoning models emit a
 * `<think>...</think>` block before the answer; while still streaming the block may be unclosed.
 */
export function splitReasoning(text: string): { reasoning: string; answer: string } {
  const open = text.indexOf("<think>");
  if (open === -1) return { reasoning: "", answer: text };
  const close = text.indexOf("</think>", open + 7);
  if (close === -1) {
    // Still inside the reasoning block: nothing to show as the answer yet.
    return { reasoning: text.slice(open + 7).trimStart(), answer: text.slice(0, open).trimStart() };
  }
  const reasoning = text.slice(open + 7, close).trim();
  const answer = (text.slice(0, open) + text.slice(close + 8)).trim();
  return { reasoning, answer };
}

/** Fold a streamed token event into the running stream state (pure). */
export function applyTokenEvent(state: StreamState, event: ChatTokenEvent): StreamState {
  if (event.kind === "error") {
    return { ...state, status: "error", error: event.error ?? "Generation failed." };
  }
  const { reasoning, answer } = splitReasoning(event.fullText);
  if (event.kind === "done") {
    return {
      ...state,
      fullText: answer,
      reasoning,
      status: state.status === "streaming" ? "complete" : state.status,
    };
  }
  return { ...state, fullText: answer, reasoning };
}
