# Khonjel EDD Interpretation

> The project-specific layer of [Eval Driven Development](./01-eval-driven-development.md).
> The generic framework (00–02) stays portable; **this** file binds it to Khonjel's real app:
> its stores, surfaces, selectors, debug handle, detector catalog, first scenarios, and the
> gaps that currently block deeper eval coverage. The runnable harness lives in
> [`app/eval/`](../../../app/eval/).

---

## 1. Where EDD sits in Khonjel's validation stack

Khonjel already defines deterministic test layers; EDD is the **selection layer above them**,
not a replacement.

| Layer | What it protects | Where |
|---|---|---|
| **L0–L6** | Static, design-system lint, unit/RTL, a11y, visual regression, spec coverage, agent visual review | [test & validation strategy](../../product-spec/04-architecture-and-delivery/06-test-and-validation-strategy.md) |
| **BE1–BE4** | Backend handler unit, IPC contract, adapter parity, offline E2E | [backend coverage framework §3a](../../product-spec/04-architecture-and-delivery/backend/06-feature-coverage-framework.md) |
| **EDD (this)** | *Did the real running product satisfy the user's expectation?* — drives convergence for capture, agent, notes, meetings, chat, transforms, and provider flows | `app/eval/` + this doc |

> **Rule of thumb:** if the success criterion is a stable contract, it is a test (L0–L2/BE1–BE3).
> If it is "the user could actually do the thing in the running app," it is an EDD scenario
> (overlaps L4/L6 and **BE4 offline E2E**). Every backend **BE4** row in the
> [coverage matrix](../../product-spec/04-architecture-and-delivery/backend/07-feature-coverage-matrix.md)
> is satisfied by a Khonjel EDD scenario here.

## 2. Khonjel user needs → eval scenarios

Scenarios trace to the product's jobs-to-be-done (see
[personas-and-jobs](../../product-spec/00-foundation/02-personas-and-jobs.md)). The driving set:

| # | User expectation (the "user-can") | Surface(s) | Phase |
|---|---|---|---|
| S1 | Open Khonjel and reach every primary view | Control Panel shell, sidebar | now (mock) |
| S2 | Open the command palette and jump to a view | Command palette | now (mock) |
| S3 | Open Settings, switch sections, toggle a setting, and it persists | Settings modal, stores | now (mock) |
| S4 | Switch theme and the whole shell repaints correctly (no blank/contrast loss) | Title bar, all views | now (mock) |
| S5 | Press dictation hotkey → see "listening" < 100 ms → text injected at cursor | Khonjel Bar, pipeline | backend P1 |
| S6 | Address the agent by name → it runs a tool and answers | Agent overlay | backend P5 |
| S7 | Record → a clean, titled note appears in Notes | Notes, pipeline | backend P5 |
| S8 | Configure an **Azure OpenAI** connection (endpoint/deployment/api-version) and test it | Settings ▸ Models | backend P2 |
| S9 | Transcribe an uploaded file → result is visible and copyable | Upload | backend P4 |
| S10 | Meeting capture → actionable meeting notes | Meeting overlay | backend P6 |

S1–S4 run against the **mock frontend today**; S5–S10 light up as the backend phases land and
become the BE4 gate for those capabilities.

## 3. Product state layers to capture (Khonjel-specific)

| Layer | Source | How the recorder reads it |
|---|---|---|
| **Product** | Zustand stores: `ui` (activeView, sidebarCollapsed, settingsOpen/section, paletteOpen), `theme`, `settings` (toggles/values) | `window.__KHONJEL_EVAL__.product()` (dev bridge, §5) |
| **Execution** | capture session, inference stream, model download (once backend lands) | `window.__KHONJEL_EVAL__.execution()` |
| **Rendered UI** | the Control Panel shell + active view + overlays | `data-eval-*` selectors + roles (§4) |
| **Integration** | provider HTTP, IPC channels, injector calls | Playwright network + IPC tap (backend) |
| **Artifacts** | injected text, created notes, upload results, meeting docs | store reads + DOM destination checks |

## 4. Selector & semantic contract

Khonjel's stable eval surface (added to the app; dev-safe):

| Selector | Marks |
|---|---|
| `[data-eval="app-shell"]` | the Control Panel root; carries `data-eval-view` and `data-eval-ready` |
| `[data-eval="content"]` | the active view's content region (carries `data-eval-view`) |
| `[data-eval="nav-item"]` | each sidebar nav button (carries `data-eval-nav="<NavId>"`) |
| `[data-eval="settings-modal"]` | the Settings dialog when open |
| `[data-eval="command-palette"]` | the command palette when open |

Plus the existing accessibility semantics already in the app — `aria-current="page"` on the
selected nav item, `aria-label`s on icon buttons, `role="dialog"` on modals. **Prefer roles +
`data-eval-*`; never assert on Tailwind class names** (they are not a product contract and the
[ds-lint](../../product-spec/04-architecture-and-delivery/06-test-and-validation-strategy.md)
gate forbids relying on them).

## 5. The debug handle (`window.__KHONJEL_EVAL__`)

A **dev-only** bridge (compiled out of production) exposes safe state for observation —
mirroring the `MockStudio` dev-component pattern already in `App.tsx`:

```ts
// app/src/app/devtools/EvalBridge.tsx (DEV only)
window.__KHONJEL_EVAL__ = {
  ready: () => boolean,                 // shell mounted + first view painted
  product: () => ({ ui, theme, settings }),   // safe store snapshots (no secrets)
  execution: () => ({ jobs, active }),  // backend stream/job state (when present)
  version: () => string,
};
```

- **Observation only.** The bridge **reads** state; it never mutates it. Scenarios drive the app
  through real clicks/keys, not through this handle.
- **No secrets.** It returns toggles/values and view state — never API keys (those live in the
  keychain and never reach the renderer per
  [backend privacy](../../product-spec/04-architecture-and-delivery/backend/11-privacy-security-and-packaging.md)).

## 6. Detector catalog (Khonjel severity policy)

Built on the generic inline anomalies ([02](./02-dom-state-capture.md)) plus Khonjel rules. Full
implementations in [`app/eval/recorder/detectors.mjs`](../../../app/eval/recorder/detectors.mjs).

| Code | Severity | Fires when | Source |
|---|---|---|---|
| `SHELL_NOT_READY` | critical | shell never reaches `data-eval-ready` | S1 |
| `VIEW_BLANK_AFTER_NAV` | critical | a nav target's content region is blank after switch | S1, visual integrity |
| `OBJECT_OBJECT_VISIBLE` | critical | `[object Object]` in body text | generic |
| `RAW_ERROR_STACK_VISIBLE` | critical | a stack trace renders in the UI | generic |
| `SECRET_TEXT_VISIBLE` | critical | an API key/token appears in visible text | privacy |
| `SETTING_NOT_PERSISTED` | critical | a toggled setting reverts after reopen/reload | S3, persistence |
| `THEME_CONTRAST_LOST` | warning | after theme switch, a primary surface is blank or near-zero contrast | S4 |
| `OVERLAY_NOT_VISIBLE` | critical | palette/settings open in state but not painted/clickable | S2, S3 |
| `MISSING_ACCESSIBLE_NAME` | warning | a visible control has no accessible name | a11y (L3) |
| `LISTENING_FEEDBACK_LATE` | critical | (backend) > 100 ms from hotkey to "listening" | S5 hot-path budget |
| `OUTPUT_NOT_DELIVERED` | critical | (backend) cleanup/agent result not visible at the destination | S5–S7 output delivery |
| `PROVIDER_KEY_LEAKED_TO_RENDERER` | critical | (backend) a provider key is observable in renderer state/network | privacy/Azure |

**Policy:** zero `critical` and zero `warning` to call a scenario clean; `info` never becomes a
surprise blocker.

## 7. Artifact convention

One directory per run under the app:

```
app/eval-results/<feature>/<scenario>-<timestamp>/
  metadata.json  timeline.json  mutations.json
  anomaly-report.json  semantic-eval-input.json
  screenshots/ frame-*.png
```

`app/eval-results/` is **git-ignored** (runtime evidence, not source). Detector catalog,
recorder, and scenarios under `app/eval/` **are** committed.

## 8. First scenarios shipped

| Scenario file | Covers | Status |
|---|---|---|
| [`app/eval/scenarios/app-readiness.eval.mjs`](../../../app/eval/scenarios/app-readiness.eval.mjs) | S1: shell ready, all 8 nav targets reachable & non-blank | runnable now |
| [`app/eval/scenarios/navigate-and-settings.eval.mjs`](../../../app/eval/scenarios/navigate-and-settings.eval.mjs) | S2/S3/S4: palette jump, settings toggle+persist, theme switch | runnable now |

Run with `npm run eval` (see [`app/eval/README.md`](../../../app/eval/README.md)).

## 9. Gaps that block deeper eval coverage (carry into the backend)

These are the EDD-specific entries for
[backend open-questions §](../../product-spec/04-architecture-and-delivery/backend/13-open-questions-and-risks.md):

1. **No backend yet** — S5–S10 can only be *scaffolded* until the real adapters exist; today
   they assert against the mock and are marked `pending-backend`.
2. **Electron surface** — ~~scenarios run against the Vite dev server (`:5174`) now~~ **RESOLVED
   (T0.8):** a Playwright-**Electron** runner (`npm run eval:electron`,
   [`app/eval/scenarios/electron-seam.eval.electron.mjs`](../../../app/eval/scenarios/electron-seam.eval.electron.mjs))
   launches the real Electron main process and gates the live IPC seam + settings persistence
   across restart. Browser scenarios (S1–S4) still run via the dev server; capture/agent/meeting
   scenarios move to the Electron runner as they land.
3. **Hot-path timing** — `LISTENING_FEEDBACK_LATE` needs a real capture clock; wire it to the
   `capture:listening` event ([backend 08](../../product-spec/04-architecture-and-delivery/backend/08-ipc-and-ports-contracts.md)).
4. **Provider egress observation** — `PROVIDER_KEY_LEAKED_TO_RENDERER` needs the network/IPC tap
   to assert keys never cross the bridge (Azure and all providers).

## 10. Convergence definition for Khonjel

A Khonjel scenario is **clean** when: multiple runs complete; zero critical/warning anomalies;
the primary user-visible outcome is painted and operable (not just present in the DOM); theme and
reload preserve meaning; and — for backend scenarios — the hot path ran **fully offline**. A
backend capability is only `Implemented` in the
[coverage matrix](../../product-spec/04-architecture-and-delivery/backend/07-feature-coverage-matrix.md)
when its BE4 EDD scenario here is clean.
