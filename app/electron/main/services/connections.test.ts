// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createConnectionStore } from "./connections";
import type { SettingsIO } from "./settings";
import type { ConnectionProfile } from "../../../src/services/ports";

function memoryIO(): SettingsIO {
  let doc: string | null = null;
  return { read: () => doc, write: (next) => { doc = next; } };
}

const azure: ConnectionProfile = {
  id: "azure-prod",
  kind: "azure-openai",
  baseEndpoint: "https://r.cognitiveservices.azure.com",
  apiVersion: "2025-03-01-preview",
  authMode: "api-key-header",
  headerName: "api-key",
};

/** BE1 — the connection store (Phase 2). */
describe("createConnectionStore", () => {
  it("starts empty", () => {
    expect(createConnectionStore(memoryIO()).list()).toEqual([]);
  });

  it("upserts (insert then update by id) and persists", () => {
    const io = memoryIO();
    const store = createConnectionStore(io);
    store.upsert(azure);
    expect(store.list()).toHaveLength(1);

    store.upsert({ ...azure, apiVersion: "2024-12-01-preview" });
    const list = store.list();
    expect(list).toHaveLength(1);
    expect(list[0]?.apiVersion).toBe("2024-12-01-preview");

    // durable across a fresh store over the same IO
    expect(createConnectionStore(io).list()).toHaveLength(1);
  });

  it("removes by id", () => {
    const io = memoryIO();
    const store = createConnectionStore(io);
    store.upsert(azure);
    store.upsert({ ...azure, id: "openai", kind: "openai" });
    expect(store.remove("azure-prod")).toHaveLength(1);
    expect(store.list()[0]?.id).toBe("openai");
  });
});
