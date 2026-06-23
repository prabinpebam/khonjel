/**
 * The backend install index (gpu-acceleration 02 §4). PURE state-machine operations over the
 * `EngineBackends` record that is persisted as `backends.json`. No IO: callers apply the returned
 * `removedDirs` to the filesystem. BE1-tested.
 *
 * Invariants:
 *   - Activation is a pointer flip; directories are immutable once installed.
 *   - Retention keeps only active + last-known-good + cpu per engine (the floor never disappears).
 *   - A quarantined backend is kept out of the active path with its failure reason.
 */
import type { AccelerationEngine, Backend } from "../../../src/services/ports";

export interface InstalledBackend {
  backend: Backend;
  version: string;
  dir: string;
  state: "installed" | "active" | "quarantined";
  probedAt?: string;
  lastError?: { code: string; message: string };
}

export interface EngineBackends {
  engine: AccelerationEngine;
  active?: string;
  lastKnownGood?: string;
  installed: Record<string, InstalledBackend>;
}

export function backendKey(backend: Backend, version: string): string {
  return `${backend}@${version}`;
}

export function emptyIndex(engine: AccelerationEngine): EngineBackends {
  return { engine, installed: {} };
}

function clone(idx: EngineBackends): EngineBackends {
  const installed: Record<string, InstalledBackend> = {};
  for (const [key, value] of Object.entries(idx.installed)) installed[key] = { ...value };
  return { engine: idx.engine, active: idx.active, lastKnownGood: idx.lastKnownGood, installed };
}

export function recordInstalled(
  idx: EngineBackends,
  info: { backend: Backend; version: string; dir: string },
): EngineBackends {
  const next = clone(idx);
  const key = backendKey(info.backend, info.version);
  const existing = next.installed[key];
  next.installed[key] = {
    backend: info.backend,
    version: info.version,
    dir: info.dir,
    state: existing?.state === "active" ? "active" : "installed",
  };
  return next;
}

export function activate(idx: EngineBackends, key: string): EngineBackends {
  const next = clone(idx);
  if (!next.installed[key]) return next;
  if (next.active && next.active !== key) {
    const prev = next.installed[next.active];
    if (prev && prev.state === "active") prev.state = "installed";
  }
  const entry = next.installed[key];
  if (entry) entry.state = "active";
  next.active = key;
  next.lastKnownGood = key;
  return next;
}

export function quarantine(idx: EngineBackends, key: string, error: { code: string; message: string }): EngineBackends {
  const next = clone(idx);
  const entry = next.installed[key];
  if (entry) {
    entry.state = "quarantined";
    entry.lastError = error;
  }
  if (next.active === key) next.active = undefined;
  if (next.lastKnownGood === key) next.lastKnownGood = undefined;
  return next;
}

function cpuKeyOf(idx: EngineBackends): string | undefined {
  const found = Object.entries(idx.installed).find(([, v]) => v.backend === "cpu" && v.state !== "quarantined");
  return found?.[0];
}

/** Where to roll back to: the last-known-good if still healthy, else the CPU floor. */
export function rollbackTarget(idx: EngineBackends): string | undefined {
  if (idx.lastKnownGood && idx.installed[idx.lastKnownGood]?.state !== "quarantined") return idx.lastKnownGood;
  return cpuKeyOf(idx);
}

/** Keep active + last-known-good + cpu; remove the rest. Returns dirs the caller should delete. */
export function pruneRetention(idx: EngineBackends): { index: EngineBackends; removedDirs: string[] } {
  const next = clone(idx);
  const keep = new Set<string>();
  if (next.active) keep.add(next.active);
  if (next.lastKnownGood) keep.add(next.lastKnownGood);
  const removedDirs: string[] = [];
  for (const [key, value] of Object.entries(next.installed)) {
    if (keep.has(key) || value.backend === "cpu") continue;
    removedDirs.push(value.dir);
    delete next.installed[key];
  }
  return { index: next, removedDirs };
}

/** Drop every GPU backend and revert to the CPU floor. Returns the GPU dirs to delete. */
export function removeGpuBackends(idx: EngineBackends): { index: EngineBackends; removedDirs: string[] } {
  const next = clone(idx);
  const cpu = cpuKeyOf(next);
  const removedDirs: string[] = [];
  for (const [key, value] of Object.entries(next.installed)) {
    if (value.backend === "cpu") continue;
    removedDirs.push(value.dir);
    delete next.installed[key];
  }
  next.active = cpu;
  next.lastKnownGood = cpu;
  if (cpu) {
    const entry = next.installed[cpu];
    if (entry) entry.state = "active";
  }
  return { index: next, removedDirs };
}
