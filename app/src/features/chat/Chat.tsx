import { useEffect, useState } from "react";
import { Mic, SendHorizontal } from "lucide-react";
import { useServices } from "@services";
import type { ChatMessage } from "@services/ports";
import { PageHeader } from "@components/common/PageHeader";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Textarea } from "@components/ui/textarea";
import { cn } from "@lib/utils";

const SUGGESTIONS = ["Rewrite that note", "Plan my day", "Summarize my last meeting", "Draft a reply"];

export function Chat() {
  const { content } = useServices();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  useEffect(() => {
    let live = true;
    void content.chat().then((m) => {
      if (live) setMessages(m);
    });
    return () => {
      live = false;
    };
  }, [content]);

  function send(text: string) {
    const value = text.trim();
    if (!value) return;
    const now = new Date().toISOString();
    const user: ChatMessage = { id: crypto.randomUUID(), role: "user", content: value, createdAt: now };
    const reply: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "This is a mock reply. Connect a real model in Settings -> Language Models -> Chat.",
      createdAt: now,
    };
    setMessages((prev) => [...prev, user, reply]);
    setInput("");
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Chat"
        actions={<Badge variant="accent">Local · Qwen 3.5 4B</Badge>}
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
          <Button variant="ghost" size="icon" aria-label="Voice input">
            <Mic />
          </Button>
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
