// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  applyDictatedPunctuation,
  applyDictionary,
  detectAgent,
  expandSnippets,
  isClean,
  runPipeline,
  stripAgentName,
  type PipelineContext,
} from "./index";

/** BE1 — the pure text pipeline (Phase 1, T1.2). */

describe("isClean", () => {
  it.each([
    ["Hello there, how are you?", true],
    ["This is a clean sentence.", true],
    ["", true],
    ["um so like i dunno", false],
    ["no ending punctuation", false],
    ["the the duplicate word.", false],
    ["add a period here period", false],
  ])("isClean(%j) === %s", (text, expected) => {
    expect(isClean(text)).toBe(expected);
  });
});

describe("applyDictatedPunctuation", () => {
  it("attaches sentence punctuation to the preceding word", () => {
    expect(applyDictatedPunctuation("hello period")).toBe("hello.");
    expect(applyDictatedPunctuation("one comma two")).toBe("one, two");
    expect(applyDictatedPunctuation("really question mark")).toBe("really?");
  });

  it("turns spoken structure into newlines", () => {
    expect(applyDictatedPunctuation("line one new line line two")).toBe("line one\nline two");
    expect(applyDictatedPunctuation("para one new paragraph para two")).toBe("para one\n\npara two");
  });

  it("protects <keep> content and strips the tags", () => {
    expect(applyDictatedPunctuation("end period <keep>say the word period here</keep>")).toBe(
      "end. say the word period here",
    );
  });
});

describe("detectAgent / stripAgentName", () => {
  it("detects the agent address with optional lead words", () => {
    expect(detectAgent("Khonjel what's the time", "Khonjel")).toBe(true);
    expect(detectAgent("Hey Khonjel, do this", "Khonjel")).toBe(true);
    expect(detectAgent("this is just dictation", "Khonjel")).toBe(false);
    expect(detectAgent("anything", undefined)).toBe(false);
  });

  it("strips the leading address", () => {
    expect(stripAgentName("Hey Khonjel, create a note", "Khonjel")).toBe("create a note");
    expect(stripAgentName("Khonjel: search my notes", "Khonjel")).toBe("search my notes");
  });
});

describe("expandSnippets", () => {
  it("replaces triggers with expansions", () => {
    expect(expandSnippets("send to ;addr today", [{ trigger: ";addr", expansion: "1 Main St" }])).toBe(
      "send to 1 Main St today",
    );
  });
});

describe("applyDictionary", () => {
  it("applies substitution rules and ignores term hints", () => {
    const rules = [
      { type: "substitution" as const, trigger: "kubernetes", replacement: "Kubernetes" },
      { type: "term" as const, term: "Khonjel" },
    ];
    expect(applyDictionary("we deployed to kubernetes", rules)).toBe("we deployed to Kubernetes");
  });
});

describe("runPipeline", () => {
  const baseCtx = (over: Partial<PipelineContext> = {}): PipelineContext => ({
    dictionary: [],
    snippets: [],
    cleanupEnabled: true,
    refine: vi.fn(async (t: string) => `refined: ${t}`),
    ...over,
  });

  it("skips the LLM when the text is already clean", async () => {
    const ctx = baseCtx();
    const result = await runPipeline("This is already clean.", ctx);
    expect(ctx.refine).not.toHaveBeenCalled();
    expect(result).toEqual({ text: "This is already clean.", cleaned: false, mode: "dictation" });
  });

  it("refines messy text with the injected LLM", async () => {
    const ctx = baseCtx();
    const result = await runPipeline("um so like the the thing", ctx);
    expect(ctx.refine).toHaveBeenCalledOnce();
    expect(result.cleaned).toBe(true);
    expect(result.mode).toBe("dictation");
  });

  it("falls back to the deterministic text when the LLM throws", async () => {
    const ctx = baseCtx({ refine: vi.fn(async () => { throw new Error("model down"); }) });
    const result = await runPipeline("um so like the the thing period", ctx);
    expect(result.cleaned).toBe(true);
    expect(result.text).toBe("um so like the the thing.");
  });

  it("routes to the agent when addressed by name", async () => {
    const runAgent = vi.fn(async () => "Here is your answer.");
    const ctx = baseCtx({ agentName: "Khonjel", runAgent });
    const result = await runPipeline("Khonjel, what's on my calendar", ctx);
    expect(runAgent).toHaveBeenCalledWith("what's on my calendar");
    expect(result).toEqual({ text: "Here is your answer.", cleaned: true, mode: "agent" });
  });

  it("does not refine when cleanup is disabled", async () => {
    const ctx = baseCtx({ cleanupEnabled: false });
    const result = await runPipeline("um messy text", ctx);
    expect(ctx.refine).not.toHaveBeenCalled();
    expect(result.cleaned).toBe(false);
  });

  it("expands snippets in the final output", async () => {
    const ctx = baseCtx({ snippets: [{ trigger: ";sig", expansion: "Best, Sam" }] });
    const result = await runPipeline("Thanks ;sig", ctx);
    expect(result.text).toContain("Best, Sam");
  });
});
