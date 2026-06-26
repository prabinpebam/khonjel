/**
 * Pure chat-search helpers (BE-tested). `searchThreads` filters conversations by title OR message
 * content and returns a snippet for content-only matches; `splitHighlight` segments text so the UI
 * can highlight matches. The Chat rail composes these. See 06 chat spec SS12 (thread search, P2).
 */
import type { ChatMessage, ChatThread } from "@services/ports";

export interface ThreadSearchResult {
  thread: ChatThread;
  /** A matching message excerpt, present only when the match was in content (not the title). */
  snippet?: string;
}

/** A whitespace-collapsed excerpt of `text` around the first occurrence of `query`. Keeps only a
 *  short lead before the match so it stays visible when the snippet is truncated in a narrow rail. */
export function excerpt(text: string, query: string, radius = 40): string {
  const clean = text.replace(/\s+/g, " ").trim();
  const needle = query.trim().toLowerCase();
  const idx = needle ? clean.toLowerCase().indexOf(needle) : -1;
  if (idx === -1) return clean.slice(0, radius * 2).trim();
  const lead = Math.min(idx, Math.min(radius, 10));
  const start = idx - lead;
  const end = Math.min(clean.length, idx + needle.length + radius);
  const before = start > 0 ? "\u2026" : "";
  const after = end < clean.length ? "\u2026" : "";
  return `${before}${clean.slice(start, end).trim()}${after}`;
}

/**
 * Filter threads (in their given order) to those whose title or any message matches `query`; an
 * empty query returns every thread. A content-only match carries a snippet of the hit message.
 */
export function searchThreads(
  threads: ChatThread[],
  messages: ChatMessage[],
  query: string,
): ThreadSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return threads.map((thread) => ({ thread }));
  const results: ThreadSearchResult[] = [];
  for (const thread of threads) {
    const titleMatch = thread.title.toLowerCase().includes(q);
    const hit = messages.find(
      (m) => m.threadId === thread.id && m.content.toLowerCase().includes(q),
    );
    if (titleMatch || hit) {
      results.push({ thread, snippet: hit && !titleMatch ? excerpt(hit.content, query) : undefined });
    }
  }
  return results;
}

/** Split `text` into segments flagged as matching `query` (case-insensitive) for highlight rendering. */
export function splitHighlight(text: string, query: string): { text: string; hit: boolean }[] {
  const q = query.trim();
  if (!q || !text) return text ? [{ text, hit: false }] : [];
  const needle = q.toLowerCase();
  const lower = text.toLowerCase();
  const parts: { text: string; hit: boolean }[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = lower.indexOf(needle, i);
    if (idx === -1) {
      parts.push({ text: text.slice(i), hit: false });
      break;
    }
    if (idx > i) parts.push({ text: text.slice(i, idx), hit: false });
    parts.push({ text: text.slice(idx, idx + q.length), hit: true });
    i = idx + q.length;
  }
  return parts;
}
