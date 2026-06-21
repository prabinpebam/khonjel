// @vitest-environment node
import { describe, it, expect } from "vitest";
import { normalizeAccelerator, isModifierOnly } from "./hotkeys";

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
