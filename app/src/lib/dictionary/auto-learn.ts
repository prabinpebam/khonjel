/**
 * Auto-learn from corrections: when the user edits a past dictation, derive personal-dictionary
 * substitution rules from the words they changed. PURE so it's unit-tested without the store.
 *
 * Conservative by design -- it only learns from aligned, same-length single-word swaps and skips
 * case- or punctuation-only changes, short triggers, and duplicates, so the dictionary doesn't fill
 * with noise. The caller persists the returned entries (newest first).
 */
import type { DictionaryEntry } from "@services/ports";

/** Max rules to learn from a single edit, so one large rewrite can't flood the dictionary. */
const MAX_PER_EDIT = 5;

/** Strip leading/trailing non-alphanumeric characters (keeps Unicode letters/digits). */
function trimWord(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

/** Lowercased, alphanumeric-only form for comparing two words ignoring case + punctuation. */
function normalize(word: string): string {
  return word.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function learnCorrections(
  before: string,
  after: string,
  existing: DictionaryEntry[],
  makeId: () => string = () => globalThis.crypto.randomUUID(),
): DictionaryEntry[] {
  const beforeWords = before.trim().split(/\s+/).filter(Boolean);
  const afterWords = after.trim().split(/\s+/).filter(Boolean);
  // Only learn from aligned, same-length edits -- a reliable signal that word i was swapped for word i.
  if (beforeWords.length === 0 || beforeWords.length !== afterWords.length) return [];

  const taken = new Set(
    existing
      .map((e) => (e.type === "substitution" ? e.trigger?.toLowerCase() : undefined))
      .filter((t): t is string => t != null && t.length > 0),
  );
  const learned: DictionaryEntry[] = [];
  for (let i = 0; i < beforeWords.length && learned.length < MAX_PER_EDIT; i++) {
    const rawBefore = beforeWords[i];
    const rawAfter = afterWords[i];
    if (rawBefore == null || rawAfter == null || rawBefore === rawAfter) continue;
    const trigger = trimWord(rawBefore);
    const replacement = trimWord(rawAfter);
    if (trigger.length < 2 || replacement.length === 0) continue;
    // Skip case-/punctuation-only edits: substitutions match case-insensitively, so they add nothing.
    if (normalize(trigger) === normalize(replacement)) continue;
    const key = trigger.toLowerCase();
    if (taken.has(key)) continue;
    taken.add(key);
    learned.push({
      id: makeId(),
      type: "substitution",
      trigger,
      replacement,
      scope: "personal",
      source: "auto-learn",
    });
  }
  return learned;
}
