// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  normalizeAccelerator,
  isModifierOnly,
  isRegistrableAccelerator,
  DEFAULT_DICTATION_HOTKEY,
} from "./hotkeys";

describe("normalizeAccelerator", () => {
  it("maps app modifier names to Electron accelerators", () => {
    expect(normalizeAccelerator("Ctrl+Shift+D")).toBe("Control+Shift+D");
    expect(normalizeAccelerator("Win+Alt+Space")).toBe("Super+Alt+Space");
  });

  it("passes through unknown keys and trims", () => {
    expect(normalizeAccelerator("Cmd + K")).toBe("Super+K");
  });
});

describe("isModifierOnly", () => {
  it("detects modifier-only chords", () => {
    expect(isModifierOnly("Control+Super")).toBe(true);
    expect(isModifierOnly("Control+Shift+D")).toBe(false);
  });
});

describe("isRegistrableAccelerator", () => {
  it("rejects modifier-only chords that cannot be a global shortcut", () => {
    // "Ctrl+Win" is the trap: a modifier-only chord Electron's globalShortcut can never bind, so it
    // would silently fall back and the advertised hotkey would be dead.
    expect(isRegistrableAccelerator("Ctrl+Win")).toBe(false);
    expect(isRegistrableAccelerator("Ctrl+Alt")).toBe(false);
    expect(isRegistrableAccelerator("")).toBe(false);
  });

  it("accepts chords with a non-modifier key", () => {
    expect(isRegistrableAccelerator("Ctrl+Shift+D")).toBe(true);
    expect(isRegistrableAccelerator("Ctrl+Shift+Space")).toBe(true);
  });

  it("the shipped default dictation hotkey is actually registrable", () => {
    // Detector: guards against ever shipping a default the OS cannot bind (the Ctrl+Win regression).
    expect(isRegistrableAccelerator(DEFAULT_DICTATION_HOTKEY)).toBe(true);
  });
});
