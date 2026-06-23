# GPU Acceleration — Spec Set

> **Status:** **Implemented (phases 1-7).** Detection, the capability->backend decision, the pinned
> artifact manifest + provisioning pipeline, the validation probe + rollback/crash-loop guard, the
> offload/`-ngl` + OOM ladder, the full typed contracts, and the one-click UX are built and covered by
> BE1 unit tests plus browser + Electron EDD. CPU stays the floor: activating a *downloaded* GPU
> backend is gated on pinned artifact hashes (a release step that records each asset's sha256), so
> until those are populated, `enable` fails gracefully to CPU. See
> [06 implementation plan](06-edd-tdd-and-implementation-plan.md).
> **Audience:** Electron/backend engineers, frontend engineers, UX, EDD authors.
> **Theme:** No-compromise GPU acceleration for **all** local models, with automatic detection,
> smart environment setup, automatic rollback, a friendly test/validate experience, and graceful
> fallback to CPU so the app is **never** left in a broken state.

This folder specifies how Khonjel turns a user's GPU into real speedups for local Speech-to-Text
(whisper.cpp) and local Language models (llama.cpp), without the user needing to know what CUDA,
Vulkan, Metal, `-ngl`, or a "backend" is.

It builds on the existing local-model work:

- [03-ux-ui/07 — Local model management](../../03-ux-ui/07-local-model-management.md)
- [03-ux-ui/08 — Local model FRE, readiness & compatibility](../../03-ux-ui/08-local-model-fre-readiness-and-compatibility.md)
- [backend/10 — Providers & models](../backend/10-providers-and-models.md)
- [backend/12 — Audio capture & OS integration](../backend/12-audio-capture-and-os-integration.md)

And on the code already shipped:

- `app/electron/main/models/hardware.ts` — Windows GPU enumeration (name/VRAM/driver).
- `app/electron/main/models/compatibility.ts` — hardware -> model compatibility/readiness.
- `app/electron/main/inference/runtime.ts` + `llama-server.ts` — local LLM runtime, `-ngl` support.
- `app/electron/main/stt/runtime.ts` + `whisper.ts` — local STT runtime.
- `app/scripts/fetch-llama.mjs` (`--backend=cpu|vulkan|cuda-12.4|cuda-13.3`), `fetch-whisper.mjs`.

---

## 1. The problem this solves

Today local inference is **CPU-only by default**. The fetch scripts pull CPU builds, the runtime
only offloads to GPU when `KHONJEL_LLM_GPU_LAYERS` is set manually, STT has no GPU path, and the
settings UI dishonestly says "GPU auto-detected." A user with an RTX 4090 gets CPU speed and no
explanation.

We want the opposite: a user clicks **one** button (or it just happens during setup), Khonjel
figures out the best safe way to use their GPU, downloads exactly what's needed, proves it works,
and shows the speed gain — and if anything is wrong, it quietly falls back to CPU and tells the
user in plain language.

---

## 2. Goals & non-goals

### Goals

- Detect GPU vendor, model, VRAM, driver, and compute capability accurately and safely.
- Pick the best **engine backend** per GPU/OS automatically (CUDA / Vulkan / Metal / HIP / SYCL / CPU).
- Provision the matching engine binaries into an isolated, versioned runtime directory.
- **Validate by actually running** a tiny GPU job before trusting it.
- **Auto-rollback and quarantine** a backend that fails to install, load, or run; never get stuck.
- Compute GPU offload (`-ngl`) automatically from VRAM vs model size, with an OOM auto-tune ladder.
- Provide a friendly **Test & validate** experience with real metrics (tokens/sec, VRAM, latency).
- Graceful, transparent fallback chain: best GPU backend -> next GPU backend -> CPU.
- **Zero-click when safe.** In the default `auto` mode, detect, set up, and turn on the GPU
  automatically in the background once a model is ready — no button to hunt for — then confirm with a
  friendly notification. The explicit one-click button exists for `off`->`on` and re-tries.
- Zero telemetry; everything stays on device.

### Non-goals (this spec)

- Cloud/provider acceleration (cloud already runs remotely; out of scope).
- Training/fine-tuning on GPU.
- Multi-node / distributed inference.
- **Multi-GPU tensor-split** (using two GPUs at once for a single model). We pick one primary GPU;
  the others are selectable in Advanced but not combined.
- Shipping our own compiled engine backends (we consume official llama.cpp / whisper.cpp release
  artifacts; building them is a separate supply-chain task).

---

## 3. Principles

1. **CPU is the floor, never removed.** A working CPU backend is always present so the app cannot be
   bricked by a GPU problem.
2. **Prove, don't assume.** A backend is only "active" after a real functional probe passes.
3. **Atomic + reversible.** Installs are atomic; the previous working backend is retained as
   last-known-good and restored on any failure.
4. **Plain language.** The user sees "graphics card", "faster", "on/off" — never CUDA/ngl/Vulkan
   unless they open Advanced.
5. **Honest status.** The UI always reflects what is actually running (GPU vs CPU) and why.
6. **No elevation, no system changes.** Everything installs under `userData`; no admin rights, no
   driver installs, no PATH edits, no registry writes.
7. **Bounded + offline-aware.** Disk budgeted; works offline if a backend is already installed.
8. **Pinned + verified.** Every downloaded backend artifact is sha256-pinned (ties to the security
   audit F1 supply-chain item).
9. **Invisible by default.** The best path needs zero decisions; UI appears only when there is a real
   choice to make or a problem to explain. Jargon is opt-in (Advanced), never required.

### Acceleration modes at a glance

| Mode | What it does | Who picks it |
|---|---|---|
| **`auto`** (default) | Detects + provisions + proves + turns on GPU **in the background** when safe; silently uses CPU when not. Adapts to battery/thermal. | Almost everyone (never has to touch it) |
| **`on`** | Always prefer GPU (still probe-gated + fallback-safe); set up now via the one-click button; keep GPU even on battery. | Power users / desktops |
| **`off`** | Force CPU everywhere; never download a GPU backend. | Privacy-strict / troubleshooting |

> `auto` is the "super-simple" promise: a typical user installs Khonjel, picks a model, and a moment
> later sees "Your graphics card is now making Khonjel ~7x faster" — having clicked nothing.

---

## 4. The lifecycle (five stages, rollback at every step)

```text
        ┌─────────┐   ┌─────────┐   ┌──────────────┐   ┌──────────┐   ┌──────┐
        │ DETECT  │──▶│ DECIDE  │──▶│  PROVISION   │──▶│ VALIDATE │──▶│ RUN  │
        │ GPU/HW  │   │ backend │   │ download+inst│   │  probe   │   │  GPU │
        └────┬────┘   └────┬────┘   └──────┬───────┘   └────┬─────┘   └──┬───┘
             │             │               │                │            │
             ▼             ▼               ▼                ▼            ▼
        (unknown HW)   (no GPU)      (download fail /   (probe fail /  (crash /
             │             │          bad hash)          driver old)    OOM)
             └─────────────┴───────────────┴────────────────┴───────────┘
                                      ▼
                        ROLLBACK to last-known-good, else CPU
                        + quarantine the bad backend + friendly reason
```

- **Detect** ([01](01-gpu-detection-and-capability.md)) — layered hardware + driver detection.
- **Decide** ([01](01-gpu-detection-and-capability.md) §6) — capability -> backend recommendation.
- **Provision** ([02](02-backend-provisioning-and-rollback.md)) — acquire + atomically install.
- **Validate** ([02](02-backend-provisioning-and-rollback.md) §5) — smoke probe; gate activation.
- **Run** ([03](03-runtime-acceleration-and-fallback.md)) — `-ngl` auto-tune + fallback chain.

---

## 5. Backend support matrix (target)

| Vendor / platform | LLM (llama.cpp) | STT (whisper.cpp) | Detection signal |
|---|---|---|---|
| **NVIDIA (Win/Linux)** | CUDA (best) -> Vulkan | cuBLAS (CUDA) -> CPU | `nvidia-smi`, registry, PCI vendor 0x10DE |
| **AMD (Win)** | Vulkan | CPU (Vulkan whisper if available) | registry, PCI vendor 0x1002 |
| **AMD (Linux)** | Vulkan (ROCm/HIP advanced) | CPU | `lspci`, ROCm probe |
| **Intel Arc / iGPU** | Vulkan (SYCL advanced) | CPU | registry/`lspci`, PCI vendor 0x8086 |
| **Apple Silicon (macOS)** | Metal (built in) | Metal/Core ML (built in) | `system_profiler`, `arch=arm64` |
| **Unknown / old / VM / headless** | CPU | CPU | fallthrough |

> Backend availability is data-driven by the **artifact manifest** ([02 §2](02-backend-provisioning-and-rollback.md));
> the matrix above is the intended default policy, not a hardcode.

---

## 6. File index

| # | File | What it specifies |
|---|------|-------------------|
| 00 | [README](README.md) | This overview: goals, principles, lifecycle, matrix, glossary. |
| 01 | [Detection & capability](01-gpu-detection-and-capability.md) | Layered GPU/driver/VRAM detection per OS; capability scoring; backend decision. |
| 02 | [Provisioning & rollback](02-backend-provisioning-and-rollback.md) | Artifact manifest, atomic install, last-known-good, quarantine, crash-loop guard. |
| 03 | [Runtime & fallback](03-runtime-acceleration-and-fallback.md) | `-ngl` auto-compute, OOM auto-tune, STT GPU, transparent fallback chain, metrics. |
| 04 | [Contracts, data & IPC](04-contracts-data-and-ipc.md) | Ports, types, IPC channels, zod schemas, settings keys, persisted state, events. |
| 05 | [UX: setup, test & validate](05-ux-setup-test-validate.md) | The friendly one-click flow, status surfaces, benchmark UX, copy, accessibility. |
| 06 | [EDD/TDD & implementation plan](06-edd-tdd-and-implementation-plan.md) | Full test matrix + phased, task-level backlog with acceptance criteria. |

---

## 7. Glossary

- **Backend** — an engine build variant that targets a compute API: `cpu`, `cuda-12.4`, `cuda-13.3`,
  `vulkan`, `metal`, `hip`, `sycl`. One per engine (`llama` / `whisper`).
- **Provision** — download + verify + extract + atomically activate a backend in `userData/runtime`.
- **Probe / smoke test** — a tiny real inference run that proves a backend loads and produces output.
- **Last-known-good (LKG)** — the most recent backend that passed a probe; the rollback target.
- **Quarantine** — move a failed backend out of the active path and record why, so it is not retried
  blindly.
- **`-ngl`** — llama.cpp "n-gpu-layers": how many transformer layers to offload to the GPU.
- **Offload plan** — the computed `-ngl` (and STT device) for a given GPU + model.
- **Acceleration mode** — user setting: `auto` (default), `on` (force GPU, still safe-gated), `off`
  (force CPU).

---

## 8. Cross-cutting requirements

- **Security** — pinned hashes, loopback-only model server (existing zero-trust token), no elevation,
  no network egress beyond the pinned artifact hosts. See [02 §8](02-backend-provisioning-and-rollback.md).
- **Privacy** — GPU detection and all metrics stay local; no telemetry.
- **Packaging** — the portable build ships **no** backends; the CPU backend is acquired/validated on
  first run like any other (or bundled minimal CPU); GPU backends are always downloaded on demand.
- **Disk** — budget roughly **1–2 GB** for an active GPU backend (engine + CUDA cudart redistributable)
  on top of the CPU floor. Khonjel keeps only **active + last-known-good + cpu** per engine and prunes
  the rest ([02 §9](02-backend-provisioning-and-rollback.md)).
- **Accessibility** — every status has text + icon (never color only); the test reports a text
  summary; full keyboard operability. See [05 §9](05-ux-setup-test-validate.md).
