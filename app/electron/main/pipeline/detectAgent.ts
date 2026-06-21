/**
 * Instruction-mode detection — does the transcript address the agent by name? When true the
 * pipeline routes to the Voice Agent instead of cleanup. `stripAgentName` removes the leading
 * address so the agent receives just the instruction. Pure + table-tested. See backend/03 §6.2.
 */
import { escapeRegExp } from "./util";

const LEAD = "(?:hey\\s+|ok\\s+|okay\\s+|hi\\s+)?";

export function detectAgent(text: string, agentName?: string): boolean {
  if (!agentName) return false;
  return new RegExp(`^\\s*${LEAD}${escapeRegExp(agentName)}\\b`, "i").test(text);
}

export function stripAgentName(text: string, agentName?: string): string {
  if (!agentName) return text.trim();
  return text.replace(new RegExp(`^\\s*${LEAD}${escapeRegExp(agentName)}[\\s,.:!?-]*`, "i"), "").trim();
}
