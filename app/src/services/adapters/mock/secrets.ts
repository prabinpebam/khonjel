import type { SecretsService } from "@services/ports";

/**
 * Mock secrets service — tracks only which connection ids have a key set (never stores the secret).
 * The browser/dev shell has no keychain; the real safeStorage-backed store runs in Electron main.
 */
const present = new Set<string>();

export const mockSecretsService: SecretsService = {
  async set(id) {
    present.add(id);
  },
  async has(id) {
    return present.has(id);
  },
  async remove(id) {
    present.delete(id);
  },
};
