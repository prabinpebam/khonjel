import { ControlPanel } from "@surfaces/control-panel/ControlPanel";

/**
 * Surface router. The desktop app runs several windows (Control Panel, floating bar,
 * settings, onboarding); the mock simulates them via a `?surface=` query param.
 * Phase 0 ships the Control Panel; the others mount here in later phases.
 */
export function AppRouter() {
  return <ControlPanel />;
}
