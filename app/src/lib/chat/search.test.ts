import { describe, it, expect } from "vitest";
import { excerpt, searchThreads, splitHighlight } from "./search";
import type { ChatMessage, ChatThread } from "@services/ports";

const thread = (id: string, title: string): ChatThread => ({
  id,
  title,
  createdAt: "",
  updatedAt: "",
  titleStatus: "auto",
});
const msg = (id: string, threadId: string, content: string): ChatMessage => ({
  id,
  threadId,
  role: "user",
  content,
  createdAt: "",
});

describe("excerpt", () => {
  it("centers a window on the match with ellipses", () => {
    const out = excerpt("the quick brown fox jumps over the lazy dog", "fox", 5);
    expect(out.startsWith("\u2026")).toBe(true);
    expect(out.endsWith("\u2026")).toBe(true);
    expect(out.toLowerCase()).toContain("fox");
  });
  it("collapses whitespace and omits leading ellipsis at the start", () => {
    expect(excerpt("hello   world", "hello", 40)).toBe("hello world");
  });
  it("falls back to the head when there is no match", () => {
    expect(excerpt("abcdef", "zzz", 2)).toBe("abcd");
  });
});

describe("searchThreads", () => {
  const threads = [thread("t1", "Design review summary"), thread("t2", "Trip to Japan")];
  const messages = [
    msg("m1", "t1", "Charts use teal exclusively."),
    msg("m2", "t2", "Book flights and a ryokan."),
  ];

  it("returns every thread (no snippet) for a blank query", () => {
    const out = searchThreads(threads, messages, "  ");
    expect(out.map((r) => r.thread.id)).toEqual(["t1", "t2"]);
    expect(out.every((r) => r.snippet === undefined)).toBe(true);
  });

  it("matches a thread title without a snippet", () => {
    const out = searchThreads(threads, messages, "japan");
    expect(out.map((r) => r.thread.id)).toEqual(["t2"]);
    expect(out[0]?.snippet).toBeUndefined();
  });

  it("matches message content and returns a snippet", () => {
    const out = searchThreads(threads, messages, "teal");
    expect(out.map((r) => r.thread.id)).toEqual(["t1"]);
    expect(out[0]?.snippet?.toLowerCase()).toContain("teal");
  });

  it("excludes threads that match neither title nor content", () => {
    expect(searchThreads(threads, messages, "zzz")).toEqual([]);
  });
});

describe("splitHighlight", () => {
  it("splits around a match (case-insensitive)", () => {
    expect(splitHighlight("Design review", "design")).toEqual([
      { text: "Design", hit: true },
      { text: " review", hit: false },
    ]);
  });
  it("flags every occurrence", () => {
    expect(splitHighlight("aXaXa", "x").filter((p) => p.hit)).toHaveLength(2);
  });
  it("returns a single non-hit segment for a blank query", () => {
    expect(splitHighlight("hello", "  ")).toEqual([{ text: "hello", hit: false }]);
  });
});
