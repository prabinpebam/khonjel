/**
 * Chat-streaming helpers for the local llama-server (PURE shaping + a small serial queue).
 *
 * Khonjel streams chat replies from llama-server's OpenAI-compatible `/v1/chat/completions` with
 * `stream:true`, which emits Server-Sent Events (`data: {json}\n\n`, terminated by `data: [DONE]`).
 * The transport lives in llama.ts; the shaping + parsing here is BE-tested without a server. See the
 * 06 chat spec (threads + streaming) and inference/llama.ts.
 */
import type { EngineMessage } from "../services/inference";
import { buildLlamaBody } from "./llama";

/** PURE: a streaming chat body (same shape as buildLlamaBody but with stream:true). */
export function buildLlamaStreamBody(
  messages: EngineMessage[],
  opts: { model?: string; temperature?: number; maxTokens?: number } = {},
): Record<string, unknown> {
  return { ...buildLlamaBody(messages, opts), stream: true };
}

/** One streamed token (or a terminal marker when `done`). */
export interface SseDelta {
  content: string;
  done: boolean;
}

/**
 * PURE incremental SSE parser. Given the bytes decoded so far, return the complete token deltas it
 * contains plus the unparsed remainder (a partial trailing event) to prepend to the next chunk.
 */
export function parseSseBuffer(buffer: string): { deltas: SseDelta[]; rest: string } {
  const deltas: SseDelta[] = [];
  let rest = buffer.replace(/\r\n/g, "\n");
  let boundary = rest.indexOf("\n\n");
  while (boundary !== -1) {
    const rawEvent = rest.slice(0, boundary);
    rest = rest.slice(boundary + 2);
    for (const line of rawEvent.split("\n")) {
      const trimmed = line.replace(/^\s+/, "");
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload.length === 0) continue;
      if (payload === "[DONE]") {
        deltas.push({ content: "", done: true });
        continue;
      }
      try {
        const json = JSON.parse(payload) as {
          choices?: { delta?: { content?: unknown }; finish_reason?: unknown }[];
        };
        const choice = json.choices?.[0];
        const content = choice?.delta?.content;
        if (typeof content === "string" && content.length > 0) {
          deltas.push({ content, done: false });
        }
        if (choice?.finish_reason != null) deltas.push({ content: "", done: true });
      } catch {
        // Malformed/keepalive line: ignore (server may emit comments or partial JSON).
      }
    }
    boundary = rest.indexOf("\n\n");
  }
  return { deltas, rest };
}

/**
 * PURE: keep a leading `system` message plus as many of the most-recent turns as fit under
 * `maxChars` (a coarse proxy for the context window). The most recent turn is always kept so a
 * single long message still gets a reply rather than an empty prompt.
 */
export function trimToBudget(messages: EngineMessage[], maxChars: number): EngineMessage[] {
  if (messages.length === 0) return [];
  const first = messages[0];
  const hasSystem = first !== undefined && first.role === "system";
  const system = hasSystem ? first : undefined;
  const turns = hasSystem ? messages.slice(1) : messages;
  const kept: EngineMessage[] = [];
  let total = system ? system.content.length : 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const msg = turns[i];
    if (msg === undefined) continue;
    if (kept.length > 0 && total + msg.content.length > maxChars) break;
    kept.unshift(msg);
    total += msg.content.length;
  }
  return system ? [system, ...kept] : kept;
}

/** A FIFO queue that runs async tasks one at a time (a rejection never stalls the chain). */
export interface SerialQueue {
  enqueue: <T>(task: () => Promise<T>) => Promise<T>;
}

export function createSerialQueue(): SerialQueue {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    enqueue: <T>(task: () => Promise<T>): Promise<T> => {
      const run = tail.then(task, task);
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}
