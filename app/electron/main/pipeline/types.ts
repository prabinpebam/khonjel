/**
 * Pipeline domain types. The pipeline is PURE (no node/electron deps) and dependency-injects its
 * LLM/agent collaborators, so every stage is unit-tested in isolation (BE1). See backend/03 §4.
 */

export interface DictionaryRule {
  type: "term" | "substitution";
  /** substitution: the spoken/typed trigger to replace. */
  trigger?: string;
  /** substitution: what to replace the trigger with. */
  replacement?: string;
  /** term: a jargon word/name to preserve (recognition hint; not a deterministic transform). */
  term?: string;
}

export interface SnippetRule {
  trigger: string;
  expansion: string;
}

export type PipelineMode = "dictation" | "agent";

export interface PipelineResult {
  text: string;
  cleaned: boolean;
  mode: PipelineMode;
}

export interface PipelineContext {
  dictionary: DictionaryRule[];
  snippets: SnippetRule[];
  /** Wake word; when the transcript addresses it, the pipeline routes to the agent. */
  agentName?: string;
  cleanupEnabled: boolean;
  /** Injected LLM cleanup (STAGE 3). Kept out of the pure module so it stays node-free + testable. */
  refine: (text: string) => Promise<string>;
  /** Injected agent runner (instruction mode). */
  runAgent?: (instruction: string) => Promise<string>;
}
