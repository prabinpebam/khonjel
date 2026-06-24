/**
 * Export the user's notes to markdown files on disk -- the "Save notes as files" setting. One file
 * per note, named from a slug of the title plus a short id suffix so the filename stays stable +
 * unique across renames and duplicate titles. Filesystem ops are injected so the planner is
 * BE1-tested without fs; main wires the real fs + target directory.
 */
import type { Note } from "../../../src/services/ports";

export interface NotesExportFs {
  ensureDir: (dir: string) => void;
  writeFile: (filePath: string, content: string) => void;
  /** List a directory's entries; return [] if it doesn't exist. */
  readDir: (dir: string) => string[];
  removeFile: (filePath: string) => void;
  join: (...parts: string[]) => string;
}

/** Only files matching this suffix were written by us, so pruning never touches the user's own files. */
const EXPORTED_SUFFIX = /-[a-z0-9]{1,8}\.md$/i;

/** PURE: turn a note title into a filesystem-safe slug (lowercase words joined by '-'). */
export function noteSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug.length > 0 ? slug : "note";
}

/** PURE: the filename for a note -- `<slug>-<id8>.md`, unique + stable per note id. */
export function noteFilename(note: Note): string {
  const id8 = note.id.replace(/[^a-z0-9]/gi, "").slice(0, 8) || "00000000";
  return `${noteSlug(note.title)}-${id8}.md`;
}

/** PURE: the markdown written for a note -- the title as an H1 followed by the body. */
export function noteMarkdown(note: Note): string {
  const title = note.title.trim() || "Untitled note";
  const body = note.body.trim();
  return body.length > 0 ? `# ${title}\n\n${body}\n` : `# ${title}\n`;
}

/**
 * Mirror `notes` into `dir`: write one .md per note, then delete any previously-exported .md whose
 * note no longer exists (pruning is limited to our own `*-<id>.md` files). Returns the filenames
 * written, in note order.
 */
export function exportNotes(notes: Note[], dir: string, fs: NotesExportFs): string[] {
  fs.ensureDir(dir);
  const wanted = new Map<string, Note>();
  for (const note of notes) wanted.set(noteFilename(note), note);
  for (const [name, note] of wanted) {
    fs.writeFile(fs.join(dir, name), noteMarkdown(note));
  }
  for (const name of fs.readDir(dir)) {
    if (EXPORTED_SUFFIX.test(name) && !wanted.has(name)) {
      fs.removeFile(fs.join(dir, name));
    }
  }
  return [...wanted.keys()];
}
