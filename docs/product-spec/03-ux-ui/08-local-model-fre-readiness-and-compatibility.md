# 08 - Local Model FRE, Readiness & Hardware Compatibility

> **Status:** Product/UX + backend contract spec for review before implementation.
> **Audience:** Product, UX, frontend, Electron/backend, EDD authors.
> **Related:** [07 - Local model management](07-local-model-management.md),
> [B4/B5 Settings](04-floating-bar-overlays-and-settings.md),
> [10 - Providers & models](../04-architecture-and-delivery/backend/10-providers-and-models.md),
> [12 - Audio capture & OS integration](../04-architecture-and-delivery/backend/12-audio-capture-and-os-integration.md).

---

## 1. Purpose

Khonjel's local model experience must feel consumer-grade: a user should never need to understand
Whisper, GGUF, llama.cpp, runtimes, model folders, or hardware constraints before they can use local
dictation and local cleanup.

This spec defines the first-run experience (FRE), hardware compatibility detection, readiness
diagnostics, support copy, and seamless model switching needed to make local models understandable
and reliable.

The product promise:

> **Khonjel tells you what your computer can run, recommends the right local models, downloads and
> prepares them safely, and explains exactly what to do when local AI is not ready.**

---

## 2. Review & Critique of the Current Plan

The existing [07 - Local model management](07-local-model-management.md) is a solid install-state
spec: it defines model rows, download progress, verification, safe removal, storage accounting, and
the model service verbs. It should remain the underlying management contract.

However, it is intentionally minimal and is not enough for a consumer-grade setup experience.

### What the current spec gets right

- Keeps local model management close to the settings surfaces where model choices already live.
- Defines simple visible states: Available, Downloading, Installed, Failed.
- Requires integrity checks and resumable downloads.
- Recognizes `engineReady`, model storage, and safe removal.
- Avoids a complex "model manager" screen as the only path.

### What is missing

| Gap | Why it matters |
| --- | --- |
| No guided FRE | New users do not know they need both a speech model and a language model. |
| No hardware confidence | Users cannot tell whether a model is suitable, slow, unsupported, or impossible. |
| No readiness diagnosis | `Installed` is not the same as `Ready`; runtime missing/loading/failure needs plain-language explanation. |
| No clear support copy | Failure states need human next steps, not internal engine words. |
| No local/cloud privacy contrast at point of action | Users need to know when audio/text stays local vs goes to a provider. |
| No active-model/warm-switch model | Switching should not break the current working model while the next one loads. |
| Unsupported catalog entries are ambiguous | Parakeet/cloud entries can look downloadable/usable when they are not locally supported yet. |

### Improved direction

Keep the minimal model row management from [07](07-local-model-management.md), but add an explicit
**Local Model Setup** experience and a backend **readiness + compatibility** layer. The user should
see one recommended path first, with advanced model lists available after setup.

---

## 3. Product Requirements

### 3.1 User questions the system must answer

1. **Can this computer run local models?**
2. **Which model should I install?**
3. **What is happening right now?**
4. **Why is local AI not working?**
5. **What should I do next?**
6. **Am I using local/private mode or sending data to a provider?**

### 3.2 Required product outcomes

- A first-run user can get to a working local dictation test without reading docs.
- A user with limited hardware gets a smaller recommended model, not a confusing failure.
- A user with unsupported hardware/runtime sees an honest, actionable compatibility state.
- A user can switch local language models without losing the previous working model until the next
  one is ready.
- A user can distinguish:
  - installed vs ready,
  - model missing vs runtime missing,
  - download failed vs model corrupt,
  - local processing vs provider/cloud processing.
- Local model setup remains optional: cloud/provider setup is still available, but it is clearly
  labelled as off-device processing.

---

## 4. Consumer-Grade UX Principles

1. **One recommended path first.** Show a balanced local setup, then let advanced users expand.
2. **Plain language over engine vocabulary.** Say `Speech model` and `Language model`; use `Whisper`,
   `llama.cpp`, and `GGUF` only in technical details.
3. **Actionable status, never mystery status.** Every not-ready state has a reason and a next step.
4. **No fake readiness.** A model is not `Ready` unless the file, runtime, and selected slot can run.
5. **Privacy at the moment of choice.** Local rows say `Private - stays on this device`; provider rows
   say `Sends data to {provider/endpoint}`.
6. **Keep the last working path alive.** If switching models fails, continue using the previous model.
7. **Progress without babysitting.** Downloads and warm-up continue if Settings closes; status is
   visible from setup, settings, and the engine badge.
8. **Unsupported is a product state.** Do not hide all unsupported options; show them behind
   `Unavailable models` with exact reasons.

---

## 5. Information Architecture

### 5.1 New surface: Local Model Setup

Add a guided surface opened as a Settings modal sub-flow, not a new sidebar destination.

Entry points:

- First launch when no usable local speech or language model exists.
- Home empty state: `Set up local models`.
- Sidebar engine card when local mode is selected but not ready.
- Speech-to-Text settings readiness banner.
- Language Models settings readiness banner.
- Floating bar error when dictation fails due to missing/not-ready speech model.
- Chat badge or assistant error when local language model is missing/not-ready.

### 5.2 Existing Settings surfaces

Keep [07](07-local-model-management.md)'s inline model rows inside:

- Settings -> Speech-to-Text -> Local.
- Settings -> Language Models -> Local.

Enhance them with compatibility/readiness metadata and `Why not working` details.

---

## 6. First-Run Experience Flow

### Step 1 - Welcome

Purpose: set expectations.

Copy:

- Title: `Set up private local AI`
- Body: `Khonjel can turn speech into text and clean it up on this computer. Local models keep audio
  and text on this device.`
- Secondary: `You can also use your own cloud or enterprise provider instead.`

Actions:

- Primary: `Check this computer`
- Secondary: `Use a provider instead`
- Tertiary link: `Skip for now`

### Step 2 - Hardware Check

Show one friendly status and the details behind it.

Possible statuses:

| Status | Meaning | Example copy |
| --- | --- | --- |
| Great | Can run recommended local speech + language models comfortably. | `Great for local models.` |
| Good | Can run balanced/small models. | `Good for local models. Larger models may be slower.` |
| Limited | Can run small models only. | `Use smaller models for best performance.` |
| Not ready | Missing runtime, low disk, unsupported runtime, or unknown critical hardware. | `Local models need setup before they can run.` |
| Unknown | Detection failed but local mode may still work. | `We could not detect all hardware. You can still try a small model.` |

Details shown as checklist rows:

- Operating system.
- CPU.
- Memory.
- Free disk.
- GPU/VRAM if detected.
- Speech runtime.
- Language runtime.

Do not require GPU for local models. CPU mode is valid; the UI should only warn about speed.

### Step 3 - Recommended Local Setup

Recommend a pair:

- Speech model.
- Language model.

Default recommendation policy:

- Prefer **balanced/private** setup, not maximum quality.
- On low-spec devices, recommend smaller models first.
- If runtime is missing but downloadable, include it in the setup package.
- If a local setup is not viable, offer provider setup clearly.

Cards:

| Preset | Meaning |
| --- | --- |
| Fastest | smallest local models, best for older PCs. |
| Balanced | recommended default. |
| Best quality | larger models, only when hardware supports it. |
| Provider | off-device, needs API key/connection. |

Each card shows:

- Storage needed.
- Expected speed: `Fast`, `Good`, `May be slow`.
- Privacy label: `Local/private` or `Provider/off-device`.
- Compatibility: `Recommended`, `Works`, `Limited`, `Not supported`.

Primary action: `Download selected setup`.

### Step 4 - Download, Verify, Prepare

One progress stack for all required assets:

1. Runtime check/download.
2. Speech model download.
3. Language model download.
4. Integrity verification.
5. Local engine warm-up.

States:

- `Waiting`
- `Downloading`
- `Verifying`
- `Preparing`
- `Ready`
- `Needs attention`

The user may close the setup flow. Progress continues in the background.

### Step 5 - Test

Test speech:

- Prompt: `Say a short sentence.`
- Shows live transcript.
- Success: `Speech model works.`

Test language model:

- Run a tiny deterministic cleanup prompt.
- Success: `Language model works.`

Finish:

- `Ready for private dictation.`
- Button: `Start using Khonjel`.

---

## 7. Hardware Detection Requirements

### 7.1 Hardware profile

Add a hardware/readiness backend capability. It may be a separate `hardware` port or a `models.hardware()`
method. Prefer a separate `hardware` port if the data will be reused outside model setup.

```ts
interface HardwareProfile {
  os: "win32" | "darwin" | "linux";
  arch: string;
  cpuName?: string;
  physicalCores?: number;
  logicalCores?: number;
  totalRamBytes?: number;
  availableRamBytes?: number;
  freeDiskBytes?: number;
  gpus: HardwareGpu[];
  power: "plugged" | "battery" | "unknown";
  detectionWarnings: string[];
}

interface HardwareGpu {
  name: string;
  vendor: "nvidia" | "amd" | "intel" | "apple" | "unknown";
  vramBytes?: number;
  driverVersion?: string;
}
```

Windows detection should use native-free APIs where possible:

- Node `os` for architecture/cores/basic memory.
- `statfsSync` for disk.
- PowerShell/CIM for CPU/GPU friendly names and VRAM.
- Fail gracefully if PowerShell/CIM fails.

### 7.2 Runtime profile

```ts
interface RuntimeStatus {
  engine: "whisper" | "llama" | "parakeet";
  state: "ready" | "missing" | "downloadable" | "unsupported" | "failed";
  path?: string;
  version?: string;
  reason?: string;
  action?: RuntimeAction;
}
```

Runtime examples:

- Whisper ready: `Speech runtime ready.`
- Whisper missing: `Speech runtime missing. Khonjel can download it.`
- llama ready: `Language runtime ready.`
- Parakeet unsupported: `Parakeet local runtime is not bundled yet.`

---

## 8. Compatibility Scoring

### 8.1 Model metadata additions

Extend each local model manifest with user-facing requirements.

```ts
interface ModelRequirements {
  minRamBytes?: number;
  recommendedRamBytes?: number;
  minFreeDiskBytes: number;
  recommendedVramBytes?: number;
  cpuUsable: boolean;
  notes?: string[];
}

interface ModelManifest {
  engine: "whisper" | "parakeet" | "llama";
  fileName: string;
  sources: string[];
  bytes?: number;
  sha256?: string;
  requirements: ModelRequirements;
  support: "supported" | "experimental" | "not-yet-supported";
}
```

### 8.2 Compatibility result

```ts
type CompatibilityLevel = "recommended" | "works" | "limited" | "unsupported" | "unknown";

interface ModelCompatibility {
  modelId: string;
  level: CompatibilityLevel;
  summary: string;
  reasons: CompatibilityReason[];
  estimated: {
    speed: "fast" | "good" | "slow" | "unknown";
    firstLoad: "short" | "medium" | "long" | "unknown";
  };
}

interface CompatibilityReason {
  code:
    | "enough-memory"
    | "low-memory"
    | "not-enough-memory"
    | "enough-disk"
    | "not-enough-disk"
    | "gpu-available"
    | "cpu-only"
    | "runtime-ready"
    | "runtime-missing"
    | "runtime-unsupported"
    | "hardware-unknown";
  message: string;
  action?: string;
}
```

### 8.3 Compatibility copy examples

- `Recommended for this PC.`
- `Works on this PC, but responses may be slower.`
- `Not enough free disk space. Needs 2.0 GB; 900 MB available.`
- `Speech runtime missing. Download the runtime first.`
- `Not supported yet. Parakeet runtime is not bundled in this version.`
- `GPU not detected. CPU mode is available.`

---

## 9. Readiness Model

Install state is not enough. Add a runtime readiness layer.

```ts
type ModelReadinessState =
  | "not-installed"
  | "downloading"
  | "verifying"
  | "installed"
  | "runtime-missing"
  | "starting"
  | "ready"
  | "failed"
  | "unsupported";

interface ModelReadiness {
  modelId: string;
  state: ModelReadinessState;
  active: boolean;
  selected: boolean;
  previousActiveModelId?: string;
  reason?: string;
  nextAction?: ReadinessAction;
}
```

User-facing projection:

| Internal state | User text |
| --- | --- |
| `not-installed` | `Download needed` |
| `downloading` | `Downloading` |
| `verifying` | `Verifying download` |
| `installed` | `Installed` |
| `runtime-missing` | `Runtime missing` |
| `starting` | `Loading model` |
| `ready` | `Ready` |
| `failed` | `Needs attention` |
| `unsupported` | `Not supported yet` |

---

## 10. Seamless Model Switching

### 10.1 Current limitation

The current LLM runtime resolver scans for the first `.gguf` in model directories. A consumer-grade
model switch must respect the selected model id and should not drop the current working model while
the next one starts.

### 10.2 Target behavior

When the user selects an installed language model:

1. Persist selection immediately.
2. Start preparing the selected model in the background.
3. Keep the previous active model serving requests.
4. When the new model is ready, switch atomically.
5. If startup fails, keep the previous model and show:
   - `Could not switch to {model}. Still using {previousModel}.`

When the user selects an installed speech model:

1. Persist selection immediately.
2. Verify model file + runtime before next capture.
3. If not ready, the floating bar opens a fix path instead of failing late.

### 10.3 Backend API shape

```ts
interface ActiveModelReport {
  speech?: ActiveModelSlot;
  language?: ActiveModelSlot;
}

interface ActiveModelSlot {
  selectedModelId?: string;
  activeModelId?: string;
  state: "none" | "starting" | "ready" | "fallback" | "failed";
  message: string;
}

interface ModelManagementService {
  status(): Promise<ModelStatus[]>;
  compatibility(): Promise<ModelCompatibilityReport>;
  readiness(): Promise<ModelReadiness[]>;
  prepare(modelId: string): Promise<void>;
  active(): Promise<ActiveModelReport>;
  onRuntime(callback: (event: ModelRuntimeEvent) => void): () => void;
}
```

---

## 11. Settings UI Enhancements

### 11.1 Readiness panel

At the top of local sections:

- `Private local mode`
- `Speech model: Ready / Needs setup`
- `Language model: Ready / Needs setup`
- `Hardware: Good for balanced models`
- Primary action: `Fix setup` or `Set up local models`

### 11.2 Model rows

Each local model row should show:

- Model name.
- Size.
- Compatibility badge.
- Runtime/readiness badge.
- Privacy label.
- Current action.
- Expandable details: requirements, storage path, last verified, failure reason.

### 11.3 Unsupported/advanced models

Default list:

- Recommended + compatible models.

Disclosure:

- `Show unavailable and advanced models`.

Unavailable rows are disabled but educational:

- `Parakeet TDT 0.6B - Not supported yet. Runtime is not bundled in this version.`
- Cloud catalog entries should not appear in the local download list; they belong in provider mode.

---

## 12. Help, Tips & Support Copy

### 12.1 Inline tips

- `Local models keep audio and text on this computer.`
- `First use can take longer while the model loads.`
- `Larger models are smarter but use more memory and storage.`
- `If local setup is not ready, you can use a provider connection instead.`

### 12.2 Failure messages

| Condition | Message | Action |
| --- | --- | --- |
| No speech model | `Local dictation needs a speech model.` | `Download recommended` |
| No language model | `Local cleanup and chat need a language model.` | `Download recommended` |
| Runtime missing | `{Speech/Language} runtime is missing.` | `Install runtime` |
| Low disk | `Not enough free space. Needs {need}; {free} available.` | `Manage storage` |
| Low memory | `This model may be slow on this PC.` | `Use smaller model` |
| Corrupt file | `This model file looks incomplete.` | `Repair` |
| Provider mode | `This sends data to {provider}.` | `Review connection` |
| Unsupported | `This model is not supported in this version.` | `Choose another model` |

### 12.3 Support bundle, later

Future support action:

- `Copy local model diagnostics`

Contents should exclude transcripts, notes, prompts, API keys, and raw audio. Include only:

- OS/hardware summary.
- selected model ids.
- runtime status.
- install states.
- sanitized error codes.
- app version.

---

## 13. Privacy Requirements

- Every local setup path must explicitly say `stays on this device`.
- Every provider/cloud path must explicitly say `sends audio/text to your selected provider`.
- Selection transforms and note/chat actions should inherit the active local/provider privacy label.
- No telemetry is introduced by hardware detection.
- Hardware detection data stays local unless the user manually copies diagnostics.

---

## 14. EDD & Test Plan

### Browser EDD

- Fresh setup opens and renders hardware check with mock profile.
- Good hardware recommends balanced setup.
- Limited hardware recommends smaller setup.
- Unsupported runtime shows exact reason.
- Provider option is visible and labelled off-device.
- Unsupported models are behind disclosure and disabled.

### Electron EDD

- Fresh userData, no models: setup says local dictation needs a speech model.
- Seed model file, no runtime: row says runtime missing.
- Seed runtime + model: row says ready.
- Local model setup download flow reaches installed/ready with fake model source.
- Selecting a second LLM keeps previous active model until new model is ready.
- Failed model startup preserves previous model and shows fallback message.
- Hardware profile returns sane OS/RAM/disk/GPU fields without crashing on Windows.
- Low disk simulation blocks download before it starts.

### Unit tests

- Hardware compatibility scoring.
- Recommendation selection.
- Readiness reason generation.
- Runtime state machine.
- Active model switch success and failure.
- Unsupported model projection.
- Privacy label projection.

---

## 15. Implementation Phases

### Phase 1 - Pure compatibility engine

- Add model requirement metadata.
- Add hardware profile types.
- Add compatibility scoring and recommendation selection.
- Unit tests only.

### Phase 2 - Hardware service

- Add hardware IPC/port.
- Implement Windows native-free detection.
- Add mock profiles.
- Add Electron EDD for non-crashing hardware profile.

### Phase 3 - Readiness service

- Add readiness and active model report.
- Distinguish installed, runtime-ready, loading, ready, failed.
- Emit runtime events.

### Phase 4 - FRE UI

- Add setup flow.
- Add recommended setup cards.
- Add download/prepare/test flow.

### Phase 5 - Settings integration

- Add readiness panels.
- Upgrade local model rows with compatibility and why-not-working details.
- Move unsupported models behind disclosure.

### Phase 6 - Seamless switching

- Runtime resolves selected model id.
- Warm next model in background.
- Atomic switch when ready.
- Preserve previous active model on failure.

### Phase 7 - Full EDD gate

- Browser EDD.
- Electron EDD.
- Unit test coverage.
- Update coverage matrix once green.

---

## 16. Product Decisions for Review

Recommended defaults:

1. **Default recommendation:** balanced private local setup.
2. **Download action:** explicit user click; do not auto-download large files.
3. **Provider setup:** equal escape hatch, but clearly labelled off-device.
4. **Unsupported models:** hidden behind `Show unavailable and advanced models`.
5. **Portable package:** keep small; download models/runtimes after install.

Decisions needed before implementation:

- Should runtimes download automatically as part of model setup, or require their own explicit line?
- Should the FRE be mandatory on first launch or dismissible forever?
- Should low-memory compatible models be labelled `Works, slower` or excluded from recommendations?
- Should cloud/provider mode appear in the same setup flow or as a separate path?
- Should model readiness appear in the sidebar engine card at all times or only when not ready?

---

## 17. Acceptance Criteria

This feature is complete when:

- Fresh users see a clear local model setup path.
- Hardware compatibility is detected and explained in plain language.
- Recommended speech + language models are selected based on device capability.
- Local model rows show compatibility, readiness, and privacy labels.
- Unsupported models cannot be mistaken for available local downloads.
- Switching language models does not break the current active model during warm-up.
- Every not-working state has a reason and next action.
- Browser and Electron EDD loops cover setup, readiness, compatibility, and switching.
- No telemetry, account, or network call is introduced by hardware detection.