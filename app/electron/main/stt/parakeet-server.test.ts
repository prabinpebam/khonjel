// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  createParakeetServerTranscriber,
  type ParakeetServerDeps,
  type SherpaServerProcess,
} from "./parakeet-server";
import type { ParakeetModelDir } from "./parakeet";

const MODEL: ParakeetModelDir = { encoder: "/m/e", decoder: "/m/d", joiner: "/m/j", tokens: "/m/t" };

interface Calls {
  starts: number;
  stops: number;
  sends: string[];
  lastArgs: string[];
}

function harness(over: Partial<ParakeetServerDeps> = {}): { deps: ParakeetServerDeps; calls: Calls } {
  const calls: Calls = { starts: 0, stops: 0, sends: [], lastArgs: [] };
  const deps: ParakeetServerDeps = {
    pickPort: async () => 6800,
    start: async (_bin, args): Promise<SherpaServerProcess> => {
      calls.starts += 1;
      calls.lastArgs = args;
      return { port: 6800, stop: () => void (calls.stops += 1) };
    },
    send: async (_port, wavPath) => {
      calls.sends.push(wavPath);
      return '{"text":" hello "}';
    },
    ...over,
  };
  return { deps, calls };
}

describe("createParakeetServerTranscriber", () => {
  it("lazily starts the server once and reuses it across calls (no per-utterance reload)", async () => {
    const { deps, calls } = harness();
    const t = createParakeetServerTranscriber({ binPath: "/bin/server", model: MODEL, deps });
    expect(calls.starts).toBe(0); // not started until the first transcribe
    expect(await t.transcribe("/a.wav")).toBe("hello");
    expect(await t.transcribe("/b.wav")).toBe("hello");
    expect(calls.starts).toBe(1); // started exactly once
    expect(calls.sends).toEqual(["/a.wav", "/b.wav"]); // each utterance is a cheap request
  });

  it("passes the websocket-server argv with the model parts + the chosen port", async () => {
    const { deps, calls } = harness();
    const t = createParakeetServerTranscriber({ binPath: "/bin/server", model: MODEL, numThreads: 3, deps });
    await t.transcribe("/a.wav");
    expect(calls.lastArgs).toContain("--encoder=/m/e");
    expect(calls.lastArgs).toContain("--port=6800");
    expect(calls.lastArgs).toContain("--num-threads=3");
  });

  it("shares a single start across concurrent first calls", async () => {
    let release: () => void = () => {};
    let signalStarted: () => void = () => {};
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const { deps, calls } = harness({
      start: async (_bin, args): Promise<SherpaServerProcess> => {
        calls.starts += 1;
        calls.lastArgs = args;
        signalStarted();
        return new Promise((resolve) => {
          release = () => resolve({ port: 6800, stop: () => void (calls.stops += 1) });
        });
      },
    });
    const t = createParakeetServerTranscriber({ binPath: "/b", model: MODEL, deps });
    const p1 = t.transcribe("/a.wav");
    const p2 = t.transcribe("/b.wav");
    await started; // start() has now been invoked exactly once
    release();
    await Promise.all([p1, p2]);
    expect(calls.starts).toBe(1);
  });

  it("stop() shuts the server down and a later call restarts it", async () => {
    const { deps, calls } = harness();
    const t = createParakeetServerTranscriber({ binPath: "/b", model: MODEL, deps });
    await t.transcribe("/a.wav");
    t.stop();
    expect(calls.stops).toBe(1);
    await t.transcribe("/b.wav");
    expect(calls.starts).toBe(2); // restarted after stop
  });

  it("falls back to the one-shot transcriber when the server cannot start", async () => {
    const { deps } = harness({
      start: async () => {
        throw new Error("spawn failed");
      },
    });
    const fallback = { transcribe: async () => "fallback text" };
    const t = createParakeetServerTranscriber({ binPath: "/b", model: MODEL, deps, fallback });
    expect(await t.transcribe("/a.wav")).toBe("fallback text");
  });

  it("falls back when an established server request fails (protocol/binary mismatch)", async () => {
    const { deps } = harness({
      send: async () => {
        throw new Error("bad frame");
      },
    });
    const fallback = { transcribe: async () => "cli text" };
    const t = createParakeetServerTranscriber({ binPath: "/b", model: MODEL, deps, fallback });
    expect(await t.transcribe("/a.wav")).toBe("cli text");
  });
});
