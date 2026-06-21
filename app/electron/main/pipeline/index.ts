/**
 * runPipeline — the single entry the capture flow calls: deterministic dictionary + dictated
 * punctuation, then either route to the agent (instruction mode), skip the LLM (already clean),
 * or refine with the LLM (with a graceful fallback). Snippets expand last. Pure + dependency-
 * injected (refine/runAgent), so the whole flow is unit-tested without an LLM. See backend/03 §4.
 */
import type { PipelineContext, PipelineResult } from "./types";
import { applyDictionary } from "./dictionary";
import { applyDictatedPunctuation } from "./substitute";
import { detectAgent, stripAgentName } from "./detectAgent";
import { isClean } from "./isClean";
import { expandSnippets } from "./snippets";

export async function runPipeline(raw: string, ctx: PipelineContext): Promise<PipelineResult> {
  const withDictionary = applyDictionary(raw, ctx.dictionary);
  const punctuated = applyDictatedPunctuation(withDictionary);

  // Instruction mode: the user addressed the agent by name.
  if (ctx.agentName && ctx.runAgent && detectAgent(punctuated, ctx.agentName)) {
    const answer = await ctx.runAgent(stripAgentName(punctuated, ctx.agentName));
    return { text: answer, cleaned: true, mode: "agent" };
  }

  // STAGE 2: skip the LLM if cleanup is off or the text is already clean.
  if (!ctx.cleanupEnabled || isClean(punctuated)) {
    return { text: expandSnippets(punctuated, ctx.snippets), cleaned: false, mode: "dictation" };
  }

  // STAGE 3: LLM refinement, with a graceful fallback so it never blocks the user.
  let refined: string;
  try {
    refined = await ctx.refine(punctuated);
  } catch {
    refined = punctuated;
  }
  return { text: expandSnippets(refined, ctx.snippets), cleaned: true, mode: "dictation" };
}

export type { PipelineContext, PipelineResult, DictionaryRule, SnippetRule } from "./types";
export { isClean } from "./isClean";
export { applyDictatedPunctuation } from "./substitute";
export { detectAgent, stripAgentName } from "./detectAgent";
export { expandSnippets } from "./snippets";
export { applyDictionary } from "./dictionary";
