/**
 * createDomEvalRecorder — the EDD recorder helper (Khonjel).
 *
 * Owns: capture injection, key-frame screenshots, mutation-timeline construction, detector
 * aggregation, and artifact writing to one directory per run. Built on the generic pattern in
 * docs/frameworks/eval-driven-development/02-dom-state-capture.md.
 */
import fs from "node:fs";
import path from "node:path";
import { captureDomEvalState } from "./capture-dom-eval-state.mjs";
import { runDetectors, summarize } from "./detectors.mjs";

const DEFAULT_OUTPUT_ROOT = "eval-results";

export function createDomEvalRecorder(page, options) {
  const { feature, scenario, userGoal = null, taskFlow = [], outputRoot = DEFAULT_OUTPUT_ROOT } = options;
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(outputRoot, feature, `${scenario}-${stamp}`);
  fs.mkdirSync(path.join(outputDir, "screenshots"), { recursive: true });

  const frames = [];
  const t0 = Date.now();

  async function capture(trigger) {
    const snap = await page.evaluate(captureDomEvalState);
    const frameId = frames.length;
    snap.frameId = frameId;
    snap.trigger = trigger;
    snap.elapsedMs = Date.now() - t0;
    const shotName = `frame-${String(frameId).padStart(4, "0")}-${slug(trigger)}.png`;
    try {
      await page.screenshot({ path: path.join(outputDir, "screenshots", shotName), fullPage: false });
      snap.screenshot = `screenshots/${shotName}`;
    } catch {
      snap.screenshot = null;
    }
    frames.push(snap);
    return snap;
  }

  async function finish() {
    const mutations = buildMutations(frames);
    const anomalies = runDetectors(frames);
    const { verdict, summary } = summarize(anomalies);
    const durationMs = Date.now() - t0;

    writeJson(outputDir, "metadata.json", {
      feature,
      scenario,
      startedAt: startedAt.toISOString(),
      runner: "playwright",
      frames: frames.length,
      userGoal,
      taskFlowSource: "docs/frameworks/eval-driven-development/03-khonjel-edd-interpretation.md",
    });
    writeJson(outputDir, "timeline.json", frames);
    writeJson(outputDir, "mutations.json", mutations);
    const report = { scenario, feature, verdict, summary, frames: frames.length, durationMs, anomalies };
    writeJson(outputDir, "anomaly-report.json", report);
    writeJson(outputDir, "semantic-eval-input.json", buildSemanticInput(frames, { scenario, userGoal, taskFlow, summary }));

    return { outputDir, report };
  }

  return {
    capture,
    finish,
    get outputDir() {
      return outputDir;
    },
  };
}

/** Diff consecutive frames on a small set of meaningful subjects. */
function buildMutations(frames) {
  const mutations = [];
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1];
    const cur = frames[i];
    const pairs = [
      ["product", "activeView", prev.product?.activeView, cur.product?.activeView],
      ["visual", "shell.ready", prev.visual?.shell?.ready, cur.visual?.shell?.ready],
      ["visual", "content.textHash", prev.visual?.shell?.contentRegion?.textHash, cur.visual?.shell?.contentRegion?.textHash],
      ["visual", "palette.visible", prev.visual?.overlays?.commandPalette?.visible, cur.visual?.overlays?.commandPalette?.visible],
      ["visual", "settings.visible", prev.visual?.overlays?.settingsModal?.visible, cur.visual?.overlays?.settingsModal?.visible],
      ["product", "stateHash", prev.product?.stateHash, cur.product?.stateHash],
    ];
    for (const [layer, field, oldValue, newValue] of pairs) {
      if (oldValue !== newValue) {
        mutations.push({ frameId: cur.frameId, timestamp: cur.timestamp, layer, subjectId: "shell", subjectType: "control-panel", field, oldValue: oldValue ?? null, newValue: newValue ?? null });
      }
    }
  }
  return mutations;
}

/** Compact narrative packet for human/LLM semantic review. */
function buildSemanticInput(frames, { scenario, userGoal, taskFlow, summary }) {
  const last = frames[frames.length - 1] || {};
  return {
    scenario,
    userGoal,
    taskFlow,
    finalSummary: {
      activeView: last.product?.activeView ?? null,
      shellReady: !!last.visual?.shell?.ready,
      primaryContentVisible: !!last.visual?.shell?.contentRegion?.nonBlank,
      errors: summary.critical,
      warnings: summary.warning,
    },
    screenshots: frames.filter((f) => f.screenshot).map((f) => f.screenshot),
    reviewQuestions: [
      "Did each navigated view render real, non-blank content?",
      "Were opened overlays (palette/settings) actually visible and operable?",
      "Did any state claim a result the UI did not actually show?",
      "Did theme/reload preserve the meaning of the screen?",
    ],
  };
}

function writeJson(dir, name, value) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + "\n", "utf8");
}

function slug(value) {
  return String(value || "frame").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}
