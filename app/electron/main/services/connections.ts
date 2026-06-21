/**
 * Provider connections domain service (main): persists the user's connection profiles (cloud/
 * self-hosted, incl. Azure OpenAI) as a JSON array. Native-free (JSON file, like settings); the
 * connection SECRET lives in the keychain (Phase 2 runtime), never here. IO-injected -> BE1-testable.
 * See backend/10 §3a + 09.
 */
import type { ConnectionProfile } from "../../../src/services/ports";
import type { SettingsIO } from "./settings";

function parse(doc: string | null): ConnectionProfile[] {
  if (!doc) return [];
  try {
    const parsed = JSON.parse(doc);
    return Array.isArray(parsed) ? (parsed as ConnectionProfile[]) : [];
  } catch {
    return [];
  }
}

export interface ConnectionStore {
  list: () => ConnectionProfile[];
  upsert: (profile: ConnectionProfile) => ConnectionProfile[];
  remove: (id: string) => ConnectionProfile[];
}

export function createConnectionStore(io: SettingsIO): ConnectionStore {
  const save = (profiles: ConnectionProfile[]): ConnectionProfile[] => {
    io.write(JSON.stringify(profiles));
    return profiles;
  };
  return {
    list: () => parse(io.read()),
    upsert: (profile) => {
      const current = parse(io.read());
      const exists = current.some((c) => c.id === profile.id);
      return save(exists ? current.map((c) => (c.id === profile.id ? profile : c)) : [...current, profile]);
    },
    remove: (id) => save(parse(io.read()).filter((c) => c.id !== id)),
  };
}
