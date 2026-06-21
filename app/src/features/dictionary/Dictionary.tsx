import { useMemo, useState } from "react";
import { ArrowDownUp, ArrowRight, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { useServices } from "@services";
import type { DictionaryEntry, LibraryScope, Snippet } from "@services/ports";
import { useAsync } from "@hooks/useAsync";
import { PageHeader } from "@components/common/PageHeader";
import { PromoBanner } from "@components/common/PromoBanner";
import { Badge } from "@components/ui/badge";
import { Button } from "@components/ui/button";
import { Card } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Tabs } from "@components/ui/tabs";
import { cn } from "@lib/utils";

type HubTab = "dictionary" | "snippets";
type ScopeFilter = "all" | LibraryScope;

const SCOPES: { value: ScopeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "personal", label: "Personal" },
  { value: "team", label: "Shared with team" },
];

export function Dictionary() {
  const { content } = useServices();
  const [tab, setTab] = useState<HubTab>("dictionary");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [query, setQuery] = useState("");
  const [promoVisible, setPromoVisible] = useState(true);

  const entries = useAsync(() => content.dictionary(), [] as DictionaryEntry[]);
  const snippets = useAsync(() => content.snippets(), [] as Snippet[]);

  const q = query.trim().toLowerCase();

  const visibleEntries = useMemo(
    () =>
      entries.filter(
        (e) =>
          (scope === "all" || e.scope === scope) &&
          (q === "" ||
            (e.term ?? "").toLowerCase().includes(q) ||
            (e.trigger ?? "").toLowerCase().includes(q) ||
            (e.replacement ?? "").toLowerCase().includes(q)),
      ),
    [entries, scope, q],
  );

  const visibleSnippets = useMemo(
    () =>
      snippets.filter(
        (s) =>
          (scope === "all" || s.scope === scope) &&
          (q === "" ||
            s.trigger.toLowerCase().includes(q) ||
            s.expansion.toLowerCase().includes(q)),
      ),
    [snippets, scope, q],
  );

  return (
    <div>
      <PageHeader
        title="Dictionary"
        actions={
          <Button>
            <Plus />
            Add new
          </Button>
        }
      />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: "dictionary", label: "Dictionary" },
          { value: "snippets", label: "Snippets" },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          {SCOPES.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setScope(s.value)}
              className={cn(
                "rounded-pill px-3 py-1 text-sm transition-colors",
                scope === s.value
                  ? "bg-accent-soft text-accent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-tertiary-foreground start-2" />
            <Input
              aria-label="Search"
              placeholder="Search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-48 ps-8"
            />
          </div>
          <Button variant="ghost" size="icon" aria-label="Sort">
            <ArrowDownUp />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Refresh">
            <RefreshCw />
          </Button>
        </div>
      </div>

      {promoVisible ? (
        <div className="mb-4">
          <PromoBanner
            headline="Khonjel spells the way you do."
            supporting="Add names, jargon, and substitutions. Khonjel learns from your corrections automatically."
            chips={["Auto-learn", "Per-word", "Shared with team"]}
            onDismiss={() => setPromoVisible(false)}
          />
        </div>
      ) : null}

      <Card className="divide-y divide-border-subtle">
        {tab === "dictionary" ? (
          visibleEntries.length === 0 ? (
            <EmptyRow query={query} />
          ) : (
            visibleEntries.map((entry) => (
              <div key={entry.id} className="group flex items-center gap-3 px-5 py-3">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {entry.type === "term" ? (
                    <span className="text-sm font-semibold text-foreground">{entry.term}</span>
                  ) : (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-foreground">{entry.trigger}</span>
                      <ArrowRight className="size-3 text-tertiary-foreground" />
                      <span className="text-muted-foreground">{entry.replacement}</span>
                    </span>
                  )}
                  {entry.source === "auto-learn" ? <Badge variant="accent">Auto-learned</Badge> : null}
                  {entry.scope === "team" ? <Badge variant="neutral">Team</Badge> : null}
                </div>
                <RowActions />
              </div>
            ))
          )
        ) : visibleSnippets.length === 0 ? (
          <EmptyRow query={query} />
        ) : (
          visibleSnippets.map((snippet) => (
            <div key={snippet.id} className="group flex items-center gap-3 px-5 py-3">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                <span className="font-mono text-foreground">{snippet.trigger}</span>
                <ArrowRight className="size-3 shrink-0 text-tertiary-foreground" />
                <span className="truncate text-muted-foreground">{snippet.expansion}</span>
                {snippet.scope === "team" ? <Badge variant="neutral">Team</Badge> : null}
              </div>
              <RowActions />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function RowActions() {
  return (
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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
  );
}

function EmptyRow({ query }: { query: string }) {
  return (
    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
      {query ? `No matches for "${query}".` : "No entries yet — add new."}
    </p>
  );
}
