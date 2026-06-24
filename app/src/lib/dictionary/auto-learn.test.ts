import { describe, it, expect, beforeEach } from "vitest";
import { learnCorrections } from "./auto-learn";
import type { DictionaryEntry } from "@services/ports";

let n = 0;
const makeId = () => `id-${++n}`;
beforeEach(() => {
  n = 0;
});

describe("learnCorrections", () => {
  it("learns a single-word correction as a substitution rule", () => {
    const out = learnCorrections("send it to teh server", "send it to the server", [], makeId);
    expect(out).toEqual([
      {
        id: "id-1",
        type: "substitution",
        trigger: "teh",
        replacement: "the",
        scope: "personal",
        source: "auto-learn",
      },
    ]);
  });

  it("learns multiple changed words in one edit", () => {
    const out = learnCorrections("meet wit Jon", "meet with John", [], makeId);
    expect(out.map((e) => [e.trigger, e.replacement])).toEqual([
      ["wit", "with"],
      ["Jon", "John"],
    ]);
  });

  it("ignores edits that change the word count (not an aligned swap)", () => {
    expect(learnCorrections("hello world", "hello there big world", [], makeId)).toEqual([]);
    expect(learnCorrections("hello world", "world", [], makeId)).toEqual([]);
  });

  it("skips case-only and punctuation-only changes", () => {
    expect(learnCorrections("khonjel rocks", "Khonjel rocks", [], makeId)).toEqual([]);
    expect(learnCorrections("yes it works", "yes, it works", [], makeId)).toEqual([]);
  });

  it("skips triggers shorter than two characters", () => {
    expect(learnCorrections("a cat", "I cat", [], makeId)).toEqual([]);
  });

  it("strips surrounding punctuation from the learned words", () => {
    const out = learnCorrections("call teh, guy", "call the, guy", [], makeId);
    expect(out).toEqual([
      {
        id: "id-1",
        type: "substitution",
        trigger: "teh",
        replacement: "the",
        scope: "personal",
        source: "auto-learn",
      },
    ]);
  });

  it("does not relearn a trigger that already exists in the dictionary", () => {
    const existing: DictionaryEntry[] = [
      { id: "x", type: "substitution", trigger: "TEH", replacement: "the", scope: "personal", source: "manual" },
    ];
    expect(learnCorrections("teh dog", "the dog", existing, makeId)).toEqual([]);
  });

  it("caps the number of rules learned from one edit", () => {
    const before = "aa bb cc dd ee ff gg";
    const after = "a1 b1 c1 d1 e1 f1 g1";
    const out = learnCorrections(before, after, [], makeId);
    expect(out).toHaveLength(5);
  });

  it("returns nothing when text is unchanged", () => {
    expect(learnCorrections("no change here", "no change here", [], makeId)).toEqual([]);
  });
});
