# Eval Driven Development

> A generic development framework for building software by repeatedly evaluating the gap between user expectations and actual product behavior. Eval Driven Development is the eval equivalent of TDD.

---

## Purpose

Eval Driven Development is a project-agnostic framework. It can be applied to any product, tool, agent, workflow, UI, API, or system where success depends on how well the real implementation satisfies an intended user experience.

Test Driven Development starts from a known behavior and writes deterministic tests that code must satisfy. That remains the right approach for pure functions, stable contracts, protocol behavior, component mechanics, and regression protection.

Eval Driven Development starts from a user need and asks a broader question:

**Given what the user expected to accomplish, did the real system behave in a way that satisfies that expectation?**

EDD is especially useful when the answer cannot be fully captured by one deterministic assertion:

- The output may be open-ended.
- The experience may unfold over time.
- The quality bar may involve coherence, usefulness, clarity, or judgment.
- The system may include LLMs, agents, generated artifacts, visual previews, external integrations, or subjective review.
- The product may be incomplete, and the current purpose of the eval is to expose the next implementation gap.

EDD is not a license for vague judgment. It requires explicit user needs, scenarios, task flows, structured evidence, deterministic detectors where possible, and semantic evaluation where hardcoded assertions are too narrow.

---

## Why Eval, Not Test

The word **eval** is explicit and intentional.

A test proves a known contract. An eval measures whether the product state satisfies a user expectation.

| TDD | Eval Driven Development |
|---|---|
| Starts from a known expected output. | Starts from a user need and expected experience. |
| Uses deterministic assertions. | Uses deterministic detectors plus semantic evaluation. |
| Proves code contracts. | Measures gaps between expectation and real behavior. |
| Best for pure logic and stable UI contracts. | Best for workflows, generated outputs, agentic behavior, temporal behavior, and experience quality. |
| Failure says a specific assertion was violated. | Finding says the current product falls short of the intended user experience. |

A good engineering practice uses both. Unit tests, integration tests, and E2E tests protect deterministic behavior. Evals guide development when the target is user-facing quality, task completion, or an open-ended outcome.

---

## Anti-Drift Warning For Agents

EDD is a new working concept, and most LLMs and agentic coding systems are heavily biased toward TDD-shaped work. Over a long session, especially after context compaction or when the original intent scrolls out of the context window, agents tend to drift back toward tests, mocks, isolated harnesses, and fake state transitions. That drift silently destroys EDD.

The failure mode is predictable:

1. The agent starts with a user-centered eval goal.
2. The agent writes unit or component tests because those are familiar.
3. The agent mocks the app state needed for the scenario.
4. The tests pass in an isolated environment.
5. The real product still fails when a user clicks through it.

That is not Eval Driven Development. That is TDD with an eval label.

EDD requires the real system. For a web app, Electron app, or any UI product, an eval must launch the actual app surface, perform user-like actions such as clicks, typing, drag/drop, navigation, save/load, and toggles, then capture the real DOM, screenshots, app state, integration events, and artifacts produced by that run.

For UI surfaces, "observe the user-visible result" means more than confirming that an HTML element exists or that a class changed. Menus, flyouts, dialogs, tooltips, popovers, previews, canvases, and generated outputs must be visibly painted in the viewport, not clipped by overflow, not hidden behind another layer, not fully transparent, and able to receive real pointer or keyboard input. A DOM node that is loaded but off-screen, under the wrong z-index, clipped by a parent, opacity-zero, covered by another element, or reachable only through synthetic `element.click()` is not user-visible evidence.

Mocking and faking states may be valid inside TDD tests that protect deterministic contracts. They are not valid as the proof layer for an eval. A mocked eval proves only that the mock behaved as imagined; it can let a broken feature pass precisely because the real failure was bypassed.

Use this rule whenever there is doubt:

**If the eval did not run the real product and observe the user-visible result of real interactions, it is not an EDD gate.**

For interactive UI, use the stricter version of the rule:

**If the gate can pass while a user cannot see or click the control in the running app, it is not an EDD gate.**

---

## Core Principle

EDD is built around one loop:

```
1. Define the user expectation.
2. Capture what the system actually does.
3. Evaluate the gap.
4. Fix the product.
5. Rerun the eval.
6. Repeat until the experience converges.
```

The eval is not an after-the-fact report. It is the driver of implementation, the same way a failing test drives code in TDD.

---

## Observation Before Judgment

EDD separates observation from judgment.

Observation records what exists in the running system before deciding whether it is good or bad. A recorder should not discard information because it looks irrelevant. It should capture enough state to reveal unexpected failures.

Judgment happens later, during evaluation. This separation matters because real systems fail in ways the original scenario did not predict:

- A model says work completed, but the UI still looks pending.
- A generated artifact exists, but the user cannot inspect it.
- A workflow succeeds once, then fails after a reload.
- A preview shows stale content while claiming to be current.
- An agent produces plausible text that does not satisfy the user's actual goal.
- An integration publishes an event, but the target system never changes.

The artifact set should let a reviewer reconstruct what happened without relying on memory or logs alone.

---

## Relationship To Tests

EDD complements, rather than replaces, tests.

| Layer | Primary question | Role in EDD |
|---|---|---|
| Unit tests | Does a pure function or local rule hold? | Protects deterministic logic. |
| Contract tests | Do system boundaries follow agreed schemas and protocols? | Protects integration shape. |
| Component tests | Does one component render and respond correctly in isolation? | Protects local UI behavior. |
| E2E tests | Can automation perform a scripted path through the real product? | Provides a runner and interaction surface for eval capture. |
| Evals | Does the complete experience satisfy the user expectation over time? | Drives product convergence for open-ended or experiential outcomes. |

Use tests whenever the expected answer is stable and deterministic. Use evals when the success criteria need captured behavior, temporal evidence, visual inspection, semantic review, or judgment about usefulness.

---

## Inputs To An Eval

Every eval should start with a documented expectation. Useful sources include:

- User needs and pain points.
- Scenarios and user-cans.
- Task flows.
- Product and UX specs.
- Design-system rules.
- API or integration contracts.
- Accessibility requirements.
- Safety, privacy, or reversibility constraints.
- Known gaps from previous audits.

If a detector or semantic finding cannot trace back to one of these inputs, either the expectation is undocumented or the finding is overreaching.

---

## The Six-Step EDD Loop

```
Step 1: DEFINE
  What should the user be able to accomplish?

Step 2: ENUMERATE
  What user-observable behaviors prove or disprove that expectation?

Step 3: PLAN RECORDING
  What evidence must be captured from the real system?

Step 4: CAPTURE
  Record temporal snapshots in observation mode.

Step 5: EVALUATE
  Run deterministic detectors and semantic review.

Step 6: CONVERGE
  Fix gaps, rerun, and repeat until clean.
```

Steps 1 and 2 are product-facing. Step 3 translates the expectation into an evidence plan. Steps 4 through 6 execute the development loop.

---

## Step 1: Define User Expectations

Define the experience from the user's perspective, not from the implementation.

A good expectation describes:

- The user's goal.
- The starting state.
- The action or workflow.
- The visible or inspectable outcome.
- The required timing or ordering, if timing matters.
- The failure and recovery behavior.
- Any safety, privacy, accessibility, or reversibility constraints.

Example:

```
Scenario: Generate and review a support reply

User goal:
  A support agent wants to draft a response to a customer complaint.

Expected experience:
  The system summarizes the complaint, proposes a reply in the correct tone,
  marks uncertain claims, shows source evidence, and lets the agent edit before sending.

Success is not only "a reply string exists." The reply must be grounded,
  editable, non-misleading, and visibly not sent without confirmation.
```

---

## Step 2: Enumerate User-Observable Behaviors

Enumeration turns expectations into eval coverage. If a behavior is not enumerated, it is unlikely to be evaluated.

Common categories:

| Category | What it catches |
|---|---|
| App readiness | The product opens, loads, and exposes the expected entry points. |
| State-to-UI sync | Internal state and rendered state agree. |
| Workflow progression | Steps happen in the expected order. |
| Output delivery | The result appears where the user expects to inspect or use it. |
| Error handling | Failures are honest, local, recoverable, and not silent. |
| Persistence | Save, reload, retry, or resume keeps meaning intact. |
| Integration effects | External services, buses, files, APIs, or embedded surfaces actually change. |
| Reversibility | Temporary or risky effects can be undone or cleared. |
| Accessibility | Controls expose names, roles, focus paths, and keyboard access. |
| Visual integrity | Text does not overlap, primary surfaces are nonblank, and layout remains usable. |
| Semantic quality | The outcome is coherent, useful, grounded, and appropriate for the goal. |

---

## Step 3: Plan Recording

The recording plan identifies the evidence needed to judge the scenario.

Typical evidence layers:

| Layer | Evidence |
|---|---|
| Product state | Stores, models, selected entities, config, route, session state. |
| Execution state | Jobs, queues, run IDs, status transitions, errors, retries, timings. |
| Rendered UI | DOM tree, accessible names, visible text, bounds, focus, screenshots. |
| Artifacts | Generated files, messages, previews, images, documents, structured outputs. |
| Integration events | API calls, bus events, bridge requests, iframe messages, file writes. |
| Environment | Feature flags, service availability, user role, permissions, test data. |

The recorder should capture summaries, hashes, and selected safe fields by default. It should avoid secrets, large payloads, and unnecessary personal data.

---

## Step 4: Capture In Observation Mode

Capture should interact with the real product the way a user would. Prefer real UI, API, or workflow entry points over direct state mutation.

Direct state access is allowed for reading evidence. If synthetic setup shortcuts are used, record them in metadata so later review understands what was real and what was staged.

Do not replace real product interaction with mocked state setup for the eval itself. Synthetic setup may reduce fixture cost, but the action being evaluated must still happen through the real product boundary that a user or integrated system would use.

Observation mode means:

- Do not mutate product state from the recorder except through the scenario's intended actions.
- Do not filter out normal-looking state.
- Do not decide pass/fail during capture beyond cheap inline anomaly checks.
- Record enough temporal frames to understand ordering.
- Include screenshots or comparable visual artifacts when the user's judgment depends on what was visible.

---

## Step 5: Evaluate The Gap

EDD evaluation uses three mechanisms.

### Deterministic Rules

Rules check behavior that can be asserted mechanically:

- Required surfaces rendered.
- Internal state and UI count agree.
- A job eventually resolves.
- A save/load round trip preserves meaning.
- A secret is not visible.
- An integration event has the expected channel and shape.

### Heuristic Detectors

Heuristics flag suspicious states that are not always failures:

- Blank previews.
- Stale output that looks fresh.
- Placeholder text.
- Raw stack traces.
- Unexpected layout shifts.
- Missing accessible names.
- Repeated retries without progress.

### Semantic Evaluation

Semantic review judges richer questions:

- Did the user accomplish the intended task?
- Was the result useful and inspectable?
- Was cause and effect understandable?
- Were errors honest and recoverable?
- Did the final state communicate the right thing?
- Would a reasonable user trust the outcome?

Semantic findings must be grounded in captured evidence. An eval may use an LLM reviewer, a human reviewer, or both, but every finding should point to a snapshot, screenshot, event, artifact, or documented expectation.

---

## Step 6: Converge

The EDD loop is iterative:

```
1. Run the scenario against the real product.
2. Write artifacts and the anomaly report.
3. Fix the highest-impact user-experience gaps first.
4. Rerun the same scenario.
5. Add or adjust detectors only when the expectation was under-specified.
6. Repeat until clean.
```

A scenario is clean when:

- Multiple independent runs complete.
- There are zero critical anomalies.
- Warning anomalies are either fixed or explicitly accepted.
- Semantic review has no actionable findings.
- The primary user-visible outcome is inspectable.
- Screenshots or comparable visual artifacts show no blank, clipped, overlapping, or misleading primary surfaces.
- Any reversible side effects prove both apply and revert behavior.

---

## Detector Template

```text
DETECTOR: OUTPUT_DELIVERED_TO_EXPECTED_SURFACE
Category:  Output delivery
Severity:  critical
Rule:      A generated output must be visible or inspectable in the surface named by the task flow.
Check:     finalArtifact.exists && expectedSurface.contentHash === finalArtifact.hash
Fires when: The system computes a result but does not deliver it to the user-facing surface.
Why it matters: Hidden success is not user success.
Source:    Scenario and task-flow expectation.
```

---

## Artifact Layout

Use one directory per eval run.

```text
eval-results/<feature>/<scenario>-<timestamp>/
  metadata.json
  timeline.json
  mutations.json
  anomaly-report.json
  semantic-eval-input.json
  screenshots/
    frame-0000-baseline.png
    frame-0004-after-action.png
    frame-0012-final.png
```

Recommended files:

| File | Purpose |
|---|---|
| `metadata.json` | Scenario name, feature, environment, start time, runner, flags, and setup notes. |
| `timeline.json` | Ordered snapshots captured during the scenario. |
| `mutations.json` | Diffed state changes between snapshots. |
| `anomaly-report.json` | Deterministic and heuristic findings with severity. |
| `semantic-eval-input.json` | Compact review packet for human or LLM semantic evaluation. |
| `screenshots/` | Visual evidence for key frames. |

---

## Non-Goals

EDD should not become a brittle screenshot approval system or a duplicate of unit tests.

- Do not assert exact pixels unless exact pixels are the product contract.
- Do not evaluate source-code style in EDD; use lint and review for that.
- Do not bypass the user path unless setup cost makes it impractical.
- Do not treat info-level notes as hidden blockers after clean criteria are met.
- Do not use semantic evaluation as a substitute for writing deterministic checks where deterministic checks are obvious.

---

## Applying EDD To A Project

A project-specific EDD interpretation should define:

- The user needs and task flows that drive eval scenarios.
- The product-specific state layers to capture.
- The artifact directory convention.
- The stable selectors, debug handles, APIs, or telemetry needed for observation.
- The detector catalog and severity policy.
- The first eval scenarios to run.
- The implementation gaps that block meaningful eval coverage.

The generic framework stays the same. The interpretation changes per project. **Khonjel's interpretation is in [03-khonjel-edd-interpretation.md](./03-khonjel-edd-interpretation.md).**
