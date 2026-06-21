import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { ServicesContext, type Services } from "@services";
import { useSettingsStore } from "@stores/settings";
import { SettingsSync } from "./SettingsSync";

/**
 * Integration test for the electron-only settings adoption. Uses a fake `services` (only the
 * settings port is exercised) and the real Zustand store, proving hydrate-on-mount and
 * write-through without launching Electron.
 */
function servicesWith(settings: Services["settings"]): Services {
  return { settings } as unknown as Services;
}

describe("SettingsSync", () => {
  beforeEach(() => {
    useSettingsStore.getState().reset();
  });

  it("hydrates the store from main on mount (main wins)", async () => {
    const get = vi.fn().mockResolvedValue({
      toggles: { "llm.cleanup.enabled": false },
      values: { "stt.dictation.mode": "providers" },
    });
    const patch = vi.fn().mockResolvedValue({ toggles: {}, values: {} });

    render(
      <ServicesContext.Provider value={servicesWith({ get, patch })}>
        <SettingsSync />
      </ServicesContext.Provider>,
    );

    await waitFor(() => expect(useSettingsStore.getState().values["stt.dictation.mode"]).toBe("providers"));
    expect(useSettingsStore.getState().toggles["llm.cleanup.enabled"]).toBe(false);
  });

  it("migrates retired model ids adopted from main and heals settings.json", async () => {
    const get = vi.fn().mockResolvedValue({
      toggles: {},
      values: { "llm.chat.model": "qwen-3.5-4b" },
    });
    const patch = vi.fn().mockResolvedValue({ toggles: {}, values: {} });

    render(
      <ServicesContext.Provider value={servicesWith({ get, patch })}>
        <SettingsSync />
      </ServicesContext.Provider>,
    );

    await waitFor(() =>
      expect(useSettingsStore.getState().values["llm.chat.model"]).toBe(
        "qwen2.5-1.5b-instruct-q4_k_m.gguf",
      ),
    );
    // the corrected id is written back to main (settings.json self-heals)
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({
          values: expect.objectContaining({ "llm.chat.model": "qwen2.5-1.5b-instruct-q4_k_m.gguf" }),
        }),
      ),
    );
  });

  it("write-throughs a store change to main", async () => {
    const get = vi.fn().mockResolvedValue({ toggles: {}, values: {} });
    const patch = vi.fn().mockResolvedValue({ toggles: {}, values: {} });

    render(
      <ServicesContext.Provider value={servicesWith({ get, patch })}>
        <SettingsSync />
      </ServicesContext.Provider>,
    );

    await waitFor(() => expect(get).toHaveBeenCalled());
    useSettingsStore.getState().setValue("stt.dictation.mode", "providers");

    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({ values: expect.objectContaining({ "stt.dictation.mode": "providers" }) }),
      ),
    );
  });
});
