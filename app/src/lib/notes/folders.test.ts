import { describe, it, expect } from "vitest";
import { ALL_FOLDER_ID, withFolderCounts, createFolder, renameFolder, deleteFolder } from "./folders";
import type { Folder, Note } from "@services/ports";

const folder = (id: string, name: string, count = 0): Folder => ({ id, name, count });
const note = (id: string, folderId: string): Note => ({
  id,
  title: id,
  preview: "",
  body: "",
  folderId,
  updatedAt: "",
  fromRecording: false,
});

describe("withFolderCounts", () => {
  it("counts notes per folder and totals the 'all' pseudo-folder", () => {
    const folders = [folder("all", "All notes"), folder("a", "A"), folder("b", "B")];
    const notes = [note("1", "a"), note("2", "a"), note("3", "b")];
    const out = withFolderCounts(folders, notes);
    expect(out.find((f) => f.id === "all")?.count).toBe(3);
    expect(out.find((f) => f.id === "a")?.count).toBe(2);
    expect(out.find((f) => f.id === "b")?.count).toBe(1);
  });

  it("does not count un-filed notes toward any real folder", () => {
    const out = withFolderCounts([folder("all", "All"), folder("a", "A")], [note("1", "")]);
    expect(out.find((f) => f.id === "all")?.count).toBe(1);
    expect(out.find((f) => f.id === "a")?.count).toBe(0);
  });
});

describe("createFolder", () => {
  it("appends a folder with the new id and a zero count", () => {
    const { folders, id } = createFolder([folder("all", "All")], "Work", () => "f1");
    expect(id).toBe("f1");
    expect(folders).toHaveLength(2);
    expect(folders[1]).toMatchObject({ id: "f1", name: "Work", count: 0 });
  });

  it("disambiguates a duplicate name", () => {
    const { folders } = createFolder([folder("all", "All"), folder("a", "Work")], "Work", () => "f1");
    expect(folders[2]?.name).toBe("Work 2");
  });

  it("falls back to 'New folder' for a blank name", () => {
    const { folders } = createFolder([folder("all", "All")], "   ", () => "f1");
    expect(folders[1]?.name).toBe("New folder");
  });
});

describe("renameFolder", () => {
  it("renames a real folder, trimming whitespace", () => {
    expect(renameFolder([folder("a", "A")], "a", "  New  ")).toEqual([folder("a", "New")]);
  });

  it("ignores a blank name", () => {
    expect(renameFolder([folder("a", "A")], "a", "   ")).toEqual([folder("a", "A")]);
  });

  it("never renames the 'all' pseudo-folder", () => {
    expect(renameFolder([folder(ALL_FOLDER_ID, "All notes")], ALL_FOLDER_ID, "Hacked")).toEqual([
      folder(ALL_FOLDER_ID, "All notes"),
    ]);
  });
});

describe("deleteFolder", () => {
  it("removes the folder and un-files its notes", () => {
    const folders = [folder("all", "All"), folder("a", "A")];
    const notes = [note("1", "a"), note("2", "b")];
    const out = deleteFolder(folders, notes, "a");
    expect(out.folders.map((f) => f.id)).toEqual(["all"]);
    expect(out.notes.find((n) => n.id === "1")?.folderId).toBe("");
    expect(out.notes.find((n) => n.id === "2")?.folderId).toBe("b");
  });

  it("never deletes the 'all' pseudo-folder", () => {
    const folders = [folder(ALL_FOLDER_ID, "All")];
    expect(deleteFolder(folders, [], ALL_FOLDER_ID).folders).toEqual(folders);
  });
});
