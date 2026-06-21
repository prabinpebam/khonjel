// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createSettingsStore, type SettingsIO } from "./settings";

/** BE1 — the main settings store (Phase 0, T0.7), with an in-memory IO (no fs, no native). */
function memoryIO(): SettingsIO {
  let doc: string | null = null;
  return {
    read: () => doc,
    write: (next) => {
      doc = next;
    },
  };
}

describe("createSettingsStore", () => {
  it("returns empty flat maps before anything is written", () => {
    expect(createSettingsStore(memoryIO()).get()).toEqual({ toggles: {}, values: {} });
  });

  it("shallow-merges toggles and values across patches and persists", () => {
    const io = memoryIO();
    const store = createSettingsStore(io);

    store.patch({ toggles: { "llm.cleanup.enabled": false }, values: { "stt.dictation.mode": "providers" } });
    const next = store.patch({ toggles: { meetingDetection: true } });

    expect(next.toggles["llm.cleanup.enabled"]).toBe(false); // preserved
    expect(next.toggles.meetingDetection).toBe(true); // merged
    expect(next.values["stt.dictation.mode"]).toBe("providers");

    // Durable: a fresh store over the same IO reads the persisted doc.
    expect(createSettingsStore(io).get().values["stt.dictation.mode"]).toBe("providers");
  });

  it("tolerates a corrupt document by returning empty maps", () => {
    const io: SettingsIO = { read: () => "{not json", write: () => {} };
    expect(createSettingsStore(io).get()).toEqual({ toggles: {}, values: {} });
  });
});
