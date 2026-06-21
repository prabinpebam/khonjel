# Khonjel — Backend Architecture Spec

> **Status:** Backend review & preparation (pre-implementation).
> **Audience:** Backend / platform engineers implementing the real adapters behind the mock frontend.
> **Premise:** The mock frontend (`/app`) is the FINAL UI. It already talks to a
> **ports-and-adapters seam** (`@services`). This spec defines the *adapters* — the
> real backend that makes every frontend feature work — with **no UI redesign**. (The one
> renderer-side change: read ports that are synchronous against the mock become
> `Promise`-returning against the real `ipc` adapter, so those call sites adopt `await`.)

This folder is the implementation-grade backend specification. It is derived from a
deep review of two open-source references and synthesized into a concrete plan for
Khonjel (an Electron desktop app: cross-platform, local-first, multi-purpose).

---

## Reading order

| # | Doc | What it answers |
|---|-----|-----------------|
| 00 | [Benchmark — OpenWhispr](00-benchmark-openwhispr.md) | How the closest analog (Electron, multi-purpose) is built, end to end, incl. prompts. |
| 01 | [Benchmark — FreeFlow](01-benchmark-freeflow.md) | How a best-in-class native dictation pipeline is built (Swift/macOS), incl. prompts. |
| 02 | [Comparison & decision](02-benchmarks-comparison.md) | Side-by-side pros/cons; what Khonjel adopts and rejects. |
| 03 | [Khonjel backend architecture](03-khonjel-backend-architecture.md) | **The recommended architecture** (process model, modules, runtime flows, diagrams). |
| 04 | [Tech stack](04-tech-stack.md) | **The recommended stack**, with alternatives considered and the rationale. |
| 05 | [Prompt & system-prompt library](05-prompt-library.md) | Every prompt the app uses, the engineering patterns, and Khonjel's own prompts. |
| 06 | [Coverage framework & process](06-feature-coverage-framework.md) | **The systematic method** to guarantee every frontend feature is backed. |
| 07 | [Coverage matrix](07-feature-coverage-matrix.md) | **The mapping**: every frontend surface → backend services, contracts, storage, status. |
| 08 | [IPC & ports contracts](08-ipc-and-ports-contracts.md) | The exact channels/methods the adapters implement (maps 1:1 to `@services`). |
| 09 | [Data & storage](09-data-and-storage.md) | SQLite schema, file layout, model cache, keychain, migrations. |
| 10 | [Providers & models](10-providers-and-models.md) | STT + LLM provider/model registry, endpoints, config resolution. |
| 11 | [Privacy, security & packaging](11-privacy-security-and-packaging.md) | Key storage, network egress rules, retention, signing, updates. |
| 12 | [Audio capture & OS integration](12-audio-capture-and-os-integration.md) | The native per-OS layer: audio format, capture, AEC, hotkeys, text injection. |
| 13 | [Open questions & risks](13-open-questions-and-risks.md) | Unresolved decisions and execution risks, with defaults and decision triggers. |
| 14 | [Implementation plan](14-implementation-plan.md) | **The build order** — sequenced, task-level backlog with a strict TDD+EDD gate per task. |

---

## The one-paragraph summary

Khonjel is **OpenWhispr's architecture, rebranded and de-monetized**, hardened with
**FreeFlow's pipeline discipline**. It is an Electron app with a **three-process model**
(main / renderer / worker), a **strict IPC seam** that mirrors the frontend's `@services`
ports, **local-first inference** (whisper.cpp / Parakeet for STT, llama.cpp for LLM) with
optional **BYO-provider** and **self-hosted/enterprise** modes, a **deterministic-then-LLM
text pipeline** (regex cleanup → clean-transcript skip → LLM refinement), **SQLite + the OS
keychain** for storage, and **all network egress going directly from the user's machine to
the chosen provider** (no Khonjel server in the default path).

## Non-negotiable principles (carried from the product spec)

1. **Local-first & private by default.** Nothing leaves the device unless the user picks a cloud provider. No telemetry by default. ([02-privacy-data-security](../02-privacy-data-security.md))
2. **Universal model support.** Local, BYO-provider, self-hosted (OpenAI-compatible), and enterprise — all first-class. No paid gate.
3. **The seam is sacred.** The renderer only ever calls `@services` ports. The backend is the adapter set behind those ports. ([05-mock-frontend-plan](../05-mock-frontend-plan.md))
4. **Every frontend feature maps to an explicit backend contract.** Tracked in the [coverage matrix](07-feature-coverage-matrix.md). "Done" = the matrix is green.
5. **Secrets never touch the renderer or disk in plaintext.** Keychain only; provider calls are proxied from the main process.

## How "done" is defined

The backend is feature-complete when **every row of the [coverage matrix](07-feature-coverage-matrix.md) is `Implemented`**, each backed by:
- a port method (frontend already consumes it),
- an IPC channel (contract in [08](08-ipc-and-ports-contracts.md)),
- a main-process handler (adapter),
- storage (if stateful, schema in [09](09-data-and-storage.md)),
- and its required tests green — the renderer's **L0–L6** ([validation strategy](../06-test-and-validation-strategy.md)) plus the backend's **BE1–BE4** ([06 §3a](06-feature-coverage-framework.md)).

---

### Reference attribution

- **OpenWhispr** — `github.com/OpenWhispr/openwhispr` (MIT). Electron, TS/React, multi-purpose. The architectural template.
- **FreeFlow** — `github.com/mrinalwadhwa/freeflow` (open source). Swift/macOS, single-purpose dictation. The pipeline template.

Both are open source; this spec summarizes and quotes short excerpts for technical analysis. Khonjel's own prompts and code are written fresh.
