import { describe, it, expect } from "vitest";
import type { ConnectionProfile, Services } from "@services/ports";
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
let connectionState: ConnectionProfile[] = [];
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
  inference: {
    cleanup: (input, options) => {
      const trimmed = input.trim();
      const looksClean = /^[A-Z].*[.!?]$/.test(trimmed);
      const cleaned = options.cleanupEnabled !== false && !looksClean;
      return { text: trimmed, cleaned, mode: "dictation" };
    },
  },
  connections: {
    list: () => [...connectionState],
    upsert: (profile) => {
      connectionState = connectionState.some((c) => c.id === profile.id)
        ? connectionState.map((c) => (c.id === profile.id ? profile : c))
        : [...connectionState, profile];
      return [...connectionState];
    },
    remove: (id) => {
      connectionState = connectionState.filter((c) => c.id !== id);
      return [...connectionState];
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

  it("inference.cleanup returns a structured result and skips already-clean text", async () => {
    const clean = await services.inference.cleanup("This is already clean.", {});
    expect(clean.cleaned).toBe(false);
    expect(clean.mode).toBe("dictation");
    const messy = await services.inference.cleanup("um so like the the thing", {});
    expect(messy.cleaned).toBe(true);
  });

  it("connections.upsert then list round-trips a profile", async () => {
    await services.connections.upsert({
      id: "p1",
      kind: "azure-openai",
      baseEndpoint: "https://x.cognitiveservices.azure.com",
      authMode: "api-key-header",
    });
    expect((await services.connections.list()).some((c) => c.id === "p1")).toBe(true);
    await services.connections.remove("p1");
    expect((await services.connections.list()).some((c) => c.id === "p1")).toBe(false);
  });

  it("content stays available (mock until Phase 4)", async () => {
    expect(Array.isArray(await services.content.notes())).toBe(true);
  });
});
