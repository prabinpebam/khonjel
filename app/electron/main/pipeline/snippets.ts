/**
 * Snippet expansion — replace each trigger with its expansion (literal, not regex). Runs after
 * cleanup so expansions are inserted verbatim. Pure + table-tested. See backend/03 §4.
 */
import type { SnippetRule } from "./types";

export function expandSnippets(text: string, snippets: SnippetRule[]): string {
  let output = text;
  for (const snippet of snippets) {
    if (!snippet.trigger) continue;
    output = output.split(snippet.trigger).join(snippet.expansion);
  }
  return output;
}
