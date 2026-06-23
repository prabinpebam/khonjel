/**
 * Real secret cipher backed by Electron `safeStorage` (OS-level encryption: DPAPI on Windows,
 * Keychain on macOS, libsecret on Linux). Imports electron, so it is loaded ONLY in the main
 * process (never in tests). Values are tagged so we can decrypt correctly even if encryption
 * availability changes between runs.
 */
import { safeStorage } from "electron";
import type { Cipher } from "./store";

export const safeStorageCipher: Cipher = {
  encrypt: (plain) => {
    if (safeStorage.isEncryptionAvailable()) {
      return `v1:${safeStorage.encryptString(plain).toString("base64")}`;
    }
    // Fail-closed: never silently persist plaintext. The secret store catches this and keeps the
    // value in memory for the session instead of writing an unprotected key to disk (see ./store.ts).
    throw new Error("OS encryption is unavailable on this host; refusing to persist plaintext.");
  },
  decrypt: (value) => {
    if (value.startsWith("v1:")) {
      return safeStorage.decryptString(Buffer.from(value.slice(3), "base64"));
    }
    // Legacy values from older installs (before fail-closed) — decode for backward compatibility.
    if (value.startsWith("raw:")) {
      return Buffer.from(value.slice(4), "base64").toString("utf8");
    }
    return Buffer.from(value, "base64").toString("utf8");
  },
};
