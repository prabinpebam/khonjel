/**
 * Dictionary application — apply user substitution rules (trigger -> replacement, word-boundary,
 * case-insensitive). `term` rules are recognition hints used in prompts, not deterministic
 * transforms, so they are not applied here. Pure + table-tested. See backend/03 §4.
 */
import type { DictionaryRule } from "./types";
import { escapeRegExp } from "./util";

export function applyDictionary(text: string, rules: DictionaryRule[]): string {
  let output = text;
  for (const rule of rules) {
    if (rule.type !== "substitution" || !rule.trigger) continue;
    output = output.replace(new RegExp(`\\b${escapeRegExp(rule.trigger)}\\b`, "gi"), rule.replacement ?? "");
  }
  return output;
}
