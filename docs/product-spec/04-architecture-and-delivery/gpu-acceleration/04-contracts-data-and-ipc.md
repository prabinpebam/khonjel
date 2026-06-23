# 04 — Contracts, Data Model & IPC

> The exact seam: service ports, shared types, IPC channels + zod schemas, persisted state, settings
> keys, and events. Follows the existing typed-seam pattern (`@services` ports -> `khonjel:invoke` ->
> zod-validated dispatch -> main handler), so the renderer stays adapter-agnostic.

---

## 1. New service port — `AccelerationService`

A dedicated port (not folded into `models`) because acceleration is reused beyond the model picker
(engine badge, FRE, diagnostics). Added to `Services` in `app/src/services/ports/index.ts`.

```ts
export interface AccelerationService {
  /** Cached GPU profile; triggers async detection if stale. */
  profile(): Promise<GpuProfile>;
  /** Re-run detection now (Advanced "Re-scan hardware"). */
  rescan(): Promise<GpuProfile>;
  /** The current acceleration state (mode, active backends, what is running). */
  state(): Promise<AccelerationState>;
  /** The smart plan: recommended backend per engine + why. */
  plan(): Promise<AccelerationPlan>;
  /** Turn acceleration on/off/auto. `on`/`auto` provisions+probes as needed (long-running -> events). */
  setMode(mode: AccelerationMode): Promise<void>;
  /** Provision+activate a specific engine backend (Advanced or the one-click flow). */
  enable(engine: Engine, backend?: Backend): Promise<void>;
  /** Force CPU for an engine (rollback / "off"). */
  disable(engine: Engine): Promise<void>;
  /** Retry a quarantined backend (e.g. after a driver update). */
  retry(engine: Engine, backend: Backend): Promise<void>;
  /** Run the friendly Test & validate benchmark (CPU vs GPU). */
  runTest(): Promise<AccelerationTestReport>;
  /** Live progress (detect/download/probe/activate/rollback) + state changes. */
  onProgress(cb: (e: AccelerationProgress) => void): () => void;
  onState(cb: (s: AccelerationState) => void): () => void;
}
```

---

## 2. Shared types (`app/src/services/ports/types.ts`)

```ts
export type GpuVendor = "nvidia" | "amd" | "intel" | "apple" | "unknown";
export type Engine = "llama" | "whisper";
export type Backend =
  | "cuda-13.3" | "cuda-12.4" | "vulkan" | "metal" | "hip" | "sycl" | "cpu";
export type AccelerationMode = "auto" | "on" | "off";

export interface GpuDevice {
  index: number; name: string; vendor: GpuVendor; vendorId?: string;
  vramBytes?: number; unifiedMemory?: boolean; driverVersion?: string;
  computeCapability?: string; maxCudaVersion?: string; isIntegrated?: boolean;
  source: string[];
}

export interface GpuProfile {
  os: "win32" | "darwin" | "linux"; arch: string;
  devices: GpuDevice[]; primary?: GpuDevice;
  detectedAt: string; warnings: string[];
}

export interface BackendCandidate {
  backend: Backend; reason: string; confidence: "high" | "medium" | "low";
  minDriver?: string; requires?: string[];
}

export interface AccelerationPlan {
  llm: BackendCandidate[];      // ordered best-first
  stt: BackendCandidate[];
  recommendedLevel: "gpu-great" | "gpu-ok" | "cpu-only" | "unknown";
  summary: string;              // plain language for the card
}

export type BackendState =
  | "none" | "planning" | "downloading" | "verifying" | "installing"
  | "probing" | "active" | "quarantined" | "failed";

export interface EngineAcceleration {
  engine: Engine;
  device: "gpu" | "cpu";
  activeBackend?: Backend;
  state: BackendState;
  message: string;              // user-facing
  metrics?: RuntimeMetrics;
  lastError?: { code: string; message: string };
}

export interface AccelerationState {
  mode: AccelerationMode;
  llm: EngineAcceleration;
  stt: EngineAcceleration;
  gpuActive: boolean;           // any engine on GPU
  summary: string;              // "Running on your NVIDIA RTX 4090" / "Running on CPU"
}

export interface RuntimeMetrics {
  device: "gpu" | "cpu"; backend?: Backend;
  tokensPerSec?: number; offloadedLayers?: number; vramUsedBytes?: number;
  firstTokenMs?: number; realtimeFactor?: number;
}

export interface AccelerationProgress {
  engine: Engine; backend: Backend; state: BackendState;
  bytesDone?: number; bytesTotal?: number;
  message: string;              // "Downloading GPU support (2 of 3)"
  rolledBackTo?: Backend;       // present on rollback
}

export interface AccelerationTestReport {
  ok: boolean;
  gpu?: RuntimeMetrics;         // GPU run (if available)
  cpu?: RuntimeMetrics;         // CPU baseline
  speedup?: number;             // gpu.tokensPerSec / cpu.tokensPerSec
  llm: { ok: boolean; message: string; metrics?: RuntimeMetrics };
  stt: { ok: boolean; message: string; metrics?: RuntimeMetrics };
  summary: string;              // "Your GPU is about 7x faster. Everything works."
}
```

---

## 3. IPC channels (`app/electron/shared/ipc-contract.ts`)

```ts
acceleration:profile      // [] -> GpuProfile
acceleration:rescan       // [] -> GpuProfile
acceleration:state        // [] -> AccelerationState
acceleration:plan         // [] -> AccelerationPlan
acceleration:setMode      // [AccelerationMode] -> void
acceleration:enable       // [Engine, Backend?] -> void
acceleration:disable      // [Engine] -> void
acceleration:retry        // [Engine, Backend] -> void
acceleration:runTest      // [] -> AccelerationTestReport
```

Plus two main->renderer relays (preload, like `onModelProgress`):

```text
khonjel:acceleration-progress   -> AccelerationProgress   (onProgress)
khonjel:acceleration-state      -> AccelerationState      (onState)
```

- Long-running verbs (`setMode`, `enable`, `runTest`) resolve when done but stream live updates over
  the relays so the UI animates without polling.
- All request/response payloads get **zod schemas** in `app/electron/shared/ipc-schemas.ts` with
  bounded strings/arrays (ties to audit F3), mirrored in `dispatch.ts` + the ipc adapter + mock.

---

## 4. Persisted state (under `userData/runtime/`)

| File | Shape | Purpose |
|---|---|---|
| `gpu-profile.json` | `GpuProfile` | cached detection (01 §7) |
| `backends.json` | `Record<Engine, EngineBackends>` | install index, active, LKG, quarantine (02 §4) |
| `<backend>@<ver>/reason.json` | `{ code, message, at }` | quarantine reason (02 §6) |
| `offload-cache.json` | `Record<modelId, { backend, ngl }>` | best working `-ngl` per model (03 §3) |

All written user-only (0600 where supported), no secrets inside, safe to delete (forces re-provision).

---

## 5. Settings keys (`app/src/stores/settings.ts` defaults)

```ts
"inference.acceleration.mode"        // "auto" (default) | "on" | "off"
"inference.acceleration.device"      // "" (auto-pick) | "<gpu index>"  (Advanced)
"inference.acceleration.useOnBattery"// "false" (Advanced; laptops)
"inference.llm.gpuLayers"            // "auto" (default) | "<number>"   (Advanced override)
"inference.acceleration.backend.llm" // "" (auto) | explicit backend    (Advanced)
"inference.acceleration.backend.stt" // "" (auto) | explicit backend    (Advanced)
```

`auto`/empty means "let the system decide" — the smart default. Advanced users can pin anything; env
vars still beat settings.

---

## 6. Main-process modules (new)

```text
app/electron/main/acceleration/
  detect.ts        # GpuProfile detection (extends models/hardware.ts), PURE parsers + IO edges
  decide.ts        # planBackends() — PURE capability -> backend ordering (01 §6)
  manifest.ts      # pinned BackendArtifact registry (02 §2)
  provision.ts     # acquire + atomic install + backends.json (reuses models/downloader.ts)
  probe.ts         # llm/stt smoke probes -> ProbeResult (02 §5)
  offload.ts       # computeOffloadPlan() + OOM ladder (PURE) (03 §2-3)
  service.ts       # createAccelerationService(deps) — orchestrates the lifecycle (DI, BE1-testable)
  metrics.ts       # parse tokens/sec, offloaded layers, vram (PURE parsers)
```

- **PURE + dependency-injected** like the rest of the backend (`decide`, `offload`, `metrics`, parsers
  in `detect`) -> BE1-unit-testable without a GPU.
- IO edges (spawn, fs, fetch, nvidia-smi/PowerShell) injected so tests pass fakes.

---

## 7. Renderer state (`app/src/stores/acceleration.ts`)

A Zustand store mirroring `models.ts`: seeds from `state()` + `plan()`, subscribes to
`onProgress`/`onState`, exposes `mode`, `llm`/`stt` engine state, `gpuActive`, `lastTest`. Used by the
setup panel, the engine badge, and the test UX.

---

## 8. Back-compat & migration

- `HardwareProfile.gpus` stays (display); `GpuProfile` is additive.
- Existing `models.compatibility()` gains an `acceleration` summary derived from `AccelerationState`
  so the local-model panel can show "Running on GPU" without a second round-trip.
- `KHONJEL_LLM_GPU_LAYERS` and friends remain the top override precedence.
