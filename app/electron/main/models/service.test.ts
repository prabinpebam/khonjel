// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createModelService, boundModelIdsFrom, type ModelServiceFs } from "./service";
import { createModelIndexStore } from "./store";
import type { Downloader } from "./downloader";
import type { SettingsIO } from "../services/settings";

const ID = "ggml-small.bin"; // a real STT manifest id (recommended)

function memoryIO(): SettingsIO {
  let doc: string | null = null;
  return { read: () => doc, write: (d) => (doc = d) };
}

function fakeFs(free = 1e12): { fs: ModelServiceFs; setFree: (n: number) => void } {
  let freeBytes = free;
  const sizes = new Map<string, number>();
  return {
    setFree: (n) => (freeBytes = n),
    fs: {
      exists: (p) => sizes.has(p),
      size: (p) => sizes.get(p) ?? 0,
      ensureDir: () => undefined,
      remove: (p) => void sizes.delete(p),
      freeBytes: () => freeBytes,
      sha256: () => "",
    },
  };
}

function okDownloader(bytes = 100): Downloader {
  return {
    download: async (_task, onTick) => {
      onTick(bytes, bytes);
      return { ok: true, bytes };
    },
  };
}

function build(over: Partial<Parameters<typeof createModelService>[0]> = {}) {
  const store = createModelIndexStore(memoryIO());
  const { fs, setFree } = fakeFs();
  const emitted: { id: string; state: string }[] = [];
  const service = createModelService({
    modelsDir: "/models",
    store,
    downloader: okDownloader(),
    fs,
    engineReady: () => true,
    boundModelIds: () => new Set<string>(),
    emit: (p) => emitted.push({ id: p.id, state: p.state }),
    ...over,
  });
  return { service, store, fs, setFree, emitted };
}

const stateOf = (service: ReturnType<typeof build>["service"], id: string) =>
  service.status().find((s) => s.id === id)?.state;

describe("createModelService", () => {
  it("downloads a model to installed and streams progress", async () => {
    const { service, emitted } = build();
    expect(stateOf(service, ID)).toBe("not-installed");
    service.download(ID);
    await vi.waitFor(() => expect(stateOf(service, ID)).toBe("installed"));
    expect(service.status().find((s) => s.id === ID)?.installedBytes).toBe(100);
    expect(emitted.map((e) => e.state)).toContain("installed");
  });

  it("removes an installed model and frees its bytes", async () => {
    const { service } = build();
    service.download(ID);
    await vi.waitFor(() => expect(stateOf(service, ID)).toBe("installed"));
    const { freedBytes } = service.remove(ID);
    expect(freedBytes).toBe(100);
    expect(stateOf(service, ID)).toBe("not-installed");
  });

  it("reports storage used by installed models", async () => {
    const { service } = build();
    service.download(ID);
    await vi.waitFor(() => expect(stateOf(service, ID)).toBe("installed"));
    expect(service.storage().usedBytes).toBe(100);
  });

  it("blocks a download that won't fit and reports disk-full", async () => {
    const { service, setFree } = build();
    setFree(1024); // far smaller than any model
    service.download(ID);
    await vi.waitFor(() => expect(stateOf(service, ID)).toBe("error"));
    expect(service.status().find((s) => s.id === ID)?.error?.code).toBe("disk-full");
  });

  it("surfaces a download failure as the Failed state", async () => {
    const failing: Downloader = {
      download: async () => ({ ok: false, code: "offline", message: "no net" }),
    };
    const { service } = build({ downloader: failing });
    service.download(ID);
    await vi.waitFor(() => expect(stateOf(service, ID)).toBe("error"));
  });

  it("marks a bound model as in use", async () => {
    const { service } = build({ boundModelIds: () => new Set([ID]) });
    expect(service.status().find((s) => s.id === ID)?.inUse).toBe(true);
  });
});

describe("boundModelIdsFrom", () => {
  it("collects real model ids from slot settings, ignoring unknown values", () => {
    const set = boundModelIdsFrom({
      "stt.dictation.model": "ggml-small.bin",
      "llm.chat.model": "qwen2.5-3b-instruct-q4_k_m.gguf",
      "llm.note.model": "not-a-model",
    });
    expect([...set].sort()).toEqual(["ggml-small.bin", "qwen2.5-3b-instruct-q4_k_m.gguf"]);
  });
});
