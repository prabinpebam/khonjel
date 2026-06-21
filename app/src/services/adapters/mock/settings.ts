import type { SettingsPatch, SettingsService, SettingsSnapshot } from "@services/ports";

/**
 * Mock settings service — an in-memory flat-map store standing in for the main-owned settings.
 * Dormant until the renderer adopts the SettingsService port (T0.8); the live settings UI still
 * uses the Zustand store (`@stores/settings`) directly today, so this does not affect behaviour.
 */
const snapshot: SettingsSnapshot = { toggles: {}, values: {} };

export const mockSettingsService: SettingsService = {
  async get() {
    return { toggles: { ...snapshot.toggles }, values: { ...snapshot.values } };
  },
  async patch(patch: SettingsPatch) {
    Object.assign(snapshot.toggles, patch.toggles ?? {});
    Object.assign(snapshot.values, patch.values ?? {});
    return { toggles: { ...snapshot.toggles }, values: { ...snapshot.values } };
  },
};
