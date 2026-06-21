/**
 * Khonjel EDD detector catalog + post-processing runner.
 *
 * Detectors evaluate the captured timeline AFTER a scenario run (observation before judgment).
 * Each finding is traceable to a scenario/expectation per
 * docs/frameworks/eval-driven-development/03-khonjel-edd-interpretation.md §6.
 */

/** Static catalog (documentation + severity policy). */
export const DETECTOR_CATALOG = [
  { code: "SHELL_NOT_READY", severity: "critical", category: "app-readiness", rule: "The Control Panel shell must reach data-eval-ready.", source: "S1" },
  { code: "VIEW_BLANK_AFTER_NAV", severity: "critical", category: "visual-integrity", rule: "A navigated view's content region must not be blank after ready.", source: "S1" },
  { code: "OVERLAY_NOT_VISIBLE", severity: "critical", category: "state-to-ui-sync", rule: "When the store says an overlay is open, it must be painted and visible.", source: "S2/S3" },
  { code: "OBJECT_OBJECT_VISIBLE", severity: "critical", category: "rendering", rule: "[object Object] must not appear in body text.", source: "generic" },
  { code: "RAW_ERROR_STACK_VISIBLE", severity: "critical", category: "error-handling", rule: "Internal stack traces must not render in the UI.", source: "generic" },
  { code: "SECRET_TEXT_VISIBLE", severity: "critical", category: "privacy", rule: "Keys/tokens must not appear in visible text.", source: "privacy" },
  { code: "MISSING_ACCESSIBLE_NAME", severity: "warning", category: "accessibility", rule: "Visible interactive controls must expose an accessible name.", source: "L3/a11y" },
  { code: "SETTING_NOT_PERSISTED", severity: "critical", category: "persistence", rule: "A toggled setting must survive reopen/reload.", source: "S3" },
  { code: "THEME_CONTRAST_LOST", severity: "warning", category: "visual-integrity", rule: "After a theme switch, primary surfaces must not go blank.", source: "S4" },
  // Backend (light up when adapters land):
  { code: "LISTENING_FEEDBACK_LATE", severity: "critical", category: "workflow", rule: "Hotkey to 'listening' must be < 100 ms.", source: "S5" },
  { code: "OUTPUT_NOT_DELIVERED", severity: "critical", category: "output-delivery", rule: "A computed result must be visible at its destination.", source: "S5-S7" },
  { code: "PROVIDER_KEY_LEAKED_TO_RENDERER", severity: "critical", category: "privacy", rule: "Provider keys must never be observable in the renderer.", source: "Azure/privacy" },
];

const SEVERITY_KEYS = ["critical", "warning", "info"];

/**
 * Run frame-derivable detectors over a captured timeline.
 * @param {Array<object>} frames
 * @returns {Array<{code,severity,category,message,trigger,frameId}>}
 */
export function runDetectors(frames) {
  const found = [];
  const add = (a, frameId) => found.push({ trigger: "post", frameId: frameId ?? null, ...a });

  // 1) Surface inline anomalies recorded during capture.
  for (const f of frames) for (const a of f.anomalies || []) add(a, f.frameId);

  // 2) SHELL_NOT_READY — no frame ever reached ready.
  const everReady = frames.some((f) => f.visual?.shell?.ready);
  if (frames.length && !everReady) {
    add({ code: "SHELL_NOT_READY", severity: "critical", category: "app-readiness", message: "Control Panel shell never reached data-eval-ready" });
  }

  // 3) VIEW_BLANK_AFTER_NAV — ready shell but the active view's content region is blank.
  for (const f of frames) {
    const shell = f.visual?.shell;
    if (shell?.ready && shell.activeView && shell.contentRegion && !shell.contentRegion.nonBlank) {
      add({ code: "VIEW_BLANK_AFTER_NAV", severity: "critical", category: "visual-integrity", message: `View "${shell.activeView}" rendered a blank content region`, view: shell.activeView }, f.frameId);
    }
  }

  // 4) OVERLAY_NOT_VISIBLE — store says open but not painted/visible.
  for (const f of frames) {
    const ui = f.product?.safeStateSummary?.ui || {};
    const ov = f.visual?.overlays || {};
    if (ui.paletteOpen && !(ov.commandPalette && ov.commandPalette.visible)) {
      add({ code: "OVERLAY_NOT_VISIBLE", severity: "critical", category: "state-to-ui-sync", message: "Command palette is open in state but not visible" }, f.frameId);
    }
    if (ui.settingsOpen && !(ov.settingsModal && ov.settingsModal.visible)) {
      add({ code: "OVERLAY_NOT_VISIBLE", severity: "critical", category: "state-to-ui-sync", message: "Settings modal is open in state but not visible" }, f.frameId);
    }
  }

  return dedupe(found);
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const a of items) {
    const key = `${a.code}|${a.frameId}|${a.message || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(a);
  }
  return out;
}

/** Roll findings into a verdict summary. CLEAN = no critical and no warning. */
export function summarize(anomalies) {
  const summary = { critical: 0, warning: 0, info: 0 };
  for (const a of anomalies) {
    if (SEVERITY_KEYS.includes(a.severity)) summary[a.severity] += 1;
  }
  const verdict = summary.critical === 0 && summary.warning === 0 ? "CLEAN" : "FINDINGS";
  return { verdict, summary };
}
