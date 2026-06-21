import { useEffect, useMemo, useState } from "react";
import { Mic, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useServices } from "@services";
import type { Folder, Note } from "@services/ports";
import { useAsync } from "@hooks/useAsync";
import { PageHeader } from "@components/common/PageHeader";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { formatRelative } from "@lib/format";
import { cn } from "@lib/utils";

export function Notes() {
  const { content } = useServices();
  const folders = useAsync(() => content.folders(), [] as Folder[]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folderId, setFolderId] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void content.notes().then((loaded) => {
      if (!live) return;
      setNotes(loaded);
      setSelectedId((cur) => cur ?? loaded[0]?.id ?? null);
    });
    return () => {
      live = false;
    };
  }, [content]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((note) => {
      const inFolder = folderId === "all" || note.folderId === folderId;
      const matches =
        q === "" || note.title.toLowerCase().includes(q) || note.preview.toLowerCase().includes(q);
      return inFolder && matches;
    });
  }, [notes, folderId, query]);

  const selected = notes.find((note) => note.id === selectedId) ?? null;

  function updateSelected(patch: Partial<Note>) {
    if (!selected) return;
    setNotes((prev) => prev.map((n) => (n.id === selected.id ? { ...n, ...patch } : n)));
  }

  return (
    <div>
      <PageHeader
        title="Notes"
        actions={
          <Button>
            <Plus />
            New note
          </Button>
        }
      />

      <div className="grid h-[70vh] grid-cols-[minmax(140px,168px)_minmax(180px,232px)_minmax(0,1fr)] gap-4">
        <aside className="flex flex-col gap-3 overflow-y-auto">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 size-4 -translate-y-1/2 text-tertiary-foreground start-2" />
            <Input
              aria-label="Search notes"
              placeholder="Search notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="ps-8"
            />
          </div>
          <nav className="flex flex-col gap-0.5">
            {folders.map((folder) => {
              const active = folder.id === folderId;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setFolderId(folder.id)}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-surface text-foreground shadow-nav"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  <span className="truncate">{folder.name}</span>
                  <span className="text-xs text-tertiary-foreground">{folder.count}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="overflow-y-auto rounded-md border border-border bg-surface">
          {filtered.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">
              {query ? `No matches for "${query}".` : "No notes in this folder."}
            </p>
          ) : (
            filtered.map((note) => {
              const active = note.id === selectedId;
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelectedId(note.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 border-b border-border-subtle px-4 py-3 text-left transition-colors",
                    active ? "bg-surface-2" : "hover:bg-surface-2",
                  )}
                >
                  <span className="truncate text-sm font-semibold text-foreground">{note.title}</span>
                  <span className="line-clamp-2 text-xs text-muted-foreground">{note.preview}</span>
                  <span className="text-xs text-tertiary-foreground">
                    {formatRelative(note.updatedAt)}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="flex min-w-0 flex-col rounded-md border border-border bg-surface">
          {selected ? (
            <>
              <div className="flex items-center gap-2 border-b border-border p-4">
                <input
                  aria-label="Note title"
                  value={selected.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-foreground outline-none"
                />
                <Button variant="ghost" size="icon" aria-label="Record and append">
                  <Mic />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete note"
                  className="text-muted-foreground hover:text-danger"
                >
                  <Trash2 />
                </Button>
              </div>
              <Textarea
                aria-label="Note body"
                value={selected.body}
                onChange={(e) => updateSelected({ body: e.target.value })}
                className="flex-1 resize-none rounded-none border-0 font-mono"
              />
              <div className="flex flex-wrap items-center gap-2 border-t border-border p-3">
                <Button variant="secondary" size="sm">
                  <Sparkles />
                  Summarize
                </Button>
                <Button variant="secondary" size="sm">
                  Rewrite
                </Button>
                <Button variant="secondary" size="sm">
                  Extract todos
                </Button>
              </div>
            </>
          ) : (
            <div className="grid flex-1 place-items-center text-sm text-muted-foreground">
              Select a note to start editing.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
