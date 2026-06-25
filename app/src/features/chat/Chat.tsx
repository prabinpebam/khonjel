import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Loader2, Mic, Pencil, Plus, RefreshCw, SendHorizontal, Square, Trash2 } from "lucide-react";
import { useServices } from "@services";
import type { ChatMessage, ChatThread, ChatTokenEvent } from "@services/ports";
import { useDictationField } from "@hooks/useDictationField";
import { useActiveModel } from "@hooks/useActiveModel";
import { useSettingsStore } from "@stores/settings";
import { PageHeader } from "@components/common/PageHeader";
import { MicWaveform } from "@components/common/MicWaveform";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Textarea } from "@components/ui/textarea";
import { cn } from "@lib/utils";
import { autoTitleThread, createThread, deleteThread, renameThread, sortThreads, touchThread } from "@lib/chat/threads";
import { chatTitlePrompt, cleanTitle, deriveThreadTitle } from "@lib/chat/title";
import { splitReasoning } from "@lib/chat/stream";
import { precedingUserMessage, toTurns, truncateAfter } from "@lib/chat/regenerate";

const SUGGESTIONS = ["Rewrite that note", "Plan my day", "Summarize my last meeting", "Draft a reply"];

export function Chat() {
  const { content, chat, inference } = useServices();
  const llm = useActiveModel("llm.chat", "llm");
  const autoTitle = useSettingsStore((s) => s.toggles["llm.chat.autoTitle"] ?? true);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [allMessages, setAllMessages] = useState<ChatMessage[]>([]);
  // The assistant message id currently streaming (null when idle).
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const levelRef = useRef(0);
  const dictation = useDictationField(input, setInput, { onLevel: (n) => (levelRef.current = n) });
  const loadedRef = useRef(false);
  // requestIds the user explicitly stopped, so the trailing done keeps "stopped" (not "complete").
  const stoppedRef = useRef<Set<string>>(new Set());
  // threadIds already sent for an LLM title, so we never re-title (or loop) on the same thread.
  const titledRef = useRef<Set<string>>(new Set());

  const sortedThreads = useMemo(() => sortThreads(threads), [threads]);
  const messages = useMemo(() => allMessages.filter((m) => m.threadId === activeId), [allMessages, activeId]);

  // Load persisted threads + messages.
  useEffect(() => {
    let live = true;
    void Promise.all([content.chatThreads(), content.chat()]).then(([t, m]) => {
      if (!live) return;
      setThreads(t);
      setAllMessages(m);
      setActiveId(sortThreads(t)[0]?.id ?? null);
      loadedRef.current = true;
    });
    return () => {
      live = false;
    };
  }, [content]);

  // Stream tokens into the assistant message (keyed by requestId == the placeholder message id).
  useEffect(() => {
    return chat.onToken((ev: ChatTokenEvent) => {
      setAllMessages((prev) =>
        prev.map((m) => {
          if (m.id !== ev.requestId) return m;
          if (ev.kind === "error") {
            return { ...m, content: ev.error ?? "Sorry, I could not reach the model.", status: "error" };
          }
          const { answer } = splitReasoning(ev.fullText);
          const stopped = stoppedRef.current.has(ev.requestId);
          const status: ChatMessage["status"] = ev.kind === "done" ? (stopped ? "stopped" : "complete") : "streaming";
          return { ...m, content: answer || (ev.kind === "done" ? m.content : "..."), status };
        }),
      );
      if (ev.kind === "done" || ev.kind === "error") {
        stoppedRef.current.delete(ev.requestId);
        setStreamingId((cur) => (cur === ev.requestId ? null : cur));
      }
    });
  }, [chat]);

  // Fallback auto-title: a pending thread gets a derived title once it has a user message.
  useEffect(() => {
    setThreads((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (t.titleStatus !== "pending") return t;
        const firstUser = allMessages.find((m) => m.threadId === t.id && m.role === "user");
        if (!firstUser) return t;
        changed = true;
        return autoTitleThread([t], t.id, deriveThreadTitle(firstUser.content))[0]!;
      });
      return changed ? next : prev;
    });
  }, [allMessages]);

  // LLM auto-title (llm.chat.autoTitle): once a thread's first exchange completes, ask the model for
  // a concise title and upgrade the fallback in place. Skips manual titles; runs once per thread.
  useEffect(() => {
    if (!autoTitle) return;
    for (const t of threads) {
      if (t.titleStatus === "manual" || titledRef.current.has(t.id)) continue;
      const msgs = allMessages.filter((m) => m.threadId === t.id);
      const hasUser = msgs.some((m) => m.role === "user");
      const replied = msgs.some(
        (m) => m.role === "assistant" && (m.status === "complete" || m.status === "stopped" || m.status == null),
      );
      if (!hasUser || !replied) continue;
      titledRef.current.add(t.id);
      const turns = msgs
        .filter((m) => m.status !== "error" && m.content.trim() && m.content !== "...")
        .map((m) => ({ role: m.role, content: m.content }));
      void inference
        .chat(chatTitlePrompt(turns))
        .then(({ text }) => {
          const title = cleanTitle(text);
          if (!title) return;
          setThreads((prev) =>
            prev.map((x) => (x.id === t.id && x.titleStatus !== "manual" ? { ...x, title, titleStatus: "auto" } : x)),
          );
        })
        .catch(() => {
          // Keep the deterministic fallback title on any titling failure.
        });
    }
  }, [threads, allMessages, autoTitle, inference]);

  // Persist (debounced) when idle -- never mid-stream (the placeholder churns per token).
  useEffect(() => {
    if (!loadedRef.current || streamingId) return;
    const handle = setTimeout(() => {
      void content.saveChatThreads(threads);
      void content.saveChat(allMessages);
    }, 300);
    return () => clearTimeout(handle);
  }, [threads, allMessages, streamingId, content]);

  function startStream(threadId: string, history: ChatMessage[]) {
    const requestId = crypto.randomUUID();
    const now = new Date().toISOString();
    const placeholder: ChatMessage = { id: requestId, threadId, role: "assistant", content: "...", createdAt: now, status: "streaming" };
    setAllMessages((prev) => [...prev, placeholder]);
    setStreamingId(requestId);
    void chat.send({ requestId, threadId, messages: toTurns(history) });
  }

  function send(text: string) {
    const value = text.trim();
    if (!value || streamingId) return;
    const now = new Date().toISOString();
    let threadId = activeId;
    if (!threadId) {
      const t = createThread(now);
      threadId = t.id;
      setThreads((prev) => [t, ...prev]);
      setActiveId(threadId);
    } else {
      const tid = threadId;
      setThreads((prev) => touchThread(prev, tid, now));
    }
    const user: ChatMessage = { id: crypto.randomUUID(), threadId, role: "user", content: value, createdAt: now };
    const history = [...allMessages.filter((m) => m.threadId === threadId), user];
    setAllMessages((prev) => [...prev, user]);
    setInput("");
    startStream(threadId, history);
  }

  function regenerate(assistantId: string) {
    if (streamingId) return;
    const target = allMessages.find((m) => m.id === assistantId);
    if (!target) return;
    const threadId = target.threadId;
    const threadMsgs = allMessages.filter((m) => m.threadId === threadId);
    const user = precedingUserMessage(threadMsgs, assistantId);
    if (!user) return;
    const kept = truncateAfter(threadMsgs, user.id);
    const others = allMessages.filter((m) => m.threadId !== threadId);
    setAllMessages([...others, ...kept]);
    startStream(threadId, kept);
  }

  function stop() {
    if (!streamingId) return;
    stoppedRef.current.add(streamingId);
    chat.stop(streamingId);
    setAllMessages((prev) => prev.map((m) => (m.id === streamingId ? { ...m, status: "stopped" } : m)));
    setStreamingId(null);
  }

  function newChat() {
    setActiveId(null);
    setInput("");
    setRenamingId(null);
  }

  function removeThread(id: string) {
    const { threads: remaining, nextId } = deleteThread(threads, id);
    setThreads(remaining);
    setAllMessages((prev) => prev.filter((m) => m.threadId !== id));
    if (activeId === id) setActiveId(nextId);
  }

  function commitRename(id: string, title: string) {
    if (title.trim()) setThreads((prev) => renameThread(prev, id, title));
    setRenamingId(null);
  }

  return (
    <div className="flex min-h-full" data-eval="chat-root">
      <aside className="flex w-56 shrink-0 flex-col border-r border-border pr-3">
        <Button variant="secondary" size="sm" className="mb-3" data-eval="chat-new" onClick={newChat}>
          <Plus />
          New chat
        </Button>
        <div className="flex flex-col gap-0.5 overflow-y-auto" role="listbox" aria-label="Conversations">
          {sortedThreads.length === 0 ? (
            <p className="px-2 py-1 text-xs text-tertiary-foreground">No conversations yet.</p>
          ) : (
            sortedThreads.map((t) => (
              <div
                key={t.id}
                role="option"
                aria-selected={t.id === activeId}
                data-eval="chat-thread"
                tabIndex={0}
                onClick={() => setActiveId(t.id)}
                onDoubleClick={() => setRenamingId(t.id)}
                onKeyDown={(e) => {
                  if (renamingId === t.id) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setActiveId(t.id);
                  } else if (e.key === "F2") {
                    setRenamingId(t.id);
                  }
                }}
                className={cn(
                  "group flex cursor-pointer items-center gap-1 rounded-md px-2 py-1.5 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  t.id === activeId ? "bg-sidebar-selected text-foreground" : "text-muted-foreground hover:bg-foreground/5",
                )}
              >
                {renamingId === t.id ? (
                  <input
                    ref={(el) => el?.focus()}
                    defaultValue={t.title}
                    aria-label="Conversation title"
                    className="min-w-0 flex-1 rounded-sm bg-surface px-1 text-sm text-foreground outline-none"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => commitRename(t.id, e.target.value)}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === "Enter") commitRename(t.id, e.currentTarget.value);
                      if (e.key === "Escape") setRenamingId(null);
                    }}
                  />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-left">{t.title || "New chat"}</span>
                )}
                <button
                  type="button"
                  aria-label="Rename conversation"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(t.id);
                  }}
                >
                  <Pencil className="size-3.5 text-tertiary-foreground hover:text-foreground" />
                </button>
                <button
                  type="button"
                  aria-label="Delete conversation"
                  data-eval="chat-thread-delete"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeThread(t.id);
                  }}
                >
                  <Trash2 className="size-3.5 text-tertiary-foreground hover:text-danger" />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      <div className="flex min-h-full flex-1 flex-col pl-5">
        <PageHeader
          title="Chat"
          actions={<Badge variant="accent" data-eval="chat-model">{`${llm.scope} \u00b7 ${llm.model}`}</Badge>}
        />

        <div className="flex-1">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm text-muted-foreground">Ask me anything.</p>
              <div className="flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-pill border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4" role="log" aria-live="polite" aria-busy={streamingId !== null}>
              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  streaming={message.id === streamingId}
                  onRegenerate={() => regenerate(message.id)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 -mx-8 mt-6 border-t border-border bg-surface px-8 py-4">
          <div className="flex items-end gap-2">
            <Button
              variant={dictation.status === "recording" ? "destructive" : "ghost"}
              size="icon"
              aria-label={
                dictation.status === "recording"
                  ? "Stop dictation"
                  : dictation.status === "transcribing"
                    ? "Transcribing"
                    : "Voice input"
              }
              disabled={dictation.status === "transcribing"}
              onClick={dictation.toggle}
            >
              {dictation.status === "transcribing" ? <Loader2 className="animate-spin" /> : <Mic />}
            </Button>
            {dictation.status === "recording" && (
              <MicWaveform levelRef={levelRef} active barCount={20} className="h-9 w-16 shrink-0" />
            )}
            <Textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Message Khonjel..."
              className="max-h-32 min-h-11 flex-1 resize-none"
              data-eval="chat-input"
            />
            {streamingId ? (
              <Button variant="destructive" aria-label="Stop" data-eval="chat-stop" onClick={stop}>
                <Square />
              </Button>
            ) : (
              <Button aria-label="Send" data-eval="chat-send" onClick={() => send(input)}>
                <SendHorizontal />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  streaming,
  onRegenerate,
}: {
  message: ChatMessage;
  streaming: boolean;
  onRegenerate: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStopped = message.status === "stopped";
  // A just-started assistant turn (placeholder, no tokens yet) shows a typing indicator.
  const isTyping = streaming && message.content === "...";

  function copy() {
    window.electronAPI?.copyText?.(message.content);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
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
          "max-w-[72%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm",
          isUser ? "bg-primary text-primary-foreground" : "border border-border bg-surface-2 text-foreground",
          isError && "border-danger text-danger",
        )}
      >
        {isTyping ? (
          <span className="flex items-center gap-1 text-muted-foreground" aria-label="Khonjel is typing">
            <Loader2 className="size-3.5 animate-spin" />
            Thinking...
          </span>
        ) : (
          <>
            {message.content}
            {streaming ? <span className="ml-0.5 inline-block animate-pulse">|</span> : null}
          </>
        )}
      </div>
      {isStopped ? <span className="px-1 text-xs text-tertiary-foreground">Stopped</span> : null}
      {!isUser && !streaming ? (
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            aria-label={copied ? "Copied" : "Copy"}
            className={copied ? "text-success hover:text-success" : undefined}
            onClick={copy}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
          <Button variant="ghost" size="icon" aria-label={isError ? "Retry" : "Regenerate"} data-eval="chat-regenerate" onClick={onRegenerate}>
            <RefreshCw />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
