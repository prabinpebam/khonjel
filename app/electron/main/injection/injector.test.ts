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

  it("paste strategy restores the user's prior clipboard after pasting", async () => {
    const d = { ...deps("notepad.exe"), readClipboard: vi.fn(() => "prior"), sleep: vi.fn(async () => {}) };
    await createInjector(d).inject("hello");
    expect(d.writeClipboard).toHaveBeenNthCalledWith(1, "hello");
    expect(d.paste).toHaveBeenCalledOnce();
    expect(d.writeClipboard).toHaveBeenNthCalledWith(2, "prior");
  });

  it("type strategy into a shell strips a trailing newline so it cannot auto-execute", async () => {
    const d = deps("cmd.exe");
    await createInjector(d).inject("rm -rf important\n");
    expect(d.typeText).toHaveBeenCalledWith("rm -rf important");
  });

  it("type strategy into a non-shell keeps the text verbatim", async () => {
    const table: InjectionTable = { default: "type", rules: [] };
    const d = { ...deps("notepad.exe"), table };
    await createInjector(d).inject("line one\n");
    expect(d.typeText).toHaveBeenCalledWith("line one\n");
  });

  it("auto-paste off: leaves the text on the clipboard without pasting or typing", async () => {
    const d = deps("notepad.exe");
    const out = await createInjector(d).inject("hello", { autoPaste: false });
    expect(d.writeClipboard).toHaveBeenCalledWith("hello");
    expect(d.paste).not.toHaveBeenCalled();
    expect(d.typeText).not.toHaveBeenCalled();
    expect(out.strategy).toBe("clipboard");
  });

  it("keep-in-clipboard: pastes but does NOT restore the prior clipboard", async () => {
    const d = { ...deps("notepad.exe"), readClipboard: vi.fn(() => "prior"), sleep: vi.fn(async () => {}) };
    await createInjector(d).inject("hello", { keepInClipboard: true });
    expect(d.writeClipboard).toHaveBeenCalledTimes(1);
    expect(d.writeClipboard).toHaveBeenCalledWith("hello");
    expect(d.paste).toHaveBeenCalledOnce();
  });

  it("keep-in-clipboard with a type strategy also copies the text to the clipboard", async () => {
    const d = deps("cmd.exe");
    await createInjector(d).inject("dir", { keepInClipboard: true });
    expect(d.typeText).toHaveBeenCalledWith("dir");
    expect(d.writeClipboard).toHaveBeenCalledWith("dir");
  });
});
