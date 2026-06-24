import type { ModelReadiness, ModelStatus } from "@services/ports";

/**
 * A recommended-setup target is "settled" once its model is fully ready, OR it is downloaded
 * (installed) but its on-device engine runtime cannot be readied (missing/failed/unsupported) and
 * prepare was already attempted. The second case is why the setup card must stop instead of spinning
 * at "Setting up… 100%" forever when a model downloads but its engine binary is absent (prepare then
 * reports `failed`, so readiness never reaches "ready").
 */
export function isTargetSettled(
  status: ModelStatus | undefined,
  readinessState: ModelReadiness["state"] | undefined,
  prepared: boolean,
): boolean {
  if (readinessState === "ready") return true;
  return (
    status?.state === "installed" &&
    prepared &&
    (readinessState === "runtime-missing" || readinessState === "failed" || readinessState === "unsupported")
  );
}
