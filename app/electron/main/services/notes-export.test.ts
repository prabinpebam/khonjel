// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  exportNotes,
  noteFilename,
  noteMarkdown,
  noteSlug,
  type NotesExportFs,
} from "./notes-export";
import type { Note } from "../../../src/services/ports";

function note(partial: Partial<Note>): Note {
  return {
    id: "n1",
    title: "Untitled",
    preview: "",
    body: "",
    folderId: "f1",
    updatedAt: "2024-01-01T00:00:00.000Z",
    fromRecording: false,
    ...partial,
  };
}

/** In-memory fs that records writes + deletes, seeded with optional existing entries. */
function fakeFs(existing: string[] = []) {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const removed: string[] = [];
  const present = new Set(existing);
  const fs: NotesExportFs = {
    ensureDir: (dir) => dirs.add(dir),
    writeFile: (filePath, content) => {
      files.set(filePath, content);
      present.add(filePath.split("/").pop() ?? filePath);
    },
    readDir: () => [...present],
    removeFile: (filePath) => {
      removed.push(filePath);
      present.delete(filePath.split("/").pop() ?? filePath);
    },
    join: (...parts) => parts.join("/"),
  };
  return { fs, files, dirs, removed };
}

describe("noteSlug", () => {
  it("lowercases and hyphenates", () => {
    expect(noteSlug("My Great Note")).toBe("my-great-note");
  });
  it("strips punctuation and collapses separators", () => {
    expect(noteSlug("  Hello, World!!  ")).toBe("hello-world");
  });
  it("falls back to 'note' for an empty/symbol-only title", () => {
    expect(noteSlug("")).toBe("note");
    expect(noteSlug("***")).toBe("note");
  });
});

describe("noteFilename", () => {
  it("combines the slug with a short id suffix", () => {
    expect(noteFilename(note({ id: "abcdef1234", title: "Meeting" }))).toBe("meeting-abcdef12.md");
  });
});

describe("noteMarkdown", () => {
  it("renders title as H1 plus the body", () => {
    expect(noteMarkdown(note({ title: "Plan", body: "Do the thing" }))).toBe("# Plan\n\nDo the thing\n");
  });
  it("omits the body section when empty and falls back to a title", () => {
    expect(noteMarkdown(note({ title: "", body: "" }))).toBe("# Untitled note\n");
  });
});

describe("exportNotes", () => {
  it("writes one markdown file per note into the target dir", () => {
    const { fs, files, dirs } = fakeFs();
    const written = exportNotes(
      [note({ id: "a1b2c3d4", title: "First", body: "one" }), note({ id: "e5f6a7b8", title: "Second", body: "two" })],
      "/notes",
      fs,
    );
    expect(dirs.has("/notes")).toBe(true);
    expect(written).toEqual(["first-a1b2c3d4.md", "second-e5f6a7b8.md"]);
    expect(files.get("/notes/first-a1b2c3d4.md")).toBe("# First\n\none\n");
    expect(files.get("/notes/second-e5f6a7b8.md")).toBe("# Second\n\ntwo\n");
  });

  it("prunes our own previously-exported files whose note was deleted", () => {
    const { fs, removed } = fakeFs(["stale-deadbeef.md", "first-a1b2c3d4.md"]);
    exportNotes([note({ id: "a1b2c3d4", title: "First", body: "one" })], "/notes", fs);
    expect(removed).toEqual(["/notes/stale-deadbeef.md"]);
  });

  it("never deletes files that aren't our exports", () => {
    const { fs, removed } = fakeFs(["README.md", "user-keep.txt"]);
    exportNotes([], "/notes", fs);
    expect(removed).toEqual([]);
  });
});
