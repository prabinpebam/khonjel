/**
 * Inference runtime resolver (composition glue): chooses the live InferenceEngine and hot-swaps
 * the real local-LLM engine in WITHOUT blocking app startup.
 *
 * The app always boots on the deterministic stub (instant), then `start()` resolves a llama-server
 * in the background and swaps it behind a stable proxy, so `inference:cleanup` upgrades from
 * "deterministic" to "LLM" quality the moment the server is ready. Resolution order:
 *   1. KHONJEL_LLAMA_ENDPOINT       -> talk to an already-running llama-server (no spawn).
 *   2. binary + .gguf model present -> spawn our own llama-server (downloaded, see scripts/).
 *   3. otherwise                    -> stay on the deterministic stub.
 * The real engine is always wrapped with withFallback(stub) so a transient failure degrades
 * gracefully. This file is composition glue (fs/child-process); the engine LOGIC it composes is
 * BE1-tested in llama.ts / llama-server.ts.
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { InferenceEngine } from "../services/inference";
import { stubInferenceEngine } from "../services/inference";
import { createLlamaEngine, withFallback } from "./llama";
import { startLlamaServer } from "./llama-server";

export interface InferenceRuntimeConfig {
  userDataDir: string;
  appDir: string;
  isWindows: boolean;
  env: Record<string, string | undefined>;
}

export type InferenceMode = "endpoint" | "spawned" | "stub";

export interface InferenceRuntime {
  /** Stable engine proxy handed to the inference service; reads the current backing engine. */
  engine: InferenceEngine;
  /** Resolve + swap in the real engine. Resolves to the mode that was selected. */
  start: () => Promise<InferenceMode>;
  /** Stop a spawned server (no-op for endpoint/stub modes). */
  stop: () => void;
}

interface ResolvedPaths {
  endpoint?: string;
  binPath?: string;
  modelPath?: string;
}

function firstGguf(dirs: string[]): string | undefined {
  for (const dir of dirs) {
    try {
      const hit = readdirSync(dir).find((f) => f.toLowerCase().endsWith(".gguf"));
      if (hit) return join(dir, hit);
    } catch {
      // dir does not exist
    }
  }
  return undefined;
}

function resolvePaths(cfg: InferenceRuntimeConfig): ResolvedPaths {
  const endpoint = cfg.env.KHONJEL_LLAMA_ENDPOINT;
  if (endpoint) return { endpoint };

  const exe = cfg.isWindows ? "llama-server.exe" : "llama-server";
  const binCandidates = [
    cfg.env.KHONJEL_LLAMA_SERVER,
    join(cfg.userDataDir, "runtime", "llama", exe),
    join(cfg.appDir, "vendor", "llama", exe),
  ].filter((p): p is string => Boolean(p));
  const binPath = binCandidates.find((p) => existsSync(p));

  const modelPath =
    cfg.env.KHONJEL_LLM_MODEL ??
    firstGguf([join(cfg.userDataDir, "models"), join(cfg.appDir, "models")]);

  return { binPath, modelPath };
}

function gpuLayers(env: Record<string, string | undefined>): number | undefined {
  const raw = env.KHONJEL_LLM_GPU_LAYERS;
  if (!raw) return undefined;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function createInferenceRuntime(cfg: InferenceRuntimeConfig): InferenceRuntime {
  let backing: InferenceEngine = stubInferenceEngine;
  let stopServer: (() => void) | undefined;

  const engine: InferenceEngine = {
    refine: (text) => backing.refine(text),
    runAgent: (instruction) =>
      backing.runAgent ? backing.runAgent(instruction) : Promise.resolve(instruction),
    chat: (messages) => (backing.chat ? backing.chat(messages) : Promise.resolve("")),
  };

  const start = async (): Promise<InferenceMode> => {
    const paths = resolvePaths(cfg);

    if (paths.endpoint) {
      // User-managed server: forward an explicit token if they set one.
      backing = withFallback(
        createLlamaEngine({ endpoint: paths.endpoint, apiKey: cfg.env.KHONJEL_LLAMA_API_KEY }),
        stubInferenceEngine,
      );
      return "endpoint";
    }

    if (paths.binPath && paths.modelPath) {
      try {
        // Per-session bearer token so only this app can use the local model server.
        const apiKey = randomUUID();
        const handle = await startLlamaServer({
          binPath: paths.binPath,
          modelPath: paths.modelPath,
          ctxSize: 4096,
          gpuLayers: gpuLayers(cfg.env),
          apiKey,
        });
        stopServer = handle.stop;
        backing = withFallback(
          createLlamaEngine({ endpoint: handle.endpoint, apiKey }),
          stubInferenceEngine,
        );
        return "spawned";
      } catch {
        // keep the deterministic stub
      }
    }

    return "stub";
  };

  const stop = (): void => {
    if (stopServer) stopServer();
  };

  return { engine, start, stop };
}
