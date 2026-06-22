// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createModelIndexStore } from "./store";
import type { SettingsIO } from "../services/settings";

function memoryIO(): SettingsIO {
  let doc: string | null = null;
  return { read: () => doc, write: (d) => (doc = d) };
}

describe("createModelIndexStore", () => {
  it("starts empty and round-trips an entry", () => {
    const store = createModelIndexStore(memoryIO());
    expect(store.all()).toEqual({});
    store.set("m1", { state: "installed", installedBytes: 100 });
    expect(store.get("m1")).toEqual({ state: "installed", installedBytes: 100 });
  });

  it("patches a partial onto an existing entry (defaulting unknown ids)", () => {
    const store = createModelIndexStore(memoryIO());
    store.set("m1", { state: "downloading", bytesDone: 10, bytesTotal: 100 });
    const next = store.patch("m1", { state: "installed", bytesDone: undefined });
    expect(next).toEqual({ state: "installed", bytesDone: undefined, bytesTotal: 100 });
    expect(store.patch("new", { state: "queued" })).toEqual({ state: "queued" });
  });

  it("removes an entry and tolerates a corrupt document", () => {
    const io = memoryIO();
    const store = createModelIndexStore(io);
    store.set("m1", { state: "installed" });
    store.remove("m1");
    expect(store.get("m1")).toBeUndefined();
    io.write("not json");
    expect(store.all()).toEqual({});
  });
});
