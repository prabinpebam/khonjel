/**
 * Acceleration service orchestration (gpu-acceleration 04 §6). PURE + dependency-injected: it owns
 * the detect -> cache -> plan flow but takes its IO (real detection, profile cache, manifest sizing)
 * as deps, so it is BE1-testable without a GPU. The node composition root (node-io.ts) builds the
 * real deps; `main.ts` wires it.
 *
 * Phase 1 surface: profile / rescan / plan (read-only). Provision / runtime / test verbs grow in
 * later phases.
 */
import { buildAccelerationPlan } from "./decide";
import type { AccelerationEngine, AccelerationPlan, Backend, GpuProfile } from "../../../src/services/ports";

export interface AccelerationDeps {
  /** Run real hardware detection (bound to env + IO in the node root, or a fake in tests). */
  detectProfile: () => GpuProfile;
  /** Load the cached `GpuProfile` from disk (undefined if none). */
  loadCachedProfile: () => GpuProfile | undefined;
  /** Persist a detected profile to disk. */
  saveProfile: (profile: GpuProfile) => void;
  /** Backends the manifest ships for this machine's os/arch. */
  availableBackends: (profile: GpuProfile) => Backend[];
  /** Backends already provisioned (no download needed); defaults to none. */
  installedBackends?: () => Backend[];
  /** Manifest sizing for honest download/disk copy. */
  sizeOf?: (engine: AccelerationEngine, backend: Backend) => { downloadBytes?: number; diskBytes?: number };
  /** Whether a cached profile is still valid (same hardware/driver/app). Defaults to always-fresh. */
  isCacheFresh?: (cached: GpuProfile) => boolean;
}

export interface AccelerationApi {
  profile(): Promise<GpuProfile>;
  rescan(): Promise<GpuProfile>;
  plan(): Promise<AccelerationPlan>;
}

export function createAccelerationService(deps: AccelerationDeps): AccelerationApi {
  let current: GpuProfile | undefined;

  async function rescan(): Promise<GpuProfile> {
    const profile = deps.detectProfile();
    current = profile;
    deps.saveProfile(profile);
    return profile;
  }

  async function profile(): Promise<GpuProfile> {
    if (current) return current;
    const cached = deps.loadCachedProfile();
    if (cached && (deps.isCacheFresh?.(cached) ?? true)) {
      current = cached;
      return cached;
    }
    return rescan();
  }

  async function plan(): Promise<AccelerationPlan> {
    const profileNow = await profile();
    return buildAccelerationPlan({
      profile: profileNow,
      available: deps.availableBackends(profileNow),
      installed: deps.installedBackends?.() ?? [],
      sizeOf: deps.sizeOf,
    });
  }

  return { profile, rescan, plan };
}

/**
 * Stand-in for the per-os/arch backend availability the artifact manifest will own in Phase 2.
 * Intentionally conservative: only the build variants we plan to ship.
 */
export function defaultAvailableBackends(os: GpuProfile["os"], arch: string): Backend[] {
  if (os === "darwin") return arch === "arm64" ? ["metal", "cpu"] : ["cpu"];
  if (arch !== "x64") return ["cpu"];
  if (os === "win32") return ["cuda-13.3", "cuda-12.4", "vulkan", "cpu"];
  // linux
  return ["cuda-13.3", "cuda-12.4", "vulkan", "cpu"];
}
