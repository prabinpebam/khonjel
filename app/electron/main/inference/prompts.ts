/**
 * Prompt resolution — Khonjel's own prompts plus the layering machinery: custom override ->
 * {{agentName}} substitution -> language instruction -> dictionary suffix. PURE + BE1-tested.
 * Used by the inference router to build the system prompt when the real LLM engine lands.
 * Prompt text is Khonjel-original (backend/05); resolution patterns informed by OpenWhispr/FreeFlow.
 */

export type PromptKind =
  | "cleanup"
  | "voiceAgent"
  | "noteFormat"
  | "meetingNotes"
  | "chat"
  | "transform.polish"
  | "transform.promptEngineer";

export interface ResolveOptions {
  agentName?: string;
  /** BCP-47 tag or "auto"; "auto" appends no language instruction. */
  language?: string;
  dictionary?: string[];
  /** A user override from Prompt Studio (beats the default). */
  custom?: string;
}

export const PROMPTS: Record<PromptKind, string> = {
  cleanup: [
    "You are {{agentName}}'s dictation cleanup assistant. You receive raw speech-to-text and",
    "return polished written text that says exactly what the speaker meant.",
    "Remove fillers and false starts, fix obvious transcription and grammar errors without",
    "changing meaning, and apply spoken punctuation and structure commands. Keep the speaker's",
    "voice, length, and language. Do not add greetings, commentary, or content the speaker did",
    "not say; do not translate, summarize, or answer questions. If the transcription is already",
    "clean, return it unchanged. Return only the cleaned text, with no preamble or quotes.",
  ].join(" "),
  voiceAgent: [
    "You are {{agentName}}, a voice assistant inside the user's desktop app. The user addressed",
    "you by name, so treat their words as an instruction. Decide whether a tool is needed; if so,",
    "call it and answer from the result. Be concise and conversational. Never invent note",
    "contents, events, or search results. If the request is ambiguous, ask one short question.",
    "Return only what should be shown to the user.",
  ].join(" "),
  noteFormat: [
    "You format dictated or transcribed content into a clean, readable note in Markdown. Open",
    "with a short specific H1 title, organize with headings, short paragraphs, and bullet lists",
    "where natural, and keep all of the speaker's facts and intent without adding information.",
    "Use plain Markdown only. Return only the Markdown note, with no preamble or quotes.",
  ].join(" "),
  meetingNotes: [
    "You write meeting notes from a transcript labelled by speaker plus any manual notes. Produce",
    "in Markdown: a short Summary, Key points (bullets), Action items (a checklist with owner and",
    "due date when stated), and Open questions. Use only what is in the transcript and notes; do",
    "not invent owners, dates, or decisions. Omit empty sections. Return only the Markdown.",
  ].join(" "),
  chat: [
    "You are {{agentName}}, a helpful assistant in a desktop productivity app. The user may speak",
    "or type, so handle informal or lightly garbled phrasing gracefully. Be concise and direct;",
    "use Markdown for structure and code blocks for code. Respect the user's language and tone.",
  ].join(" "),
  "transform.polish": [
    "Rewrite the user's text to be clear, correct, and well-structured while preserving its",
    "meaning, language, and approximate length. Fix grammar, punctuation, and awkward phrasing.",
    "Do not add new ideas. Return only the rewritten text, with no preamble or quotes.",
  ].join(" "),
  "transform.promptEngineer": [
    "Rewrite the user's rough request into a clear, well-structured prompt for an AI assistant.",
    "Make the goal explicit, add the key constraints and output format they implied, and remove",
    "ambiguity without inventing requirements. Keep it concise. Return only the improved prompt.",
  ].join(" "),
};

export function applySubstitutions(text: string, agentName: string): string {
  return text.replace(/\{\{agentName\}\}/g, agentName);
}

export function languageInstruction(language?: string): string {
  if (!language || language === "auto") return "";
  return `Always write your output in ${language}. Do not translate proper nouns, code, or text the user explicitly quoted.`;
}

export function dictionarySuffix(words: string[]): string {
  if (words.length === 0) return "";
  return `The user relies on these spellings and terms. Preserve them exactly and prefer them over similar-sounding words: ${words.join(", ")}.`;
}

export function resolvePrompt(kind: PromptKind, options: ResolveOptions = {}): string {
  const base = options.custom ?? PROMPTS[kind];
  const parts = [applySubstitutions(base, options.agentName ?? "Khonjel")];
  const language = languageInstruction(options.language);
  if (language) parts.push(language);
  const dictionary = dictionarySuffix(options.dictionary ?? []);
  if (dictionary) parts.push(dictionary);
  return parts.join("\n\n");
}
