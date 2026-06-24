/**
 * Acceleration speed test (composition glue). Measures real, on-device tokens/sec by spawning the
 * provisioned engine and timing a fixed completion: the active GPU backend vs the CPU floor when
 * both are present, so the card shows an honest speedup instead of a guess. Best-effort: any failure
 * resolves to an honest "couldn't measure" leg. Mirrors inference/runtime.ts (no unit tests at this
 * fs/child-process edge); the numbers never leave the device.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { startLlamaServer } from "../inference/llama-server";
import { buildLlamaBody } from "../inference/llama";
import { activeGpuBackend, plannedGpuLayers, readGpuProfile } from "./active-backend";
import type { AccelerationEngine, AccelerationTestReport, RuntimeMetrics } from "../../../src/services/ports";
import type { EngineBackends } from "./backends";

export interface BenchmarkInput {
  runtimeDir: string;
  modelsDir: string;
  isWindows: boolean;
  loadBackends: (engine: AccelerationEngine) => EngineBackends;
}

const PROMPT = "Write one short, friendly sentence about the weather today.";
const MAX_TOKENS = 48;

function firstGguf(dir: string): string | undefined {
  try {
    const hit = readdirSync(dir).find((f) => /\.gguf$/i.test(f));
    return hit ? join(dir, hit) : undefined;
  } catch {
    return undefined;
  }
}

function sizeOf(p: string): number {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
}

/** Spawn llama-server with the given binary + offload, time one completion, return tokens/sec. */
async function measure(
  binPath: string,
  modelPath: string,
  gpuLayers: number,
): Promise<RuntimeMetrics | undefined> {
  const apiKey = randomUUID();
  const port = 8200 + Math.floor(Math.random() * 700);
  let handle: { endpoint: string; stop: () => void } | undefined;
  try {
    handle = await startLlamaServer({ binPath, modelPath, gpuLayers, apiKey, port, ctxSize: 4096 }, 60_000);
    const t0 = Date.now();
    const res = await fetch(`${handle.endpoint}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(buildLlamaBody([{ role: "user", content: PROMPT }], { maxTokens: MAX_TOKENS })),
    });
    const json = (await res.json()) as { usage?: { completion_tokens?: number } };
    const ms = Date.now() - t0;
    const tokens = json.usage?.completion_tokens ?? MAX_TOKENS;
    return {
      device: gpuLayers > 0 ? "gpu" : "cpu",
      tokensPerSec: ms > 0 ? Math.round((tokens / ms) * 1000 * 10) / 10 : undefined,
      firstTokenMs: ms,
      offloadedLayers: gpuLayers > 0 ? gpuLayers : undefined,
    };
  } catch {
    return undefined;
  } finally {
    handle?.stop();
  }
}

const CPU_ONLY: AccelerationTestReport = {
  ok: false,
  llm: { ok: false, message: "Turn on GPU acceleration to run a speed test." },
  stt: { ok: false, message: "Voice typing runs on the CPU." },
  summary: "Running on the CPU.",
};

export async function runAccelerationBenchmark(input: BenchmarkInput): Promise<AccelerationTestReport> {
  const exe = input.isWindows ? "llama-server.exe" : "llama-server";
  const modelPath = firstGguf(input.modelsDir);
  const gpu = activeGpuBackend(input.loadBackends("llama"));
  if (!modelPath || !gpu) return CPU_ONLY;

  const gpuBin = join(gpu.dir, exe);
  if (!existsSync(gpuBin)) return CPU_ONLY;
  const ngl = plannedGpuLayers({ profile: readGpuProfile(input.runtimeDir), modelBytes: sizeOf(modelPath) }) || 999;

  const gpuMetrics = await measure(gpuBin, modelPath, ngl);
  if (!gpuMetrics?.tokensPerSec) {
    return { ...CPU_ONLY, llm: { ok: false, message: "Couldn't measure GPU speed just now. Try again." } };
  }

  // Compare against the CPU floor when the CPU build is also installed (honest, real speedup).
  const cpuBin = join(input.runtimeDir, "llama", exe);
  const cpuMetrics = existsSync(cpuBin) ? await measure(cpuBin, modelPath, 0) : undefined;
  const speedup =
    cpuMetrics?.tokensPerSec && gpuMetrics.tokensPerSec
      ? Math.round((gpuMetrics.tokensPerSec / cpuMetrics.tokensPerSec) * 10) / 10
      : undefined;

  return {
    ok: true,
    gpu: gpuMetrics,
    cpu: cpuMetrics,
    speedup,
    llm: { ok: true, message: "GPU speed test complete.", metrics: gpuMetrics },
    stt: { ok: false, message: "Voice typing speed isn't measured here." },
    summary: speedup ? `About ${speedup}x faster on your graphics card.` : "Running on your graphics card.",
  };
}
