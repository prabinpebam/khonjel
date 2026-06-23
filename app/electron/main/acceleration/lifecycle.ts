/**
 * Lifecycle glue (gpu-acceleration 02 §6, 03 §5). PURE decisions that compose the probe result and
 * the crash-loop guard with the backends index into the next index state + a rollback target. The
 * service applies the returned index to disk and restarts the engine; these functions hold the
 * "never get stuck" safety policy and are BE1-tested.
 */
import { activate, quarantine, rollbackTarget, type EngineBackends } from "./backends";
import { shouldDemote } from "./probe";

export interface ProbeOutcome {
  index: EngineBackends;
  activatedKey?: string;
  rolledBackTo?: string;
}

/** Activate on pass; on fail, quarantine + roll back to the last-known-good (else CPU, else nothing). */
export function applyProbeOutcome(
  index: EngineBackends,
  key: string,
  ok: boolean,
  error?: { code: string; message: string },
): ProbeOutcome {
  if (ok) {
    return { index: activate(index, key), activatedKey: key };
  }
  const quarantined = quarantine(index, key, error ?? { code: "unknown", message: "GPU support failed its test." });
  const target = rollbackTarget(quarantined);
  return {
    index: target ? activate(quarantined, target) : quarantined,
    rolledBackTo: target,
  };
}

export interface CrashLoopOutcome {
  index: EngineBackends;
  demoted: boolean;
  rolledBackTo?: string;
}

/** Auto-demote a backend that crashes too often, rolling back to the last-known-good / CPU. */
export function applyCrashLoop(
  index: EngineBackends,
  activeKey: string,
  crashTimes: number[],
  now: number,
  threshold: number,
  windowMs: number,
): CrashLoopOutcome {
  if (!shouldDemote(crashTimes, now, threshold, windowMs)) {
    return { index, demoted: false };
  }
  const quarantined = quarantine(index, activeKey, {
    code: "crashed",
    message: "GPU acceleration kept crashing, so Khonjel switched back to a stable setup.",
  });
  const target = rollbackTarget(quarantined);
  return {
    index: target ? activate(quarantined, target) : quarantined,
    demoted: true,
    rolledBackTo: target,
  };
}
