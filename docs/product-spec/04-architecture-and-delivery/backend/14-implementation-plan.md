# 14 — Backend implementation plan (the build sequence)

> **This is the task-level execution plan for building the backend** with a **strict TDD + EDD
> loop**. It turns the architecture ([03](03-khonjel-backend-architecture.md)), coverage
> framework ([06](06-feature-coverage-framework.md)), and matrix ([07](07-feature-coverage-matrix.md))
> into an ordered backlog where **every task writes tests first, implements, then passes an eval**.
> The frontend build is governed by the [execution playbook](../00-execution-playbook.md); this
> doc is its backend counterpart.

---

## 1. Are we ready? (status)

| Pillar | State |
|---|---|
| Architecture spec (process model, IPC seam, pipeline, providers incl. Azure, storage, privacy, audio/OS) | ✅ implementation-grade ([03](03-khonjel-backend-architecture.md)–[13](13-open-questions-and-risks.md)) |
| Feature → backend coverage (every frontend capability mapped to ports/contracts/storage) | ✅ [matrix](07-feature-coverage-matrix.md) |
| **EDD lane** (real-app eval harness) | ✅ **operational** — `npm run eval`, 2 scenarios CLEAN ([app/eval/](../../../../app/eval/)) |
| **TDD lane** (Vitest unit/store/component) | ✅ **operational** — `npm run test`, seed suite green ([vitest.config.ts](../../../../app/vitest.config.ts)) |
| **Sequenced task plan with TDD+EDD gates** | ✅ **this document** |

> **Verdict:** ready to implement. Both selection lanes run today; the backlog below is the
> ordered path. The hard *unknowns* are tracked in [13](13-open-questions-and-risks.md) and must
> be resolved at the phase that first needs them — they do not block starting Phase 0.

## 2. The per-task loop (strict TDD ↔ EDD)

Every task follows this cycle. **Tests are written before implementation.**

```
1. READ      the task's contract (port + IPC channel + storage + acceptance in 08–12).
2. RED        write the deterministic tests FIRST and watch them fail:
                BE1 unit (pure logic)         → Vitest
                BE2 IPC contract (zod + types) → Vitest
                BE3 adapter parity (mock≡ipc)  → Vitest
3. GREEN      implement the handler/adapter until BE1–BE3 pass.
4. REFACTOR   clean up; keep tests green; run `npm run verify:quick`.
5. EVAL (BE4) run/extend the EDD scenario that proves the *user* can do the thing in the
              REAL app (offline where the hot path requires it) → `npm run eval`.
6. CONVERGE   fix gaps until the scenario is CLEAN (0 critical / 0 warning) + semantic review clean.
7. MARK       flip the capability to `Implemented` in the coverage matrix; record tests + scenario.
```

- **TDD owns the contract; EDD owns the experience.** A task is not done if either lane is red.
- **Never mock the thing under test in the EDD step** (see the [anti-drift rule](../../../frameworks/eval-driven-development/01-eval-driven-development.md#anti-drift-warning-for-agents)).
- **Hot-path tasks** (capture/inference/inject) require a **BE4 offline** run.

## 3. Definition of Ready / Definition of Done

**A task is READY when:** its port method + IPC channel + payload types exist in
[08](08-ipc-and-ports-contracts.md); its storage (if any) is in [09](09-data-and-storage.md);
its acceptance check is written; its EDD scenario is named.

**A task is DONE when:** BE1–BE3 green · the handler validates input with zod and returns typed
results or `IpcError` · `npm run verify` is green (L0–L2 + build) · its **BE4 EDD scenario is
CLEAN** · the `ipc` adapter does not fall back to mock at runtime · the matrix row reads
`Implemented` with its tests + scenario recorded.

**A phase is DONE when:** every task in it is done · the product runs at the end of the phase ·
all that phase's matrix rows are green.

## 4. The sequenced backlog

Phases follow [06 §5](06-feature-coverage-framework.md). Each task lists its TDD tests and its
EDD scenario. `Sx` scenarios are defined in the
[Khonjel EDD interpretation](../../../frameworks/eval-driven-development/03-khonjel-edd-interpretation.md).

### Phase 0 — Bootstrap the rails (no features yet)

| ID | Task | TDD (write first) | EDD gate | Done = matrix |
|---|---|---|---|---|
| T0.1 | Main-process **TypeScript build** (esbuild/tsup: `electron/**/*.ts` → `.cjs`) | build smoke (emits main.cjs/preload.cjs; app launches) | app boots under Electron | — |
| T0.2 | `shared/ipc-contract.ts` — channel registry, `CONTRACT_VERSION`, `IpcError`, zod schemas | BE2: every channel has a zod schema; version present | — | — |
| T0.3 | **IPC router** + preload **allow-list** bridge (contextIsolation/sandbox) | BE2: unknown channel rejected; registered channel round-trips; bad payload → `IpcError("validation")` | — | — |
| T0.4 | Renderer **`ipc` adapter set** + `useServices()` env switch (mock↔ipc) | BE3: mock and ipc satisfy the same `Services` interface (type + shared behavioral suite) | — | — |
| T0.5 | **Seam proof**: `profile:get`, `system:getAppVersion/getPlatform` end-to-end | BE1 handlers · BE2 contract · BE3 parity | **S1** extended: real profile/version read via bridge under Electron | ProfileService, SystemService ✅ |
| T0.6 | **SQLite store** init + **migrations** runner (better-sqlite3 + kysely) | BE1: forward-only, idempotent, version tracked; WAL on | — | — |
| T0.7 | **Settings source-of-truth in main** (flat maps) + `settings:get/patch` | BE1 merge/validate · BE2 contract · BE3 parity with the renderer store | **S3** under Electron: toggle persists across restart (gated with T0.8) | SettingsService |
| T0.8 | **Electron eval runner**: switch Playwright to launch the Electron main process; wire durable DB settings into live boot (better-sqlite3 native rebuild) + renderer adoption | harness smoke (launches packaged app) | S1/S2/S3 run against Electron, not just Vite | ProfileService, SystemService, SettingsService ✅ |

> **Plan refinements:** (1) `secrets→keychain` moves to **Phase 2** (provider connections), where
> keys are first used (S8/Azure) — a native keychain with no consumer in T0.7 would be premature.
> (2) **Settings persist to a native-free JSON file**, not a SQLite row ([09 §4](09-data-and-storage.md)):
> it works in the Node tests, dev Electron, and packaged app with **no better-sqlite3 ABI rebuild**;
> SQLite is reserved for Phase 4 relational data.

> **Phase 0 COMPLETE ✅** — the **seam is real** end-to-end: TS main, a typed + versioned IPC
> contract, durable JSON settings (+ renderer `SettingsSync` adoption), and the SQLite migration
> framework (for Phase 4). **Both test lanes run against the actual Electron app** —
> `npm run eval:electron` launches the real app twice and gates the live seam + settings
> persistence across restart. 39 unit tests (BE1/BE2/BE3) + browser/Electron eval (BE4); **zero
> frontend regression** throughout. **Next: Phase 1 — the dictation hot path.**

### Phase 1 — The hot path (dictation)

| ID | Task | TDD (write first) | EDD gate |
|---|---|---|---|
| T1.1 | **Audio capture** sidecar + 16 kHz/mono/PCM contract + VAD ([12](12-audio-capture-and-os-integration.md)) | BE1: resampler/chunker; VAD gate; BE2: `audio:*` channels | S5 (capture starts; level/partial events) |
| T1.2 | **Pipeline** modules: `applyDictatedPunctuation`, `isClean`, `detectAgent`, `expandSnippets` | BE1: table-driven unit tests per stage (esp. `isClean` + punctuation) | — |
| T1.3 | **STT local** adapter (whisper.cpp/Parakeet sidecar) behind `TranscriptionService` | BE2 contract · BE3 parity | S5 offline: speech → transcript |
| T1.4 | **LLM cleanup** slot (llama.cpp) + `refineWithLLM` + fallback | BE1 fallback path · BE2 contract | S5 offline: cleanup runs only when `isClean` fails |
| T1.5 | **Text injection** (per-app strategy table) + transcript recovery buffer | BE1 strategy selection; secure-field refusal | S5: text appears at cursor; re-paste works |
| T1.6 | **History append** (retention-gated) | BE1 retention rule · BE2 contract | S5: entry appears in Home history |

> Phase 1 DoD: **hotkey → listening < 100 ms → injected text, fully offline** (the `LISTENING_FEEDBACK_LATE`
> and `OUTPUT_NOT_DELIVERED` detectors must not fire).

### Phases 2–8 (task tables follow the same shape)

| Phase | Tasks (each: BE1–BE3 first → BE4 scenario) | Primary scenarios | Matrix rows |
|---|---|---|---|
| **2 — Settings & hotkeys** | hotkey register/rebind/conflict; STT/LLM slot config; **provider connection profiles incl. Azure** + `secrets:set` + `connections:test` | **S8** (configure + test Azure), S3 | J, K, L |
| **3 — Models** | catalog, download (resumable/verified), cache, hardware probe, self-hosted discovery | models scenarios | K |
| **4 — Content surfaces** | history, notes CRUD, dictionary, snippets, transforms list, upload+transcribe | S7, S9 | B–I read/CRUD |
| **5 — Intelligence** | voice agent (tools, bounded steps), chat (stream), note formatting, transforms run | S6, S7 | D, E, H, A(agent) |
| **6 — Meetings** | detection, dual-channel capture + AEC, diarization, meeting notes | S10 | A(meeting), notes |
| **7 — Integrations & search** | calendar/IDE connect (OAuth), notes search (FTS5; Qdrant optional) | integration scenarios | I, E(search) |
| **8 — Account/Workspace (optional)** | auth + sync, **compile-out by default** | account scenarios | L(optional) |

Full per-task contracts live in [08](08-ipc-and-ports-contracts.md)–[12](12-audio-capture-and-os-integration.md);
this table is the **order**, and every cell becomes a checklist item against the
[matrix](07-feature-coverage-matrix.md).

## 5. Traceability (one chain per capability)

```
frontend capability (07 row)
  → port method (08)         → BE3 adapter-parity test
  → IPC channel + types (08) → BE2 contract test
  → handler logic            → BE1 unit test(s)
  → storage (09) / provider (10) / OS (12)
  → user expectation (S-scenario, EDD 03)  → BE4 eval run
  → matrix row flips to Implemented
```

If any link is missing, the task is not READY. If any test or the scenario is red, the task is
not DONE. **"Backend done" = every matrix row Implemented + its scenario CLEAN + the hot path
verified offline.**

## 6. Cadence & commands

| Loop | Command | When |
|---|---|---|
| Inner (per edit) | `npm run verify:quick` | after every change (types + lint + ds-lint + **unit**) |
| TDD watch | `npm run test:watch` | while red-green-refactoring a task |
| EDD gate | `npm run eval` | to close a task / phase (BE4) |
| Full gate | `npm run verify` | before declaring any task done; CI |

> Milestone reviews at the end of each phase: run `npm run verify` + `npm run eval`, walk the
> matrix rows that flipped, and triage [open questions](13-open-questions-and-risks.md) the next
> phase depends on.

## 7. Acceptance (of this plan)
- [ ] Both lanes run today: `npm run test` (TDD) and `npm run eval` (EDD) are green.
- [ ] Every task names its BE1–BE3 tests and its BE4 scenario before coding starts.
- [ ] Phase 0 lands the real seam (TS main, typed IPC, migrated DB, main-owned settings) under Electron.
- [ ] Each capability flips to `Implemented` only when its tests pass **and** its EDD scenario is CLEAN.
- [ ] No task ships with the `ipc` adapter falling back to mock at runtime.
