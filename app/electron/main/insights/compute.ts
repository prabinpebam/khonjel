/**
 * Insights aggregation — computes the Insights dashboard metrics from history ON READ (the
 * local-compute design; never a network call). PURE + BE1-tested. The cleanly-derivable metrics
 * (totalWords, WPM, app usage, streak, heatmap) are exact; `wpmPercentile` is a documented
 * heuristic and `wordsCorrected` a cleanup-count proxy until per-entry correction counts exist.
 * See backend/07 §C + 09 §3 ("aggregates computed on read").
 */
import type { HistoryEntry, InsightsAggregate } from "../../../src/services/ports";

function dayKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function isConsecutive(earlier: string, later: string): boolean {
  return new Date(`${later}T00:00:00Z`).getTime() - new Date(`${earlier}T00:00:00Z`).getTime() === 86_400_000;
}

export function computeStreak(dates: string[]): { current: number; longest: number } {
  const days = [...new Set(dates)].sort();
  if (days.length === 0) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    run = isConsecutive(days[i - 1]!, days[i]!) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }

  let current = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (isConsecutive(days[i - 1]!, days[i]!)) current += 1;
    else break;
  }
  return { current, longest };
}

export function computeInsights(history: HistoryEntry[]): InsightsAggregate {
  const totalWords = history.reduce((sum, h) => sum + h.wordCount, 0);
  const totalSeconds = history.reduce((sum, h) => sum + h.durationSec, 0);
  const wpm = totalSeconds > 0 ? Math.round(totalWords / (totalSeconds / 60)) : 0;
  const wpmPercentile = Math.max(0, Math.min(99, Math.round((wpm / 130) * 90)));
  const wordsCorrected = history.filter((h) => h.cleanupApplied).length;

  const total = history.length || 1;
  const byApp = new Map<string, number>();
  const byDay = new Map<string, number>();
  for (const h of history) {
    byApp.set(h.app, (byApp.get(h.app) ?? 0) + 1);
    const day = dayKey(h.createdAt);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }

  const appUsage = [...byApp.entries()]
    .map(([category, count]) => ({ category, count, pct: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);

  const heatmap = [...byDay.entries()].map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

  return {
    wpm,
    wpmPercentile,
    wordsCorrected,
    dictionaryFixes: 0,
    totalWords,
    appUsage,
    streak: computeStreak(history.map((h) => dayKey(h.createdAt))),
    heatmap,
  };
}
