/**
 * Pure note-folder (group) helpers: live counts + CRUD that keeps notes consistent.
 *
 * "all" is a read-only pseudo-folder (every note); deleting a real folder UN-FILES its notes
 * (folderId -> "") rather than destroying them. BE-tested; the Notes view composes these. See the
 * F4 folder-management item in docs/archive/frontend-wiring-fixes.md.
 */
import type { Folder, Note } from "@services/ports";

export const ALL_FOLDER_ID = "all";

/** Recompute each folder's count from the notes: a real folder = its notes; "all" = every note. */
export function withFolderCounts(folders: Folder[], notes: Note[]): Folder[] {
  return folders.map((folder) =>
    folder.id === ALL_FOLDER_ID
      ? { ...folder, count: notes.length }
      : { ...folder, count: notes.filter((note) => note.folderId === folder.id).length },
  );
}

/** A folder name not already taken (case-insensitive), suffixing " 2", " 3", ... when needed. */
function uniqueName(folders: Folder[], base: string): string {
  const taken = new Set(folders.map((f) => f.name.trim().toLowerCase()));
  const name = base.trim() || "New folder";
  if (!taken.has(name.toLowerCase())) return name;
  let n = 2;
  while (taken.has(`${name} ${n}`.toLowerCase())) n += 1;
  return `${name} ${n}`;
}

/** Append a new (uniquely named) folder; returns the updated list + the new id. */
export function createFolder(
  folders: Folder[],
  name = "New folder",
  makeId: () => string = () => crypto.randomUUID(),
): { folders: Folder[]; id: string } {
  const id = makeId();
  return { folders: [...folders, { id, name: uniqueName(folders, name), count: 0 }], id };
}

/** Rename a folder (never the "all" pseudo-folder); a blank name is ignored. */
export function renameFolder(folders: Folder[], id: string, name: string): Folder[] {
  const trimmed = name.trim();
  if (!trimmed || id === ALL_FOLDER_ID) return folders;
  return folders.map((folder) => (folder.id === id ? { ...folder, name: trimmed } : folder));
}

/** Delete a real folder and un-file its notes (folderId -> ""); "all" is protected. */
export function deleteFolder(
  folders: Folder[],
  notes: Note[],
  id: string,
): { folders: Folder[]; notes: Note[] } {
  if (id === ALL_FOLDER_ID) return { folders, notes };
  return {
    folders: folders.filter((folder) => folder.id !== id),
    notes: notes.map((note) => (note.folderId === id ? { ...note, folderId: "" } : note)),
  };
}
