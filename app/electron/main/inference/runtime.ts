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
import { activeLlamaGpu } from "../acceleration/active-backend";

export interface InferenceRuntimeConfig {
  userDataDir: string;
  appDir: string;
  isWindows: boolean;
  env: Record<string, string | undefined>;
  selectedModelId?: () => string | undefined;
  /**
   * Whether any LLM task currently uses the LOCAL engine. When this returns false the local model
   * is never loaded (and a running server is released), so a fully cloud-routed setup holds no GPU
   * VRAM. Defaults to "always needed" when omitted (back-compat for tests/eval).
   */
  localEngineNeeded?: () => boolean;
}

export type InferenceMode = "endpoint" | "spawned" | "stub";

export interface InferenceRuntime {
  /** Stable engine proxy handed to the inference service; reads the current backing engine. */
  engine: InferenceEngine;
  /** Resolve + swap in the real engine. Resolves to the mode that was selected. */
  start: () => Promise<InferenceMode>;
  /** Warm/switch to a specific local model id; keeps the previous engine if startup fails. */
  prepareModel: (modelId: string) => Promise<InferenceMode>;
  activeModelId: () => string | undefined;
  /** Stop a spawned server (no-op for endpoint/stub modes). */
  stop: () => void;
}

interface ResolvedPaths {
  endpoint?: string;
  binPath?: string;
  modelPath?: string;
  /** -ngl to launch with (GPU backend or env override); undefined/0 keeps the CPU path. */
  gpuLayers?: number;
}

export function resolveModelPath(opts: {
  dirs: string[];
  selectedModelId?: string;
  filesByDir?: (dir: string) => string[];
}): string | undefined {
  const filesByDir = opts.filesByDir ?? ((dir: string) => readdirSync(dir));
  for (const dir of opts.dirs) {
    try {
      const files = filesByDir(dir);
      const selected = opts.selectedModelId
        ? files.find((f) => f.toLowerCase() === opts.selectedModelId?.toLowerCase())
        : undefined;
      if (selected) return join(dir, selected);
      const hit = files.find((f) => f.toLowerCase().endsWith(".gguf"));
      if (hit) return join(dir, hit);
    } catch {
      // dir does not exist
    }
  }
  return undefined;
}

function resolvePaths(cfg: InferenceRuntimeConfig, modelId?: string): ResolvedPaths {
  const endpoint = cfg.env.KHONJEL_LLAMA_ENDPOINT;
  if (endpoint) return { endpoint };

  const modelPath =
    cfg.env.KHONJEL_LLM_MODEL ??
    resolveModelPath({
      dirs: [join(cfg.userDataDir, "models"), join(cfg.appDir, "models")],
      selectedModelId: modelId ?? cfg.selectedModelId?.(),
    });

  const exe = cfg.isWindows ? "llama-server.exe" : "llama-server";
  const runtimeDir = join(cfg.userDataDir, "runtime");

  // Precedence: an explicit binary override (power users / evals) wins; then an active GPU backend
  // (the user turned on acceleration); then the proven CPU runtime/vendor binary.
  if (cfg.env.KHONJEL_LLAMA_SERVER && existsSync(cfg.env.KHONJEL_LLAMA_SERVER)) {
    return { binPath: cfg.env.KHONJEL_LLAMA_SERVER, modelPath, gpuLayers: gpuLayers(cfg.env) };
  }
  const gpu = modelPath
    ? activeLlamaGpu({ runtimeDir, isWindows: cfg.isWindows, modelPath, envOverride: cfg.env.KHONJEL_LLM_GPU_LAYERS })
    : undefined;
  if (gpu) return { binPath: gpu.binPath, modelPath, gpuLayers: gpu.gpuLayers };

  const binCandidates = [join(runtimeDir, "llama", exe), join(cfg.appDir, "vendor", "llama", exe)];
  const binPath = binCandidates.find((p) => existsSync(p));

  return { binPath, modelPath, gpuLayers: gpuLayers(cfg.env) };
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
  let activeModel: string | undefined;

  const engine: InferenceEngine = {
    refine: (text) => backing.refine(text),
    runAgent: (instruction) =>
      backing.runAgent ? backing.runAgent(instruction) : Promise.resolve(instruction),
    chat: (messages) => (backing.chat ? backing.chat(messages) : Promise.resolve("")),
    // Prefer the backing engine's native streaming; otherwise degrade to a single-shot reply emitted
    // as one token, so chat still works on the deterministic stub (no model installed).
    chatStream: (messages, handlers) => {
      if (backing.chatStream) return backing.chatStream(messages, handlers);
      if (backing.chat) {
        return backing.chat(messages).then((text) => {
          if (text.length > 0) handlers.onToken(text);
          return text;
        });
      }
      return Promise.resolve("");
    },
  };

  const startFor = async (modelId?: string): Promise<InferenceMode> => {
    const paths = resolvePaths(cfg, modelId);

    if (paths.endpoint) {
      // User-managed server: forward an explicit token if they set one.
      backing = withFallback(
        createLlamaEngine({ endpoint: paths.endpoint, apiKey: cfg.env.KHONJEL_LLAMA_API_KEY }),
        stubInferenceEngine,
      );
      activeModel = modelId;
      return "endpoint";
    }

    // Only hold a local model in (V)RAM when an LLM task actually uses the local engine. With every
    // task routed to cloud, skip the spawn (and release any running server) so nothing sits on the GPU.
    const localNeeded = cfg.localEngineNeeded ? cfg.localEngineNeeded() : true;

    if (paths.binPath && paths.modelPath && localNeeded) {
      try {
        // Per-session bearer token so only this app can use the local model server.
        const apiKey = randomUUID();
        const handle = await startLlamaServer({
          binPath: paths.binPath,
          modelPath: paths.modelPath,
          ctxSize: 4096,
          gpuLayers: paths.gpuLayers,
          apiKey,
        });
        const previousStop = stopServer;
        backing = withFallback(
          createLlamaEngine({ endpoint: handle.endpoint, apiKey }),
          stubInferenceEngine,
        );
        stopServer = handle.stop;
        activeModel = modelId ?? cfg.selectedModelId?.();
        previousStop?.();
        return "spawned";
      } catch {
        // Keep the current engine (or deterministic stub if no engine has ever started).
      }
    } else if (!localNeeded && stopServer) {
      // The last local LLM task just switched to cloud: release the model so it stops holding VRAM.
      stopServer();
      stopServer = undefined;
      backing = stubInferenceEngine;
      activeModel = undefined;
    }

    return backing === stubInferenceEngine ? "stub" : "spawned";
  };

  const start = (): Promise<InferenceMode> => startFor();

  const stop = (): void => {
    if (stopServer) stopServer();
  };

  return { engine, start, prepareModel: (modelId) => startFor(modelId), activeModelId: () => activeModel, stop };
}
