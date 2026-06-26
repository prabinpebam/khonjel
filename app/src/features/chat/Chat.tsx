import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Loader2, Mic, Pencil, Plus, RefreshCw, SendHorizontal, Square, Trash2 } from "lucide-react";
import { useServices } from "@services";
import type { ChatMessage, ChatThread, ChatTokenEvent } from "@services/ports";
import { useDictationField } from "@hooks/useDictationField";
import { useActiveModel } from "@hooks/useActiveModel";
import { useSettingsStore } from "@stores/settings";
import { PageHeader } from "@components/common/PageHeader";
import { MicWaveform } from "@components/common/MicWaveform";
import { SearchInput } from "@components/common/SearchInput";
import { Panel } from "@components/common/Panel";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Textarea } from "@components/ui/textarea";
import { cn } from "@lib/utils";
import { autoTitleThread, createThread, deleteThread, renameThread, sortThreads, touchThread } from "@lib/chat/threads";
import { chatTitlePrompt, cleanTitle, deriveThreadTitle } from "@lib/chat/title";
import { splitReasoning } from "@lib/chat/stream";
import { searchThreads, splitHighlight } from "@lib/chat/search";
import { precedingUserMessage, toTurns, truncateAfter } from "@lib/chat/regenerate";
import { Markdown } from "./Markdown";

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
  const [threadQuery, setThreadQuery] = useState("");
  const levelRef = useRef(0);
  const dictation = useDictationField(input, setInput, { onLevel: (n) => (levelRef.current = n) });
  const loadedRef = useRef(false);
  // requestIds the user explicitly stopped, so the trailing done keeps "stopped" (not "complete").
  const stoppedRef = useRef<Set<string>>(new Set());
  // threadIds already sent for an LLM title, so we never re-title (or loop) on the same thread.
  const titledRef = useRef<Set<string>>(new Set());
  // Autoscroll only when the user is pinned to the bottom (an IntersectionObserver tracks the sentinel).
  const bottomRef = useRef<HTMLDivElement>(null);
  const pinnedRef = useRef(true);

  const sortedThreads = useMemo(() => sortThreads(threads), [threads]);
  const results = useMemo(
    () => searchThreads(sortedThreads, allMessages, threadQuery),
    [sortedThreads, allMessages, threadQuery],
  );
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
          // Keep the RAW reply (reasoning + answer); the bubble splits <think> at render time.
          const stopped = stoppedRef.current.has(ev.requestId);
          const status: ChatMessage["status"] = ev.kind === "done" ? (stopped ? "stopped" : "complete") : "streaming";
          return { ...m, content: ev.fullText || (ev.kind === "done" ? m.content : "..."), status };
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
        .map((m) => ({ role: m.role, content: splitReasoning(m.content).answer || m.content }));
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

  // Track whether the user is pinned to the bottom (sentinel visible) so autoscroll never fights a
  // user who has scrolled up to read earlier messages.
  useEffect(() => {
    const el = bottomRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const last = entries[entries.length - 1];
        if (last) pinnedRef.current = last.isIntersecting;
      },
      { rootMargin: "0px 0px 160px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Autoscroll to the latest content while pinned (on new turns + as the streaming reply grows).
  const lastLen = messages.at(-1)?.content.length ?? 0;
  useEffect(() => {
    if (pinnedRef.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, lastLen, streamingId]);

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

  // Edit a user turn: rewrite it, drop everything after it, and re-answer from there (spec 5.3).
  function editAndResend(messageId: string, nextText: string) {
    if (streamingId) return;
    const value = nextText.trim();
    if (!value) return;
    const target = allMessages.find((m) => m.id === messageId);
    if (!target || target.role !== "user") return;
    const threadId = target.threadId;
    const edited = allMessages
      .filter((m) => m.threadId === threadId)
      .map((m) => (m.id === messageId ? { ...m, content: value } : m));
    const kept = truncateAfter(edited, messageId);
    const others = allMessages.filter((m) => m.threadId !== threadId);
    setAllMessages([...others, ...kept]);
    setThreads((prev) => touchThread(prev, threadId, new Date().toISOString()));
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
    <div className="flex min-h-0 flex-1 flex-col" data-eval="chat-root">
      <PageHeader
        title="Chat"
        actions={<Badge variant="accent" data-eval="chat-model">{`${llm.scope} \u00b7 ${llm.model}`}</Badge>}
      />

      <div className="flex min-h-0 flex-1 gap-4">
        <Panel as="aside" className="w-60 shrink-0">
          <div className="flex flex-col gap-2 border-b border-border p-2.5">
            <Button variant="secondary" size="sm" className="w-full" data-eval="chat-new" onClick={newChat}>
              <Plus />
              New chat
            </Button>
            <SearchInput
              value={threadQuery}
              onChange={setThreadQuery}
              placeholder="Search chats…"
              aria-label="Search conversations"
              size="sm"
              data-eval="chat-search"
            />
          </div>
          <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2" role="listbox" aria-label="Conversations">
            {results.length === 0 ? (
              <p className="px-2 py-1 text-xs text-tertiary-foreground">
                {threadQuery ? "No conversations match." : "No conversations yet."}
              </p>
            ) : (
              results.map(({ thread: t, snippet }) => (
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
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-left">
                        <HighlightText text={t.title || "New chat"} query={threadQuery} />
                      </span>
                      {snippet ? (
                        <span className="truncate text-xs text-tertiary-foreground" data-eval="chat-thread-snippet">
                          <HighlightText text={snippet} query={threadQuery} />
                        </span>
                      ) : null}
                    </div>
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
        </Panel>

        <Panel as="section" className="min-w-0 flex-1">
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="flex flex-1 flex-col px-6 py-5">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
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
                      busy={streamingId !== null}
                      onRegenerate={() => regenerate(message.id)}
                      onEdit={(text) => editAndResend(message.id, text)}
                    />
                  ))}
                </div>
              )}
              <div ref={bottomRef} className="h-px scroll-mb-24" aria-hidden="true" />
            </div>

            <div className="sticky bottom-0 border-t border-border bg-surface/75 px-6 py-3 backdrop-blur">
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
        </Panel>
      </div>
    </div>
  );
}

/** Render text with case-insensitive matches of `query` highlighted. */
function HighlightText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;
  return (
    <>
      {splitHighlight(text, query).map((part, i) =>
        part.hit ? (
          <mark key={i} className="rounded-sm bg-primary/25 text-foreground">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}

function MessageBubble({
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
          ref={(el) => el?.focus()}
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
        </div>
      ) : null}
    </div>
  );
}
