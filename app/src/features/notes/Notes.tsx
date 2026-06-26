import { useEffect, useMemo, useRef, useState } from "react";
import { FolderPlus, Loader2, Mic, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useServices } from "@services";
import type { Folder, Note } from "@services/ports";
import { useDictationField } from "@hooks/useDictationField";
import { useAutoFocus } from "@hooks/useAutoFocus";
import { PageHeader } from "@components/common/PageHeader";
import { MicWaveform } from "@components/common/MicWaveform";
import { SearchInput } from "@components/common/SearchInput";
import { Panel } from "@components/common/Panel";
import { Button } from "@components/ui/button";
import { Select } from "@components/ui/select";
import { Textarea } from "@components/ui/textarea";
import { formatRelative } from "@lib/format";
import { ALL_FOLDER_ID, createFolder, deleteFolder, renameFolder, withFolderCounts } from "@lib/notes/folders";
import { cn } from "@lib/utils";

function preview(body: string): string {
  return body.slice(0, 140).replace(/\s+/g, " ").trim();
}

export function Notes() {
  const { content, inference } = useServices();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [folderId, setFolderId] = useState(ALL_FOLDER_ID);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const autoFocusRename = useAutoFocus<HTMLInputElement>({ select: true });
  const [busy, setBusy] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    let live = true;
    void Promise.all([content.notes(), content.folders()]).then(([loadedNotes, loadedFolders]) => {
      if (!live) return;
      setNotes(loadedNotes);
      setFolders(loadedFolders);
      setSelectedId((cur) => cur ?? loadedNotes[0]?.id ?? null);
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

  // Persist folder (group) changes with live counts.
  useEffect(() => {
    if (!loadedRef.current) return;
    const timer = setTimeout(() => void content.saveFolders(withFolderCounts(folders, notes)), 500);
    return () => clearTimeout(timer);
  }, [folders, notes, content]);

  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const selectedIdValue = selected?.id ?? null;

  const levelRef = useRef(0);
  const dictation = useDictationField(
    selected?.body ?? "",
    (next) => {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === selectedIdValue
            ? { ...n, body: next, preview: preview(next), updatedAt: new Date().toISOString() }
            : n,
        ),
      );
    },
    { onLevel: (n) => (levelRef.current = n) },
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((note) => {
      const inFolder = folderId === ALL_FOLDER_ID || note.folderId === folderId;
      const matches =
        q === "" || note.title.toLowerCase().includes(q) || note.preview.toLowerCase().includes(q);
      return inFolder && matches;
    });
  }, [notes, folderId, query]);

  const displayFolders = useMemo(() => withFolderCounts(folders, notes), [folders, notes]);

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
      folderId: folderId === ALL_FOLDER_ID ? "" : folderId,
      updatedAt: new Date().toISOString(),
      fromRecording: false,
    };
    setNotes((prev) => [note, ...prev]);
    setSelectedId(note.id);
  }

  function addFolder() {
    const { folders: next, id } = createFolder(folders);
    setFolders(next);
    setFolderId(id);
    setRenamingFolderId(id);
  }

  function commitFolderRename(id: string, name: string) {
    setFolders((prev) => renameFolder(prev, id, name));
    setRenamingFolderId(null);
  }

  function removeFolder(id: string) {
    const result = deleteFolder(folders, notes, id);
    setFolders(result.folders);
    setNotes(result.notes);
    if (folderId === id) setFolderId(ALL_FOLDER_ID);
    setRenamingFolderId((cur) => (cur === id ? null : cur));
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
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader
        title="Notes"
        actions={
          <Button onClick={createNote}>
            <Plus />
            New note
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 gap-4">
        <Panel as="aside" className="w-52 shrink-0">
          <div className="border-b border-border p-2.5">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search notes…"
              aria-label="Search notes"
            />
          </div>
          <div className="flex items-center justify-between px-3 pb-1 pt-2.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">Folders</span>
            <button
              type="button"
              aria-label="New folder"
              data-eval="folder-new"
              onClick={addFolder}
              className="rounded p-1 text-tertiary-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <FolderPlus className="size-4" />
            </button>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 pb-2" aria-label="Folders">
            {displayFolders.map((folder) => {
              const active = folder.id === folderId;
              const editable = folder.id !== ALL_FOLDER_ID;
              return (
                <div
                  key={folder.id}
                  data-eval="folder-row"
                  className={cn(
                    "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-surface-2 text-foreground"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
                  )}
                >
                  {renamingFolderId === folder.id ? (
                    <input
                      ref={autoFocusRename}
                      defaultValue={folder.name}
                      aria-label="Folder name"
                      data-eval="folder-rename-input"
                      className="min-w-0 flex-1 rounded-sm bg-surface px-1 text-sm text-foreground outline-none ring-1 ring-ring"
                      onBlur={(e) => commitFolderRename(folder.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitFolderRename(folder.id, e.currentTarget.value);
                        if (e.key === "Escape") setRenamingFolderId(null);
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setFolderId(folder.id)}
                      onDoubleClick={() => editable && setRenamingFolderId(folder.id)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                    >
                      <span className="truncate">{folder.name}</span>
                      <span className="shrink-0 text-xs text-tertiary-foreground">{folder.count}</span>
                    </button>
                  )}
                  {editable && renamingFolderId !== folder.id ? (
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        aria-label="Rename folder"
                        data-eval="folder-rename"
                        onClick={() => setRenamingFolderId(folder.id)}
                      >
                        <Pencil className="size-3.5 text-tertiary-foreground hover:text-foreground" />
                      </button>
                      <button
                        type="button"
                        aria-label="Delete folder"
                        data-eval="folder-delete"
                        onClick={() => removeFolder(folder.id)}
                      >
                        <Trash2 className="size-3.5 text-tertiary-foreground hover:text-danger" />
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
        </Panel>

        <Panel className="w-72 shrink-0">
          <div className="flex-1 overflow-y-auto">
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
                    data-eval="note-row"
                    onClick={() => setSelectedId(note.id)}
                    className={cn(
                      "flex w-full flex-col gap-1 border-b border-border-subtle px-4 py-3 text-left transition-colors",
                      active ? "bg-surface-2" : "hover:bg-surface-2",
                    )}
                  >
                    <span className="truncate text-sm font-semibold text-foreground">{note.title}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{note.preview}</span>
                    <span className="text-xs text-tertiary-foreground">{formatRelative(note.updatedAt)}</span>
                  </button>
                );
              })
            )}
          </div>
        </Panel>

        <Panel className="min-w-0 flex-1">
          {selected ? (
            <>
              <div className="flex items-center gap-2 border-b border-border p-4">
                <input
                  aria-label="Note title"
                  value={selected.title}
                  onChange={(e) => updateSelected({ title: e.target.value })}
                  className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-foreground outline-none"
                />
                <Select
                  aria-label="Move to folder"
                  data-eval="note-folder"
                  className="w-40 shrink-0"
                  value={selected.folderId}
                  onValueChange={(folderId) => updateSelected({ folderId })}
                  options={[
                    { value: "", label: "Uncategorized" },
                    ...folders
                      .filter((f) => f.id !== ALL_FOLDER_ID)
                      .map((f) => ({ value: f.id, label: f.name })),
                  ]}
                />
                {dictation.status === "recording" && (
                  <MicWaveform levelRef={levelRef} active barCount={18} className="h-8 w-16 shrink-0" />
                )}
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
                className="min-h-0 flex-1 resize-none rounded-none border-0 font-mono"
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
        </Panel>
      </div>
    </div>
  );
}
