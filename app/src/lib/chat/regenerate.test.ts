import { describe, it, expect } from "vitest";
import { truncateAfter, precedingUserMessage, toTurns } from "./regenerate";
import type { ChatMessage } from "@services/ports";

function msg(id: string, role: "user" | "assistant", content = id): ChatMessage {
  return { id, threadId: "t", role, content, createdAt: "2026-01-01T00:00:00Z" };
}

const convo = [msg("u1", "user"), msg("a1", "assistant"), msg("u2", "user"), msg("a2", "assistant")];

describe("truncateAfter", () => {
  it("drops everything after the target message", () => {
    expect(truncateAfter(convo, "u2").map((m) => m.id)).toEqual(["u1", "a1", "u2"]);
  });
  it("returns the input unchanged when the id is missing", () => {
    expect(truncateAfter(convo, "nope")).toHaveLength(4);
  });
});

describe("precedingUserMessage", () => {
  it("finds the user turn before an assistant message", () => {
    expect(precedingUserMessage(convo, "a2")?.id).toBe("u2");
  });
  it("returns undefined for the first message", () => {
    expect(precedingUserMessage(convo, "u1")).toBeUndefined();
  });
});

describe("toTurns", () => {
  it("maps to role/content only", () => {
    expect(toTurns([msg("u1", "user", "hi")])).toEqual([{ role: "user", content: "hi" }]);
  });
});
