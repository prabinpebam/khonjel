// @vitest-environment node
import { describe, it, expect } from "vitest";
import { isTargetSettled } from "./local-setup-logic";
import type { ModelStatus } from "@services/ports";

const installed = { state: "installed" } as ModelStatus;
const downloading = { state: "downloading" } as ModelStatus;

describe("isTargetSettled (recommended local setup must not spin forever)", () => {
  it("is settled when the model is ready", () => {
    expect(isTargetSettled(installed, "ready", true)).toBe(true);
  });

  it("is settled when installed but the engine runtime is missing/failed and prepare was attempted", () => {
    expect(isTargetSettled(installed, "runtime-missing", true)).toBe(true);
    expect(isTargetSettled(installed, "failed", true)).toBe(true);
    expect(isTargetSettled(installed, "unsupported", true)).toBe(true);
  });

  it("is NOT settled while still downloading", () => {
    expect(isTargetSettled(downloading, "downloading", false)).toBe(false);
  });

  it("is NOT settled when runtime-missing but prepare has not been attempted yet (still working)", () => {
    expect(isTargetSettled(installed, "runtime-missing", false)).toBe(false);
  });

  it("is NOT settled when installed and readiness is still a transient state (engine loading)", () => {
    expect(isTargetSettled(installed, "installed", true)).toBe(false);
  });
});
