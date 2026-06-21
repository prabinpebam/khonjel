// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createInferenceService, stubInferenceEngine } from "./inference";

/** BE1 — the inference service maps options to the pipeline and uses the injected engine. */
describe("createInferenceService", () => {
  it("skips refine for already-clean text", async () => {
    const refine = vi.fn(async (text: string) => `R:${text}`);
    const result = await createInferenceService({ refine }).cleanup("This is clean.", {});
    expect(refine).not.toHaveBeenCalled();
    expect(result).toEqual({ text: "This is clean.", cleaned: false, mode: "dictation" });
  });

  it("refines messy text via the injected engine", async () => {
    const refine = vi.fn(async (text: string) => `R:${text}`);
    const result = await createInferenceService({ refine }).cleanup("um so like the the thing", {});
    expect(refine).toHaveBeenCalledOnce();
    expect(result.cleaned).toBe(true);
  });

  it("maps dictionary substitutions and snippets through the pipeline", async () => {
    const result = await createInferenceService(stubInferenceEngine).cleanup("deploy to k8s ;sig", {
      cleanupEnabled: true,
      dictionary: [
        { id: "d1", type: "substitution", trigger: "k8s", replacement: "Kubernetes", scope: "personal", source: "manual" },
      ],
      snippets: [{ id: "s1", trigger: ";sig", expansion: "Best, Sam", scope: "personal" }],
    });
    expect(result.text).toContain("Kubernetes");
    expect(result.text).toContain("Best, Sam");
  });

  it("the stub engine deterministically tidies text", async () => {
    expect(await stubInferenceEngine.refine("um the the thing")).toBe("The thing.");
  });
});
