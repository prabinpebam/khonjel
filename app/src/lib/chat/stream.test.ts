import { describe, it, expect } from "vitest";
import { initialStreamState, splitReasoning, applyTokenEvent } from "./stream";
import type { ChatTokenEvent } from "@services/ports";

function ev(over: Partial<ChatTokenEvent>): ChatTokenEvent {
  return { requestId: "r", threadId: "t", kind: "token", delta: "", fullText: "", ...over };
}

describe("splitReasoning", () => {
  it("returns the text as the answer when there is no think block", () => {
    expect(splitReasoning("hello")).toEqual({ reasoning: "", answer: "hello" });
  });
  it("extracts a closed think block", () => {
    expect(splitReasoning("<think>because</think>The answer")).toEqual({
      reasoning: "because",
      answer: "The answer",
    });
  });
  it("treats an unclosed think block as reasoning-only", () => {
    expect(splitReasoning("<think>still thinking")).toEqual({
      reasoning: "still thinking",
      answer: "",
    });
  });
});

describe("applyTokenEvent", () => {
  it("accumulates the answer from fullText while streaming", () => {
    const s = applyTokenEvent(initialStreamState(), ev({ fullText: "Hel" }));
    expect(s.fullText).toBe("Hel");
    expect(s.status).toBe("streaming");
  });
  it("completes on done", () => {
    const s = applyTokenEvent(initialStreamState(), ev({ kind: "done", fullText: "Done" }));
    expect(s.status).toBe("complete");
    expect(s.fullText).toBe("Done");
  });
  it("captures errors", () => {
    const s = applyTokenEvent(initialStreamState(), ev({ kind: "error", error: "boom" }));
    expect(s.status).toBe("error");
    expect(s.error).toBe("boom");
  });
  it("separates reasoning from the answer", () => {
    const s = applyTokenEvent(initialStreamState(), ev({ fullText: "<think>hm</think>Hi" }));
    expect(s.reasoning).toBe("hm");
    expect(s.fullText).toBe("Hi");
  });
});
