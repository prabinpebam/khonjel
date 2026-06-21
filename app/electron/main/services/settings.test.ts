// @vitest-environment node
import { describe, it, expect } from "vitest";
import { openDatabase } from "../../store/db";
import { createSettingsStore } from "./settings";

/** BE1 — the main settings store (Phase 0, T0.7), against an in-memory migrated DB. */
describe("createSettingsStore", () => {
  it("returns empty flat maps before anything is written", () => {
    const db = openDatabase(":memory:");
    expect(createSettingsStore(db).get()).toEqual({ toggles: {}, values: {} });
    db.close();
  });

  it("shallow-merges toggles and values across patches and persists", () => {
    const db = openDatabase(":memory:");
    const store = createSettingsStore(db);

    store.patch({ toggles: { "llm.cleanup.enabled": false }, values: { "stt.dictation.mode": "providers" } });
    const next = store.patch({ toggles: { meetingDetection: true } });

    expect(next.toggles["llm.cleanup.enabled"]).toBe(false); // preserved
    expect(next.toggles.meetingDetection).toBe(true); // merged
    expect(next.values["stt.dictation.mode"]).toBe("providers");

    // Durable: a fresh store over the same DB reads the persisted row.
    expect(createSettingsStore(db).get().values["stt.dictation.mode"]).toBe("providers");
    db.close();
  });
});
