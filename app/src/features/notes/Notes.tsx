import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Mic, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useServices } from "@services";
import type { Folder, Note } from "@services/ports";
import { useAsync } from "@hooks/useAsync";
import { useDictation } from "@hooks/useDictation";
import { PageHeader } from "@components/common/PageHeader";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { formatRelative } from "@lib/format";
import { cn } from "@lib/utils";

function preview(body: string): string {
  return body.slice(0, 140).replace(/\s+/g, " ").trim();
}

export function Notes() {
  const { content, inference } = useServices();
  const folders = useAsync(() => content.folders(), [] as Folder[]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folderId, setFolderId] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    let live = true;
    void content.notes().then((loaded) => {
      if (!live) return;
      setNotes(loaded);
      setSelectedId((cur) => cur ?? loaded[0]?.id ?? null);
      loadedRef.current = true;
    });
    return () => {
      live = false;
    };
  }, [content]);

  // Persist edits to the durable store (debounced so typing is not a write per keystroke).
  useEffect(() => {
    if (!loadedRef.current) return;
    const timer = setTimeout(() => void content.saveNotes(notes), 500);
    return () => clearTimeout(timer);
  }, [notes, content]);

  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const selectedIdValue = selected?.id ?? null;

  const dictation = useDictation((text) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === selectedIdValue
          ? {
              ...n,
              body: n.body ? `${n.body} ${text}` : text,
              preview: preview(n.body ? `${n.body} ${text}` : text),
              updatedAt: new Date().toISOString(),
            }
          : n,
      ),
    );
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((note) => {
      const inFolder = folderId === "all" || note.folderId === folderId;
      const matches =
        q === "" || note.title.toLowerCase().includes(q) || note.preview.toLowerCase().includes(q);
      return inFolder && matches;
    });
  }, [notes, folderId, query]);

  function updateSelected(patch: Partial<Note>) {
    if (!selected) return;
    setNotes((prev) =>
      prev.map((n) => {
        if (n.id !== selected.id) return n;
        const next = { ...n, ...patch, updatedAt: new Date().toISOString() };
        if (patch.body !== undefined) next.preview = preview(patch.body);
        return next;
      }),
    );
  }

  function createNote() {
    const note: Note = {
      id: crypto.randomUUID(),
      title: "Untitled note",
      preview: "",
      body: "",
      folderId: folderId === "all" ? (folders[0]?.id ?? "all") : folderId,
      updatedAt: new Date().toISOString(),
      fromRecording: false,
    };
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
  }

  function deleteSelected() {
    if (!selected) return;
    const id = selected.id;
    setNotes((prev) => prev.filter((n) => n.id !== id));
    setSelectedId(notes.find((n) => n.id !== id)?.id ?? null);
  }

  async function runAction(label: string, instruction: string, replace: boolean) {
    if (!selected || busy || !selected.body.trim()) return;
    setBusy(true);
    try {
      const { text } = await inference.chat([
        { role: "user", content: `${instruction}\n\n---\n${selected.body}` },
      ]);
      const result = text.trim();
      if (result) {
        updateSelected({ body: replace ? result : `${selected.body}\n\n## ${label}\n${result}` });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Notes"
        actions={
          <Button onClick={createNote}>
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
                <Button
                  variant={dictation.status === "recording" ? "destructive" : "ghost"}
                  size="icon"
                  aria-label={dictation.status === "recording" ? "Stop recording" : "Record and append"}
                  disabled={dictation.status === "transcribing"}
                  onClick={dictation.toggle}
                >
                  {dictation.status === "transcribing" ? <Loader2 className="animate-spin" /> : <Mic />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete note"
                  className="text-muted-foreground hover:text-danger"
                  onClick={deleteSelected}
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
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void runAction("Summary", "Summarize this note as a few concise bullet points.", false)
                  }
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  Summarize
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void runAction(
                      "Rewrite",
                      "Rewrite this note to be clear and well-structured. Return only the rewritten note.",
                      true,
                    )
                  }
                >
                  Rewrite
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    void runAction("Todos", "Extract action items from this note as a Markdown checklist.", false)
                  }
                >
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
