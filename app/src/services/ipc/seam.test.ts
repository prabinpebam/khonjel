import { describe, it, expect } from "vitest";
import type { Services } from "@services/ports";
import { mockServices } from "@services/adapters/mock";
import { createIpcServices } from "@services/adapters/ipc";
import { createDispatch } from "@ipc/dispatch";

/**
 * BE3 — adapter parity (Phase 0, T0.4). The mock and the real `ipc` adapter must satisfy the
 * SAME `Services` contract. We wire the ipc adapter to an in-memory loopback (its `invoke`
 * routes straight to the pure dispatch layer), so the whole seam -- adapter, channel,
 * validation, handler, response -- is exercised deterministically without launching Electron.
 */
const settingsState = { toggles: {} as Record<string, boolean>, values: {} as Record<string, string> };
const dispatch = createDispatch({
  profile: { get: () => ({ id: "local", name: "You" }) },
  system: { getAppVersion: () => "9.9.9", getPlatform: () => "linux" as const },
  settings: {
    get: () => ({ toggles: { ...settingsState.toggles }, values: { ...settingsState.values } }),
    patch: (patch) => {
      Object.assign(settingsState.toggles, patch.toggles ?? {});
      Object.assign(settingsState.values, patch.values ?? {});
      return { toggles: { ...settingsState.toggles }, values: { ...settingsState.values } };
    },
  },
});
const ipcServices = createIpcServices((channel, ...args) => dispatch(channel, ...args), mockServices);

const PLATFORMS = ["win32", "darwin", "linux", "web"];

describe.each<[string, Services]>([
  ["mock", mockServices],
  ["ipc", ipcServices],
])("Services parity — %s adapter", (_name, services) => {
  it("profile.get resolves a profile with id + name", async () => {
    const profile = await services.profile.get();
    expect(profile.id).toBeTruthy();
    expect(profile.name).toBeTruthy();
  });

  it("system.getAppVersion resolves a non-empty string", async () => {
    const version = await services.system.getAppVersion();
    expect(typeof version).toBe("string");
    expect(version.length).toBeGreaterThan(0);
  });

  it("system.getPlatform resolves a known platform", async () => {
    expect(PLATFORMS).toContain(await services.system.getPlatform());
  });

  it("settings.patch then get round-trips a flat-map value", async () => {
    await services.settings.patch({ values: { "stt.dictation.mode": "providers" } });
    const snapshot = await services.settings.get();
    expect(snapshot.values["stt.dictation.mode"]).toBe("providers");
  });

  it("content stays available (mock until Phase 4)", () => {
    expect(Array.isArray(services.content.notes())).toBe(true);
  });
});
