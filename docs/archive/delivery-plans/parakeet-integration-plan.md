# Parakeet Integration — No-Compromise Plan

> **Status:** Implemented (phases P1-P7), CPU-first + TDD/EDD. Two deliberate scope notes: the warm
> websocket transport ships behind a one-shot-CLI fallback and needs validation against a pinned
> sherpa build (§2.1); GPU support ships as the `--provider=cuda` gate (§6) with the acceleration-card
> UI integration tracked as the low-priority follow-up. Real transcription needs the fetched binary +
> 640 MB model (`npm run fetch:parakeet`); all logic/seam/UX is BE1- + EDD-tested.
> **Audience:** Electron/backend engineers, frontend engineers, EDD authors.
> **Goal:** Make **NVIDIA Parakeet** a real, first-class local speech-to-text engine in Khonjel —
> not a greyed-out placeholder — with the same privacy, reliability, and EDD discipline as the
> existing whisper.cpp engine, and with optional GPU acceleration that plugs into the
> [GPU acceleration system](gpu-acceleration/README.md).

---

## 1. Why Parakeet is unavailable today (the gap to close)

Parakeet is a **hardcoded placeholder**, not a feature that failed to load. Three stubs gate it:

1. **No download source.** [models/catalog.ts](../../../app/electron/main/models/catalog.ts) lists
   `sherpa-onnx-nemo-parakeet-tdt-0.6b-v3` with `sources: []` — nothing to fetch, so the UI shows
   **Unavailable**.
2. **Runtime pinned to "unsupported".** [main.ts `runtimeStatuses()`](../../../app/electron/main/main.ts)
   returns `{ engine: "parakeet", state: "unsupported", message: "Parakeet local runtime is not
   bundled yet." }` unconditionally (whisper/llama check `engineReady(...)`; parakeet never does).
3. **Compatibility marks it "not-yet-supported".**
   [models/compatibility.ts](../../../app/electron/main/models/compatibility.ts) `REQUIREMENTS`.

Closing the gap means: pick a runtime that fits Khonjel's architecture, ship/download it + the model,
wire an engine-agnostic transcriber, flip the three stubs, and prove it end-to-end with EDD.

---

## 2. The runtime decision: sherpa-onnx (offline NeMo transducer)

Parakeet's reference runtime is **NVIDIA NeMo** (a heavy Python/PyTorch/CUDA stack). That does **not**
fit Khonjel's "spawn a standalone binary as a child process" model (the same reason `better-sqlite3`
was avoided). The catalog id (`sherpa-onnx-nemo-parakeet-...`) already encodes the right answer:

**[sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx)** (k2-fsa / "Next-gen Kaldi"):

- Runs Parakeet via **ONNX Runtime** — no Python, no PyTorch.
- Ships a **standalone CLI binary** `sherpa-onnx-offline` (Windows: `sherpa-onnx-offline.exe`) —
  exactly like `whisper-cli` and `llama-server`. **Zero native ABI rebuild.**
- Provides **pre-exported ONNX models** for Parakeet TDT v2 (English) and **v3 (25 European
  languages)** as GitHub release assets — no conversion needed.
- Supports **CPU and CUDA** via the onnxruntime provider flag (`--provider=cpu|cuda`) — so GPU
  acceleration reuses the [GPU acceleration](gpu-acceleration/README.md) machinery.
- Apache-2.0 tooling; the v2/v3 models are **CC-BY-4.0** (commercial use OK).
- Fast on CPU: int8 is comfortably real-time (RTF well below 1.0) — k2-fsa's own tests show ~0.12 for
  v2 and ~0.33 for v3 (multi-thread, modern CPU); GPU is faster still but rarely necessary.

> **Decision:** integrate Parakeet as a **new local STT engine backed by sherpa-onnx**, mirroring the
> existing local engines. NeMo and the cloud Riva API are explicit non-goals (below).

### 2.1 Keep the model warm (the latency decision — this is the "no compromise" part)

The naive integration — spawn `sherpa-onnx-offline` once per utterance, like `whisper-cli` — has a
hidden cost: the model (a ~620 MB encoder) is **reloaded from disk on every call**. sherpa's own logs
show ~0.8–1 s just to *create the recognizer* before any audio is processed. For push-to-talk
dictation that adds ~1 s of dead latency to **every phrase** — a real compromise.

Khonjel already solved exactly this for the LLM by running a **persistent `llama-server`** (model
resident; talk to it over loopback). Parakeet gets the same treatment:

- **Primary (dictation): a persistent sherpa server.** Spawn `sherpa-onnx-offline-websocket-server`
  (shipped in the same archive) once with the model args + `--port`; it loads the model **once** and
  serves many requests over a **loopback** websocket. Per-utterance latency drops to the model's RTF
  (tens of ms), not a full reload — same zero-trust posture as `llama-server` (127.0.0.1 only, never
  exposed). _(Alternative: the sherpa-onnx Node addon keeps the model warm in-process but reintroduces
  a native module — the dual-ABI risk Khonjel deliberately avoids; the server keeps the engine a
  standalone process.)_
- **Fallback (non-interactive): the one-shot CLI.** For uploads / batch / a single transcription where
  warm-up does not matter, `sherpa-onnx-offline <wav>` is simpler — and is the easiest thing to ship in
  P1 before the server is wired.

> The persistent server is what makes Parakeet feel **instant**; the one-shot CLI is the simple
> stepping stone. Both yield the **same JSON result**, so the wrapper/parser is shared.

### 2.2 Architecture fit (mirrors the proven llama-server / whisper paths)

```text
renderer mic --16kHz mono PCM16 WAV (base64)--> transcription:transcribe (IPC)
  main TranscriptionService -> resolveTranscriber() (thunk: pick engine from the selected model) ->
     whisper:  whisper-cli  -m ggml-*.bin  -f wav                              (one-shot, today)
     parakeet: persistent sherpa websocket server (model resident) <- audio   (NEW, warm)
               [fallback] sherpa-onnx-offline --encoder/--decoder/--joiner/--tokens <wav>
  -> parse JSON {text} -> renderer
```

The renderer already emits **16 kHz mono 16-bit PCM WAV** (`src/lib/audio/wav.ts`), which sherpa
accepts directly (single-channel 16-bit; it resamples internally). **No capture changes are required.**

---

## 3. What we ship: binary + model

### 3.1 The engine binary (`sherpa-onnx-offline`)

- Prebuilt binaries are published per release on
  [k2-fsa/sherpa-onnx releases](https://github.com/k2-fsa/sherpa-onnx/releases) (pin a version, e.g.
  `v1.13.3`), with **separate CPU and CUDA** archives per platform:
  - Windows x64 CPU + Windows x64 CUDA
  - Linux x64 CPU + CUDA
  - macOS arm64/x64 (CPU; Apple uses CoreML/CPU EP)
- Layout: the executable(s) + onnxruntime shared lib(s); the **same archive ships every `sherpa-onnx-*`
  binary** (incl. `sherpa-onnx-offline` and `sherpa-onnx-offline-websocket-server`). On Windows they
  are commonly under a `bin/` (historically `Release/`) folder — the resolver supports both, like
  whisper.
- A `scripts/fetch-parakeet.mjs` downloads + extracts the binary into `app/vendor/parakeet/`
  (git-ignored), exactly like `fetch-whisper.mjs`.

### 3.2 The model (multiple ONNX files — downloaded individually, no archive extraction)

The one structural difference from whisper/llama: a Parakeet model is **not** a single file — it is a
directory of ONNX parts + tokens. GitHub publishes it as one `.tar.bz2`, but **Hugging Face hosts the
same files individually** (k2-fsa's `csukuangfj*` repos). Khonjel should download the **individual
files** — this sidesteps in-app archive extraction entirely (Node has no native bzip2/tar) and reuses
the existing single-file, resumable, sha256-verified downloader, once per part:

| Model id | Languages | Files (each sha256-pinned) | Total |
|---|---|---|---|
| `...parakeet-tdt-0.6b-v3-int8` | **25 EU languages** | `encoder.int8.onnx` (~622M), `decoder.int8.onnx` (~12M), `joiner.int8.onnx` (~6M), `tokens.txt` (~92K) | ~640 MB |
| `...parakeet-tdt-0.6b-v2-int8` | English | same shape | ~640 MB |

- Per-file source: the Hugging Face model repo
  (`https://huggingface.co/csukuangfj/<repo>/resolve/main/<file>`), with the GitHub `.tar.bz2` as a
  convenience bundle used **only** by the build-time `fetch-parakeet.mjs` (where a real `tar`/extractor
  is available).
- **int8 is the default** (smallest, fast, negligible WER loss); fp16/fp32 are later options for GPU.
- **v3 (multilingual)** is the recommended default, matching the UI's "Parakeet TDT 0.6B v3" entry.

> **Data-layer change:** a catalog model becomes a **set of files** that land in a per-model directory
> (the engine points `--encoder/--decoder/--joiner/--tokens` at them), and readiness = all files
> present + verified. No new extraction dependency and no new archive format in the runtime path —
> only "a model can have more than one file".

---

## 4. The exact CLI + output contract

### Spawn (PURE arg builder, BE1-tested)

```bash
sherpa-onnx-offline \
  --encoder=<dir>/encoder.int8.onnx \
  --decoder=<dir>/decoder.int8.onnx \
  --joiner=<dir>/joiner.int8.onnx \
  --tokens=<dir>/tokens.txt \
  --model-type=nemo_transducer \
  --num-threads=<N> \
  --provider=cpu \            # or "cuda" when a GPU provider is provisioned
  <audio.wav>
```

### Output (a JSON object per utterance)

```json
{"lang":"","emotion":"","event":"","text":" Ask not what your country can do for you, ...","timestamps":[...],"tokens":[...],"words":[]}
```

- The **websocket server** returns this JSON directly per request. The **one-shot CLI** prints it as
  one line amid config/log lines, so `parseSherpaText` must locate the line that `JSON.parse`s to an
  object with a `text` field (not "the last line").
- The transcript is `json.text` (trim leading space).
- `timestamps` (word/token) are available for future features (subtitles, highlighting); not needed
  for dictation.
- Decoding defaults to `greedy_search`; punctuation + casing are built in (no post-clean needed,
  though Khonjel's dictation cleanup still applies downstream).

---

## 5. Code changes (files to touch)

### 5.1 New: the Parakeet wrapper (mirror `stt/whisper.ts`)

`app/electron/main/stt/parakeet.ts` — **PURE** arg builders + JSON parser + injected-runner transcribers
(the one-shot CLI and the warm server share the same parse + `Transcriber` shape):

```ts
export interface ParakeetModelDir { encoder: string; decoder: string; joiner: string; tokens: string; }

export interface SherpaArgsOptions { model: ParakeetModelDir; audioPath: string; numThreads?: number; provider?: "cpu" | "cuda"; }

/** PURE: the one-shot `sherpa-onnx-offline` argv. */
export function buildSherpaArgs(opts: SherpaArgsOptions): string[];

/** PURE: the `sherpa-onnx-offline-websocket-server` argv (model + --port, no audio). */
export function buildSherpaServerArgs(o: { model: ParakeetModelDir; port: number; numThreads?: number; provider?: "cpu" | "cuda" }): string[];

/** PURE: extract the transcript from a sherpa result/stdout (the JSON object that has a `text` field). */
export function parseSherpaText(out: string): string;

/** Same Transcriber shape as whisper.ts. One-shot (reloads the model) — the P1 stepping stone. */
export function createParakeetTranscriber(o: { binPath: string; model: ParakeetModelDir; run: RunCommand; numThreads?: number; provider?: "cpu" | "cuda" }): Transcriber;
```

`Transcriber` is the **existing** interface from `stt/whisper.ts` (`transcribe(audioPath, opts)`), so
nothing downstream changes. The **warm** transcriber (the persistent server client) lives in §5.2 and
implements the same `Transcriber`.

### 5.2 New: the Parakeet runtime resolver (mirror `stt/runtime.ts`)

`app/electron/main/stt/parakeet-runtime.ts` — finds the binary + the model directory and returns a
`Transcriber | undefined`, preferring the **warm server** and falling back to the one-shot CLI:

```ts
export function resolveParakeetTranscriber(cfg: {
  userDataDir: string; appDir: string; isWindows: boolean; env: Record<string,string|undefined>;
  provider?: "cpu" | "cuda";
}): Transcriber | undefined;
// binary:  KHONJEL_SHERPA_BIN | <userData>/runtime/parakeet[/bin] | <appDir>/vendor/parakeet[/bin]
// model:   KHONJEL_PARAKEET_MODEL_DIR | <models>/<parakeet-model-id>/ holding
//          encoder.*.onnx + decoder.*.onnx + joiner.*.onnx + tokens.txt
// runtime: prefer the persistent `sherpa-onnx-offline-websocket-server` (spawn once on a loopback
//          port, model resident; lazy-start on first transcribe, reaped on quit). If only the
//          one-shot binary is present, return the CLI transcriber. Missing binary/model -> undefined.
```

The server child + loopback client (`stt/parakeet-server.ts`) mirror `inference/llama-server.ts`:
spawn on `127.0.0.1:<free port>`, health-check, stream 16 kHz PCM, receive the JSON result, and stop
on `before-quit`.

### 5.3 Engine-agnostic STT selection

Today `main.ts` constructs `createTranscriptionService({ transcriber })` with a **single, fixed**
whisper transcriber. To switch engines when the user changes the model, the service must resolve the
transcriber **per request** from the current `stt.dictation.model` setting:

- Small **contract change**: replace the fixed `transcriber?: Transcriber` with a thunk
  `resolveTranscriber?: () => Transcriber | undefined` (the service calls it on each `transcribe`), so
  editing the model in Settings takes effect immediately — no restart, no rewiring.
- `resolveActiveTranscriber()` maps `engine: "whisper"` -> the whisper transcriber and
  `engine: "parakeet"` -> the Parakeet (sherpa) transcriber, both **memoized** so the persistent server
  / binary is reused across calls. Cloud routing still wins when a slot is bound.

### 5.4 Multi-file model support (the one data-layer addition)

- Extend the catalog so a model can declare **multiple files** that land in a per-model directory:

```ts
// catalog.ts
"sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8": {
  engine: "parakeet",
  // NEW: a model is a set of files in its own directory; each part is sha256-pinned.
  files: [
    { name: "encoder.int8.onnx", url: `${HF}/csukuangfj/.../encoder.int8.onnx`, sha256: "<pinned>" },
    { name: "decoder.int8.onnx", url: `${HF}/.../decoder.int8.onnx`, sha256: "<pinned>" },
    { name: "joiner.int8.onnx",  url: `${HF}/.../joiner.int8.onnx`,  sha256: "<pinned>" },
    { name: "tokens.txt",        url: `${HF}/.../tokens.txt`,        sha256: "<pinned>" },
  ],
}
```

- Reuse the existing **resumable, sha256-verified, atomic** single-file downloader
  ([models/downloader.ts](../../../app/electron/main/models/downloader.ts)) **once per file**, into
  `<models>/<modelId>/`. Readiness = every file present + verified; download progress = aggregate
  bytes across files. **No archive format, no bzip2/tar dependency** in the runtime path.
- Storage accounting (`models:storage`) sums the model directory.

> If a single `.tar.bz2` is ever preferred (fewer requests), that extraction belongs to the
> **binary-provisioning** path (build-time `fetch-parakeet.mjs` or the GPU provisioning pipeline,
> where a real extractor exists), not the in-app model download.

### 5.5 Flip the three stubs

- **catalog.ts**: real `archive` source (above) instead of `sources: []`.
- **main.ts `runtimeStatuses()`**: replace the hardcoded `unsupported` with
  `engineReady("parakeet") ? "ready" : "missing"`, and extend `makeEngineReady` to resolve the
  Parakeet binary + model (via `resolveParakeetTranscriber`).
- **compatibility.ts**: change Parakeet `support: "not-yet-supported"` -> `"supported"` (keep the RAM
  estimate; add a "GPU recommended for best speed" tip, not a hard requirement).

### 5.6 Settings + UI (mostly already there)

- The **Provider** picker already shows **Whisper / NVIDIA Parakeet** in
  [surfaces/settings/inference.tsx](../../../app/src/surfaces/settings/inference.tsx); selecting
  Parakeet sets `stt.dictation.localProvider = "parakeet"` and surfaces Parakeet models in the list.
- Honest readiness: the row shows **Download** (not "Unavailable"), a size label (~640 MB), and a
  **Recommended** badge for v3; after download it shows **Ready** + **In use**.
- `transcriptionLanguage` (already a setting) maps to Parakeet's multilingual support (v3); for v2 it
  is English-only (the UI notes this).

---

## 6. GPU acceleration (ties into the existing system)

Parakeet on GPU is the headline reason to use it. It plugs into the
[GPU acceleration](gpu-acceleration/README.md) machinery cleanly:

- Add a **sherpa-onnx CUDA backend** to the artifact manifest
  ([02 §2](gpu-acceleration/02-backend-provisioning-and-rollback.md)) — model it as a new acceleration
  engine `"parakeet"`. The parts are the **CUDA sherpa build** (which bundles the onnxruntime CUDA EP)
  plus the **CUDA runtime (`cudart`) and cuDNN** redistributables. Note cuDNN is a **heavier,
  separately licensed** dependency than llama's cudart-only path — so this backend is larger and
  warrants its own pinning/licensing review. The same **pin -> verify -> probe -> activate/rollback**
  lifecycle applies.
- The runtime simply passes `--provider=cuda` when the GPU backend is active and probed; otherwise
  `--provider=cpu`. The **probe** ([gpu 02 §5](gpu-acceleration/02-backend-provisioning-and-rollback.md))
  runs sherpa on a tiny bundled WAV and confirms a non-empty transcript on the GPU provider.
- This gives Parakeet the same **graceful fallback**: GPU when it is proven, CPU otherwise. Parakeet
  is already real-time on CPU (int8), so the CPU floor is excellent.

> Because Parakeet's CPU performance is already real-time (int8) and the GPU path drags in a heavy
> cuDNN dependency, **GPU is an optional, lower-priority phase** here — an enhancement, never a
> requirement — fully consistent with the GPU spec's "CPU is the floor" principle.

---

## 7. Long-form / streaming (reuse the capture pipeline)

- **Dictation (short):** one request to the warm sherpa server per utterance — the model is already
  loaded, so latency is just the RTF (no reload).
- **Note recording / uploads / meetings (long):** sherpa's offline recognizer is **non-streaming**, so
  long audio is chunked. Khonjel already has a **VAD/segmenter** ([stt/segmenter.ts](../../../app/electron/main/stt/segmenter.ts))
  + streaming capture session; route Parakeet through the **same segmentation** whisper uses, sending
  each window to the warm server (cheap — no per-window reload). Optionally adopt sherpa's bundled
  `silero_vad.onnx` later for parity; the existing segmenter is enough to ship.

---

## 8. Packaging & supply-chain

- **Not bundled by default.** Like the local LLM/whisper models, the Parakeet binary + model are
  **downloaded on demand** (portable build stays small). `vendor/parakeet` + the model dir are
  git-ignored.
- **Pinned + verified.** The binary archive and the model `.tar.bz2` are **sha256-pinned** (audit F1)
  and verified before extraction — reuse `scripts/verify-model-pins.mjs` (extend it to cover the
  Parakeet archive) and the provisioning verifier.
- **Hosts allowlisted:** `github.com` / `objects.githubusercontent.com` (releases) — same allowlist as
  the GPU manifest; no new egress surface.
- **No elevation, no system changes** — everything under `userData`/`vendor`.

---

## 9. EDD / TDD plan

### Unit (BE1, pure — no binary)

| File | Covers |
|---|---|
| `stt/parakeet.test.ts` | `buildSherpaArgs` + `buildSherpaServerArgs` (correct `--encoder/--decoder/--joiner/--tokens/--model-type/--provider/--num-threads` / `--port`); `parseSherpaText` (finds the JSON object with a `text` field amid logs, trims) |
| `stt/parakeet-server.test.ts` | warm server client: PCM -> request -> parse JSON result -> text (injected fake socket); lazy-start once + reuse across calls; stop on quit |
| `stt/parakeet-runtime.test.ts` | binary + model-dir resolution precedence (env > runtime > vendor); prefers the server, falls back to the CLI; returns undefined when incomplete |
| `models/catalog.test.ts` (extend) | the Parakeet entry has a `files[]` source (each with url + sha256); `engine: "parakeet"` |
| `models/downloader.test.ts` (extend) | multi-file model: each file download -> verify -> place; readiness = all present; tamper -> reject |
| `models/compatibility.test.ts` (update) | Parakeet now `supported`; runtime status flips with `engineReady` |

### Backend E2E (BE4, real Electron)

`eval/scenarios/parakeet.eval.electron.mjs`:

- With the Parakeet binary + model present (CI provisions a **tiny** test model dir, or a simulated
  fake binary that echoes a fixed JSON), `transcription:transcribe` on a bundled WAV returns the
  expected text via the **Parakeet** engine (assert it routed to sherpa, not whisper).
- `models:readiness`/`models:compatibility` report Parakeet `supported`/`ready` (no longer
  "Unavailable").
- App never crashes when the binary/model are absent (graceful `model_unavailable`).

### UI EDD (browser, real app + mock)

`eval/scenarios/parakeet-setup.eval.mjs`:

- Settings -> Speech-to-Text -> **Provider: NVIDIA Parakeet** -> the Parakeet v3 row shows
  **Download** + size + Recommended (not "Unavailable"/"Not supported").
- Detector: a new `STT_ENGINE_DEAD_END` (a selectable provider whose only model is permanently
  Unavailable) must NOT fire for Parakeet after integration.

> Discipline: real running app + real interactions; pure logic stays in BE1 tests. The actual 640 MB
> model download is simulated in CI (injected fakes), while the **arg/parse/resolve** logic is fully
> unit-tested — same pattern as the GPU work.

---

## 10. Phased backlog (each phase shippable, CPU-first, no regressions)

| Phase | Scope | Acceptance |
|---|---|---|
| **P1 — Wrapper + fetch** | `stt/parakeet.ts` (pure args+parse), `scripts/fetch-parakeet.mjs` (binary + model), pinned hashes | BE1 green; `npm run fetch:parakeet` lands a working binary + v3 model; manual `sherpa-onnx-offline` smoke transcribes a WAV |
| **P2 — Multi-file model** | catalog `files[]`; per-file resumable verified download into a model dir; storage accounting | each file download->verify->place; readiness = all present; tamper rejected; no archive extraction |
| **P3 — Warm runtime + engine-agnostic STT** | persistent `sherpa-onnx-offline-websocket-server` (loopback + model resident) with the one-shot CLI as fallback; `resolveTranscriber()` thunk wired into `TranscriptionService` | Parakeet dictation transcribes via the warm server with no per-utterance reload; whisper unaffected; cloud routing still wins |
| **P4 — Flip the stubs + readiness** | catalog source, `engineReady("parakeet")`, compatibility `supported`; UI shows Download/Ready | UI no longer shows "Unavailable"; download -> Ready -> In use; electron EDD green |
| **P5 — GPU provider (optional, low priority)** | **Implemented:** a `--provider=cuda` gate (NVIDIA GPU + an onnxruntime-CUDA/cuDNN lib beside the binary; `KHONJEL_PARAKEET_PROVIDER` override; CPU floor); `fetch:parakeet --provider=cuda` lands the CUDA build. **Follow-up:** model it as a sherpa CUDA backend in the GPU manifest + acceleration card (a new engine slot) | provider gate BE1-tested + graceful CPU fallback; the card toggle is the deferred enhancement |
| **P6 — Multilingual + long-form** | **Delivered by the engine-agnostic thunk** — long audio already routes through the existing segmenter -> transcription service -> active engine, and v3 is inherently multilingual (auto-detect, no language flag) | non-English works on v3; uploads/notes transcribe long audio via Parakeet automatically |
| **P7 — EDD + polish** | browser + electron EDD scenarios + detector; docs cross-links; honest copy | all suites green; Parakeet is a first-class, honest STT option |

Feature-flag (`KHONJEL_FEATURE_PARAKEET`) until P4 lands, mirroring the GPU rollout.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Model is large (~640 MB) | int8 default; on-demand download with progress + resumable; clear size label; never bundled |
| **Per-utterance model reload latency** (~1 s with the one-shot CLI) | **Run the persistent sherpa websocket server** (model resident), like `llama-server`; the CLI is only for non-interactive/batch use (§2.1) |
| Multi-file model | download each ONNX/tokens file individually (no archive) via the existing single-file downloader; readiness = all files present + verified |
| `.tar.bz2` extraction (binary only; Node has no native bzip2) | extract the binary at build time (`fetch-parakeet.mjs`) or via the provisioning pipeline where a real extractor exists; the in-app model path avoids archives entirely |
| sherpa binary + onnxruntime DLL layout (Windows nests under `bin/`) | resolver checks both `bin/` and root, like whisper's `Release/` handling; keep the ORT DLL next to the binary |
| GPU provider needs onnxruntime-CUDA + **cuDNN** | heavier than llama (cuDNN is large + separately licensed); model it as a pinned GPU backend; probe-gated; CPU fallback; low priority |
| Model license (CC-BY-4.0) | commercial use permitted; attribution recorded in NOTICE/docs |
| v2 is English-only vs v3 multilingual | default to v3; UI labels language scope per model |
| Parakeet output differs from whisper (JSON, casing/punct already applied) | `parseSherpaText` normalizes; dictation cleanup still runs; EDD asserts real text |

---

## 12. Non-goals (this plan)

- Bundling **NVIDIA NeMo** or PyTorch (heavy Python/CUDA stack; wrong fit).
- The **cloud Riva/NIM** Parakeet API (that is a cloud connection, not local — could be a separate
  "enterprise STT" connection later).
- **Streaming** (token-by-token) Parakeet — this model is non-streaming; long audio uses VAD chunking.
- Training / fine-tuning / model export (we consume k2-fsa's pre-exported ONNX).

---

## 13. Definition of done

1. Selecting **NVIDIA Parakeet** in Settings shows real **Download** rows (size + Recommended), not
   "Unavailable".
2. After download, Parakeet is **Ready/In use** and dictation transcribes through the **warm sherpa
   server** (one-shot CLI fallback), verified by electron EDD routing to the Parakeet engine.
3. Whisper is untouched; cloud STT routing still takes precedence when bound.
4. Optional **GPU** acceleration works through the existing acceleration system, probe-gated, with
   transparent CPU fallback.
5. Multilingual (v3) dictation works; long audio transcribes via the segmenter.
6. All artifacts pinned + verified; no elevation; no new egress hosts.
7. `npm run verify:quick`, `npm run eval`, `npm run eval:electron` all green; the three stubs are gone.
