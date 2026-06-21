/**
 * Global dictation hotkey. The accelerator normalization is PURE (BE1-tested); the registration
 * uses Electron's globalShortcut. Modifier-only chords (e.g. "Ctrl+Win") can't be registered as
 * global shortcuts (the OS needs a key), so the composition root falls back to a key-based
 * accelerator and logs which one is live.
 */
import { globalShortcut } from "electron";

const TOKENS: Record<string, string> = {
  ctrl: "Control",
  control: "Control",
  ctl: "Control",
  win: "Super",
  cmd: "Super",
  command: "Super",
  meta: "Super",
  super: "Super",
  alt: "Alt",
  option: "Alt",
  shift: "Shift",
};

/** PURE: map an app hotkey setting (e.g. "Ctrl+Shift+D") to an Electron accelerator. */
export function normalizeAccelerator(setting: string): string {
  return setting
    .split("+")
    .map((part) => {
      const key = part.trim();
      return TOKENS[key.toLowerCase()] ?? key;
    })
    .filter((p) => p.length > 0)
    .join("+");
}

/** PURE: true when the accelerator has no non-modifier key (cannot be a global shortcut). */
export function isModifierOnly(accelerator: string): boolean {
  const mods = new Set(["Control", "Super", "Alt", "Shift"]);
  return accelerator.split("+").every((p) => mods.has(p));
}

export interface HotkeyManager {
  /** Register `setting` (falling back to `fallback` if it is modifier-only or fails). Returns the live accelerator or null. */
  register: (setting: string, onTrigger: () => void, fallback?: string) => string | null;
  /** Register an additional shortcut without clearing existing ones (no fallback). Returns the live accelerator or null. */
  registerExtra: (setting: string, onTrigger: () => void) => string | null;
  unregisterAll: () => void;
}

export function createHotkeyManager(): HotkeyManager {
  return {
    register: (setting, onTrigger, fallback = "CommandOrControl+Shift+D") => {
      globalShortcut.unregisterAll();
      const primary = normalizeAccelerator(setting);
      const candidates = isModifierOnly(primary) ? [fallback] : [primary, fallback];
      for (const accel of candidates) {
        try {
          if (globalShortcut.register(accel, onTrigger)) return accel;
        } catch {
          // try the next candidate
        }
      }
      return null;
    },
    registerExtra: (setting, onTrigger) => {
      const accel = normalizeAccelerator(setting);
      if (isModifierOnly(accel)) return null;
      try {
        return globalShortcut.register(accel, onTrigger) ? accel : null;
      } catch {
        return null;
      }
    },
    unregisterAll: () => globalShortcut.unregisterAll(),
  };
}
