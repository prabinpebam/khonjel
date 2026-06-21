// @vitest-environment node
import { describe, it, expect } from "vitest";
import { resolvePrompt, applySubstitutions, languageInstruction, dictionarySuffix, PROMPTS } from "./prompts";

/** BE1 — prompt resolution (Phase 5). */
describe("resolvePrompt", () => {
  it("substitutes {{agentName}} with the wake word", () => {
    const prompt = resolvePrompt("cleanup", { agentName: "Buddy" });
    expect(prompt).toContain("Buddy");
    expect(prompt).not.toContain("{{agentName}}");
  });

  it("defaults the agent name to Khonjel", () => {
    expect(resolvePrompt("chat")).toContain("Khonjel");
  });

  it("uses a custom override over the default", () => {
    expect(resolvePrompt("cleanup", { custom: "CUSTOM {{agentName}}", agentName: "X" })).toBe("CUSTOM X");
  });

  it("appends a language instruction only when a language is set (not auto)", () => {
    expect(resolvePrompt("cleanup", { language: "French" })).toContain("write your output in French");
    expect(resolvePrompt("cleanup", { language: "auto" })).not.toContain("write your output");
    expect(resolvePrompt("cleanup", {})).not.toContain("write your output");
  });

  it("appends the dictionary suffix only when there are words", () => {
    const prompt = resolvePrompt("cleanup", { dictionary: ["Khonjel", "Kubernetes"] });
    expect(prompt).toContain("Khonjel, Kubernetes");
    expect(resolvePrompt("cleanup", { dictionary: [] })).not.toContain("Preserve them exactly");
  });
});

describe("prompt helpers", () => {
  it("applySubstitutions replaces every occurrence", () => {
    expect(applySubstitutions("{{agentName}} and {{agentName}}", "Z")).toBe("Z and Z");
  });
  it("languageInstruction is empty for auto/empty", () => {
    expect(languageInstruction()).toBe("");
    expect(languageInstruction("auto")).toBe("");
    expect(languageInstruction("Spanish")).toContain("Spanish");
  });
  it("dictionarySuffix is empty for no words", () => {
    expect(dictionarySuffix([])).toBe("");
  });
  it("ships a prompt for every kind", () => {
    for (const kind of Object.keys(PROMPTS)) {
      expect(PROMPTS[kind as keyof typeof PROMPTS].length).toBeGreaterThan(0);
    }
  });
});
