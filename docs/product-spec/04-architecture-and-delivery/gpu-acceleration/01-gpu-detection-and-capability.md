# 01 — GPU Detection & Capability

> How Khonjel learns, accurately and safely, what GPU a machine has, what driver/compute it
> supports, and which engine backend to recommend. Detection feeds [02 Provisioning](02-backend-provisioning-and-rollback.md)
> and [03 Runtime](03-runtime-acceleration-and-fallback.md).

---

## 1. Why layered detection

A single source is never enough or trustworthy:

- Windows `Win32_VideoController.AdapterRAM` is a **32-bit** field that **caps/wraps at 4 GB** — an
  RTX 4090 reports ~4 GB, not 24 GB. (This is exactly why the current setup panel under-reports VRAM.)
- `nvidia-smi` is accurate but only exists for NVIDIA and only if the driver is installed.
- OS enumeration sees the device but not whether a compute backend will actually load.

So detection runs in **three tiers**, each refining the last, and **never throws** — every failure
degrades to "unknown" and ultimately CPU.

```text
Tier 1  OS enumeration        -> device list (name, vendor, ids)            [always]
Tier 2  Vendor/registry probe -> accurate VRAM, driver, compute capability  [best-effort]
Tier 3  Functional probe      -> "this backend actually runs"               [only at provision/validate]
```

Tier 1+2 produce the **GpuProfile**. Tier 3 lives in [02 §5](02-backend-provisioning-and-rollback.md)
(it requires a provisioned backend).

---

## 2. Tier 1 — OS enumeration

All commands are native-free (no node-gyp), run with a short timeout, `windowsHide`, and are wrapped
so any failure returns `[]`.

### Windows

```powershell
Get-CimInstance Win32_VideoController |
  Select-Object Name, AdapterCompatibility, PNPDeviceID, DriverVersion, AdapterRAM |
  ConvertTo-Csv -NoTypeInformation
```

- `Name` -> device name (e.g. `NVIDIA GeForce RTX 4090`).
- `AdapterCompatibility` -> vendor string.
- `PNPDeviceID` -> contains `VEN_10DE` (NVIDIA) / `VEN_1002` (AMD) / `VEN_8086` (Intel) — the
  **authoritative vendor id**, more reliable than the name.
- `AdapterRAM` -> **unreliable** (4 GB cap); used only as a last-resort VRAM floor.

> Extends the existing `parseWindowsGpuCsv` in `app/electron/main/models/hardware.ts`, adding the
> PNP vendor-id parse.

### macOS

```bash
system_profiler -json SPDisplaysDataType
```

- `sppci_model` -> name (e.g. `Apple M3 Max`).
- `spdisplays_vendor` -> vendor.
- Apple Silicon uses **unified memory**: there is no discrete VRAM; usable GPU memory is a fraction
  of system RAM (policy: `min(0.7 * totalRam, totalRam - 4GB)`), recorded as `unifiedMemory: true`.

### Linux

```bash
lspci -nnk | grep -iA3 'vga\|3d\|display'
```

- Parse PCI vendor ids `[10de]` / `[1002]` / `[8086]`.
- VRAM via `/sys/class/drm/card*/device/mem_info_vram_total` (AMD) or `nvidia-smi` (NVIDIA).

---

## 3. Tier 2 — accurate VRAM, driver, compute

### NVIDIA (all OS) — `nvidia-smi`

```bash
nvidia-smi --query-gpu=name,memory.total,driver_version,compute_cap --format=csv,noheader,nounits
# e.g.: NVIDIA GeForce RTX 4090, 24564, 581.15, 8.9
```

- `memory.total` (MiB) -> **accurate VRAM**.
- `driver_version` -> drives the CUDA runtime-build selection (§6).
- `compute_cap` -> CUDA compute capability (8.9 for Ada/4090).
- The `nvidia-smi` header also reports the **max CUDA version** the driver supports
  (`CUDA Version: 13.x`); capture it from `nvidia-smi -q` when present — it is the most direct signal
  for choosing the CUDA build.

### Accurate VRAM for any vendor on Windows — registry `qwMemorySize`

`Win32_VideoController.AdapterRAM` lies; the 64-bit truth is in the display-class registry:

```powershell
Get-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\0*' |
  Where-Object { $_.'HardwareInformation.qwMemorySize' } |
  Select-Object MatchingDeviceId, 'HardwareInformation.qwMemorySize', DriverVersion
```

- `HardwareInformation.qwMemorySize` is a `REG_QWORD` (64-bit) with the real adapter memory.
- Use it for AMD/Intel and as an NVIDIA cross-check when `nvidia-smi` is absent.

### AMD / Intel

- **VRAM**: registry `qwMemorySize` (Win) or `/sys/.../mem_info_vram_total` (Linux). Intel iGPU has
  no dedicated VRAM -> treat as shared-memory (cap usable at a fraction of system RAM).
- **Driver**: `DriverVersion` from enumeration; AMD Adrenalin / Intel Arc driver versions are
  recorded but not gated (Vulkan is broadly compatible).

### Apple Silicon

- Metal is always available on `arm64` macOS; no driver gating. `unifiedMemory` true; usable memory
  computed from system RAM.

---

## 4. Detection data model

```ts
type GpuVendor = "nvidia" | "amd" | "intel" | "apple" | "unknown";

interface GpuDevice {
  index: number;                 // ordinal (multi-GPU)
  name: string;                  // "NVIDIA GeForce RTX 4090"
  vendor: GpuVendor;
  vendorId?: string;             // PCI vendor id, e.g. "10DE"
  vramBytes?: number;            // accurate where possible; undefined if unknown
  unifiedMemory?: boolean;       // Apple Silicon
  driverVersion?: string;
  computeCapability?: string;    // NVIDIA "8.9"
  maxCudaVersion?: string;       // from nvidia-smi, e.g. "13.0"
  isIntegrated?: boolean;        // iGPU
  source: ("os" | "nvidia-smi" | "registry" | "system_profiler" | "lspci")[];
}

interface GpuProfile {
  os: "win32" | "darwin" | "linux";
  arch: string;
  devices: GpuDevice[];
  primary?: GpuDevice;           // the device we plan to use (most VRAM, discrete > iGPU)
  detectedAt: string;            // ISO; for cache invalidation
  warnings: string[];            // e.g. "VRAM could not be read accurately"
}
```

> This supersedes the flat `gpus: HardwareGpu[]` on `HardwareProfile`. `HardwareProfile.gpus`
> remains for display back-compat; `GpuProfile` is the richer structure the acceleration system uses.

---

## 5. Primary-GPU selection

For multi-GPU / hybrid (Optimus) machines:

1. Prefer **discrete** over integrated.
2. Among discrete, prefer the largest accurate `vramBytes`.
3. Prefer a vendor with a supported backend in the manifest.
4. Record the rest as selectable in Advanced (device override).

Laptops with NVIDIA Optimus + Intel iGPU: pick the NVIDIA dGPU; note that on battery the OS may park
it (see [03 §7](03-runtime-acceleration-and-fallback.md) power policy).

---

## 6. Capability -> backend decision (pure, testable)

A pure function maps a `GpuProfile` + the **available backends** (from the manifest) + the engine to
an ordered list of candidate backends (best first). This is the heart of "smart":

```ts
type Engine = "llama" | "whisper";
type Backend = "cuda-13.3" | "cuda-12.4" | "vulkan" | "metal" | "hip" | "sycl" | "cpu";

interface BackendCandidate {
  backend: Backend;
  reason: string;                 // plain-language "Best for your NVIDIA GPU"
  minDriver?: string;             // gate
  requires?: string[];            // e.g. ["cudart-12.4"]
  confidence: "high" | "medium" | "low";
}

function planBackends(profile: GpuProfile, engine: Engine, available: Backend[]): BackendCandidate[];
```

### Decision policy (default; manifest-overridable)

```text
Apple Silicon            -> [metal, cpu]                       (metal is built into macOS builds)
NVIDIA + driver OK:
  pick CUDA build by driver/maxCuda:
    maxCuda >= 13         -> [cuda-13.3, cuda-12.4, vulkan, cpu]
    12.4 <= maxCuda < 13  -> [cuda-12.4, vulkan, cpu]
    maxCuda < 12.4        -> [vulkan, cpu]
NVIDIA + driver too old   -> [vulkan, cpu]   (+ "Update your NVIDIA driver for best speed" tip)
AMD (discrete)            -> [vulkan, cpu]    (Linux advanced: hip before vulkan if ROCm present)
Intel Arc                 -> [vulkan, cpu]    (advanced: sycl)
Intel iGPU                -> [vulkan, cpu]    (low confidence; small models only)
unknown / VM / headless   -> [cpu]
```

CUDA driver gates (informational; the **probe** is the real gate):

| CUDA runtime build | Min NVIDIA driver (Windows) | Min driver (Linux) |
|---|---|---|
| `cuda-12.4` | >= 551.78 | >= 550.54 |
| `cuda-13.3` | >= 580.x | >= 580.x |

> Driver gating only **orders** candidates and produces tips. Activation is decided by the **probe**
> ([02 §5](02-backend-provisioning-and-rollback.md)), so a wrong gate never blocks a backend that
> actually works, and a passing gate never activates a backend that actually fails.

### Whisper backend mapping

- NVIDIA -> `cuda` (cuBLAS) whisper build if the manifest has it, else `cpu`.
- Others -> `cpu` initially (Vulkan whisper builds added to the manifest when validated).

---

## 7. Caching & re-detection triggers

- Persist the `GpuProfile` to `userData/runtime/gpu-profile.json`.
- Re-run detection when any of these change vs the cached profile:
  - GPU device set (name/vendorId), driver version, OS/arch, app version.
- Tier 1+2 detection budget: < 1.5 s total; runs off the app's hot path (after `ready`, async),
  never blocks the window.
- A manual **"Re-scan hardware"** action in Advanced forces fresh detection.

---

## 8. Edge cases

| Case | Handling |
|---|---|
| VRAM unreadable (registry + smi fail) | `vramBytes` undefined; offload uses a conservative floor; UI says "GPU memory unknown — using a safe amount". |
| Hybrid Optimus (laptop) | choose dGPU; on battery, optional auto-CPU ([03 §7](03-runtime-acceleration-and-fallback.md)). |
| Multiple GPUs | pick best; expose device override in Advanced. |
| eGPU (hot-plug) | re-detect on focus/setup open; treat like discrete. |
| VM / RDP / headless | usually no usable GPU -> CPU; never crash trying. |
| GPU present, driver missing | recommend Vulkan or CPU; tip: "Install your GPU driver to go faster". |
| `nvidia-smi`/PowerShell blocked by policy | fall back to registry/OS; mark low confidence. |

---

## 9. Outputs consumed downstream

- `GpuProfile` -> the **Decide** stage and the UX hardware card ([05](05-ux-setup-test-validate.md)).
- `BackendCandidate[]` per engine -> [02 Provisioning](02-backend-provisioning-and-rollback.md).
- VRAM + model size -> the offload plan ([03 §2](03-runtime-acceleration-and-fallback.md)).

See [04 Contracts](04-contracts-data-and-ipc.md) for the exact persisted shapes and IPC.
