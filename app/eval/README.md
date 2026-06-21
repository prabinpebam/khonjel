# Khonjel Eval Harness (EDD)

Runnable implementation of [Eval Driven Development](../../docs/frameworks/eval-driven-development/README.md).
Scenarios drive the **real running app** and capture a timeline + screenshots + anomaly report,
then judge the gap against the user expectation. This is the **BE4 offline-E2E gate** for backend
capabilities and complements the deterministic L0–L6 layers.

## Layout

```
app/
  playwright.config.mjs          runner config (targets the Vite dev server :5174)
  eval/
    recorder/
      capture-dom-eval-state.mjs   injected, side-effect-free DOM/state capture (reads window.__KHONJEL_EVAL__)
      dom-eval-recorder.mjs        capture → screenshot → mutations → detectors → artifacts
      detectors.mjs                Khonjel detector catalog + post-processing + verdict
    scenarios/
      app-readiness.eval.mjs       S1: shell ready, all 8 views reachable & non-blank
      navigate-and-settings.eval.mjs S2/S3: palette visible, settings change persists across reload
  eval-results/                  per-run artifacts (git-ignored)
    <feature>/<scenario>-<timestamp>/
      metadata.json timeline.json mutations.json anomaly-report.json semantic-eval-input.json
      screenshots/frame-*.png
```

## One-time setup

Playwright's browser binary is not committed. Install it once:

```
cd app
npm install                 # installs @playwright/test (uses --legacy-peer-deps repo-wide)
npx playwright install chromium
```

## Run

```
cd app
npm run eval                       # all browser scenarios (starts/reuses the dev server automatically)
npm run eval -- app-readiness      # filter to one scenario by name
npm run eval:headed                # watch it drive the real app
npm run eval:electron              # launch the REAL Electron app (seam + settings persistence)
```

A scenario is **CLEAN** when the recorder reports zero `critical` and zero `warning` anomalies
and the asserted user-visible outcomes hold. Inspect `eval-results/.../anomaly-report.json` and
the `screenshots/` for evidence; feed `semantic-eval-input.json` to a human/LLM reviewer for the
semantic pass.

## Discipline (do not drift to TDD)

- The scenario must launch the real app and interact like a user (clicks/keys), not mock the
  thing under test. See the [anti-drift warning](../../docs/frameworks/eval-driven-development/01-eval-driven-development.md#anti-drift-warning-for-agents).
- Assert on **roles + `data-eval-*`**, never on Tailwind class names.
- The dev bridge `window.__KHONJEL_EVAL__` is **read-only** observation — never set state through it.
- Backend scenarios (S5–S10) are scaffolded but `pending-backend` until the real adapters land,
  at which point the runner moves to Playwright's Electron launcher.
