# 03 — Runtime Acceleration & Graceful Fallback

> How an active GPU backend is actually used at inference time: computing how much to offload,
> auto-tuning down on out-of-memory, accelerating STT, and degrading transparently to CPU when
> needed — always with honest status. Consumes [02 Provisioning](02-backend-provisioning-and-rollback.md).

---

## 1. Where this plugs into existing code

- `app/electron/main/inference/runtime.ts` — today resolves a `llama-server` binary + first GGUF and
  reads `KHONJEL_LLM_GPU_LAYERS`. It becomes the consumer of the **active backend dir** + the computed
  **offload plan**, and gains `prepareModel` already added for switching.
- `app/electron/main/inference/llama-server.ts` — `buildServerArgs` already supports `-ngl` and `-c`;
  it gains `--device`/main-GPU selection and the auto-tune retry loop wrapper.
- `app/electron/main/stt/runtime.ts` / `whisper.ts` — gains active-backend resolution + GPU device
  flags + CPU fallback.

> Env overrides (`KHONJEL_LLM_GPU_LAYERS`, `KHONJEL_LLAMA_SERVER`, `KHONJEL_WHISPER_BIN`) remain
> highest-priority manual overrides for power users and evals.

---

## 2. LLM offload plan (`-ngl` auto-compute)

The goal: offload as many layers as fit in VRAM with safe headroom, else as many as possible, else 0.

### Inputs

- `vramBytes` (accurate, from [01](01-gpu-detection-and-capability.md); may be undefined).
- model file size + layer count (from GGUF metadata when available, else estimated from size).
- context size (`-c`, default 4096) -> KV-cache cost.

### Computation (pure, testable)

```ts
interface OffloadPlan {
  ngl: number;                 // 0..999 (999 = all layers)
  mainGpu?: number;            // device index
  reason: string;              // "Your 24 GB GPU fits the whole model"
  estimate: { fitsFully: boolean; reservedBytes: number };
}

function computeOffloadPlan(input: {
  vramBytes?: number;
  modelBytes: number;
  layerCount?: number;
  contextTokens: number;
  vendor: GpuVendor;
}): OffloadPlan;
```

Policy:

```text
reserve = max(1.0 GB, 0.10 * vram)        # desktop + driver + fragmentation headroom
kvCache ≈ contextTokens * perTokenKvBytes # model-dependent estimate
budget  = vram - reserve - kvCache

if vram unknown                  -> ngl = conservativeFloor (e.g. 12) ; reason "GPU memory unknown"
else if modelBytes <= budget     -> ngl = 999 (all) ; fitsFully = true
else                             -> perLayer = modelBytes / layerCount
                                    ngl = clamp(floor(budget / perLayer), 0, layerCount)
if ngl == 0                      -> CPU (no GPU benefit) ; fall through to fallback chain
```

Apple Metal: `unifiedMemory` -> treat `budget` from the unified-memory policy ([01 §3](01-gpu-detection-and-capability.md));
Metal typically offloads all layers for models that fit.

### Shared VRAM across engines (LLM + STT)

The resident `llama-server` and whisper can want the GPU at the same time and share **one** VRAM
pool, so the offload budget subtracts a reservation for the other engine:

- The LLM has the largest footprint (model resident in VRAM) and is budgeted first.
- When STT is also GPU-enabled, the LLM `budget` subtracts a small STT reservation (whisper models
  are far smaller and loaded per run).
- If both cannot fit safely, default policy: **the LLM keeps the GPU and STT falls back to CPU**
  (short dictations are already fast on CPU), reported honestly per engine.
- A live `vramUsedBytes` sample (nvidia-smi/API) refines the budget; a real OOM still triggers the
  ladder (§3) as the correctness backstop.

---

## 3. OOM auto-tune ladder (no-compromise but safe)

A computed plan can still OOM (other apps using VRAM, fragmentation, bad estimate). On a GPU start
failure classified as `oom` ([02 §5](02-backend-provisioning-and-rollback.md)):

```text
ngl ladder:  planned → 80% → 60% → 40% → 20% → 0(CPU)
```

- Retry `llama-server` start with the next rung; each rung is fast (server start + health).
- Record the **highest rung that worked** as the model's cached offload for next launch (so it does
  not re-walk the ladder every time).
- If it reaches 0, that is a clean, transparent CPU fallback (not a crash).

This makes acceleration **adaptive per model + machine state**, which is what "no compromise with
graceful fallback" requires in practice.

---

## 4. STT acceleration

- whisper.cpp CUDA (cuBLAS) build uses the GPU automatically; pass the device index and ensure the
  GPU build's DLLs are on the spawn `cwd`/dir (no PATH edits — spawn from the backend dir).
- Failure (load error / driver) -> classified -> fall back to the CPU whisper backend for that run
  and demote per the crash-loop guard if it recurs.
- whisper has `--no-gpu` to force CPU; used by the CPU fallback path and by the "off" mode.

---

## 5. The fallback chain (transparent + honest)

At any inference, the **effective engine** is resolved as:

```text
acceleration mode = off    -> CPU (forced)
acceleration mode = auto/on:
    active GPU backend present & probed -> GPU (with offload plan + OOM ladder)
        on runtime crash-loop           -> demote to LKG, else CPU
    no active GPU backend               -> CPU
```

- The fallback is **silent to the workflow** (the user's dictation/chat still works) but **loud in
  the status surface**: the engine badge + setup panel always show "Running on GPU" vs "Running on
  CPU" and, if degraded, a one-line reason + Retry ([05](05-ux-setup-test-validate.md)).
- Ties into existing `models.active()` / `onRuntime` events so the sidebar/badge reflect GPU vs CPU
  live and after restart.

---

## 6. Live metrics (local-only, powers the test UX)

Captured from the engine during a run / probe, never sent anywhere:

```ts
interface RuntimeMetrics {
  device: "gpu" | "cpu";
  backend: Backend;
  tokensPerSec?: number;        // LLM
  offloadedLayers?: number;     // LLM (from llama-server /props or logs)
  vramUsedBytes?: number;       // sampled (nvidia-smi / API) during run
  firstTokenMs?: number;
  realtimeFactor?: number;      // STT: audioSec / processSec
}
```

These feed the **Test & validate** before/after comparison ([05 §5](05-ux-setup-test-validate.md)).

### The benchmark (fair, deterministic, local)

`runTest` ([04](04-contracts-data-and-ipc.md)) must produce a **stable, fair** number, not a lucky one:

- **Fixed workload** — a canned prompt + fixed `max_tokens` (e.g. 128) for the LLM, and the bundled
  sample clip for STT. The exact same input is used for the CPU and GPU legs.
- **Warmup** — one discarded short run to load weights/caches before timing (cold-start excluded).
- **On-device CPU baseline** — the same workload run once with `-ngl 0` / `--no-gpu` on the *active*
  model, so "x faster" is true for *this* machine, never a generic marketing number.
- **Bounded** — each leg is time-boxed; if the CPU leg would be very slow it is estimated from a
  shorter run and labelled "approx".
- **Reported** — tokens/sec (LLM), realtime-factor (STT), peak `vramUsedBytes`, and `speedup`.

---

## 7. Power & thermal policy (laptops)

- If on **battery** and acceleration mode is `auto`: default to CPU for STT short dictations (low
  latency anyway) but keep GPU for the LLM if the dGPU is active; expose a toggle
  "Use GPU on battery" (default off for `auto`, on for `on`).
- Never spin up a parked Optimus dGPU for a 1-second dictation if CPU is fast enough — measured by the
  probe's tokens/sec vs a CPU baseline.
- **Live AC/battery transitions**: unplugging does **not** kill an in-progress GPU run; the new policy
  applies at the next engine start/idle moment so nothing is interrupted. Re-plugging re-enables GPU
  on the next start.
- These are policy knobs in settings ([04](04-contracts-data-and-ipc.md)), not hardcodes.

---

## 8. Interaction with model switching

- The existing `models.prepare(id)` warm/switch flow ([08 §10](../../03-ux-ui/08-local-model-fre-readiness-and-compatibility.md))
  now also recomputes the offload plan for the newly selected model and keeps the previous model
  serving until the new one passes start (preserving "seamless switch, keep last working").
- Changing acceleration mode (on/off/auto) is itself a warm switch: prepare the target engine, prove
  it, then flip; on failure, stay on the current one and report.
- **Never interrupt active work**: if a switch (mode change, `enable`, or auto-setup activation) would
  restart an engine that is mid-dictation/mid-generation, defer the flip until the engine is idle and
  show "will apply in a moment". The current backend keeps serving until then.

---

## 9. Defaults summary

| Knob | Default | Notes |
|---|---|---|
| Acceleration mode | `auto` | detect + use GPU when safe, else CPU |
| `-ngl` | computed | OOM ladder adjusts; env overrides |
| Context size | 4096 | existing |
| Use GPU on battery | off (auto) | laptop policy |
| Probe before activate | always | the hard gate |
| Crash-loop demote | 2 crashes / 120 s | configurable |
| Auto-setup on first run | on (in `auto` mode) | background, cancelable, after first model ready |
| LLM+STT VRAM contention | LLM keeps GPU | STT -> CPU when both can't fit safely |
