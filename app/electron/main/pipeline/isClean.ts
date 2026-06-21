/**
 * STAGE 2 — the clean-transcript skip heuristic. If the transcript already starts with a capital,
 * ends with sentence punctuation, and has no fillers/repeats/dictated commands, the LLM cleanup is
 * skipped entirely (the big latency/cost win from FreeFlow). Pure + table-tested. See backend/05 §2.
 */
const STARTS_CAPITAL = /^["'([]?\p{Lu}/u;
const ENDS_PUNCT = /[.!?…"')\]]$/u;
const HAS_FILLER = /\b(um+|uh+|erm+|like|you know|i mean|sort of)\b/i;
const HAS_REPEAT = /\b(\w+)\s+\1\b/i;
const HAS_DICTATED = /\b(period|comma|new line|new paragraph|question mark|full stop)\b/i;

export function isClean(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2) return true;
  return (
    STARTS_CAPITAL.test(trimmed) &&
    ENDS_PUNCT.test(trimmed) &&
    !HAS_FILLER.test(trimmed) &&
    !HAS_REPEAT.test(trimmed) &&
    !HAS_DICTATED.test(trimmed)
  );
}
