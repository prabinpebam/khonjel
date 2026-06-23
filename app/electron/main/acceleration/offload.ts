/**
 * GPU offload computation (gpu-acceleration 03 §2-3). PURE: how many transformer layers to offload
 * (`-ngl`) given VRAM vs model size + context, the OOM auto-tune ladder, and the shared LLM/STT VRAM
 * reservation. BE1-tested; the runtime applies the result and walks the ladder on a real OOM.
 */
import type { GpuVendor } from "../../../src/services/ports";

/** llama.cpp sentinel meaning "offload all layers". */
export const NGL_ALL = 999;
const GIB = 1024 * 1024 * 1024;
const CONSERVATIVE_FLOOR = 12;
const DEFAULT_LAYERS = 32;
const DEFAULT_KV_PER_TOKEN = 200 * 1024;

export interface OffloadInput {
  vramBytes?: number;
  modelBytes: number;
  layerCount?: number;
  contextTokens: number;
  perTokenKvBytes?: number;
  /** VRAM reserved for the other engine (STT) when both share the GPU. */
  sttReservedBytes?: number;
  vendor: GpuVendor;
  unifiedMemory?: boolean;
  mainGpu?: number;
}

export interface OffloadPlan {
  ngl: number;
  mainGpu?: number;
  reason: string;
  estimate: { fitsFully: boolean; reservedBytes: number };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function computeOffloadPlan(input: OffloadInput): OffloadPlan {
  const layerCount = input.layerCount ?? DEFAULT_LAYERS;
  const perToken = input.perTokenKvBytes ?? DEFAULT_KV_PER_TOKEN;

  if (input.vramBytes == null) {
    return {
      ngl: Math.min(CONSERVATIVE_FLOOR, layerCount),
      mainGpu: input.mainGpu,
      reason: "GPU memory is unknown, so a safe number of layers will be used.",
      estimate: { fitsFully: false, reservedBytes: 0 },
    };
  }

  const reserve = Math.max(1 * GIB, 0.1 * input.vramBytes);
  const kvCache = input.contextTokens * perToken;
  const sttReserved = input.sttReservedBytes ?? 0;
  const budget = input.vramBytes - reserve - kvCache - sttReserved;

  if (budget <= 0) {
    return { ngl: 0, mainGpu: input.mainGpu, reason: "Not enough GPU memory; running on the CPU.", estimate: { fitsFully: false, reservedBytes: reserve } };
  }
  if (input.modelBytes <= budget) {
    const gb = Math.round(input.vramBytes / GIB);
    return { ngl: NGL_ALL, mainGpu: input.mainGpu, reason: `Your ${gb} GB GPU fits the whole model.`, estimate: { fitsFully: true, reservedBytes: reserve } };
  }
  const perLayer = input.modelBytes / layerCount;
  const ngl = clamp(Math.floor(budget / perLayer), 0, layerCount);
  const reason = ngl > 0 ? `Offloading ${ngl} of ${layerCount} layers to the GPU.` : "Not enough GPU memory; running on the CPU.";
  return { ngl, mainGpu: input.mainGpu, reason, estimate: { fitsFully: false, reservedBytes: reserve } };
}

/** The OOM step-down ladder: planned -> 80% -> 60% -> 40% -> 20% -> 0 (CPU), as layer counts. */
export function oomLadder(plannedNgl: number, layerCount: number): number[] {
  const base = plannedNgl >= NGL_ALL ? layerCount : plannedNgl;
  const rungs = [1, 0.8, 0.6, 0.4, 0.2, 0].map((p) => Math.floor(base * p));
  const seen = new Set<number>();
  const out: number[] = [];
  for (const r of rungs) {
    if (!seen.has(r)) {
      seen.add(r);
      out.push(r);
    }
  }
  return out;
}

/** The next lower rung strictly below `currentNgl`, or undefined once at CPU. */
export function nextRung(ladder: number[], currentNgl: number): number | undefined {
  const lower = ladder.filter((r) => r < currentNgl);
  return lower.length > 0 ? Math.max(...lower) : undefined;
}

// ------------------------------------------------------------------ //
// Resolution precedence + per-(model,backend,version) cache
// ------------------------------------------------------------------ //

/**
 * The effective `-ngl` to launch with. Precedence: an explicit env override (power users / evals)
 * wins, then the cached best-working rung for this model+backend, then the freshly computed plan,
 * else 0 (CPU). This keeps the proven CPU path unchanged when no GPU plan exists.
 */
export function resolveGpuLayers(opts: { envOverride?: string | number; cachedNgl?: number; plannedNgl?: number }): number {
  if (opts.envOverride != null && opts.envOverride !== "") {
    const n = Number(opts.envOverride);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  if (opts.cachedNgl != null) return opts.cachedNgl;
  if (opts.plannedNgl != null) return opts.plannedNgl;
  return 0;
}

export type OffloadCache = Record<string, { ngl: number }>;

/** Cache key is per model + backend + engine build, so a new engine version re-tunes from scratch. */
export function offloadCacheKey(modelId: string, backend: string, engineVersion: string): string {
  return `${modelId}|${backend}|${engineVersion}`;
}

export function readCachedNgl(cache: OffloadCache, key: string): number | undefined {
  return cache[key]?.ngl;
}

/** Returns a NEW cache with the best-working rung recorded (immutable update). */
export function writeCachedNgl(cache: OffloadCache, key: string, ngl: number): OffloadCache {
  return { ...cache, [key]: { ngl } };
}
