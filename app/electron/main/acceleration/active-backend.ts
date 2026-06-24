/**
 * Active-backend bridge (gpu-acceleration -> live runtimes). PURE selectors over the persisted
 * acceleration index (backends.json) plus a thin node reader, so the inference + STT runtimes can
 * load the active GPU engine binary and offload `-ngl` layers. When nothing is active, the proven
 * CPU path is used unchanged. The selectors are BE1-tested; this file does no spawning.
 */
import fs from "node:fs";
import path from "node:path";
import { computeOffloadPlan, resolveGpuLayers } from "./offload";
import type { EngineBackends } from "./backends";
import type { AccelerationEngine, GpuProfile } from "../../../src/services/ports";

export interface ActiveBackend {
  backend: string;
  version: string;
  dir: string;
}

/** PURE: the active GPU backend for an engine, or undefined when on the CPU floor. */
export function activeGpuBackend(index: EngineBackends | undefined): ActiveBackend | undefined {
  const key = index?.active;
  if (!index || !key) return undefined;
  const entry = index.installed[key];
  if (!entry || entry.state !== "active" || entry.backend === "cpu") return undefined;
  return { backend: entry.backend, version: entry.version, dir: entry.dir };
}

/** PURE: planned -ngl for an LLM GPU backend from VRAM + model size (env override wins, then plan). */
export function plannedGpuLayers(opts: {
  profile?: GpuProfile;
  modelBytes: number;
  contextTokens?: number;
  envOverride?: string;
}): number {
  const primary = opts.profile?.primary;
  const plan = computeOffloadPlan({
    vramBytes: primary?.vramBytes,
    modelBytes: opts.modelBytes,
    contextTokens: opts.contextTokens ?? 4096,
    vendor: primary?.vendor ?? "unknown",
    unifiedMemory: primary?.unifiedMemory,
  });
  return resolveGpuLayers({ envOverride: opts.envOverride, plannedNgl: plan.ngl });
}

// ------------------------------------------------------------------ //
// Node readers (composition glue over runtime/*.json)
// ------------------------------------------------------------------ //

export function readBackendsIndex(runtimeDir: string, engine: AccelerationEngine): EngineBackends | undefined {
  try {
    const all = JSON.parse(fs.readFileSync(path.join(runtimeDir, "backends.json"), "utf8")) as Record<
      string,
      EngineBackends
    >;
    return all[engine];
  } catch {
    return undefined;
  }
}

export function readGpuProfile(runtimeDir: string): GpuProfile | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(runtimeDir, "gpu-profile.json"), "utf8")) as GpuProfile;
  } catch {
    return undefined;
  }
}

function sizeOf(p: string): number {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

/** The active GPU llama-server binary + planned -ngl, or undefined to keep the proven CPU path. */
export function activeLlamaGpu(opts: {
  runtimeDir: string;
  isWindows: boolean;
  modelPath: string;
  envOverride?: string;
}): { binPath: string; gpuLayers: number } | undefined {
  const active = activeGpuBackend(readBackendsIndex(opts.runtimeDir, "llama"));
  if (!active) return undefined;
  const exe = opts.isWindows ? "llama-server.exe" : "llama-server";
  const binPath = path.join(active.dir, exe);
  if (!fs.existsSync(binPath)) return undefined;
  const gpuLayers = plannedGpuLayers({
    profile: readGpuProfile(opts.runtimeDir),
    modelBytes: sizeOf(opts.modelPath),
    envOverride: opts.envOverride,
  });
  return { binPath, gpuLayers };
}

/** Binary directories for the active GPU whisper backend (empty = keep the CPU path). */
export function activeWhisperGpuDirs(runtimeDir: string, isWindows: boolean): string[] {
  const active = activeGpuBackend(readBackendsIndex(runtimeDir, "whisper"));
  if (!active) return [];
  // The whisper.cpp Windows zip can nest binaries under Release/; support both layouts.
  return isWindows ? [active.dir, path.join(active.dir, "Release")] : [active.dir];
}
