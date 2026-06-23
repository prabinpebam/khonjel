import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, SendHorizontal } from "lucide-react";
import { useServices } from "@services";
import type { ChatMessage } from "@services/ports";
import { useDictationField } from "@hooks/useDictationField";
import { useActiveModel } from "@hooks/useActiveModel";
import { PageHeader } from "@components/common/PageHeader";
import { MicWaveform } from "@components/common/MicWaveform";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Textarea } from "@components/ui/textarea";
import { cn } from "@lib/utils";

const SUGGESTIONS = ["Rewrite that note", "Plan my day", "Summarize my last meeting", "Draft a reply"];

export function Chat() {
  const { content, inference } = useServices();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const levelRef = useRef(0);
  const dictation = useDictationField(input, setInput, {
    onLevel: (n) => (levelRef.current = n),
  });
  const llm = useActiveModel("llm.chat", "llm");
  const loadedRef = useRef(false);

  useEffect(() => {
    let live = true;
    void content.chat().then((m) => {
      if (!live) return;
      setMessages(m);
      loadedRef.current = true;
    });
    return () => {
      live = false;
    };
  }, [content]);

  // Persist the conversation so it survives a reload.
  useEffect(() => {
    if (loadedRef.current) void content.saveChat(messages);
  }, [messages, content]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || pending) return;
    const now = new Date().toISOString();
    const user: ChatMessage = { id: crypto.randomUUID(), role: "user", content: value, createdAt: now };
    const pendingId = crypto.randomUUID();
    const placeholder: ChatMessage = { id: pendingId, role: "assistant", content: "\u2026", createdAt: now };
    const conversation = [...messages, user].map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, user, placeholder]);
    setInput("");
    setPending(true);
    try {
      const { text: reply } = await inference.chat(conversation);
      setMessages((prev) => prev.map((m) => (m.id === pendingId ? { ...m, content: reply } : m)));
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === pendingId ? { ...m, content: "Sorry, I could not reach the model." } : m,
        ),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Chat"
        actions={
          <Badge variant="accent" data-eval="chat-model">{`${llm.scope} \u00b7 ${llm.model}`}</Badge>
        }
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
          <div className="flex flex-col gap-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[72%] whitespace-pre-wrap rounded-lg px-4 py-2.5 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border bg-surface-2 text-foreground",
                  )}
                >
                  {message.content}
                </div>
              </div>
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
            placeholder="Message Khonjel…"
            className="max-h-32 min-h-11 flex-1 resize-none"
          />
          <Button aria-label="Send" onClick={() => send(input)}>
            <SendHorizontal />
          </Button>
        </div>
      </div>
    </div>
  );
}
