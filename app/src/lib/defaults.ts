import type { InsightsAggregate } from "@services/ports";

/**
 * Neutral insights aggregate rendered while the real values load (one microtask for the
 * mock, an IPC round-trip under Electron). Keeps insight views from dereferencing null.
 */
export const EMPTY_INSIGHTS: InsightsAggregate = {
  wpm: 0,
  wpmPercentile: 0,
  wordsCorrected: 0,
  dictionaryFixes: 0,
  totalWords: 0,
  appUsage: [],
  streak: { current: 0, longest: 0 },
  heatmap: [],
};
