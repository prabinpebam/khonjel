# DOM State Capture For Evals

> A generic guide for capturing user-visible DOM state, temporal UI behavior, and supporting product evidence for Eval Driven Development.

---

## Purpose

DOM state capture records what a user could see, inspect, focus, click, read, or infer from the running product. In Eval Driven Development, this evidence is paired with product state, execution state, screenshots, artifacts, and integration events so reviewers can evaluate whether the product satisfied the intended user expectation.

This guide is project-agnostic. The examples mention common web apps, generated previews, and workflow tools, but the capture pattern can be adapted to any browser, Electron, webview, or embedded UI surface. The Khonjel-specific recorder built on this guide lives in [`app/eval/`](../../../app/eval/) and is described in [03-khonjel-edd-interpretation.md](./03-khonjel-edd-interpretation.md).

---

## Real-App Requirement

DOM capture for EDD must observe the real app. A headless component harness, isolated jsdom render, mocked store, or fake state machine can be useful for TDD, but it is not sufficient for an eval gate.

For web and Electron apps, the eval runner should launch the actual application entry point and drive it through user-like actions:

- Click real buttons, menu items, tabs, toolbar controls, and dialogs.
- Type into real fields.
- Drag, drop, resize, select, and navigate through the real UI where the scenario requires it.
- Trigger save, load, run, pause, apply, revert, import, export, and service actions through the product boundary.
- Capture the resulting real DOM, screenshots, focus state, app state summaries, integration events, generated artifacts, and embedded surface state.

For interactive UI, "real DOM" is not enough by itself. The eval must prove that the user-facing surface is actually visible and operable:

- The element has a non-empty bounding box inside the viewport or intended scroll container.
- The element and its ancestors are not `display:none`, `visibility:hidden`, opacity-zero, inert, disabled, or hidden behind a modal/scrim.
- The element is not clipped by ancestor `overflow`, misplaced outside the window, or covered by another z-index layer.
- `document.elementFromPoint(...)` at the interaction point resolves to the element or one of its descendants.
- The action uses runner-level pointer/keyboard operations such as Playwright `locator.click()`, `hover()`, `press()`, or `type()`, not synthetic `element.click()` inside `evaluate()`.
- A screenshot or pixel/paint evidence shows the opened menu, flyout, dialog, preview, or output in the actual app window.

Do not fake the exact state the eval is supposed to prove. If the eval manually injects a successful store value, bypasses the real click path, stubs an iframe update, or pretends a bus event happened, it can pass while the feature remains broken for users.

Do not replace visibility proof with DOM existence proof. If a menu exists in the DOM but is clipped by `overflow:hidden`, sits behind another layer, has transparent paint, or cannot receive pointer events, the eval must fail.

Mocks belong underneath EDD in deterministic tests. The eval itself is the real-app evidence layer.

---

## What DOM Capture Is For

A final assertion rarely explains an experience failure. Many important failures are temporal or visual:

- A button appears enabled before required data is ready.
- A generated result exists in memory but is not visible to the user.
- A preview shows stale content after inputs change.
- A progress state disappears before the output is delivered.
- A modal opens but focus remains behind it.
- A menu opens in the DOM but is clipped outside the visible command bar.
- A flyout renders behind another z-index layer or transparent surface.
- A visible-looking control cannot receive pointer input because another element covers it.
- A workflow reloads correctly, then layout shifts after the first render tick.
- An embedded iframe reports loaded but renders blank.

DOM state capture creates a timeline that answers:

- What did the user see at each step?
- Which controls were available?
- Which output was visible, hidden, stale, blank, clipped, or misleading?
- Did accessible roles and names match the intended interaction?
- Did the UI update before, after, or independently from product state?

---

## Snapshot Envelope

Every capture frame should use a stable outer shape.

```ts
interface EvalSnapshot {
  frameId: number;
  timestamp: number;
  elapsedMs: number;
  trigger: string;

  product: ProductSnapshot;
  execution: ExecutionSnapshot;
  visual: VisualSnapshot;
  integration: IntegrationSnapshot;
  artifacts: ArtifactSnapshot;

  anomalies: CaptureAnomaly[];
}
```

A project can add or remove layers, but the recorder should keep the distinction between internal state, rendered state, integration evidence, and generated artifacts.

---

## Visual Snapshot

The visual snapshot records user-visible DOM state.

```ts
interface VisualSnapshot {
  viewportState: 'loading' | 'ready' | 'empty' | 'has-content' | 'error';
  route: string;
  root: ComponentNode;
  focus: {
    activeElementRole: string;
    activeElementName: string;
  };
  viewport: {
    width: number;
    height: number;
    scrollX: number;
    scrollY: number;
  };
  bodyTextHash: number;
  visibleTextSample: string;
}

interface ComponentNode {
  type: string;
  id: string;
  state: string;
  visible: boolean;
  position: number;
  bounds: { x: number; y: number; width: number; height: number };
  contentHash: number;
  accessibleName?: string;
  role?: string;
  children: ComponentNode[];
  properties: Record<string, unknown>;
}
```

The component tree does not need to mirror every DOM node. It should capture semantically important surfaces: shell, navigation, forms, controls, results, previews, dialogs, lists, panels, and embedded surfaces.

---

## Recommended Component Vocabulary

Use stable semantic component types rather than implementation-specific CSS names.

| Component type | Examples of captured properties |
|---|---|
| `app-shell` | route, ready state, theme, authenticated state. |
| `navigation` | selected item, visible items, collapsed state. |
| `toolbar` | available actions, disabled actions, active mode. |
| `form` | fields, validation state, submit state. |
| `field` | label, value hash, dirty state, error text, required state. |
| `button` | label, disabled state, pressed state, loading state. |
| `dialog` | title, modal state, focus containment, action buttons. |
| `list` | item count, selected item, empty state. |
| `item` | id, label hash, selected state, status. |
| `preview` | empty/nonempty, content hash, dimensions, nonblank ratio. |
| `result` | status, content hash, source/evidence count. |
| `alert` | severity, message hash, dismissible state. |
| `embedded-surface` | iframe/canvas/media load state, bounds, nonblank ratio. |

Projects should extend this vocabulary where needed, but should avoid one-off names that make detectors hard to reuse.

---

## Selector Guidance

Prefer selectors that express stable product semantics:

- `data-testid` for high-level surfaces and workflows.
- `data-eval-*` attributes for state intended specifically for capture.
- ARIA roles and accessible names for controls and dialogs.
- Stable domain IDs for repeated entities, such as `data-item-id` or `data-node-id`.

Avoid selectors that are likely to churn:

- Auto-generated class names.
- Deep positional selectors.
- Styling-only classes with no product meaning.
- Text-only selectors for dynamic or localized content, unless visible text is the thing being evaluated.

A product-specific interpretation should define its selector contract explicitly.

---

## Product State Snapshot

The product snapshot records what the app believes exists.

```ts
interface ProductSnapshot {
  route: string;
  sessionId?: string;
  selectedIds: string[];
  entityCounts: Record<string, number>;
  stateHash: number;
  safeStateSummary: Record<string, unknown>;
}
```

Capture product state when the UI depends on a model, store, cache, document, graph, session, or generated artifact. Store hashes and summaries by default. Capture raw values only when they are safe and necessary for evaluation.

---

## Execution Snapshot

The execution snapshot records work in progress.

```ts
interface ExecutionSnapshot {
  active: boolean;
  paused: boolean;
  queueLength: number;
  jobs: Array<{
    id: string;
    label: string;
    state: 'idle' | 'queued' | 'running' | 'done' | 'error' | 'blocked' | 'canceled';
    startedAt?: number;
    completedAt?: number;
    durationMs?: number;
    errorMessage?: string;
    inputHash?: number;
    outputHash?: number;
  }>;
}
```

Capture timing and transitions so evaluators can detect stuck work, premature success, missing progress feedback, and stale output.

---

## Integration Snapshot

The integration snapshot records boundary behavior.

```ts
interface IntegrationSnapshot {
  network: Array<{
    timestamp: number;
    method: string;
    urlHash: number;
    status?: number;
    requestShape?: string;
    responseShape?: string;
  }>;
  events: Array<{
    timestamp: number;
    source: string;
    type: string;
    payloadHash: number;
  }>;
  embedded: Array<{
    id: string;
    kind: 'iframe' | 'canvas' | 'media' | 'webview' | 'other';
    loaded: boolean;
    visible: boolean;
    width: number;
    height: number;
    nonBlankPixelRatio?: number;
    stateHash?: number;
  }>;
}
```

Record event shape and payload hashes, not secrets or large payloads. For inaccessible embedded surfaces, rely on load state, bounds, screenshots, and pixel sampling.

---

## Artifact Snapshot

The artifact snapshot records outputs the user may inspect or use.

```ts
interface ArtifactSnapshot {
  outputs: Array<{
    id: string;
    kind: string;
    created: boolean;
    visible: boolean;
    contentHash: number;
    destination: string;
  }>;
}
```

An output is delivered only when it appears in the expected user-facing destination. A generated result hidden only in memory or logs is not delivered if the task flow expects a preview, a file, a message draft, a chart, or an applied state.

---

## Inline Anomalies

Inline anomalies are cheap checks that can run during capture. They are not a substitute for post-processing detectors.

```ts
interface CaptureAnomaly {
  code: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  message: string;
  trigger: string;
}
```

Recommended generic checks:

| Code | Rule |
|---|---|
| `OBJECT_OBJECT_VISIBLE` | Page body must not show `[object Object]`. |
| `RAW_ERROR_STACK_VISIBLE` | Internal stack traces should not appear in user-facing UI. |
| `PRIMARY_SURFACE_BLANK` | A required primary surface must not be blank after ready. |
| `OUTPUT_NOT_VISIBLE` | A completed output must be visible or inspectable in the expected destination. |
| `RUNNING_WITHOUT_FEEDBACK` | Active work should show visible progress or pending state. |
| `DONE_WITH_SPINNER` | Completed work should not still show loading feedback. |
| `MISSING_ACCESSIBLE_NAME` | Interactive controls should have accessible names. |
| `TEXT_OVERLAP_OR_CLIP` | Important labels, buttons, headings, and result text should not overlap or clip. |
| `SECRET_TEXT_VISIBLE` | Keys, tokens, or secrets should not appear in visible text. |

---

## Capture Triggers

Use several trigger types together.

### User-Action Triggers

Capture immediately before and after user actions:

- Open a page or tool.
- Click a command.
- Change a field.
- Drag or reorder an object.
- Start a run.
- Save, load, export, or import.
- Open or close a dialog.
- Toggle a mode.

### Product-State Triggers

Capture after observable internal changes:

- Entity created, updated, deleted, selected, or reordered.
- Route changed.
- Validation state changed.
- Output changed.
- Error state changed.
- Session or document state changed.

### Execution Triggers

Capture after work-state changes:

- Queued.
- Running.
- Done.
- Error.
- Blocked.
- Canceled.
- Retry scheduled.

### Integration Triggers

Capture after boundary events:

- API request or response.
- Message bus publish or receive.
- Iframe or webview load.
- File read or write.
- External command request or response.

### Polling Safety Net

Poll every 200-500ms during active user interaction or execution. Stop only after the relevant product state, execution state, DOM fingerprint, and integration state are stable.

---

## Fingerprints

Fingerprints prevent recording dozens of identical frames while still catching meaningful changes.

```ts
interface EvalFingerprint {
  product: string;
  execution: string;
  visual: string;
  integration: string;
  artifacts: string;
}
```

Recommended fingerprint contents:

- Product: route, selected IDs, entity IDs, state hash.
- Execution: job IDs, states, queue length, output hashes.
- Visual: visible component IDs, states, bounds buckets, body text hash.
- Integration: event IDs, payload hashes, embedded surface load states.
- Artifacts: output IDs, visibility, destination, content hashes.

Do not include raw timestamps in fingerprints.

---

## Mutation Timeline

The mutation timeline is built by diffing consecutive snapshots.

```ts
interface EvalMutation {
  frameId: number;
  timestamp: number;
  layer: 'product' | 'execution' | 'visual' | 'integration' | 'artifacts';
  subjectId: string;
  subjectType: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
}
```

Timeline analysis answers questions such as:

- Did the UI show progress before work began?
- Did the result become visible after the execution output changed?
- Did an error appear in the right place?
- Did an external event fire without a corresponding visible change?
- Did the page reload alter the meaning of the saved state?

---

## Playwright Capture Pattern

A browser or Electron runner can capture DOM state with a small recorder helper.

```js
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test('captures eval timeline', async ({ page }) => {
  const outputDir = path.join('eval-results', 'example-feature', 'happy-path-' + Date.now());
  fs.mkdirSync(path.join(outputDir, 'screenshots'), { recursive: true });

  await page.goto('http://localhost:3000');

  const recorder = createDomEvalRecorder(page, outputDir, 'happy-path');

  await recorder.capture('baseline');
  await page.getByRole('button', { name: 'Generate' }).click();
  await recorder.capture('after-generate-click');
  await page.getByRole('button', { name: 'Save' }).click();
  await recorder.capture('after-save');

  await recorder.finish();

  const report = JSON.parse(fs.readFileSync(path.join(outputDir, 'anomaly-report.json'), 'utf8'));
  expect(report.summary.critical).toBe(0);
});
```

The helper should own:

- Capture injection via `page.evaluate()`.
- Screenshot key frames.
- Fingerprint comparison.
- Mutation timeline construction.
- Artifact writing.
- Anomaly aggregation.

---

## Generic Renderer Capture Function

The injected function should be self-contained, side-effect free, and tolerant of partial state.

```js
function captureDomEvalState() {
  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function hashString(value) {
    var text = String(value || '');
    var hash = 0;
    for (var index = 0; index < text.length; index++) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return hash;
  }

  function textOf(element) {
    return element ? String(element.textContent || '').trim() : '';
  }

  function boundsOf(element) {
    if (!element || !element.getBoundingClientRect) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    var rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }

  function accessibleNameOf(element) {
    if (!element) {
      return '';
    }
    return element.getAttribute('aria-label') || element.getAttribute('title') || textOf(element);
  }

  var bodyText = textOf(document.body);
  var anomalies = [];

  if (bodyText.indexOf('[object Object]') !== -1) {
    anomalies.push({
      code: 'OBJECT_OBJECT_VISIBLE',
      severity: 'critical',
      category: 'rendering',
      message: '[object Object] is visible in the page body',
      trigger: 'capture'
    });
  }

  var interactive = qsa('button, a, input, select, textarea, [role="button"], [role="menuitem"], [tabindex]').map(function(element, index) {
    return {
      type: 'control',
      id: element.getAttribute('data-testid') || element.id || 'control-' + index,
      state: element.disabled || element.getAttribute('aria-disabled') === 'true' ? 'disabled' : 'enabled',
      visible: !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length),
      position: index,
      bounds: boundsOf(element),
      contentHash: hashString(textOf(element)),
      accessibleName: accessibleNameOf(element),
      role: element.getAttribute('role') || element.tagName.toLowerCase(),
      children: [],
      properties: {
        testId: element.getAttribute('data-testid') || '',
        pressed: element.getAttribute('aria-pressed') || '',
        expanded: element.getAttribute('aria-expanded') || ''
      }
    };
  });

  interactive.forEach(function(control) {
    if (control.visible && !control.accessibleName && control.role !== 'input') {
      anomalies.push({
        code: 'MISSING_ACCESSIBLE_NAME',
        severity: 'warning',
        category: 'accessibility',
        message: 'Visible interactive control has no accessible name',
        trigger: 'capture'
      });
    }
  });

  return {
    frameId: 0,
    timestamp: Date.now(),
    elapsedMs: 0,
    trigger: 'capture',
    product: {
      route: location.pathname + location.search,
      selectedIds: [],
      entityCounts: {},
      stateHash: 0,
      safeStateSummary: {}
    },
    execution: {
      active: false,
      paused: false,
      queueLength: 0,
      jobs: []
    },
    visual: {
      viewportState: bodyText ? 'has-content' : 'empty',
      route: location.pathname + location.search,
      root: {
        type: 'app-shell',
        id: 'document-body',
        state: 'ready',
        visible: true,
        position: 0,
        bounds: boundsOf(document.body),
        contentHash: hashString(bodyText),
        accessibleName: '',
        role: 'document',
        children: interactive,
        properties: {}
      },
      focus: {
        activeElementRole: document.activeElement ? document.activeElement.getAttribute('role') || document.activeElement.tagName.toLowerCase() : '',
        activeElementName: accessibleNameOf(document.activeElement)
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY
      },
      bodyTextHash: hashString(bodyText),
      visibleTextSample: bodyText.substring(0, 300)
    },
    integration: {
      network: [],
      events: [],
      embedded: qsa('iframe, canvas, video').map(function(element, index) {
        return {
          id: element.getAttribute('data-testid') || element.id || 'embedded-' + index,
          kind: element.tagName.toLowerCase() === 'iframe' ? 'iframe' : element.tagName.toLowerCase() === 'canvas' ? 'canvas' : 'media',
          loaded: true,
          visible: !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length),
          width: boundsOf(element).width,
          height: boundsOf(element).height
        };
      })
    },
    artifacts: { outputs: [] },
    anomalies: anomalies
  };
}
```

Projects should extend the capture function with product-specific store readers, domain entities, artifact summaries, and integration event taps.

---

## Artifact Layout

Use one directory per scenario run.

```text
eval-results/<feature>/<scenario>-<timestamp>/
  metadata.json
  timeline.json
  mutations.json
  anomaly-report.json
  semantic-eval-input.json
  screenshots/
    frame-0000-baseline.png
    frame-0001-after-action.png
    frame-0008-final.png
```

### `metadata.json`

```json
{
  "feature": "example-feature",
  "scenario": "happy-path",
  "startedAt": "2026-04-25T00:00:00.000Z",
  "runner": "playwright",
  "captureIntervalMs": 250,
  "stabilityThresholdFrames": 12,
  "taskFlowSource": "docs/scenarios.md"
}
```

### `anomaly-report.json`

```json
{
  "scenario": "happy-path",
  "verdict": "CLEAN",
  "summary": {
    "critical": 0,
    "warning": 0,
    "info": 1
  },
  "frames": 28,
  "durationMs": 9400,
  "anomalies": []
}
```

Zero critical and zero warning findings means the scenario is clean. Info findings should not become surprise blockers after clean criteria are met.

---

## Semantic Evaluation Input

Compile raw artifacts into a compact narrative for review.

```json
{
  "scenario": "generate-and-save",
  "userGoal": "Generate an artifact and save it after review.",
  "taskFlow": [
    "Open the tool",
    "Enter source material",
    "Generate output",
    "Review output",
    "Save output"
  ],
  "finalSummary": {
    "primaryOutputVisible": true,
    "saveCompleted": true,
    "errors": [],
    "warnings": []
  },
  "temporalViolations": [],
  "heuristicAnomalies": [],
  "screenshots": [
    "screenshots/frame-0000-baseline.png",
    "screenshots/frame-0004-generated.png",
    "screenshots/frame-0008-saved.png"
  ],
  "reviewQuestions": [
    "Did the user see the generated result before saving?",
    "Was the save state clear and trustworthy?",
    "Did any UI state claim success before the artifact existed?"
  ]
}
```

---

## Capture Discipline

- Capture broad structured evidence first; evaluate later.
- Prefer hashes and summaries over large payloads.
- Never capture secrets in plaintext.
- Never mutate app state from the capture function.
- Use screenshots for visual truth, not as the only truth.
- Keep recordings broad enough for unexpected findings.
- Keep detector rules traceable to user needs, scenarios, and task flows.
