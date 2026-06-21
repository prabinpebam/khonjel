import type { ConnectionProfile, ConnectionService } from "@services/ports";

/**
 * Mock connection service — in-memory provider connection profiles standing in for the main-owned
 * JSON store. The Settings UI (Phase 2 frontend) configures connections through this port.
 */
let profiles: ConnectionProfile[] = [];

export const mockConnectionService: ConnectionService = {
  async list() {
    return [...profiles];
  },
  async upsert(profile) {
    profiles = profiles.some((c) => c.id === profile.id)
      ? profiles.map((c) => (c.id === profile.id ? profile : c))
      : [...profiles, profile];
    return [...profiles];
  },
  async remove(id) {
    profiles = profiles.filter((c) => c.id !== id);
    return [...profiles];
  },
};
