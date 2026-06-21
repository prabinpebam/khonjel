// @vitest-environment node
import { describe, it, expect } from "vitest";
import { searchNotes } from "./search";

const notes = [
  { id: "1", title: "Kubernetes deploy", body: "rolling update strategy" },
  { id: "2", title: "Grocery list", body: "milk eggs kubernetes sticker" },
  { id: "3", title: "Meeting notes", body: "discuss roadmap" },
];

/** BE1 — notes search (Phase 7 MVP). */
describe("searchNotes", () => {
  it("AND-matches all query terms across title and body", () => {
    const hits = searchNotes(notes, "kubernetes update");
    expect(hits.map((h) => h.item.id)).toEqual(["1"]);
  });

  it("ranks title matches above body-only matches", () => {
    const hits = searchNotes(notes, "kubernetes");
    expect(hits[0]?.item.id).toBe("1"); // title match scores higher than note 2's body match
    expect(hits.map((h) => h.item.id)).toContain("2");
  });

  it("excludes non-matching items", () => {
    expect(searchNotes(notes, "roadmap").map((h) => h.item.id)).toEqual(["3"]);
    expect(searchNotes(notes, "nonexistentword")).toEqual([]);
  });

  it("returns everything for an empty query", () => {
    expect(searchNotes(notes, "  ")).toHaveLength(3);
  });
});
