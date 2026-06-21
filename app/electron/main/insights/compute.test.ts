// @vitest-environment node
import { describe, it, expect } from "vitest";
import { computeInsights, computeStreak } from "./compute";
import type { HistoryEntry } from "../../../src/services/ports";

function entry(over: Partial<HistoryEntry>): HistoryEntry {
  return {
    id: Math.random().toString(36).slice(2),
    createdAt: "2026-06-01T10:00:00.000Z",
    finalText: "hi",
    app: "Slack",
    language: "en-US",
    wordCount: 10,
    durationSec: 30,
    mode: "dictation",
    hasAudio: false,
    cleanupApplied: false,
    ...over,
  };
}

describe("computeStreak", () => {
  it("returns zero for no days", () => {
    expect(computeStreak([])).toEqual({ current: 0, longest: 0 });
  });
  it("computes current and longest consecutive-day streaks", () => {
    // a 3-day run, gap, then a 2-day run ending last
    const days = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-06", "2026-06-07"];
    expect(computeStreak(days)).toEqual({ current: 2, longest: 3 });
  });
  it("dedupes multiple entries on the same day", () => {
    expect(computeStreak(["2026-06-01", "2026-06-01", "2026-06-02"])).toEqual({ current: 2, longest: 2 });
  });
});

describe("computeInsights", () => {
  it("computes totals and WPM from word counts and durations", () => {
    const result = computeInsights([
      entry({ wordCount: 60, durationSec: 60 }),
      entry({ wordCount: 30, durationSec: 30 }),
    ]);
    expect(result.totalWords).toBe(90);
    expect(result.wpm).toBe(60); // 90 words over 90s = 1.5 wps = 60 wpm
  });

  it("counts cleaned dictations and groups app usage", () => {
    const result = computeInsights([
      entry({ app: "Slack", cleanupApplied: true }),
      entry({ app: "Slack" }),
      entry({ app: "VS Code", cleanupApplied: true }),
    ]);
    expect(result.wordsCorrected).toBe(2);
    expect(result.appUsage[0]).toEqual({ category: "Slack", count: 2, pct: 67 });
  });

  it("builds a per-day heatmap", () => {
    const result = computeInsights([
      entry({ createdAt: "2026-06-01T09:00:00.000Z" }),
      entry({ createdAt: "2026-06-01T12:00:00.000Z" }),
      entry({ createdAt: "2026-06-02T09:00:00.000Z" }),
    ]);
    expect(result.heatmap).toEqual([
      { date: "2026-06-01", count: 2 },
      { date: "2026-06-02", count: 1 },
    ]);
  });

  it("handles an empty history", () => {
    const result = computeInsights([]);
    expect(result).toMatchObject({ wpm: 0, totalWords: 0, appUsage: [], heatmap: [] });
    expect(result.streak).toEqual({ current: 0, longest: 0 });
  });
});
