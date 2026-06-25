// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createContentStore, type ContentDeps } from "./content";
import type { SettingsIO } from "./settings";

/** In-memory IO so the store is exercised without fs (BE1). */
function memIO(initial: string | null = null): SettingsIO {
  let doc = initial;
  return {
    read: () => doc,
    write: (next) => {
      doc = next;
    },
  };
}

const deps: ContentDeps = {
  listModels: (kind) =>
    kind === "stt"
      ? [{ id: "stt", name: "STT", sizeLabel: "1 GB", recommended: true }]
      : [{ id: "llm", name: "LLM", sizeLabel: "2 GB", recommended: true }],
  // Fake compute returns history length as wpm so the test can assert it ran on stored history.
  computeInsights: (history) => ({
    wpm: history.length,
    wpmPercentile: 0,
    wordsCorrected: 0,
    dictionaryFixes: 0,
    totalWords: 0,
    appUsage: [],
    streak: { current: 0, longest: 0 },
    heatmap: [],
  }),
};

describe("createContentStore", () => {
  it("a fresh install starts empty for user data with default catalogs", () => {
    const store = createContentStore(memIO(), deps);
    expect(store.history()).toEqual([]);
    expect(store.notes()).toEqual([]);
    expect(store.dictionary()).toEqual([]);
    expect(store.transforms().length).toBeGreaterThan(0);
    expect(store.transforms().every((t) => t.builtin)).toBe(true);
    expect(store.integrations()).toHaveLength(4);
    expect(store.integrations().every((i) => i.status === "disconnected")).toBe(true);
  });

  it("derives model lists from the injected catalog", () => {
    const store = createContentStore(memIO(), deps);
    expect(store.sttModels().map((m) => m.id)).toEqual(["stt"]);
    expect(store.llmModels().map((m) => m.id)).toEqual(["llm"]);
  });

  it("starts with no chat threads and round-trips them via replace", () => {
    const store = createContentStore(memIO(), deps);
    expect(store.chatThreads()).toEqual([]);
    const thread = {
      id: "t1",
      title: "Hello",
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
      titleStatus: "manual" as const,
    };
    store.replace("chatThreads", [thread]);
    expect(store.chatThreads()).toEqual([thread]);
  });

  it("migrates a legacy flat chat into one 'Imported chat' thread", () => {
    const legacy = JSON.stringify({
      chat: [
        { id: "m1", role: "user", content: "hi", createdAt: "2026-01-01T00:00:00Z" },
        { id: "m2", role: "assistant", content: "hello", createdAt: "2026-01-01T00:00:05Z" },
      ],
    });
    const store = createContentStore(memIO(legacy), deps);
    const threads = store.chatThreads();
    expect(threads).toHaveLength(1);
    expect(threads[0]?.title).toBe("Imported chat");
    expect(threads[0]?.titleStatus).toBe("manual");
    const threadId = threads[0]?.id;
    expect(store.chat().every((m) => m.threadId === threadId)).toBe(true);
  });

  it("does not migrate when chat is empty or already threaded", () => {
    expect(createContentStore(memIO(), deps).chatThreads()).toEqual([]);
    const threaded = JSON.stringify({
      chat: [{ id: "m1", threadId: "tX", role: "user", content: "hi", createdAt: "2026-01-01T00:00:00Z" }],
      chatThreads: [{ id: "tX", title: "Kept", createdAt: "", updatedAt: "", titleStatus: "manual" }],
    });
    const store = createContentStore(memIO(threaded), deps);
    expect(store.chatThreads().map((t) => t.id)).toEqual(["tX"]);
    expect(store.chat()[0]?.threadId).toBe("tX");
  });

  it("derives insights from stored history via the injected compute fn", () => {
    const doc = JSON.stringify({
      history: [
        {
          id: "h1",
          createdAt: "2026-01-01T00:00:00Z",
          finalText: "hi",
          app: "x",
          language: "en",
          wordCount: 1,
          durationSec: 1,
          mode: "dictation",
          hasAudio: false,
          cleanupApplied: false,
        },
      ],
    });
    const store = createContentStore(memIO(doc), deps);
    expect(store.insights().wpm).toBe(1);
  });

  it("reads persisted user collections from the document", () => {
    const doc = JSON.stringify({
      notes: [
        {
          id: "n1",
          title: "T",
          preview: "p",
          body: "b",
          folderId: "f",
          updatedAt: "2026-01-01",
          fromRecording: false,
        },
      ],
    });
    const store = createContentStore(memIO(doc), deps);
    expect(store.notes()).toHaveLength(1);
    expect(store.notes()[0]!.title).toBe("T");
  });

  it("falls back to defaults on a malformed document", () => {
    const store = createContentStore(memIO("not json"), deps);
    expect(store.history()).toEqual([]);
    expect(store.integrations()).toHaveLength(4);
  });

  it("addHistory prepends an entry with derived id/createdAt/wordCount and persists it", () => {
    const io = memIO();
    const store = createContentStore(io, deps);
    const list = store.addHistory({
      finalText: "hello world there",
      app: "Khonjel",
      language: "en",
      durationSec: 3,
      mode: "dictation",
      hasAudio: false,
      cleanupApplied: true,
    });
    expect(list).toHaveLength(1);
    expect(list[0]!.wordCount).toBe(3);
    expect(list[0]!.id).toBeTruthy();
    expect(list[0]!.createdAt).toBeTruthy();
    // persisted to the document
    expect(createContentStore(io, deps).history()).toHaveLength(1);
  });

  it("replace overwrites a collection and persists it across store instances", () => {
    const io = memIO();
    const store = createContentStore(io, deps);
    store.replace("notes", [
      {
        id: "n1",
        title: "Saved",
        preview: "p",
        body: "b",
        folderId: "f",
        updatedAt: "2026-01-01",
        fromRecording: false,
      },
    ]);
    expect(store.notes()).toHaveLength(1);
    // a brand-new store reading the same IO sees the persisted write
    expect(createContentStore(io, deps).notes()[0]!.title).toBe("Saved");
  });

  it("replace ignores unknown collection names (guards prototype pollution)", () => {
    const io = memIO();
    const store = createContentStore(io, deps);
    store.replace("__proto__", [{ polluted: true }]);
    store.replace("notARealCollection", [1, 2, 3]);
    expect(store.notes()).toEqual([]);
    expect((({}) as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("keeps all history when retention is unset", () => {
    const store = createContentStore(memIO(), deps);
    store.addHistory({
      finalText: "one",
      app: "k",
      language: "en",
      durationSec: 1,
      mode: "dictation",
      hasAudio: false,
      cleanupApplied: false,
    });
    const out = store.addHistory({
      finalText: "two",
      app: "k",
      language: "en",
      durationSec: 1,
      mode: "dictation",
      hasAudio: false,
      cleanupApplied: false,
    });
    expect(out).toHaveLength(2);
  });

  it("purges history older than the retention window when a new entry is added", () => {
    const io = memIO();
    const retaining: ContentDeps = { ...deps, retentionDays: () => 7 };
    const store = createContentStore(io, retaining);
    store.replace("history", [
      {
        id: "old",
        createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        finalText: "old",
        app: "x",
        language: "en",
        wordCount: 1,
        durationSec: 1,
        mode: "dictation",
        hasAudio: false,
        cleanupApplied: false,
      },
    ]);
    const out = store.addHistory({
      finalText: "fresh",
      app: "k",
      language: "en",
      durationSec: 1,
      mode: "dictation",
      hasAudio: false,
      cleanupApplied: false,
    });
    expect(out.some((h) => h.id === "old"), "old entry purged").toBe(false);
    expect(out.some((h) => h.finalText === "fresh")).toBe(true);
  });
});
