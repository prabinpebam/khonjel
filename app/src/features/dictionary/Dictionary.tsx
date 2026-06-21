import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownUp, ArrowRight, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useServices } from "@services";
import type { DictionaryEntry, LibraryScope, Snippet } from "@services/ports";
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

interface Draft {
  id: string | null;
  kind: "term" | "substitution" | "snippet";
  a: string;
  b: string;
  scope: LibraryScope;
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...list];
  const copy = list.slice();
  copy[idx] = item;
  return copy;
}

export function Dictionary() {
  const { content } = useServices();
  const [tab, setTab] = useState<HubTab>("dictionary");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [query, setQuery] = useState("");
  const [promoVisible, setPromoVisible] = useState(true);
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const loadedRef = useRef(false);

  useEffect(() => {
    let live = true;
    void Promise.all([content.dictionary(), content.snippets()]).then(([d, s]) => {
      if (!live) return;
      setEntries(d);
      setSnippets(s);
      loadedRef.current = true;
    });
    return () => {
      live = false;
    };
  }, [content]);

  // Persist edits so the dictionary that powers dictation stays in sync.
  useEffect(() => {
    if (loadedRef.current) void content.saveDictionary(entries);
  }, [entries, content]);
  useEffect(() => {
    if (loadedRef.current) void content.saveSnippets(snippets);
  }, [snippets, content]);

  function startAdd() {
    setDraft({
      id: null,
      kind: tab === "snippets" ? "snippet" : "term",
      a: "",
      b: "",
      scope: "personal",
    });
  }

  function editEntry(entry: DictionaryEntry) {
    setDraft({
      id: entry.id,
      kind: entry.type,
      a: (entry.type === "term" ? entry.term : entry.trigger) ?? "",
      b: entry.replacement ?? "",
      scope: entry.scope,
    });
  }

  function editSnippet(snippet: Snippet) {
    setDraft({
      id: snippet.id,
      kind: "snippet",
      a: snippet.trigger,
      b: snippet.expansion,
      scope: snippet.scope,
    });
  }

  function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }

  function deleteSnippet(id: string) {
    setSnippets((prev) => prev.filter((s) => s.id !== id));
  }

  function saveDraft() {
    if (!draft) return;
    const a = draft.a.trim();
    if (a === "") return;
    const id = draft.id ?? globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}`;
    if (draft.kind === "snippet") {
      const next: Snippet = { id, trigger: a, expansion: draft.b.trim(), scope: draft.scope };
      setSnippets((prev) => upsert(prev, next));
    } else if (draft.kind === "term") {
      const next: DictionaryEntry = { id, type: "term", term: a, scope: draft.scope, source: "manual" };
      setEntries((prev) => upsert(prev, next));
    } else {
      const next: DictionaryEntry = {
        id,
        type: "substitution",
        trigger: a,
        replacement: draft.b.trim(),
        scope: draft.scope,
        source: "manual",
      };
      setEntries((prev) => upsert(prev, next));
    }
    setDraft(null);
  }

  const q = query.trim().toLowerCase();

  const visibleEntries = useMemo(
    () =>
      entries
        .filter(
          (e) =>
            (scope === "all" || e.scope === scope) &&
            (q === "" ||
              (e.term ?? "").toLowerCase().includes(q) ||
              (e.trigger ?? "").toLowerCase().includes(q) ||
              (e.replacement ?? "").toLowerCase().includes(q)),
        )
        .sort((a, b) => {
          const ka = (a.term ?? a.trigger ?? "").toLowerCase();
          const kb = (b.term ?? b.trigger ?? "").toLowerCase();
          return sortAsc ? ka.localeCompare(kb) : kb.localeCompare(ka);
        }),
    [entries, scope, q, sortAsc],
  );

  const visibleSnippets = useMemo(
    () =>
      snippets
        .filter(
          (s) =>
            (scope === "all" || s.scope === scope) &&
            (q === "" ||
              s.trigger.toLowerCase().includes(q) ||
              s.expansion.toLowerCase().includes(q)),
        )
        .sort((a, b) =>
          sortAsc
            ? a.trigger.toLowerCase().localeCompare(b.trigger.toLowerCase())
            : b.trigger.toLowerCase().localeCompare(a.trigger.toLowerCase()),
        ),
    [snippets, scope, q, sortAsc],
  );

  return (
    <div>
      <PageHeader
        title="Dictionary"
        actions={
          <Button onClick={startAdd}>
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
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sort"
            title={sortAsc ? "Sort Z to A" : "Sort A to Z"}
            onClick={() => setSortAsc((v) => !v)}
          >
            <ArrowDownUp />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Refresh"
            title="Reload from store"
            onClick={() => {
              void content.dictionary().then(setEntries);
              void content.snippets().then(setSnippets);
            }}
          >
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

      {draft ? (
        <DraftEditor draft={draft} onChange={setDraft} onSave={saveDraft} onCancel={() => setDraft(null)} />
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
                <RowActions onEdit={() => editEntry(entry)} onDelete={() => deleteEntry(entry.id)} />
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
              <RowActions onEdit={() => editSnippet(snippet)} onDelete={() => deleteSnippet(snippet.id)} />
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <Button variant="ghost" size="icon" aria-label="Edit" onClick={onEdit}>
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
  );
}

function DraftEditor({
  draft,
  onChange,
  onSave,
  onCancel,
}: {
  draft: Draft;
  onChange: (d: Draft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const isSnippet = draft.kind === "snippet";
  const hasReplacement = draft.kind === "substitution" || isSnippet;
  return (
    <Card className="mb-4 space-y-3 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">
          {draft.id ? "Edit entry" : "Add entry"}
        </span>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={onCancel}>
          <X />
        </Button>
      </div>
      {!isSnippet ? (
        <div className="flex items-center gap-1">
          {(["term", "substitution"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onChange({ ...draft, kind: k })}
              className={cn(
                "rounded-pill px-3 py-1 text-sm capitalize transition-colors",
                draft.kind === k ? "bg-accent-soft text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft.a}
          onChange={(e) => onChange({ ...draft, a: e.target.value })}
          placeholder={draft.kind === "term" ? "Word or phrase" : "Trigger"}
        />
        {hasReplacement ? (
          <Input
            value={draft.b}
            onChange={(e) => onChange({ ...draft, b: e.target.value })}
            placeholder={isSnippet ? "Expansion" : "Replacement"}
          />
        ) : null}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {(["personal", "team"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange({ ...draft, scope: s })}
              className={cn(
                "rounded-pill px-3 py-1 text-sm capitalize transition-colors",
                draft.scope === s ? "bg-accent-soft text-accent" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <Button onClick={onSave} disabled={draft.a.trim() === ""}>
          Save
        </Button>
      </div>
    </Card>
  );
}

function EmptyRow({ query }: { query: string }) {
  return (
    <p className="px-5 py-8 text-center text-sm text-muted-foreground">
      {query ? `No matches for "${query}".` : "No entries yet — add new."}
    </p>
  );
}
