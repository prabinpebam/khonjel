# 02 — Backend Provisioning, Validation & Rollback

> How Khonjel acquires the right engine backend, installs it atomically, **proves it works**, keeps a
> last-known-good to fall back to, and quarantines anything broken so the app can never get stuck.
> Consumes the [01](01-gpu-detection-and-capability.md) decision; feeds [03 Runtime](03-runtime-acceleration-and-fallback.md).

---

## 1. Runtime directory layout (isolated + versioned)

Everything lives under `userData`, no elevation, no system changes:

```text
<userData>/runtime/
  gpu-profile.json                 # cached GpuProfile (01 §7)
  backends.json                    # install index: per engine -> installed backends + active + LKG
  llama/
    cpu-b9744/                     # one dir per backend@version (immutable once installed)
      llama-server.exe
      ggml-*.dll / *.so
    cuda-12.4-b9744/
      llama-server.exe
      ggml-cuda.dll
      cudart64_12.dll ...          # CUDA runtime redistributable (see §2 "requires")
    vulkan-b9744/
    .quarantine/                   # failed installs moved here with a reason file
  whisper/
    cpu-v1.9.1/
    cuda-12.4-v1.9.1/
```

- A backend directory is **immutable** once activated — switching backends never mutates a working
  one; it repoints the active pointer.
- `vendor/llama`, `vendor/whisper` (dev) and env overrides remain valid fallbacks (back-compat with
  `app/electron/main/inference/runtime.ts` / `stt/runtime.ts`).

---

## 2. The artifact manifest (source of truth, pinned)

A static, build-time-pinned manifest describes every downloadable backend. It is the only place that
knows URLs, hashes, and file requirements — the decision logic ([01 §6](01-gpu-detection-and-capability.md))
only references backend ids.

```ts
interface BackendArtifact {
  engine: "llama" | "whisper";
  backend: Backend;                 // "cuda-12.4" | "vulkan" | "metal" | "cpu" | ...
  version: string;                  // engine release tag, e.g. "b9744" / "v1.9.1"
  os: "win32" | "darwin" | "linux";
  arch: "x64" | "arm64";
  /** Ordered download parts (engine zip + any redistributable, e.g. CUDA cudart). */
  parts: {
    url: string;                    // official llama.cpp / whisper.cpp release asset
    sha256: string;                 // PINNED (security audit F1)
    bytes: number;
    role: "engine" | "redist";      // redist = e.g. cudart-*.zip
  }[];
  /** Files that MUST exist after extract for the install to be considered complete. */
  expectFiles: string[];            // ["llama-server.exe", "ggml-cuda.dll"]
  /** Soft gate surfaced as a tip; the probe is the hard gate. */
  minDriver?: { nvidia?: string; amd?: string };
  notes?: string;
}
```

### Real-world artifact notes (must be encoded in the manifest)

- **llama.cpp Windows CUDA builds require the CUDA runtime redistributable** shipped as a separate
  asset (`cudart-llama-bin-win-cuda-<ver>-x64.zip`). The manifest lists it as a `redist` part; a
  CUDA install that lacks cudart will fail the probe and roll back — encoding it avoids that.
- llama.cpp asset names follow `llama-<tag>-bin-win-<backend>-x64.zip` (matches the existing
  `fetch-llama.mjs --backend` values: `cpu | vulkan | cuda-12.4 | cuda-13.3`).
- whisper.cpp ships `whisper-bin-x64.zip` (CPU) and cuBLAS variants (`whisper-cublas-<ver>-bin-x64.zip`);
  encode the exact pinned names per release.
- macOS llama/whisper standard builds include **Metal**; the `metal` backend's `parts` may be empty
  if Metal ships inside the base build — represented as an already-satisfied backend.

> Hashes are populated at build time (download once, compute sha256) and verified by
> `scripts/verify-model-pins.mjs`-style gating extended to backends.

---

## 3. Acquisition pipeline (atomic, resumable)

Reuses the proven downloader (`app/electron/main/models/downloader.ts`: `.part` -> verify -> atomic
rename, HTTP Range resume). Per backend:

```text
for each part (engine, redist...):
  download to <dir>.part/<file>.part   (Range-resumable)
  verify sha256 == manifest            (mismatch -> abort, no partial activation)
extract all zips into <dir>.staging/
assert every expectFiles[] present     (missing -> fail)
fsync + atomic rename <dir>.staging -> <backend>@<version>   (the only "commit" step)
record in backends.json as state: "installed" (NOT yet active)
```

- Failure at any step leaves the **previous active backend untouched**.
- Disk pre-flight: refuse if free space < Σ parts + headroom (friendly "free up space" path, reusing
  the model-management storage line).

---

## 4. Activation = repoint, never mutate

`backends.json` per engine:

```ts
interface EngineBackends {
  engine: "llama" | "whisper";
  active?: string;                 // "cuda-12.4@b9744"
  lastKnownGood?: string;          // probe-passed previously
  installed: Record<string, {      // key = "<backend>@<version>"
    backend: Backend;
    version: string;
    dir: string;
    state: "installed" | "active" | "quarantined";
    probedAt?: string;
    lastError?: { code: ProbeFailCode; message: string };
  }>;
}
```

Switching to a GPU backend:

1. Probe it (§5) **before** making it active.
2. On pass: set `active` + `lastKnownGood` = this backend, restart the engine pointing at its dir.
3. On fail: leave `active` unchanged; quarantine the candidate (§6).

`cpu` is always `installed` (acquired/validated first run) so a fallback target always exists.

---

## 5. Validation — the smoke probe (the real gate)

A backend is **never trusted on metadata alone**. After install (and on first use after a driver
change), run a tiny real job:

### LLM probe

- Start `llama-server` from the backend dir with the smallest installed GGUF, a tiny context, and the
  computed `-ngl` ([03 §2](03-runtime-acceleration-and-fallback.md)).
- Wait for `/health` ok within a timeout.
- Issue a 1-token `/v1/chat/completions` ("ping").
- **Pass** = health ok + a token returned + (for GPU) the server log/`/props` shows non-zero offloaded
  layers (so a silent CPU-only fallback inside a GPU build is detected and reported honestly).

### STT probe

- Run `whisper-cli` on a bundled ~1 s silent/marker WAV with the GPU build.
- **Pass** = exit 0 + parseable output within timeout.

### Probe result

```ts
type ProbeFailCode =
  | "missing-files" | "driver-too-old" | "load-failed" | "no-gpu-offload"
  | "oom" | "timeout" | "crashed" | "unknown";

interface ProbeResult {
  ok: boolean;
  backend: Backend;
  failCode?: ProbeFailCode;
  message: string;                 // plain language
  metrics?: { tokensPerSec?: number; offloadedLayers?: number; vramUsedBytes?: number; ms?: number };
  logTail?: string;                // last lines (local only; for Advanced/diagnostics)
}
```

Probe failure signatures are classified from the engine's stderr (e.g. CUDA `out of memory`,
`cudaErrorInsufficientDriver`, missing DLL load errors) into `ProbeFailCode` so the UX and the
auto-tune ([03 §3](03-runtime-acceleration-and-fallback.md)) can react precisely.

---

## 6. Rollback & quarantine (never get stuck)

```text
            install ok
                │
                ▼
            ┌───────┐  probe pass   ┌────────┐
   ─────────│ PROBE │──────────────▶│ ACTIVE │  (set LKG = this)
            └───┬───┘               └────────┘
                │ probe fail
                ▼
        ┌────────────────┐
        │  QUARANTINE     │  move dir -> .quarantine/, write reason.json
        └───────┬────────┘
                ▼
   roll back to:  LKG (if still present + still probes ok)  else  CPU
                ▼
        surface friendly reason + Retry / Use CPU
```

- **Atomic rollback**: because activation is a pointer flip and dirs are immutable, rollback is just
  repointing `active` to LKG (or `cpu`) and restarting the engine — no half-state.
- **Quarantine** keeps the bad backend on disk (out of the active path) with a `reason.json`; it is
  not auto-retried unless the user clicks Retry or a driver update is detected.

### Crash-loop guard (runtime, not just install)

Even an activated backend can crash later (driver crash, thermal, OOM under load):

- Track engine process exits with a sliding window.
- If a backend crashes **N times in T seconds** (default N=2, T=120s) -> auto-demote: quarantine,
  fall back to LKG/CPU, and show: "GPU acceleration kept crashing, so Khonjel switched to the CPU to
  keep working." with Retry.
- Distinguish a clean stop (model switch / shutdown) from a crash (non-zero/abnormal exit).

---

## 7. State machine (the full backend lifecycle)

```text
none ─▶ planning ─▶ downloading ─▶ verifying ─▶ installing ─▶ probing ─▶ active
  ▲         │            │             │             │            │         │
  │         ▼            ▼             ▼             ▼            ▼         ▼ (runtime crash-loop)
  └──────  failed ◀───────────────────────────── quarantined ◀──┴─────────┘
                         (rollback to LKG/CPU on any failure, app stays usable)
```

Each transition emits an `acceleration:progress` event ([04](04-contracts-data-and-ipc.md)) so the UX
shows live, honest status.

---

## 8. Security & safety (ties to the independent audit)

- **Pinned hashes** for every backend part (audit F1). Reject `KHONJEL_*` source overrides unless the
  pinned hash matches.
- **Loopback only**: the spawned `llama-server` stays on `127.0.0.1` with the existing per-session
  bearer token; GPU changes none of that.
- **No elevation / no system mutation**: downloads + extracts under `userData`; never touch system
  CUDA, PATH, drivers, or registry (read-only registry reads for detection only).
- **No new egress**: only the pinned artifact hosts (GitHub releases / Hugging Face), same as model
  downloads; everything else stays off.
- **Resource caps**: probe + downloads time-boxed; disk budgeted; a runaway engine is killed by the
  crash-loop guard.
