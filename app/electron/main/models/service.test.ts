// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import { createModelService, boundModelIdsFrom, type ModelServiceFs } from "./service";
import { createModelIndexStore } from "./store";
import type { Downloader } from "./downloader";
import type { SettingsIO } from "../services/settings";

const ID = "ggml-small.bin"; // a real STT manifest id (recommended)

function memoryIO(): SettingsIO {
  let doc: string | null = null;
  return { read: () => doc, write: (d) => (doc = d) };
}

function fakeFs(free = 1e12): {
  fs: ModelServiceFs;
  setFree: (n: number) => void;
  setSize: (p: string, n: number) => void;
} {
  let freeBytes = free;
  const sizes = new Map<string, number>();
  return {
    setFree: (n) => (freeBytes = n),
    setSize: (p, n) => sizes.set(p, n),
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
  const { fs, setFree, setSize } = fakeFs();
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
  return { service, store, fs, setFree, setSize, emitted };
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

  it("throttles per-chunk progress so a large download cannot flood the UI / disk", async () => {
    // A real download delivers thousands of chunks; emitting (and persisting) on every one freezes
    // the app. The service must collapse them into a handful of throttled progress events.
    const flood: Downloader = {
      download: async (_task, onTick) => {
        for (let i = 1; i <= 2000; i++) onTick(i, 2000);
        return { ok: true, bytes: 2000 };
      },
    };
    const { service, emitted } = build({ downloader: flood });
    service.download(ID);
    await vi.waitFor(() => expect(stateOf(service, ID)).toBe("installed"));
    const downloadingEmits = emitted.filter((e) => e.state === "downloading").length;
    expect(downloadingEmits).toBeLessThan(20);
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

  it("verify emits a verifying tick then re-confirms installed (picker feedback)", async () => {
    const { service, emitted, setSize } = build();
    setSize(join("/models", "ggml-small.bin"), 100); // the model file is present on disk
    const result = await service.verify(ID);
    expect(result.ok).toBe(true);
    expect(emitted.map((e) => e.state)).toEqual(["verifying", "installed"]);
  });

  it("verify of a vanished file emits verifying, drops to not-installed, and re-downloads", async () => {
    const { service, emitted } = build();
    const result = await service.verify(ID); // no file on disk
    expect(result.ok).toBe(false);
    expect(emitted[0]?.state).toBe("verifying");
    await vi.waitFor(() => expect(stateOf(service, ID)).toBe("installed"));
  });
});

describe("createModelService (multi-file models)", () => {
  const PARAKEET = "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3";
  const MODEL_DIR = join("/models", "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8");
  const PARTS = ["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"];

  it("downloads every part and installs to the aggregate size", async () => {
    const { service } = build();
    expect(stateOf(service, PARAKEET)).toBe("not-installed");
    service.download(PARAKEET);
    await vi.waitFor(() => expect(stateOf(service, PARAKEET)).toBe("installed"));
    // 4 parts * 100 bytes each from the fake downloader.
    expect(service.status().find((s) => s.id === PARAKEET)?.installedBytes).toBe(400);
  });

  it("fails the whole model when any single part fails", async () => {
    let n = 0;
    const flaky: Downloader = {
      download: async (_task, onTick) => {
        n += 1;
        if (n === 2) return { ok: false, code: "offline", message: "no net" };
        onTick(100, 100);
        return { ok: true, bytes: 100 };
      },
    };
    const { service } = build({ downloader: flaky });
    service.download(PARAKEET);
    await vi.waitFor(() => expect(stateOf(service, PARAKEET)).toBe("error"));
  });

  it("reconciles to installed only when ALL parts are present on disk", () => {
    const { service, setSize } = build();
    setSize(join(MODEL_DIR, "encoder.int8.onnx"), 10);
    setSize(join(MODEL_DIR, "decoder.int8.onnx"), 10);
    service.reconcile();
    expect(stateOf(service, PARAKEET)).toBe("not-installed"); // joiner + tokens still missing
    setSize(join(MODEL_DIR, "joiner.int8.onnx"), 10);
    setSize(join(MODEL_DIR, "tokens.txt"), 10);
    service.reconcile();
    expect(stateOf(service, PARAKEET)).toBe("installed");
  });

  it("removes every part and frees the aggregate bytes", async () => {
    const removed: string[] = [];
    const { fs } = fakeFs();
    const tracking: ModelServiceFs = { ...fs, remove: (p) => removed.push(p) };
    const { service } = build({ fs: tracking });
    service.download(PARAKEET);
    await vi.waitFor(() => expect(stateOf(service, PARAKEET)).toBe("installed"));
    const { freedBytes } = service.remove(PARAKEET);
    expect(freedBytes).toBe(400);
    expect(stateOf(service, PARAKEET)).toBe("not-installed");
    // Each part path under the model directory was removed.
    for (const part of PARTS) expect(removed).toContain(join(MODEL_DIR, part));
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
