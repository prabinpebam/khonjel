import type { ChatMessage } from "@services/ports";

/** Messages up to and including `messageId` (drops everything after). For regenerate / edit-resend. */
export function truncateAfter(messages: ChatMessage[], messageId: string): ChatMessage[] {
  const idx = messages.findIndex((m) => m.id === messageId);
  return idx === -1 ? messages : messages.slice(0, idx + 1);
}

/** The user turn that immediately precedes an assistant message (the prompt to regenerate from). */
export function precedingUserMessage(
  messages: ChatMessage[],
  assistantId: string,
): ChatMessage | undefined {
  const idx = messages.findIndex((m) => m.id === assistantId);
  if (idx <= 0) return undefined;
  for (let i = idx - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role === "user") return m;
  }
  return undefined;
}

/** Map thread messages into role/content turns for the model. */
export function toTurns(
  messages: ChatMessage[],
): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}
