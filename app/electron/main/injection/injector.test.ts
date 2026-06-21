// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { selectInjectionStrategy, type InjectionTable } from "./table";
import { createInjector } from "./injector";

describe("selectInjectionStrategy", () => {
  it("defaults to paste for unknown apps", () => {
    expect(selectInjectionStrategy("notepad.exe")).toBe("paste");
    expect(selectInjectionStrategy(undefined)).toBe("paste");
  });

  it("types into terminals and clipboard-only for remote windows", () => {
    expect(selectInjectionStrategy("WindowsTerminal.exe")).toBe("type"); // case-insensitive
    expect(selectInjectionStrategy("mstsc.exe")).toBe("clipboard");
  });

  it("honors a custom table", () => {
    const table: InjectionTable = { default: "clipboard", rules: [{ app: "x.exe", strategy: "type" }] };
    expect(selectInjectionStrategy("y.exe", table)).toBe("clipboard");
    expect(selectInjectionStrategy("x.exe", table)).toBe("type");
  });
});

function deps(app: string | undefined) {
  return {
    writeClipboard: vi.fn(),
    paste: vi.fn(async () => {}),
    typeText: vi.fn(async () => {}),
    getForegroundApp: vi.fn(async () => app),
  };
}

describe("createInjector", () => {
  it("paste strategy: writes clipboard then sends Ctrl+V", async () => {
    const d = deps("notepad.exe");
    const out = await createInjector(d).inject("hello");
    expect(d.writeClipboard).toHaveBeenCalledWith("hello");
    expect(d.paste).toHaveBeenCalledOnce();
    expect(d.typeText).not.toHaveBeenCalled();
    expect(out).toEqual({ strategy: "paste", app: "notepad.exe" });
  });

  it("type strategy: synthesizes keystrokes, no clipboard", async () => {
    const d = deps("cmd.exe");
    const out = await createInjector(d).inject("dir");
    expect(d.typeText).toHaveBeenCalledWith("dir");
    expect(d.writeClipboard).not.toHaveBeenCalled();
    expect(d.paste).not.toHaveBeenCalled();
    expect(out.strategy).toBe("type");
  });

  it("clipboard strategy: writes clipboard but does not paste", async () => {
    const d = deps("mstsc.exe");
    const out = await createInjector(d).inject("secret");
    expect(d.writeClipboard).toHaveBeenCalledWith("secret");
    expect(d.paste).not.toHaveBeenCalled();
    expect(out.strategy).toBe("clipboard");
  });
});
