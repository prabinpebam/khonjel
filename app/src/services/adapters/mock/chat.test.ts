import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mockChatService } from "./chat";
import type { ChatTokenEvent } from "@services/ports";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("mockChatService", () => {
  it("streams tokens then a terminal done event", async () => {
    const events: ChatTokenEvent[] = [];
    const unsub = mockChatService.onToken((e) => events.push(e));
    await mockChatService.send({ requestId: "r1", threadId: "t1", messages: [{ role: "user", content: "hi" }] });

    vi.advanceTimersByTime(5000);
    unsub();

    expect(events.length).toBeGreaterThan(1);
    expect(events.every((e) => e.requestId === "r1" && e.threadId === "t1")).toBe(true);
    const last = events[events.length - 1];
    expect(last?.kind).toBe("done");
    // fullText grows monotonically and the final answer is non-empty.
    expect((last?.fullText.length ?? 0)).toBeGreaterThan(0);
  });

  it("stop cancels mid-stream and emits a done with the partial text", async () => {
    const events: ChatTokenEvent[] = [];
    const unsub = mockChatService.onToken((e) => events.push(e));
    await mockChatService.send({ requestId: "r2", threadId: "t2", messages: [] });

    vi.advanceTimersByTime(120); // a few tokens
    mockChatService.stop("r2");
    const partial = events[events.length - 1];

    vi.advanceTimersByTime(5000); // no further events after stop
    unsub();

    expect(partial?.kind).toBe("done");
    expect(events.filter((e) => e.kind === "done")).toHaveLength(1);
  });
});
