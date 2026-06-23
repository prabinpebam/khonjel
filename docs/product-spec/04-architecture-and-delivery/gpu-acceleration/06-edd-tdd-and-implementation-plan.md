# 06 — EDD/TDD Strategy & Implementation Plan

> The test matrix and phased, files-to-touch backlog to ship this safely. Follows the repo's
> Eval-Driven Development framework (`docs/frameworks/eval-driven-development/`) and the BE1 pure-unit
> discipline. Every phase is independently shippable behind a flag and leaves CPU untouched.

---

## 1. Test pyramid

```text
        ┌───────────────────────────────────────────────┐
   E2E  │ Electron EDD (*.eval.electron.mjs)            │  real detect, simulated provision/probe
        ├───────────────────────────────────────────────┤
  UX    │ Browser EDD (*.eval.mjs) + mock GPU profiles  │  every card/test/fallback state
        ├───────────────────────────────────────────────┤
  UNIT  │ Vitest BE1 pure: detect parsers, decide,      │  no GPU needed, deterministic
        │ offload, OOM ladder, rollback state machine   │
        └───────────────────────────────────────────────┘
```

Rule: **all decision logic is pure + unit-tested**; GPU hardware is never required for green CI.

---

## 2. Unit tests (Vitest, BE1 — no GPU)

| File | Covers |
|---|---|
| `acceleration/detect.test.ts` | parse Win CIM CSV (VEN_10DE/1002/8086), `nvidia-smi` CSV, registry qwMemorySize, macOS `system_profiler`, Linux `lspci`; 4GB AdapterRAM cap is overridden by accurate source |
| `acceleration/decide.test.ts` | `planBackends()` ordering per vendor/driver; CUDA driver gates (12.4 ≥551.78, 13.3 ≥580); unknown -> CPU; AMD -> Vulkan; Apple -> Metal |
| `acceleration/offload.test.ts` | `computeOffloadPlan()`: fits-fully, partial floor, unknown VRAM conservative, unified-memory; **shared LLM+STT VRAM reservation** (LLM keeps GPU, STT->CPU when both can't fit); OOM ladder 999->80->60->40->20->0 picks highest working rung |
| `acceleration/estimate.test.ts` | pre-commit `AccelerationPlan` hints: `estimatedSpeedup` range + `downloadBytes`/`diskBytes` from VRAM + model fit + manifest part sizes |
| `acceleration/rollback.test.ts` | provision/probe/activate/quarantine state machine; crash-loop guard (2/120s) -> demote to LKG; quarantine reason written |
| `acceleration/cleanup.test.ts` | retention keeps **active + LKG + cpu** and prunes the rest; `removeGpuBackends` reverts to cpu; disk pre-flight refuses doomed downloads; version-upgrade migration |
| `acceleration/manifest.test.ts` | every `BackendArtifact` pinned (sha256 + version), cudart redist part present for CUDA, `expectFiles` non-empty, urls https + allowlisted host |
| `acceleration/benchmark.test.ts` | deterministic test: identical workload both legs, warmup discarded, `speedup = gpu/cpu`, bounded/approx labelling |
| `acceleration/metrics.test.ts` | parse tokens/sec, offloaded layers, vram from engine output -> `RuntimeMetrics` |
| `ipc-schemas` additions | zod accept/reject for each `acceleration:*` payload; bounded strings/arrays |

These extend the current 249-test suite and must keep `npm run verify:quick` green.

---

## 3. Browser EDD (UX states, mock adapter)

New `app/eval/scenarios/gpu-acceleration.eval.mjs` driving the **mock** `AccelerationService` through
fixtures so every visual state is observed (capture-then-judge):

| Fixture (mock profile/result) | Expected UI |
|---|---|
| No GPU | "Running on CPU", calm, no scary CTA |
| NVIDIA + good driver, not on | "could be ~5–10x faster · ~250 MB" estimate + size + primary CTA |
| Auto-setup (background) | non-blocking progress, app stays usable, **single** success toast |
| Turn-on success | progress steps -> "On … 7x faster" + speed bars with numbers |
| Offline | "connect to set up GPU acceleration" — no doomed download CTA |
| Waiting for a model (deferred) | "GPU speed is ready when your model is", no error |
| Probe fail | rolled-back card, "kept things on CPU", Try again |
| Crash-loop demote | "switched back to a stable setup" |
| Old driver | "update your driver" guidance, no CTA spinner stuck |

New detectors (extend `detectors.mjs` `DETECTOR_CATALOG`):

```text
ACCEL_STATUS_DISHONEST   critical  status claims GPU while state.device == cpu
ACCEL_FALLBACK_AS_ERROR  warning   CPU-fallback rendered with error styling/headline
ACCEL_CTA_DEADEND        critical  primary CTA leads to a stuck spinner (no terminal state)
ACCEL_AUTOSETUP_BLOCKING critical  auto-setup blocks input or shows a modal instead of background+toast
ACCEL_SIZE_UNDISCLOSED   warning   a GPU download begins without showing its size up front
ACCEL_OFFLINE_DEADEND    warning   offline state offers a download CTA that cannot succeed
ACCEL_NUMBERS_MISSING    warning   speed bars shown without numeric labels (a11y)
```

Plus existing `MISSING_ACCESSIBLE_NAME` / `SECRET_TEXT_VISIBLE` apply to the new panels.

---

## 4. Electron EDD (real seam, simulated hardware ops)

`app/eval/scenarios/gpu-acceleration.eval.electron.mjs`:

- **Real detection** runs on the test machine and must **never crash** the app; it asserts a valid
  `GpuProfile` is produced (any vendor incl. `unknown`) and the app stays `data-eval-ready`.
- **Provision/probe simulated** via injected fakes (no multi-GB downloads in CI): a fake artifact +
  fake probe success/failure exercises activate + rollback end-to-end over real IPC.
- Asserts `acceleration:state` relay updates reach the renderer and the engine badge flips GPU/CPU.
- Honors the existing pre-run hygiene (kill lingering `electron|Khonjel` processes) to avoid the known
  global-shortcut/worker-teardown flakiness.

Keeps the suite at its current shape (browser `npm run eval`; electron `npm run eval:electron`).

---

## 5. Phased implementation backlog

Each phase: BE1 units first (red->green), then wire, then EDD. Ships behind
`inference.acceleration.mode` defaulting to `auto` but gated by a feature flag
`KHONJEL_FEATURE_GPU` until Phase 7.

### Phase 1 — Detection (read-only, safe)
- Files: `acceleration/detect.ts`, `decide.ts`, extend `models/hardware.ts`, types in
  `ports/types.ts`, IPC `acceleration:profile|rescan|plan`, schemas, dispatch, ipc+mock adapters.
- Accept: accurate VRAM on NVIDIA (smi) + registry fallback; `GpuProfile` cached to `gpu-profile.json`;
  `planBackends` ordered correctly; all unit tests green; zero behavior change to inference.

### Phase 2 — Manifest + provisioning (no activation yet)
- Files: `manifest.ts` (pinned artifacts incl. cudart redist), `provision.ts` (reuse
  `models/downloader.ts` resume/verify/atomic), `backends.json` index, cleanup/pruning + disk pre-flight.
- Accept: download->verify(sha256)->atomic install into `runtime/<engine>/<backend>-<ver>/`;
  interrupted resume works; tamper -> reject + quarantine; retention keeps active+LKG+cpu and prunes
  the rest; `removeGpuBackends` reverts to cpu; no PATH/elevation.

### Phase 3 — Probe + rollback (the safety core)
- Files: `probe.ts`, rollback/crash-loop in `service.ts`, `reason.json`.
- Accept: LLM probe requires non-zero offloaded layers + 1 token; STT probe transcribes marker WAV;
  fail -> quarantine + stay on prior; crash-loop (2/120s) -> auto-demote to LKG.

### Phase 4 — Runtime offload + fallback chain
- Files: `offload.ts`, wire `inference/runtime.ts` + `llama-server.ts` (`-ngl`, `--device`),
  `stt/runtime.ts` (GPU + `--no-gpu`), OOM ladder, `offload-cache.json`, shared LLM+STT VRAM budget.
- Accept: auto `-ngl` from VRAM; shared-VRAM contention resolves (LLM keeps GPU, STT->CPU); OOM
  auto-tunes down and caches best rung; CPU fallback transparent; engine badge reflects reality;
  env overrides still win.

### Phase 5 — Contracts complete + metrics + estimate
- Files: `metrics.ts`, deterministic `benchmark.ts`, `acceleration:state|enable|disable|retry|setMode|runTest|removeGpu|reset`,
  relays `onProgress/onState`, store `stores/acceleration.ts`, `AccelerationPlan` estimate fields.
- Accept: full `AccelerationState`/`AccelerationTestReport` over IPC; deterministic fair benchmark;
  pre-commit `estimatedSpeedup`/`downloadBytes` available before any download; live progress without
  polling; settings keys persisted + honored.

### Phase 6 — UX (zero-click + one-click)
- Files: `AccelerationCard/Progress/Test/Advanced.tsx`, success toast, replace dishonest copy in
  `surfaces/settings/inference.tsx`, badge deep-link, FRE nudge.
- Accept: **zero-click `auto` background setup** ends in a single honest toast; one-click flow shows
  real size/time; estimate shown before commit; calm fallback copy incl. offline/AV/deferred; Advanced
  disclosure incl. Remove GPU; a11y (icon+text, aria-live, numeric labels); browser EDD states all pass.

### Phase 7 — Flip default + docs
- Accept: `KHONJEL_FEATURE_GPU` removed/on; electron EDD green; README/spec cross-links; honest
  status everywhere; `verify:quick` + both eval suites green.

---

## 6. Risk register

| Risk | Mitigation |
|---|---|
| CUDA build missing cudart redist -> DLL load fail | manifest ships redist as a required part; probe catches before activate ([02 §2](02-backend-provisioning-and-rollback.md)) |
| Wrong VRAM (4GB cap) -> bad `-ngl` -> OOM | accurate sources (smi/registry) + OOM ladder safety net |
| Driver too old | driver-version gate in `decide`; UX "update driver" path, never a crash |
| Multi-GB downloads flaky | resumable `.part` + sha256 verify + simulated in CI |
| GPU instability in the field | crash-loop demote + quarantine + one-click "Reset acceleration" |
| Dishonest status regressions | `ACCEL_STATUS_DISHONEST` detector guards it in EDD |
| Large GPU download surprises a metered user | size shown up front (`downloadBytes`); `autoSetup` opt-out; resumable + cancelable |
| Antivirus/locked files on Windows | atomic rename + quarantine dir; "security software blocked" copy; retry; never partial-activate |

---

## 7. Definition of done (whole feature)

1. CPU path is byte-for-byte unchanged when GPU is off/absent.
2. In `auto`, the GPU is reached with **zero clicks** and a **single** honest toast; large downloads
   disclose their size; offline / AV-blocked / no-model-yet are handled with no dead-ends.
3. Turning GPU on manually is **one click**, proven by a real on-device test before it claims to be on.
4. Any failure **silently keeps the user working on CPU** and explains itself in plain language.
5. Everything is reversible from the UI; state lives under `runtime/` and is safe to delete; disk is
   bounded (active + LKG + cpu).
6. No elevation, no PATH edits, all artifacts pinned + hash-verified, all IPC zod-bounded, diagnostics
   scrubbed of token + home path.
7. `npm run verify:quick`, `npm run eval`, `npm run eval:electron` all green.
