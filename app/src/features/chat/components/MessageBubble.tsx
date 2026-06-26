import { useState } from "react";
import { Check, Copy, Loader2, Pencil, RefreshCw } from "lucide-react";
import type { ChatMessage } from "@services/ports";
import { useAutoFocus } from "@hooks/useAutoFocus";
import { useSettingsStore } from "@stores/settings";
import { RowActions } from "@components/common/RowActions";
import { Button } from "@components/ui/button";
import { Textarea } from "@components/ui/textarea";
import { cn } from "@lib/utils";
import { splitReasoning } from "@lib/chat/stream";
import { Markdown } from "../Markdown";

export function MessageBubble({
  message,
  streaming,
  busy,
  onRegenerate,
  onEdit,
}: {
  message: ChatMessage;
  streaming: boolean;
  busy: boolean;
  onRegenerate: () => void;
  onEdit: (text: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const autoFocusEdit = useAutoFocus<HTMLTextAreaElement>();
  const reasoningOn = useSettingsStore((s) => s.toggles["llm.chat.reasoning"] ?? false);
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStopped = message.status === "stopped";
  const split = isUser || isError ? { reasoning: "", answer: message.content } : splitReasoning(message.content);
  const reasoning = split.reasoning;
  // The "..." placeholder counts as "no answer yet" so the typing indicator (not literal dots) shows.
  const answer = split.answer === "..." ? "" : split.answer;
  // A just-started assistant turn (placeholder / reasoning-only so far) shows a typing indicator.
  const isTyping = streaming && !isError && answer.trim().length === 0;
  const copyText = isUser || isError ? message.content : answer;

  function copy() {
    window.electronAPI?.copyText?.(copyText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function saveEdit(text: string) {
    setEditing(false);
    if (text.trim() && text.trim() !== message.content.trim()) onEdit(text);
  }

  function beginEdit() {
    setEditText(message.content);
    setEditing(true);
  }

  if (editing) {
    return (
      <div data-eval="chat-message" data-eval-role={message.role} className="flex flex-col items-end gap-1">
        <Textarea
          ref={autoFocusEdit}
          rows={2}
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          aria-label="Edit message"
          data-eval="chat-edit-input"
          className="max-h-40 w-[var(--chat-bubble-max)] resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              saveEdit(editText);
            }
            if (e.key === "Escape") setEditing(false);
          }}
        />
        <div className="flex gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel
          </Button>
          <Button size="sm" data-eval="chat-edit-save" onClick={() => saveEdit(editText)}>
            Send
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-eval="chat-message"
      data-eval-role={message.role}
      data-eval-status={message.status ?? ""}
      className={cn("group flex flex-col gap-1", isUser ? "items-end" : "items-start")}
    >
      <div
        className={cn(
          "max-w-[var(--chat-bubble-max)] rounded-lg px-4 py-2.5 text-sm",
          isUser ? "whitespace-pre-wrap bg-primary text-primary-foreground" : "border border-border bg-surface-2 text-foreground",
          isError && "whitespace-pre-wrap border-danger text-danger",
        )}
      >
        {reasoningOn && reasoning.trim().length > 0 ? (
          <details className="mb-1.5 rounded border border-border/60 bg-foreground/5 px-2 py-1 text-xs">
            <summary className="cursor-pointer select-none text-tertiary-foreground">Thinking</summary>
            <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{reasoning.trim()}</div>
          </details>
        ) : null}
        {isTyping ? (
          <span className="flex items-center gap-1 text-muted-foreground" aria-label="Khonjel is typing">
            <Loader2 className="size-3.5 animate-spin" />
            Thinking...
          </span>
        ) : isUser || isError ? (
          message.content
        ) : (
          <Markdown source={answer} />
        )}
        {streaming && !isTyping ? <span className="ml-0.5 inline-block animate-pulse">|</span> : null}
      </div>
      {isStopped ? <span className="px-1 text-xs text-tertiary-foreground">Stopped</span> : null}
      {!streaming ? (
        <RowActions className="gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label={copied ? "Copied" : "Copy"}
            className={copied ? "text-success hover:text-success" : undefined}
            onClick={copy}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          {isUser ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit"
              data-eval="chat-edit"
              disabled={busy}
              onClick={beginEdit}
            >
              <Pencil />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" aria-label={isError ? "Retry" : "Regenerate"} data-eval="chat-regenerate" onClick={onRegenerate}>
              <RefreshCw />
            </Button>
          )}
        </RowActions>
      ) : null}
    </div>
  );
}
