/**
 * STAGE 1 — deterministic dictated-punctuation substitution. Spoken commands ("period", "comma",
 * "new paragraph") become characters before any LLM sees the text. Content inside `<keep>…</keep>`
 * is protected from substitution (the tags are stripped afterwards). Pure + table-tested.
 * See backend/03 §4 and 01 (FreeFlow PolishPipeline stage 1).
 */

/** [pattern, replacement] — sentence punctuation consumes the preceding space so it attaches;
 * newline commands consume the surrounding spaces so they join cleanly. */
const RULES: Array<[RegExp, string]> = [
  [/\s*\bnew paragraph\b\s*/gi, "\n\n"],
  [/\s*\bnew line\b\s*/gi, "\n"],
  [/\s*\bfull stop\b/gi, "."],
  [/\s*\bperiod\b/gi, "."],
  [/\s*\bcomma\b/gi, ","],
  [/\s*\bquestion mark\b/gi, "?"],
  [/\s*\bexclamation (?:mark|point)\b/gi, "!"],
  [/\s*\bsemicolon\b/gi, ";"],
  [/\s*\bcolon\b/gi, ":"],
];

const KEEP = "\uFFFC"; // object-replacement char — safe placeholder delimiter, never in real text

export function applyDictatedPunctuation(input: string): string {
  const protectedParts: string[] = [];
  let text = input.replace(/<keep>([\s\S]*?)<\/keep>/gi, (_match, inner: string) => {
    protectedParts.push(inner);
    return `${KEEP}${protectedParts.length - 1}${KEEP}`;
  });

  for (const [pattern, replacement] of RULES) {
    text = text.replace(pattern, replacement);
  }

  text = text.replace(new RegExp(`${KEEP}(\\d+)${KEEP}`, "g"), (_match, index: string) => protectedParts[Number(index)] ?? "");
  return text;
}
