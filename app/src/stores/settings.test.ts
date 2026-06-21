import { describe, it, expect, beforeEach } from "vitest";
import { useSettingsStore, migrateModelIds } from "./settings";

/**
 * L2 store example — the settings store models two flat dotted-key maps (toggles/values).
 * This is the exact shape the backend SettingsService contract mirrors
 * (docs/.../backend/08-ipc-and-ports-contracts.md §3.4), so the test doubles as a contract anchor.
 */
describe("settings store", () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
  });

  it("flips a boolean toggle by its dotted key", () => {
    const before = useSettingsStore.getState().toggles["llm.cleanup.enabled"];
    useSettingsStore.getState().setToggle("llm.cleanup.enabled", !before);
    expect(useSettingsStore.getState().toggles["llm.cleanup.enabled"]).toBe(!before);
  });

  it("sets a string value by its dotted key", () => {
    useSettingsStore.getState().setValue("stt.dictation.mode", "providers");
    expect(useSettingsStore.getState().values["stt.dictation.mode"]).toBe("providers");
  });

  it("reset restores defaults", () => {
    useSettingsStore.getState().setValue("stt.dictation.mode", "providers");
    useSettingsStore.getState().reset();
    expect(useSettingsStore.getState().values["stt.dictation.mode"]).toBe("local");
  });

  it("migrateModelIds heals retired model ids and leaves other keys untouched", () => {
    const out = migrateModelIds({
      "llm.chat.model": "qwen-3.5-4b",
      "stt.dictation.model": "ggml-base.en.bin",
      uiLanguage: "en",
    });
    expect(out["llm.chat.model"]).toBe("qwen2.5-1.5b-instruct-q4_k_m.gguf");
    expect(out["stt.dictation.model"]).toBe("ggml-base.en.bin");
    expect(out.uiLanguage).toBe("en");
  });
});
