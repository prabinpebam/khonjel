# 07 — Local model management (UX spec)

> **What this is.** The complete UX + state contract for **managing on-device model assets** —
> downloading them, knowing when one is *truly* installed, recovering from a failed download,
> deleting them, and seeing where the disk goes. It builds directly on what already exists and names
> the precise gaps it closes.
>
> **Scope.** On-device (`Local` mode) assets only: STT weights (whisper.cpp `ggml-*.bin`, sherpa
> Parakeet), LLM weights (`*.gguf`), and the **engine runtimes** they need (`llama-server`,
> `whisper-cli`). Cloud / Providers / Self-Hosted / Enterprise models carry no download or storage
> and are out of scope here (see [10 — Providers & models](../04-architecture-and-delivery/backend/10-providers-and-models.md)).
>
> **Read with.** [08 §3.6 `ModelCatalogService`](../04-architecture-and-delivery/backend/08-ipc-and-ports-contracts.md),
> [09 §2–3 Data & storage](../04-architecture-and-delivery/backend/09-data-and-storage.md),
> [04 B4/B5/B7 Settings](04-floating-bar-overlays-and-settings.md), and the design-system
> intent (P1–P13) in [design-system/01-intent.md](design-system/01-intent.md).
>
> **Design stance — minimal footprint.** No new screen and no new vocabulary. Management lives
> **inside the model list that already exists** in Settings ▸ Speech-to-Text / Language Models. The
> user ever sees **four states** (Available · Downloading · Installed · Failed) and **one action** per
> model (Download · Cancel · Remove · Retry). Everything that makes it robust — integrity checks,
> resume, queueing, verification — runs **invisibly**, surfacing only when the user must decide
> something (a hard failure, or not enough disk).

---

## 1. What exists today, and the gap

| Concern | Today | File(s) | Gap this spec closes |
|---|---|---|---|
| **Catalog** | Static list: `id, name, sizeLabel, recommended` | [`catalog.ts`](../../../app/electron/main/models/catalog.ts), [`ModelInfo`](../../../app/src/services/ports/types.ts) | No install state, exact bytes, path, checksum, or source URL |
| **Download** | Out-of-band CLI scripts; `.part` temp → atomic rename; %→stderr; idempotent (skip if size>0) | [`fetch-llama.mjs`](../../../app/scripts/fetch-llama.mjs), [`fetch-whisper.mjs`](../../../app/scripts/fetch-whisper.mjs) | No in-app download, no progress events, no resume |
| **"Is it installed?"** | Heuristic: *first* `*.gguf` / `ggml-*.bin` found; LLM also `size>0` | [`inference/runtime.ts`](../../../app/electron/main/inference/runtime.ts), [`stt/runtime.ts`](../../../app/electron/main/stt/runtime.ts) | No id-precise resolution, no integrity (size/sha256) check; a truncated file looks "present" |
| **Errors** | Script prints and `exit(1)` | scripts | No in-app recovery, no resume |
| **Delete** | Manual file deletion / "Clear cache" (whole folder) | [04 B7](04-floating-bar-overlays-and-settings.md) | No per-model remove, no active-model safety, no freed-space feedback |
| **Storage** | "Model cache" path with Open + Clear cache | [09 §2](../04-architecture-and-delivery/backend/09-data-and-storage.md), [04 B7](04-floating-bar-overlays-and-settings.md) | No used-by-models / free-space number |
| **Contract** | `ModelCatalogService` (list/download/cancel/discover/hardware/cachePath/clearCache) **declared**, partially wired (`content.sttModels/llmModels` return the static list) | [08 §3.6](../04-architecture-and-delivery/backend/08-ipc-and-ports-contracts.md) | Not implemented end to end; missing status/verify/remove/storage |
| **State store** | `model_cache` table **defined** (not yet used); models scanned from disk | [09 §3](../04-architecture-and-delivery/backend/09-data-and-storage.md) | No durable per-asset install record |

**One-line problem statement.** The app can *use* a local model if a matching file happens to be on
disk, but it cannot **acquire, verify, repair, or remove** one, and it cannot tell the user **what is
installed, how far a download got, why it failed, or how much disk it costs.**

---

## 2. What the user sees — four states, one action each

The user never learns a vocabulary. A local model is in exactly one of **four visible states**, each
with a single obvious action:

| Visible state | Looks like | The one action |
|---|---|---|
| **Available** | name · size | **Download** |
| **Downloading** | thin progress bar · `289 / 466 MB` | **Cancel** |
| **Installed** | name · `✓` (· `In use`) | **Remove** (inside a `⋯` menu) |
| **Failed** | one plain line — *"Couldn't finish — we'll retry."* | **Retry** |

That is the whole surface. Selecting a model is just picking the row you already pick today; choosing
an **Available** one downloads it in place and selects it when done.

> **Mechanics, not UI.** Under the hood the downloader runs a fuller lifecycle
> (`queued → downloading → verifying → installed`, plus `paused` on a dropped link and `removing`
> during delete). None of that reaches the user: *queued* and *verifying* both read as
> **Downloading…**, *paused* **auto-resumes**, and only the four states above are ever shown. Engine
> runtimes are the same — a model that needs one it lacks just reads **Downloading…** while the engine
> is fetched first; there is no separate engine row.

---

## 3. "Fully downloaded?" — integrity, kept invisible

This is the core robustness fix, and the user never sees it work. Presence on disk is **not** proof
of completeness. An asset is `installed` **only** when all of the following hold, recorded in the
state index (§7):

1. The canonical file exists at its id-derived path (no `.part` suffix).
2. `size(file) === manifest.bytes` (exact, not just `> 0`).
3. `sha256(file) === manifest.sha256` (verified once at install; `verifiedAt` stored).

**Catalog manifest (new fields).** Each catalog entry gains the data needed to verify and fetch:

```ts
interface ModelManifest {
  id: string;                 // stable id (== current catalog id)
  kind: "stt" | "llm";
  engine: "whisper" | "parakeet" | "llama";   // which runtime it needs
  bytes: number;              // EXACT expected size
  sha256: string;             // expected digest of the final file
  sources: string[];          // ordered mirrors; sources[0] == the script URL today
  fileName: string;           // canonical on-disk name (e.g. "ggml-small.bin", "qwen2.5-….gguf")
  minDiskBytes?: number;      // bytes needed during install (file + .part headroom)
}
```

> The first `sources[]` entry is exactly the URL the scripts already use (Hugging Face / llama.cpp
> releases), so the in-app downloader and the CLI scripts pull the **same bytes** from the **same
> place**. `bytes`/`sha256` are filled from the model cards referenced in
> [10 §5–6](../04-architecture-and-delivery/backend/10-providers-and-models.md) and pinned at build.

**Download → verify → install (atomic, resumable).** Stream to `<fileName>.part`; resume an
interrupted part-file with an **HTTP Range** request instead of restarting (the scripts restart from
zero today); on byte-complete check size then stream-hash `sha256`; on match, `fsync` + **atomic
rename** `.part → final` (the scripts' `renameSync` pattern) and record `installed`.

**Startup reconcile (cheap, then thorough).** On boot, a fast pass marks assets `installed` when
file-exists + size matches (no hashing — instant). A full `sha256` re-check runs in the background
(and on demand via `⋯ ▸ Re-verify`); a file that fails it is **silently re-downloaded** (the §4
*"looks incomplete"* line), never left half-trusted. This replaces the "first file found" heuristic
in the runtime resolvers with an **id-addressed, integrity-checked** lookup.

---

## 4. When a download fails — one line, one button

Failures are **quiet and self-healing first**. A dropped connection or timeout **resumes
automatically** (HTTP Range from where it stopped) behind a soft *"Reconnecting…"* — no button, no
modal. Only a failure the user must act on becomes visible, as **one plain sentence + one button**:

| What the user sees | When | The button |
|---|---|---|
| *"Not enough space — needs 1.5 GB, 0.9 GB free."* | disk full / pre-flight check | **Manage storage** (→ B7) |
| *"Couldn't finish downloading. Try again?"* | repeated network / source failure | **Retry** |
| *"This file looks incomplete — re-downloading."* | size / checksum mismatch (automatic) | *(none; self-repairs)* |

A failed or removed model **never** silently breaks dictation: the slot keeps its previous working
model (or the deterministic fallback) and the [model badge](02-app-shell-and-layout.md) reflects the
state (§8). Raw errors live only in logs (`Copy diagnostics` in B7), never on screen.

> Internally the downloader still distinguishes `offline / source-unavailable / disk-full /
> checksum-mismatch / corrupt / permission` — for the right auto-recovery (retry with backoff, next
> mirror, re-download) and for logs. The user sees only the three rows above.

---

## 5. The one surface — the existing model list (no new screen)

There is **no dedicated model-manager screen.** Management is the model list **already present** in
the **Local** config of [B4 Speech-to-Text](04-floating-bar-overlays-and-settings.md) and
[B5 Language Models](04-floating-bar-overlays-and-settings.md). Each row gains a state and a single
action; nothing else on the screen moves:

- `Whisper Small — 466 MB` · **✓ Installed · In use** · `⋯`
- `Whisper Base — 142 MB` · **✓ Installed** · `⋯`
- `Whisper Large v3 Turbo — 1.5 GB` · downloading `289 / 466 MB` · **Cancel**
- `Parakeet TDT 0.6B — 0.6 GB` · **Download**

- **Pick to use.** Choosing an **Installed** row binds it to the slot — the selection that exists
  today. Choosing an **Available** row downloads it inline, then selects it on success.
- **One small menu.** The `⋯` on an installed row is the *only* secondary surface, with three items:
  **Remove**, **Re-verify**, **Open folder**. No toolbar, no bulk actions, no separate dialog.
- **Recommended first.** The recommended model sorts to the top and is the default in onboarding
  ([03 step 2](03-screen-specifications.md)).
- **Engines are invisible.** A model that needs a runtime it lacks just reads **Downloading…** while
  the engine is fetched first; there is no separate engine row.
- **Empty state.** No model yet → the list shows the one recommended model with **Download** and a
  quiet *"Use a cloud provider instead"* link. Offline with nothing installed → **Download** is
  disabled with *"Connect to the internet to download."*
- **You don't have to watch it.** Downloads run in the background, keep going when Settings closes,
  and resume after a restart; live progress also shows on the
  [model badge](02-app-shell-and-layout.md).

---

## 6. Storage & delete (reuse what's there)

- **One number, where it already lives.** The existing **B7 ▸ Data Management ▸ Model cache** row
  gains a single summary — *"Models — 3.1 GB used · 58 GB free"* — beside the current **Open** and
  **Clear cache**. No new panel, no per-model table.
- **Delete is per-row.** `⋯ ▸ Remove` on an installed model deletes its file and reports the space
  freed (*"Removed · 466 MB free"*). If it's in use, a one-line confirm names the slot and its
  fallback first (§8).
- **Pre-flight, not post-mortem.** Free space is checked before a download starts; if it won't fit,
  the row shows *"Needs 1.5 GB, 0.9 GB free"* instead of starting (the §4 disk-full line).
- **Self-tidying.** Orphaned part-files from cancelled/failed downloads are cleaned up
  automatically; **Clear cache** stays the single "remove everything" escape hatch. The canonical
  location is `<userData>/models` (+ `<userData>/runtime`), per
  [09 §2](../04-architecture-and-delivery/backend/09-data-and-storage.md).

---

## 7. Contract & data additions (build on what's declared)

**Extend `ModelInfo` → `ModelStatus`** (the picker binds to this; `ModelInfo` stays the catalog shape
it is today):

```ts
type InstallState =
  | "not-installed" | "queued" | "downloading" | "paused"
  | "verifying" | "installed" | "error" | "removing";

interface ModelStatus extends ModelInfo {   // ModelInfo = id, name, sizeLabel, recommended (unchanged)
  kind: "stt" | "llm";
  state: InstallState;          // internal; UI projects it to Available/Downloading/Installed/Failed
  bytesDone?: number;           // downloading — drives the only progress text ("289 / 466 MB")
  bytesTotal?: number;          // == manifest.bytes
  engineReady: boolean;         // its runtime is installed
  error?: { code: ErrorCode; message: string };  // message = the one user line; code = logs only
  installedBytes?: number;      // on-disk size when installed
  verifiedAt?: string;          // ISO; last successful sha256 check
  inUseBySlots?: SlotId[];      // for the "In use" tag + remove-safety
}
```

**Extend `ModelCatalogService`** ([08 §3.6](../04-architecture-and-delivery/backend/08-ipc-and-ports-contracts.md)
already declares `list/download/cancelDownload/discover/hardware/cachePath/clearCache` + the
`models:progress` event — keep those; add four management verbs):

```ts
interface ModelCatalogService {
  // existing (08 §3.6)
  list(kind: "stt"|"llm"): Promise<ModelInfo[]>;            // models:list
  download(modelId: string): Promise<{ handle: string }>;   // models:download (+ models:progress evt)
  cancelDownload(handle: string): Promise<void>;            // models:cancel  (the Cancel button)
  discover(endpoint: string): Promise<ModelInfo[]>;         // models:discover
  hardware(): Promise<HardwareProfile>;                     // models:hardware
  cachePath(): Promise<string>; clearCache(): Promise<void>;// models:cachePath / :clearCache

  // NEW — management (the UI binds only these four)
  status(): Promise<ModelStatus[]>;                         // models:status  (all assets + state)
  verify(modelId: string): Promise<{ ok: boolean }>;        // models:verify  (⋯ ▸ Re-verify; also runs in bg)
  remove(modelId: string): Promise<{ freedBytes: number }>; // models:remove  (⋯ ▸ Remove)
  storage(): Promise<StorageReport>;                        // models:storage (the one summary line)
}
// resume (HTTP Range after a dropped link), queueing, and .part/orphan cleanup are INTERNAL +
// automatic — they are mechanics, not user controls.

interface StorageReport {
  cachePath: string;          // the existing <userData>/models (+ /runtime)
  usedBytes: number;          // Σ installed assets — the "X used" in the summary line
  freeBytes: number;          // free on the volume — the "Y free" + the pre-flight check
}
```

**Events** (high-rate over the existing `models:progress` channel per
[08 §2](../04-architecture-and-delivery/backend/08-ipc-and-ports-contracts.md) streaming rule):
`{ id, state, bytesDone, bytesTotal }` throttled to ~5/s; a terminal
`{ id, state: "installed" | "error", error? }` on completion.

**State index (durable).** The per-asset record lands in the **`model_cache`** table already defined
in [09 §3](../04-architecture-and-delivery/backend/09-data-and-storage.md) — extended with the fields
this spec needs: `state`, `bytes_total`, `bytes_done`, `sha256`, `source_url`, `error_code`,
`verified_at`. Until SQLite lands (it's Phase 4), this state lives in a **native-free
`<userData>/models/index.json`**, consistent with the settings-as-JSON decision in
[09 §4](../04-architecture-and-delivery/backend/09-data-and-storage.md) (works identically in the
Node test lane, dev, and packaged app — no `better-sqlite3` rebuild). The shape is the same either
way; the JSON file is the interim home and migrates into `model_cache` later.

**Resolver change.** [`inference/runtime.ts`](../../../app/electron/main/inference/runtime.ts) and
[`stt/runtime.ts`](../../../app/electron/main/stt/runtime.ts) stop using "first `*.gguf` /
`ggml-*.bin` found" and instead resolve the **slot-selected id** through the index, accepting only an
`installed` asset (and its `installed` engine). Env overrides (`KHONJEL_LLM_MODEL`,
`KHONJEL_WHISPER_MODEL`, …) and the read-only dev `vendor/` location remain valid fallbacks.

---

## 8. Selection safety (the invariants behind the simple UI)

The simple surface (§5) rests on three rules in [`inference.tsx`](../../../app/src/surfaces/settings/inference.tsx)
(`InferenceConfigBlock`), which today lists every catalog entry as freely selectable:

- **Only installed models are selectable.** Choosing an **Available** one downloads first and binds
  on success; cancelling keeps the prior selection. Cloud / Providers / Self-Hosted entries are
  unaffected (no local asset).
- **A slot never points at a missing or bad model.** If its model is removed or fails verification,
  the slot falls back to the recommended installed model, else the deterministic stub /
  `model_unavailable` — exactly how the runtime degrades today — and the badge says why.
- **Remove is safe.** Removing an in-use model first shows a one-line confirm naming the slot and its
  fallback, then re-points it.

---

## 9. Accessibility & design-system

- Each row's action has a state-aware accessible name (`Download Whisper Small, 466 megabytes`;
  `Cancel download, 62 percent`). Progress is a `role="progressbar"` with `aria-valuenow/min/max`.
- A polite live region announces only terminal changes (`Whisper Small installed`; `download
  failed`) — never per-percent.
- Icon **and** text for every state (colour is never the only signal); all values are
  tokens/variants per the [design-system gate](design-system/01-intent.md) and `lint:ds`.

---

## 10. EDD coverage (gates this feature)

Real-Electron scenarios under [`app/eval/`](../../../app/eval/), in the style of the existing
[`electron-seam`](../../../app/eval/scenarios/electron-seam.eval.electron.mjs) / capture evals:

| # | User-can | Asserts |
|---|---|---|
| M1 | Download the recommended model and see it become usable | progress events advance; terminal `installed`; the row becomes selectable; the slot binds |
| M2 | A truncated/altered file is caught | seed a wrong-size/sha file → background verify flags it; it **auto re-downloads** to `installed`; the slot never binds a bad file |
| M3 | A dropped connection resumes, not restarts | kill the stream mid-download → it shows *Reconnecting…*; resume issues a **Range** request from `bytesDone`; final `sha256` matches |
| M4 | Delete frees space and is safe | `remove()` returns `freedBytes`; `storage().usedBytes` drops; an in-use model confirms and re-points its slot |
| M5 | Disk pressure is honest | simulate `ENOSPC`/low free → the row shows *needs/free* and won't start; the failure line offers **Manage storage** (B7) |

Detector additions to [`detectors.mjs`](../../../app/eval/recorder/detectors.mjs):
`MODEL_PARTIAL_SELECTABLE` (critical — a non-`installed` asset offered as usable),
`MODEL_PROGRESS_STALLED` (warning — `downloading` with no byte movement past a window),
`STORAGE_FREE_UNKNOWN` (warning — the storage summary can't read free space).

---

## 11. Build plan (incremental, on top of current code)

1. **Manifest + index.** Add `bytes/sha256/sources/fileName/engine` to the catalog
   ([`catalog.ts`](../../../app/electron/main/models/catalog.ts)); introduce `<userData>/models/index.json`
   and the startup reconcile. *No UI yet; resolvers start reading the index.*
2. **In-app downloader.** Lift the proven download/extract/rename logic out of
   [`fetch-llama.mjs`](../../../app/scripts/fetch-llama.mjs) / [`fetch-whisper.mjs`](../../../app/scripts/fetch-whisper.mjs)
   into a main-process service with **Range resume**, `sha256` verify, and `models:progress` events.
   Public verbs: `status / download / cancel / verify / remove / storage` (resume + tidy are internal).
3. **Inline UI (no new screen).** Add the per-row state + action to the **existing** B4/B5 model list
   (§5) and the one storage line to B7 (§6); the badge already reflects progress.
4. **Picker coupling.** Gate selection on `installed`, add inline download, add remove-safety (§8).
5. **EDD.** Land M1–M5 + detectors; mark the capability `Implemented` in the
   [coverage matrix](../04-architecture-and-delivery/backend/07-feature-coverage-matrix.md) only when green.

The CLI scripts stay as the **developer** path and as the source-of-truth for URLs; the in-app
downloader and the scripts converge on the same files, sources, and atomic-rename guarantees — so a
model fetched either way is byte-identical and recognised by the same id-addressed reconcile.
