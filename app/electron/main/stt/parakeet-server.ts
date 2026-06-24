/**
 * Parakeet warm server transcriber: keeps the sherpa-onnx model resident in a persistent
 * `sherpa-onnx-offline-websocket-server` process (loopback only) so dictation pays just the model's
 * RTF per utterance instead of a ~1 s reload on every phrase. This mirrors how the LLM uses a
 * persistent `llama-server` (inference/llama-server.ts).
 *
 * The orchestration (lazy-start-once, reuse, stop, fall back to the one-shot CLI on any failure) is
 * BE1-tested with injected `deps`; the real process spawn + websocket transport are wired as
 * composition glue in stt/parakeet-runtime.ts. Falling back to the one-shot transcriber on a start
 * or request failure guarantees a transcript even if the server protocol needs tuning against a
 * specific sherpa-onnx build.
 * See docs/archive/delivery-plans/parakeet-integration-plan.md §2.1, §5.2.
 */
import { buildSherpaServerArgs, parseSherpaText, type ParakeetModelDir } from "./parakeet";
import type { Transcriber } from "./whisper";

/** A `Transcriber` whose backing process can be reaped (on `before-quit`). */
export interface StoppableTranscriber extends Transcriber {
  stop: () => void;
}

/** A running sherpa websocket server on a loopback port. */
export interface SherpaServerProcess {
  port: number;
  stop: () => void;
}

export interface ParakeetServerDeps {
  /** Reserve a free loopback port. */
  pickPort: () => Promise<number>;
  /** Spawn the server with `args` on the chosen port; resolve once it is ready to serve. */
  start: (binPath: string, args: string[], port: number) => Promise<SherpaServerProcess>;
  /** Send a 16 kHz mono WAV to the running server; resolve the raw result (a JSON line). */
  send: (port: number, wavPath: string) => Promise<string>;
}

export interface ParakeetServerOptions {
  /** Path to `sherpa-onnx-offline-websocket-server(.exe)`. */
  binPath: string;
  model: ParakeetModelDir;
  numThreads?: number;
  provider?: "cpu" | "cuda";
  deps: ParakeetServerDeps;
  /** One-shot CLI transcriber used if the warm server cannot start or a request fails. */
  fallback?: Transcriber;
}

export function createParakeetServerTranscriber(opts: ParakeetServerOptions): StoppableTranscriber {
  let proc: SherpaServerProcess | undefined;
  let starting: Promise<SherpaServerProcess> | undefined;

  const startServer = async (): Promise<SherpaServerProcess> => {
    try {
      const port = await opts.deps.pickPort();
      const args = buildSherpaServerArgs({
        model: opts.model,
        port,
        numThreads: opts.numThreads,
        provider: opts.provider,
      });
      const started = await opts.deps.start(opts.binPath, args, port);
      proc = started;
      return started;
    } finally {
      // Let the next attempt re-start whether this one resolved or rejected (the success path keeps
      // `proc`, so `ensure` short-circuits before reaching here again).
      starting = undefined;
    }
  };

  const ensure = (): Promise<SherpaServerProcess> => {
    if (proc) return Promise.resolve(proc);
    starting ??= startServer();
    return starting;
  };

  return {
    transcribe: async (audioPath) => {
      try {
        const running = await ensure();
        const raw = await opts.deps.send(running.port, audioPath);
        return parseSherpaText(raw);
      } catch (err) {
        if (opts.fallback) return opts.fallback.transcribe(audioPath);
        throw err;
      }
    },
    stop: () => {
      proc?.stop();
      proc = undefined;
      starting = undefined;
    },
  };
}
