import { useEffect, useMemo, useState } from "react";
import { Copy, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { useServices } from "@services";
import type { HistoryEntry } from "@services/ports";
import { PageHeader } from "@components/common/PageHeader";
import { StatCard } from "@components/common/StatCard";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Card } from "@components/ui/card";
import { dayKey, formatDateLabel, formatDuration, formatNumber, formatTime } from "@lib/format";

export function Home() {
  const { profile, content } = useServices();
  const [firstName, setFirstName] = useState("You");

  useEffect(() => {
    let live = true;
    void profile.get().then((p) => {
      if (live) setFirstName(p.name.split(" ")[0] ?? p.name);
    });
    return () => {
      live = false;
    };
  }, [profile]);

  const history = content.history();
  const insights = content.insights();

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

  return (
    <div>
      <PageHeader title={`Welcome back, ${firstName}`} description="Your dictation history and stats." />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1fr_var(--rail-width)]">
        <section>
          {groups.map(([key, entries]) => (
            <div key={key} className="mb-2">
              <div className="mb-1 border-b border-border-subtle pb-1 text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">
                {formatDateLabel(entries[0]?.createdAt ?? key)}
              </div>
              {entries.map((entry) => (
                <HistoryRow key={entry.id} entry={entry} />
              ))}
            </div>
          ))}
        </section>

        <aside className="hidden flex-col gap-4 xl:flex">
          <div className="sticky top-0 flex flex-col gap-4">
            <StatCard
              value={formatNumber(insights.totalWords)}
              label="Total words"
              valueClassName="text-cat-home"
            />
            <StatCard
              value={formatNumber(insights.wpm)}
              label="Words / minute"
              sub={`Top ${(100 - insights.wpmPercentile).toFixed(1)}%`}
              valueClassName="text-cat-insights"
            />
            <StatCard
              value={String(insights.streak.current)}
              label="Day streak"
              sub={`Longest ${insights.streak.longest} days`}
              valueClassName="text-cat-chat"
            />
            <Card className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">
                Voice profile
              </p>
              <p className="mt-2 text-sm font-semibold text-foreground">Design Critique</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tuned from your recent dictation style.
              </p>
            </Card>
          </div>
        </aside>
      </div>
    </div>
  );
}

function HistoryRow({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="group flex gap-4 border-b border-border-subtle py-3 transition-colors hover:bg-surface-2">
      <span className="w-20 shrink-0 pt-0.5 text-xs text-tertiary-foreground">
        {formatTime(entry.createdAt)}
      </span>
      <div className="min-w-0 flex-1">
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
      </div>
      <div className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <Button variant="ghost" size="icon" aria-label="Copy">
          <Copy />
        </Button>
        {entry.hasAudio ? (
          <Button variant="ghost" size="icon" aria-label="Re-transcribe">
            <RotateCcw />
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" aria-label="Edit">
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Delete"
          className="text-muted-foreground hover:text-danger"
        >
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}
