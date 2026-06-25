import { describe, it, expect } from "vitest";
import { deriveThreadTitle, chatTitlePrompt, cleanTitle, titleFromPrompt } from "./title";

describe("deriveThreadTitle", () => {
  it("takes the first six words", () => {
    expect(deriveThreadTitle("Please help me plan my week ahead today")).toBe(
      "Please help me plan my week",
    );
  });
  it("falls back to 'New chat' for empty input", () => {
    expect(deriveThreadTitle("   ")).toBe("New chat");
  });
  it("caps very long input with an ellipsis", () => {
    const out = deriveThreadTitle("x".repeat(80));
    expect(out.length).toBeLessThanOrEqual(48);
    expect(out.endsWith("\u2026")).toBe(true);
  });
});

describe("chatTitlePrompt", () => {
  it("produces a single user turn including the conversation", () => {
    const turns = chatTitlePrompt([
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
    ]);
    expect(turns).toHaveLength(1);
    expect(turns[0]?.role).toBe("user");
    expect(turns[0]?.content).toContain("User: hi");
    expect(turns[0]?.content).toContain("Assistant: hello");
  });
});

describe("cleanTitle", () => {
  it("strips wrapping quotes, a trailing period, and newlines", () => {
    expect(cleanTitle('"My great title."')).toBe("My great title");
    expect(cleanTitle("Line\nbreak")).toBe("Line break");
  });
  it("returns empty for blank input", () => {
    expect(cleanTitle("  ")).toBe("");
  });
});

describe("titleFromPrompt", () => {
  it("derives a concise title from a titling request's conversation", () => {
    const prompt = chatTitlePrompt([{ role: "user", content: "Plan a quiet weekend away" }])[0]!.content;
    expect(titleFromPrompt(prompt)).toBe("Plan a quiet weekend away");
  });
  it("returns null for a non-titling prompt", () => {
    expect(titleFromPrompt("What is the capital of France?")).toBeNull();
  });
  it("falls back to a default when the request has no user line", () => {
    expect(titleFromPrompt("Write a short, specific title for this conversation.")).toBe("New chat");
  });
});
