/**
 * Global dictation hotkey. The accelerator normalization is PURE (BE1-tested); the registration
 * uses Electron's globalShortcut. Modifier-only chords (e.g. "Ctrl+Win") can't be registered as
 * global shortcuts (the OS needs a key). Rather than silently bind a DIFFERENT accelerator (which
 * leaves the UI advertising a dead key), `register` binds exactly the configured accelerator or
 * nothing — callers read back the live accelerator and surface it, so what the user sees is what is
 * actually bound. The shipped default (`DEFAULT_DICTATION_HOTKEY`) is always registrable.
 */
import { globalShortcut } from "electron";

/**
 * The default global dictation hotkey. MUST be a registrable accelerator (a non-modifier key plus
 * modifiers) — Electron's `globalShortcut` cannot bind a modifier-only chord like "Ctrl+Win", which
 * would silently fall back to a different shortcut and leave the advertised hotkey dead. The
 * renderer mirrors this value in `DEFAULT_VALUES["hotkey.dictation"]`; the dictation EDD scenario
 * gates that the advertised hotkey is the one actually registered.
 */
export const DEFAULT_DICTATION_HOTKEY = "Ctrl+Shift+Space";

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

/**
 * PURE: true when an app hotkey setting maps to an accelerator the OS can actually bind as a global
 * shortcut (i.e. it normalizes to a non-empty chord with at least one non-modifier key). A setting
 * that fails this can never be the live dictation hotkey — `register()` would silently fall back to
 * another accelerator, so the UI would advertise a key that does nothing.
 */
export function isRegistrableAccelerator(setting: string): boolean {
  const accel = normalizeAccelerator(setting);
  return accel.length > 0 && !isModifierOnly(accel);
}

export interface HotkeyManager {
  /**
   * Register `setting` as the live global shortcut and return the live accelerator (or null when it
   * cannot be bound). A modifier-only chord (e.g. "Ctrl+Win") cannot be a global shortcut and binds
   * NOTHING — we never silently swap in a different, undiscoverable accelerator.
   */
  register: (setting: string, onTrigger: () => void) => string | null;
  /** Register an additional shortcut without clearing existing ones (no fallback). Returns the live accelerator or null. */
  registerExtra: (setting: string, onTrigger: () => void) => string | null;
  unregisterAll: () => void;
}

export function createHotkeyManager(): HotkeyManager {
  return {
    register: (setting, onTrigger) => {
      globalShortcut.unregisterAll();
      if (!isRegistrableAccelerator(setting)) return null;
      const accel = normalizeAccelerator(setting);
      try {
        return globalShortcut.register(accel, onTrigger) ? accel : null;
      } catch {
        return null;
      }
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
