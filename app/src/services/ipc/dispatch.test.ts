import { describe, it, expect } from "vitest";
import { createDispatch } from "@ipc/dispatch";
import { isIpcError } from "@ipc/ipc-contract";

/**
 * BE1/BE2 — the pure dispatch layer (Phase 0, T0.5). Deps are injected so handlers stay pure
 * and node-free (the real db/keychain are constructed in the electron composition root later).
 */
const deps = {
  profile: { get: () => ({ id: "local", name: "You" }) },
  system: { getAppVersion: () => "1.2.3", getPlatform: () => "win32" as const },
};

describe("createDispatch", () => {
  const dispatch = createDispatch(deps);

  it("routes a known channel to its handler", async () => {
    expect(await dispatch("system:getAppVersion")).toBe("1.2.3");
    expect(await dispatch("system:getPlatform")).toBe("win32");
    expect(await dispatch("profile:get")).toEqual({ id: "local", name: "You" });
  });

  it("rejects an unknown channel with a not_found IpcError", async () => {
    await expect(dispatch("nope:nope")).rejects.toSatisfy((e: unknown) => isIpcError(e) && e.code === "not_found");
  });

  it("rejects an over-supplied payload with a validation IpcError", async () => {
    await expect(dispatch("system:getAppVersion", "unexpected-arg")).rejects.toSatisfy(
      (e: unknown) => isIpcError(e) && e.code === "validation",
    );
  });
});
