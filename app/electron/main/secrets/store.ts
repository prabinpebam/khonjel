/**
 * Secret store for provider API keys. The cipher + persistence IO are injected, so the store logic
 * is BE1-tested without electron or fs; the composition root wires the real Electron `safeStorage`
 * cipher (see ./safeStorageCipher.ts) and a `<userData>/secrets.json` file.
 *
 * Secrets are keyed by ConnectionProfile id and NEVER read back to the renderer: the IPC surface
 * exposes only set/has/delete. `get` is main-only (used by the provider router at call time).
 * See backend/10 SS3b + 11 (privacy/security).
 */
export interface SecretIO {
  read: () => string | null;
  write: (doc: string) => void;
}

/** Reversible transform for at-rest secrets (real impl = Electron safeStorage). */
export interface Cipher {
  encrypt: (plain: string) => string;
  decrypt: (value: string) => string;
}

export interface SecretStore {
  set: (id: string, secret: string) => void;
  /** Main-only: decrypt the secret for a connection (used by the provider router). */
  get: (id: string) => string | undefined;
  has: (id: string) => boolean;
  remove: (id: string) => void;
}

function parse(doc: string | null): Record<string, string> {
  if (!doc) return {};
  try {
    const parsed = JSON.parse(doc) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

export function createSecretStore(io: SecretIO, cipher: Cipher): SecretStore {
  const save = (map: Record<string, string>): void => io.write(JSON.stringify(map));
  return {
    set: (id, secret) => {
      const map = parse(io.read());
      map[id] = cipher.encrypt(secret);
      save(map);
    },
    get: (id) => {
      const value = parse(io.read())[id];
      if (value == null) return undefined;
      try {
        return cipher.decrypt(value);
      } catch {
        return undefined;
      }
    },
    has: (id) => Object.prototype.hasOwnProperty.call(parse(io.read()), id),
    remove: (id) => {
      const map = parse(io.read());
      delete map[id];
      save(map);
    },
  };
}
