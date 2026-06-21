# Eval Driven Development (EDD)

> Khonjel's **validation-loop framework**: build the product by repeatedly evaluating the gap
> between what a user expected and what the **real running app** actually did — then fixing the
> product until the experience converges. EDD is the eval equivalent of TDD and the *selection
> layer* above Khonjel's deterministic tests.

## Reading order

| # | Doc | What it gives you |
|---|-----|-------------------|
| 00 | [Why EDD](./00-why-eval-driven-development.md) | The principle: invest in the selector, not the generator. |
| 01 | [Eval Driven Development](./01-eval-driven-development.md) | The portable framework: the six-step loop, observation-before-judgment, detectors, anti-drift rules. |
| 02 | [DOM State Capture](./02-dom-state-capture.md) | How to capture user-visible DOM + product/execution/integration/artifact evidence from the real app. |
| 03 | [Khonjel EDD Interpretation](./03-khonjel-edd-interpretation.md) | **Khonjel-specific:** scenarios, stores, selectors, the dev debug handle, detector catalog, first scenarios, and gaps. |

00–02 are the **portable framework** (replicated unchanged so updates stay portable). 03 is the
**project interpretation**. The **runnable harness** lives in [`app/eval/`](../../../app/eval/).

## The loop in one line

```
DEFINE expectation → CAPTURE real behavior → EVALUATE the gap → FIX product → RERUN → converge
```

## How EDD relates to Khonjel's other gates

- **L0–L6** ([test & validation strategy](../../product-spec/04-architecture-and-delivery/06-test-and-validation-strategy.md)) and **BE1–BE4** ([backend §3a](../../product-spec/04-architecture-and-delivery/backend/06-feature-coverage-framework.md)) protect deterministic contracts.
- **EDD** drives convergence for user-facing, temporal, and open-ended behavior, and **is the BE4 "offline E2E" gate** for every backend capability in the [coverage matrix](../../product-spec/04-architecture-and-delivery/backend/07-feature-coverage-matrix.md).

## Run it

```
cd app
npm run eval            # run all EDD scenarios against the dev app
npm run eval -- app-readiness   # one scenario
```

See [`app/eval/README.md`](../../../app/eval/README.md) for setup (one-time Playwright browser install) and artifact layout.
