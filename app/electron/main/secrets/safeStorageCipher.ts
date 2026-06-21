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
    // Fallback when OS encryption is unavailable (e.g. a headless Linux without a keyring).
    return `raw:${Buffer.from(plain, "utf8").toString("base64")}`;
  },
  decrypt: (value) => {
    if (value.startsWith("v1:")) {
      return safeStorage.decryptString(Buffer.from(value.slice(3), "base64"));
    }
    if (value.startsWith("raw:")) {
      return Buffer.from(value.slice(4), "base64").toString("utf8");
    }
    return Buffer.from(value, "base64").toString("utf8");
  },
};
