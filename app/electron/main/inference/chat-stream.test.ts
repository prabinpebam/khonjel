/**
 * BE-tested chat-streaming helpers (PURE + a small stateful queue).
 *
 * `parseSseBuffer` / `buildLlamaStreamBody` shape llama-server's streaming
 * `/v1/chat/completions` (Server-Sent Events) into token deltas; `trimToBudget` keeps a chat within
 * the model's context window; `createSerialQueue` serializes local generations (one at a time) so a
 * single-slot llama-server is never asked to run two completions concurrently. See 06 chat spec.
 */
import { describe, expect, it } from "vitest";
import {
  buildLlamaStreamBody,
  parseSseBuffer,
  trimToBudget,
  createSerialQueue,
} from "./chat-stream";
import type { EngineMessage } from "../services/inference";

describe("buildLlamaStreamBody", () => {
  it("sets stream:true and carries the messages + options", () => {
    const body = buildLlamaStreamBody([{ role: "user", content: "hi" }], {
      model: "local",
      temperature: 0.4,
      maxTokens: 256,
    });
    expect(body).toMatchObject({
      stream: true,
      model: "local",
      temperature: 0.4,
      max_tokens: 256,
      messages: [{ role: "user", content: "hi" }],
    });
  });
});

describe("parseSseBuffer", () => {
  it("extracts a single content delta and leaves no remainder", () => {
    const { deltas, rest } = parseSseBuffer(
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
    );
    expect(deltas).toEqual([{ content: "Hello", done: false }]);
    expect(rest).toBe("");
  });

  it("extracts multiple deltas from one buffer", () => {
    const { deltas } = parseSseBuffer(
      'data: {"choices":[{"delta":{"content":"a"}}]}\n\n' +
        'data: {"choices":[{"delta":{"content":"b"}}]}\n\n',
    );
    expect(deltas.map((d) => d.content)).toEqual(["a", "b"]);
  });

  it("keeps a partial trailing event in rest", () => {
    const { deltas, rest } = parseSseBuffer(
      'data: {"choices":[{"delta":{"content":"x"}}]}\n\ndata: {"choices":[{"delta":{"con',
    );
    expect(deltas).toEqual([{ content: "x", done: false }]);
    expect(rest).toBe('data: {"choices":[{"delta":{"con');
  });

  it("treats [DONE] as a terminal event", () => {
    const { deltas } = parseSseBuffer("data: [DONE]\n\n");
    expect(deltas).toEqual([{ content: "", done: true }]);
  });

  it("treats a finish_reason as terminal", () => {
    const { deltas } = parseSseBuffer(
      'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
    );
    expect(deltas.some((d) => d.done)).toBe(true);
  });

  it("normalizes CRLF line endings", () => {
    const { deltas } = parseSseBuffer(
      'data: {"choices":[{"delta":{"content":"q"}}]}\r\n\r\n',
    );
    expect(deltas).toEqual([{ content: "q", done: false }]);
  });

  it("ignores malformed keepalive lines", () => {
    const { deltas, rest } = parseSseBuffer(": keep-alive\n\n");
    expect(deltas).toEqual([]);
    expect(rest).toBe("");
  });
});

describe("trimToBudget", () => {
  const sys: EngineMessage = { role: "system", content: "SYS" };
  const turns: EngineMessage[] = [
    { role: "user", content: "aaaa" },
    { role: "assistant", content: "bbbb" },
    { role: "user", content: "cccc" },
  ];

  it("keeps everything under a generous budget", () => {
    expect(trimToBudget([sys, ...turns], 1000)).toEqual([sys, ...turns]);
  });

  it("keeps the system message + only the most recent turns that fit", () => {
    // budget 8 chars after SYS(3): keeps "cccc" (4) then stops before "bbbb".
    const out = trimToBudget([sys, ...turns], 8);
    expect(out[0]).toEqual(sys);
    expect(out[out.length - 1]).toEqual({ role: "user", content: "cccc" });
    expect(out).not.toContainEqual({ role: "user", content: "aaaa" });
  });

  it("always keeps at least the most recent turn even if over budget", () => {
    const out = trimToBudget([sys, ...turns], 1);
    expect(out).toEqual([sys, { role: "user", content: "cccc" }]);
  });

  it("works without a system message", () => {
    expect(trimToBudget(turns, 1000)).toEqual(turns);
  });

  it("returns empty for empty input", () => {
    expect(trimToBudget([], 100)).toEqual([]);
  });
});

describe("createSerialQueue", () => {
  it("runs tasks in FIFO order", async () => {
    const queue = createSerialQueue();
    const order: number[] = [];
    const tick = (n: number, ms: number) =>
      queue.enqueue(
        () =>
          new Promise<void>((resolve) => {
            setTimeout(() => {
              order.push(n);
              resolve();
            }, ms);
          }),
      );
    // First enqueued sleeps longer; FIFO must still finish it first.
    const a = tick(1, 20);
    const b = tick(2, 1);
    await Promise.all([a, b]);
    expect(order).toEqual([1, 2]);
  });

  it("keeps running after a task rejects", async () => {
    const queue = createSerialQueue();
    const failed = queue.enqueue(() => Promise.reject(new Error("boom")));
    await expect(failed).rejects.toThrow("boom");
    const ok = await queue.enqueue(() => Promise.resolve("ok"));
    expect(ok).toBe("ok");
  });
});
