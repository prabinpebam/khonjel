// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { createDownloader, type DownloadFetch, type DownloadFs, type DownloadResponse } from "./downloader";

/** In-memory `.part`/final filesystem for the downloader. */
function fakeFs() {
  const parts = new Map<string, Uint8Array>();
  const finals = new Map<string, Uint8Array>();
  const fs: DownloadFs = {
    partSize: (p) => parts.get(p)?.length ?? 0,
    appendChunk: (p, c) => {
      const cur = parts.get(p) ?? new Uint8Array();
      const next = new Uint8Array(cur.length + c.length);
      next.set(cur);
      next.set(c, cur.length);
      parts.set(p, next);
    },
    removePart: (p) => void parts.delete(p),
    sha256: (p) => createHash("sha256").update(Buffer.from(parts.get(p) ?? new Uint8Array())).digest("hex"),
    finalize: (part, final) => {
      finals.set(final, parts.get(part) ?? new Uint8Array());
      parts.delete(part);
    },
  };
  return { fs, parts, finals };
}

interface FetchOpts {
  status?: number;
  contentLength?: number;
  chunks?: Uint8Array[];
  captureHeaders?: (h: Record<string, string>) => void;
}

function fakeFetch(opts: FetchOpts): DownloadFetch {
  const chunks = opts.chunks ?? [new Uint8Array([1, 2, 3, 4])];
  const total = opts.contentLength ?? chunks.reduce((n, c) => n + c.length, 0);
  return async (_url, init): Promise<DownloadResponse> => {
    opts.captureHeaders?.(init.headers);
    return {
      ok: (opts.status ?? 200) < 400,
      status: opts.status ?? 200,
      headers: { get: (n) => (n.toLowerCase() === "content-length" ? String(total) : null) },
      body: (async function* () {
        for (const c of chunks) yield c;
      })(),
    };
  };
}

const task = { url: "https://x/model.bin", partPath: "/m.bin.part", finalPath: "/m.bin" };
const noop = () => {};

describe("createDownloader", () => {
  it("downloads, verifies size, and atomically installs", async () => {
    const { fs, finals } = fakeFs();
    const dl = createDownloader({ fetch: fakeFetch({ chunks: [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])] }), fs });
    const out = await dl.download({ ...task, expectedBytes: 5 }, noop, new AbortController().signal);
    expect(out).toEqual({ ok: true, bytes: 5 });
    expect(finals.get("/m.bin")?.length).toBe(5);
  });

  it("resumes a partial .part with a Range header instead of restarting", async () => {
    const { fs, parts, finals } = fakeFs();
    parts.set("/m.bin.part", new Uint8Array([1, 2])); // 2 bytes already on disk
    let sentRange: string | undefined;
    const dl = createDownloader({
      fetch: fakeFetch({
        status: 206,
        chunks: [new Uint8Array([3, 4, 5])],
        contentLength: 3,
        captureHeaders: (h) => (sentRange = h.Range),
      }),
      fs,
    });
    const out = await dl.download({ ...task, expectedBytes: 5 }, noop, new AbortController().signal);
    expect(sentRange).toBe("bytes=2-");
    expect(out).toEqual({ ok: true, bytes: 5 });
    expect(finals.get("/m.bin")?.length).toBe(5);
  });

  it("rejects a checksum mismatch and discards the .part", async () => {
    const { fs, parts } = fakeFs();
    const dl = createDownloader({ fetch: fakeFetch({ chunks: [new Uint8Array([9, 9, 9])] }), fs });
    const out = await dl.download({ ...task, sha256: "deadbeef" }, noop, new AbortController().signal);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("checksum-mismatch");
    expect(parts.has("/m.bin.part")).toBe(false);
  });

  it("maps a 404 to source-unavailable", async () => {
    const { fs } = fakeFs();
    const dl = createDownloader({ fetch: fakeFetch({ status: 404 }), fs });
    const out = await dl.download(task, noop, new AbortController().signal);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("source-unavailable");
  });

  it("stops when the signal is already aborted", async () => {
    const { fs } = fakeFs();
    const controller = new AbortController();
    controller.abort();
    const dl = createDownloader({ fetch: fakeFetch({ chunks: [new Uint8Array([1])] }), fs });
    const out = await dl.download(task, noop, controller.signal);
    expect(out.ok).toBe(false);
  });
});
