/**
 * llama-server lifecycle controller: spawns the prebuilt llama.cpp HTTP server as a child process
 * and waits until it is ready to serve completions. Standalone executable -> no native ABI rebuild.
 *
 * The argv construction is PURE (BE1-tested). The spawn + health-poll is real and verified at
 * runtime (the user supplies the binary + model; see scripts/fetch-llama.mjs and the README). The
 * composition root calls this only when a binary + model are present, and always keeps the
 * deterministic engine as a fallback, so the app runs with or without a local model.
 */
import { spawn } from "node:child_process";

export interface LlamaServerOptions {
  /** Path to llama-server(.exe). */
  binPath: string;
  /** Path to the .gguf model file. */
  modelPath: string;
  host?: string;
  port?: number;
  /** Bearer token required on every request (zero-trust localhost). */
  apiKey?: string;
  /** Context window (-c). */
  ctxSize?: number;
  /** GPU layers to offload (-ngl); 0 = CPU only. */
  gpuLayers?: number;
  extraArgs?: string[];
}

export interface LlamaServerHandle {
  endpoint: string;
  stop: () => void;
  pid?: number;
}

/** PURE: the llama-server argv for these options. */
export function buildServerArgs(opts: LlamaServerOptions): string[] {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 8080;
  const args = ["-m", opts.modelPath, "--host", host, "--port", String(port)];
  if (opts.apiKey) args.push("--api-key", opts.apiKey);
  if (typeof opts.ctxSize === "number") args.push("-c", String(opts.ctxSize));
  if (typeof opts.gpuLayers === "number") args.push("-ngl", String(opts.gpuLayers));
  if (opts.extraArgs && opts.extraArgs.length > 0) args.push(...opts.extraArgs);
  return args;
}

async function isHealthy(endpoint: string): Promise<boolean> {
  try {
    const fetchFn = (globalThis as unknown as { fetch: (u: string) => Promise<{ ok: boolean }> }).fetch;
    const res = await fetchFn(`${endpoint}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Spawn llama-server and resolve once `/health` is ok, or reject if it never becomes ready. */
export async function startLlamaServer(
  opts: LlamaServerOptions,
  waitMs = 90_000,
): Promise<LlamaServerHandle> {
  const host = opts.host ?? "127.0.0.1";
  const port = opts.port ?? 8080;
  // Zero-trust localhost: never expose the model server beyond the loopback interface.
  if (host !== "127.0.0.1" && host !== "localhost" && host !== "::1") {
    throw new Error(`llama-server refuses a non-loopback host: ${host}`);
  }
  const endpoint = `http://${host}:${port}`;

  const child = spawn(opts.binPath, buildServerArgs(opts), { stdio: "ignore", windowsHide: true });
  let exited = false;
  child.on("exit", () => {
    exited = true;
  });

  const deadline = Date.now() + waitMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error("llama-server exited before becoming ready");
    if (await isHealthy(endpoint)) {
      return { endpoint, stop: () => child.kill(), pid: child.pid };
    }
    await sleep(500);
  }
  child.kill();
  throw new Error(`llama-server did not become ready within ${waitMs}ms`);
}
