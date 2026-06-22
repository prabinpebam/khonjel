import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Mic, Pencil, Trash2, X } from "lucide-react";
import { useServices } from "@services";
import type { HistoryEntry } from "@services/ports";
import { useAsync } from "@hooks/useAsync";
import { useSettingsStore } from "@stores/settings";
import { useUiStore } from "@stores/ui";
import { EMPTY_INSIGHTS } from "@lib/defaults";
import { PageHeader } from "@components/common/PageHeader";
import { StatCard } from "@components/common/StatCard";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Keycap } from "@components/ui/keycap";
import { Textarea } from "@components/ui/textarea";
import { dayKey, formatDateLabel, formatDuration, formatNumber, formatTime } from "@lib/format";

export function Home() {
  const { profile, content } = useServices();
  const setActiveView = useUiStore((s) => s.setActiveView);
  const openSettings = useUiStore((s) => s.openSettings);
  const hotkey = useSettingsStore((s) => s.values["hotkey.dictation"] ?? "Ctrl+Shift+Space");
  const [firstName, setFirstName] = useState("You");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    let live = true;
    void profile.get().then((p) => {
      if (live) setFirstName(p.name.split(" ")[0] ?? p.name);
    });
    return () => {
      live = false;
    };
  }, [profile]);

  useEffect(() => {
    let live = true;
    void content.history().then((h) => {
      if (!live) return;
      setHistory(h);
      loadedRef.current = true;
    });
    return () => {
      live = false;
    };
  }, [content]);

  // Persist edits/deletes back to the durable store.
  useEffect(() => {
    if (loadedRef.current) void content.saveHistory(history);
  }, [history, content]);

  const insights = useAsync(() => content.insights(), EMPTY_INSIGHTS);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryEntry[]>();
    for (const entry of history) {
      const key = dayKey(entry.createdAt);
      const list = map.get(key) ?? [];
      list.push(entry);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [history]);

  function removeEntry(id: string) {
    setHistory((prev) => prev.filter((e) => e.id !== id));
  }

  function saveEntry(id: string, finalText: string) {
    setHistory((prev) => prev.map((e) => (e.id === id ? { ...e, finalText } : e)));
  }

  return (
    <div>
      <PageHeader title={`Welcome back, ${firstName}`} description="Your dictation history and stats." />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_var(--rail-width)]">
        <section>
          {history.length === 0 ? (
            <EmptyHistory
              hotkey={hotkey}
              onOpenChat={() => setActiveView("chat")}
              onConfigure={() => openSettings("hotkeys")}
            />
          ) : (
            groups.map(([key, entries]) => (
              <div key={key} className="mb-2">
                <div className="mb-1 border-b border-border-subtle pb-1 text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">
                  {formatDateLabel(entries[0]?.createdAt ?? key)}
                </div>
                {entries.map((entry) => (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    onCopy={() => void navigator.clipboard.writeText(entry.finalText)}
                    onDelete={() => removeEntry(entry.id)}
                    onSave={(text) => saveEntry(entry.id, text)}
                  />
                ))}
              </div>
            ))
          )}
        </section>

        <aside className="hidden flex-col gap-4 lg:flex">
          <div className="sticky top-0 flex flex-col gap-4">
            <StatCard
              value={formatNumber(insights.totalWords)}
              label="Total words"
              valueClassName="text-cat-home"
            />
            <StatCard
              value={formatNumber(insights.wpm)}
              label="Words / minute"
              sub={insights.wpm > 0 ? `Top ${(100 - insights.wpmPercentile).toFixed(1)}%` : undefined}
              valueClassName="text-cat-insights"
            />
            <StatCard
              value={String(insights.streak.current)}
              label="Day streak"
              sub={`Longest ${insights.streak.longest} days`}
              valueClassName="text-cat-chat"
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function HistoryRow({
  entry,
  onCopy,
  onDelete,
  onSave,
}: {
  entry: HistoryEntry;
  onCopy: () => void;
  onDelete: () => void;
  onSave: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.finalText);

  function startEdit() {
    setDraft(entry.finalText);
    setEditing(true);
  }
  function commit() {
    const text = draft.trim();
    if (text !== "") onSave(text);
    setEditing(false);
  }

  return (
    <div className="group flex gap-4 border-b border-border-subtle py-3 transition-colors hover:bg-surface-2">
      <span className="w-20 shrink-0 pt-0.5 text-xs text-tertiary-foreground">
        {formatTime(entry.createdAt)}
      </span>
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} />
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={commit}>
                <Check />
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                <X />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-foreground">{entry.finalText}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <Badge variant="neutral">{entry.app}</Badge>
              <span className="text-xs text-tertiary-foreground">
                {entry.wordCount} words &middot; {formatDuration(entry.durationSec)}
              </span>
              {entry.cleanupApplied ? (
                <span className="text-xs text-tertiary-foreground">Cleaned</span>
              ) : null}
            </div>
          </>
        )}
      </div>
      {!editing ? (
        <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <Button variant="ghost" size="icon" aria-label="Copy" onClick={onCopy}>
            <Copy />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Edit" onClick={startEdit}>
            <Pencil />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Delete"
            className="text-muted-foreground hover:text-danger"
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function EmptyHistory({
  hotkey,
  onOpenChat,
  onConfigure,
}: {
  hotkey: string;
  onOpenChat: () => void;
  onConfigure: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
      <span className="grid size-12 place-items-center rounded-pill bg-cat-home/12 text-cat-home">
        <Mic className="size-6" />
      </span>
      <p className="text-sm font-semibold text-foreground">No dictations yet</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Press <Keycap>{hotkey}</Keycap> anywhere to dictate, or start a conversation in Chat. Your
        history and stats will show up here.
      </p>
      <div className="mt-1 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onOpenChat}>
          Open Chat
        </Button>
        <Button variant="ghost" size="sm" onClick={onConfigure}>
          Configure hotkey
        </Button>
      </div>
    </div>
  );
}
