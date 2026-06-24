# Khonjel - Work Handoff

_Last updated: 2026-06-24_

A snapshot to continue work seamlessly on another device. Read the top section first.

---

## 0. IMPORTANT: there is uncommitted work

The most recent fix (GPU setup cascade + manifest corrections + "Try again" button)
is **NOT committed**. Git does not carry uncommitted changes to another machine.

**Before switching devices, do ONE of these from `c:\projects\khonjel`:**

```pwsh
# Option A (recommended): commit + push so the other device just pulls it
git add -A
git commit -m "fix(acceleration): cascade through GPU backends + correct b9744/v1.9.1 manifest URLs"
git push

# Option B: stash and carry it some other way (less ideal)
git stash push -m "gpu-cascade-wip"
```

If you forget and the changes are gone on the other device, Section 4 documents
exactly what they were so you can recreate them.

---

## 1. Repository snapshot

| Item | Value |
|------|-------|
| Repo root | `c:\projects\khonjel` |
| App package | `c:\projects\khonjel\app` (run all npm/build/test commands here) |
| Branch | `main` |
| Remote | `origin` -> https://github.com/prabinpebam/khonjel.git |
| HEAD (pushed) | `51504a7` feat(acceleration): optional GPU download wired end-to-end + relocated UX |
| Uncommitted | 8 files (see Section 4) - the GPU setup fix |
| Stack | Electron 42, React 19, Vite, TypeScript, zustand, vitest, Playwright |
| Unit tests | 432 passing (60 files) |

---

## 2. Set up on a new device

```pwsh
# 1. Clone
git clone https://github.com/prabinpebam/khonjel.git
cd khonjel/app

# 2. Install deps
npm install

# 3. (Optional) fetch local model files + CPU engine binaries for dev
#    These are NOT in git; they live in userData at runtime, or fetch for dev:
node scripts/fetch-whisper.mjs           # whisper.cpp CPU build + a ggml model
node scripts/fetch-llama.mjs             # llama.cpp CPU build
#    GPU dev builds (optional): --backend=vulkan | cuda-12.4, --provider=cuda

# 4. Run the app (dev)
npm run electron
```

### Where runtime data lives (Windows)

`userData = C:\Users\<you>\AppData\Roaming\khonjel-app\`

- `models/` - downloaded GGUF/GGML model files + `index.json`
- `runtime/<engine>/` - CPU engine binaries (whisper-cli.exe, llama-server.exe), fetched in-app on first local-model setup
- `runtime/<engine>/<backend>-<version>/` - GPU engine builds (provisioned by the acceleration manager)
- `runtime/backends.json` - which GPU/CPU backend is active per engine (source of truth)
- `runtime/gpu-profile.json` - cached GPU detection result

Engine binaries are NOT bundled and NOT in the catalog; they are downloaded on demand.

---

## 3. Build / verify commands (run from `app/`)

```pwsh
npm run typecheck          # tsc app + electron
npm run lint               # eslint
npm run lint:ds            # design-system lint (no arrow glyphs / emoji in comments; "..." ellipsis ok)
npm run test               # vitest (expect 432 passing)
npx vitest run electron/main/acceleration   # just the acceleration suite (135 tests)
npm run build              # vite build (renderer)
node scripts/build-electron.mjs             # bundle electron main+preload -> electron/main.cjs, preload.cjs

# Browser evals (Playwright):
node_modules\.bin\playwright.cmd test --config="C:\projects\khonjel\app\playwright.config.mjs" <filter>
# Electron evals (real app; rebuild the bundle first):
node_modules\.bin\playwright.cmd test --config="C:\projects\khonjel\app\playwright.electron.config.mjs" <filter>
```

Full green gate before committing: typecheck, lint, lint:ds, test, build, build-electron, plus the
relevant evals (gpu-acceleration, local-model, model-badge).

---

## 4. The uncommitted fix (what + why)

**Problem reported:** On a real NVIDIA machine the GPU acceleration card said
"GPU support isn't available for this system yet" and "Try again" did nothing.

**Four compounding root causes, all fixed:**

1. `manager.enable` tried only the single top backend (`plan.llm[0]` / `plan.stt[0]`) and gave up on
   any failure - no fallback.
2. `defaultAvailableBackends` was engine-agnostic, so whisper was offered `cuda-13.3` (which it does
   not ship) -> `findArtifact` miss -> the "isn't available for this system" message.
3. The manifest shipped two dead URLs for the pinned releases (HEAD-verified):
   - llama `cuda-13.3` -> `llama-b9744-bin-win-cuda-13.0-x64.zip` = **404** (b9744 has no CUDA-13 build).
   - whisper `cuda-12.4` cudart redist `cudart-whisper-bin-win-cuda-12.4-x64.zip` = **404**
     (whisper's cuBLAS zip is self-contained and bundles cudart).
4. The card's rolled-back "Try again" button called `rescan()` (re-detect hardware), not re-setup.

**Verified-good URLs (HEAD 200):** `llama-b9744-bin-win-cuda-12.4-x64.zip`,
`cudart-llama-bin-win-cuda-12.4-x64.zip`, `llama-b9744-bin-win-vulkan-x64.zip`,
`whisper-cublas-12.4.0-bin-x64.zip`.

**Files changed (8):**

| File | Change |
|------|--------|
| `app/electron/main/acceleration/manager.ts` | `runEnable` now CASCADES best-first through planned candidates (skip no-artifact, fall back on probe/provision failure) until one works or hits the CPU floor. `enable(engine, backend?)` cascades when backend omitted; `retry` stays single-backend. |
| `app/electron/main/acceleration/manager.test.ts` | +1 cascade test (falls back to 2nd candidate; a successful fallback is not a failure). |
| `app/electron/main/acceleration/manifest.ts` | Removed 404 llama `cuda-13.3`; whisper `cuda-12.4` is now a single self-contained cuBLAS part; `manifestStructuralIssues` redist rule is now llama-only. |
| `app/electron/main/acceleration/manifest.test.ts` | Redist test now scoped to llama CUDA backends. |
| `app/electron/main/acceleration/service.ts` | `defaultAvailableBackends` dropped `cuda-13.3` (win32 + linux). |
| `app/electron/main/acceleration/service.test.ts` | win32 availability assertion updated. |
| `app/src/surfaces/settings/AccelerationCard.tsx` | Rolled-back "Try again" calls `enableAll()` (`data-eval="accel-retry"`); no-gpu keeps `rescan()` (`accel-rescan`). |
| `app/eval/scenarios/gpu-acceleration.eval.electron.mjs` | Enable test uses backend `"hip"` (no platform ships it) so it degrades gracefully WITHOUT triggering the real multi-hundred-MB download; the stays-on-CPU assertion is preserved. |

All green: 432 unit tests, typecheck/lint/ds, build + build-electron, gpu-acceleration browser +
electron evals.

---

## 5. Feature context: GPU acceleration (the area in flight)

GPU acceleration is an **optional** download, presented in **Settings -> Speech-to-Text -> GPU
acceleration** (one card drives both engines: dictation/whisper + chat/llama). A GPU/CPU status pill
in the sidebar deep-links to it.

**Flow:** detect -> plan -> `enable` cascades (provision -> probe -> activate, else fall back) -> the
live engines read the active backend from `runtime/backends.json` and prefer the GPU binary, with CPU
as the always-available floor.

**Key modules** (`app/electron/main/acceleration/`):

- `detect.ts` - real GPU detection (PowerShell CIM/registry, nvidia-smi). Writes `gpu-profile.json`.
- `decide.ts` - PURE capability -> ordered backend candidates + plan.
- `manifest.ts` - the artifact catalog (URLs, pinned hashes, expectFiles). Source of truth for what ships.
- `provision.ts` - PURE install orchestration (download -> extract -> verify -> activate). `allowUnpinned` gate.
- `manager.ts` - stateful enable/disable/retry lifecycle + the CASCADE (the fix above).
- `active-backend.ts` - PURE + node: reads `backends.json` to find the live GPU build + computes `-ngl`.
- `node-io.ts` - the node composition root: real download/extract/probe IO. `provision` passes `allowUnpinned: true`.
- `probe-io.ts` / `benchmark-io.ts` - real on-device probe + speed test.

**Live-engine integration:** `app/electron/main/inference/runtime.ts` (llama) and
`app/electron/main/stt/runtime.ts` (whisper) prefer the active GPU binary; `main.ts` `onState` hot-reloads
both engines on a toggle (no restart).

**UI:** `app/src/surfaces/settings/AccelerationCard.tsx`, store `app/src/stores/acceleration.ts`
(`enableAll`/`disableAll` drive both engines), mock `app/src/services/adapters/mock/acceleration.ts`.

---

## 6. Known caveats / gotchas

- **GPU artifact sha256 pins are still empty** in `manifest.ts`. Provisioning currently runs at the
  "CPU-installer integrity floor" (HTTPS + allow-listed host + post-extract `expectFiles`), gated by
  `allowUnpinned: true`. Before release, fill real hashes (download once, hash) to upgrade to full
  pinning. `npm run verify:pins` reports the pending ones.
- **The real GPU download + probe cannot be eval-tested offline** (needs real hardware). Evals use
  the mock or force an unprovisionable backend. The cascade means a failed CUDA probe falls back to
  Vulkan, then CPU, with a visible message.
- **Electron evals cold-start flake**: the 30s `waitForSelector('[data-eval="app-shell"][data-eval-ready]')`
  can time out on the FIRST launch after a fresh `build-electron` (and on the in-test restart). It is
  a flake, not a regression - just re-run warm.
- **Restart `npm run electron` after rebuilding** the bundle; a running instance holds the old
  `electron/main.cjs`.
- **GPU detection logs a benign** "Get-ChildItem ... Requested registry access is not allowed" when
  reading HKLM for VRAM; it is caught (goes into `warnings[]`), not a crash.
- **ds-lint** forbids arrow glyphs and emoji in source comments. Use `->` and plain text. `"..."`
  ellipsis in string literals is fine.
- **Preserve `data-eval` hooks** when editing surfaces (evals depend on them): `acceleration-card`,
  `accel-cta`, `accel-retry`, `accel-rescan`, `accel-turn-off`, `accel-test`, `download-recommended-models`,
  model-badge hooks.

---

## 7. Suggested next steps

1. Commit + push the Section 4 fix (if not already done).
2. On the real NVIDIA box: restart `npm run electron`, open Settings -> Speech-to-Text -> GPU
   acceleration -> "Try again". Confirm it downloads CUDA 12.4 (or falls back to Vulkan) and the
   on-device probe flips the card to "Running on your GPU". Watch `runtime/backends.json`.
3. If the CUDA probe fails on the real GPU, capture the failure and confirm the cascade falls through
   to Vulkan cleanly.
4. Fill the GPU artifact sha256 pins in `manifest.ts` (release hardening); re-run `npm run verify:pins`.
5. Consider deriving `defaultAvailableBackends` directly from the manifest per engine (remove the
   hardcoded stand-in) so availability can never drift from what actually ships.
