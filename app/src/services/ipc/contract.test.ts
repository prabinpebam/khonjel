import { describe, it, expect } from "vitest";
import { CHANNELS, CONTRACT_VERSION, ipcError, isIpcError } from "@ipc/ipc-contract";
import { RequestSchemas, ResponseSchemas } from "@ipc/ipc-schemas";

/**
 * BE2 — IPC contract test (Phase 0). Proves the typed channel registry is complete, versioned,
 * and that every channel has request + response zod schemas. See
 * docs/.../backend/08-ipc-and-ports-contracts.md and 14-implementation-plan.md (T0.2).
 */
describe("ipc contract", () => {
  it("is versioned", () => {
    expect(CONTRACT_VERSION).toBeGreaterThan(0);
  });

  it("every channel has request + response schemas", () => {
    for (const channel of Object.values(CHANNELS)) {
      expect(RequestSchemas[channel], `request schema for ${channel}`).toBeDefined();
      expect(ResponseSchemas[channel], `response schema for ${channel}`).toBeDefined();
    }
  });

  it("response schema validates a good profile and rejects a bad one", () => {
    expect(ResponseSchemas["profile:get"].safeParse({ id: "local", name: "You" }).success).toBe(true);
    expect(ResponseSchemas["profile:get"].safeParse({ id: 1 }).success).toBe(false);
  });

  it("platform response schema accepts only known platforms", () => {
    expect(ResponseSchemas["system:getPlatform"].safeParse("win32").success).toBe(true);
    expect(ResponseSchemas["system:getPlatform"].safeParse("plan9").success).toBe(false);
  });

  it("ipcError builds a structured error recognised by isIpcError", () => {
    const err = ipcError("validation", "bad input");
    expect(isIpcError(err)).toBe(true);
    expect(isIpcError(new Error("x"))).toBe(false);
  });
});
