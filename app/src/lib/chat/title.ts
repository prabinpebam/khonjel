const MAX_TITLE = 48;

/** Cap a title to MAX_TITLE chars, appending an ellipsis when truncated. */
function cap(text: string): string {
  return text.length > MAX_TITLE ? `${text.slice(0, MAX_TITLE - 1).trimEnd()}\u2026` : text;
}

/** Fallback title: the first ~6 words of the first user message, trimmed and capped. */
export function deriveThreadTitle(firstUserText: string): string {
  const words = firstUserText.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  const title = cap(words.join(" "));
  return title || "New chat";
}

/** Build the titling request turns for the LLM (short answer, no preamble). */
export function chatTitlePrompt(
  messages: { role: "user" | "assistant"; content: string }[],
): { role: "user" | "assistant"; content: string }[] {
  const convo = messages
    .slice(0, 4)
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n");
  return [
    {
      role: "user",
      content:
        "Write a short, specific title (max 6 words, no quotes, no trailing period) for this " +
        `conversation. Reply with only the title.\n\n${convo}`,
    },
  ];
}

/** Sanitize an LLM-produced title: collapse newlines, strip wrapping quotes + trailing period, cap. */
export function cleanTitle(raw: string): string {
  const text = raw
    .replace(/[\r\n]+/g, " ")
    .replace(/^["'\s]+/, "")
    .replace(/["'.\s]+$/, "")
    .trim();
  return text ? cap(text) : "";
}

/**
 * If `prompt` is a titling request (built by `chatTitlePrompt`), derive a concise title from its
 * embedded conversation; otherwise null. Lets a model-less engine (the mock / the local stub) still
 * produce a sensible auto-title instead of echoing the prompt back.
 */
export function titleFromPrompt(prompt: string): string | null {
  if (!/^Write a short, specific title/.test(prompt.trimStart())) return null;
  const userLine = prompt.split("\n").find((line) => line.trimStart().startsWith("User:"));
  const subject = userLine ? userLine.slice(userLine.indexOf("User:") + "User:".length).trim() : "";
  return deriveThreadTitle(subject);
}
