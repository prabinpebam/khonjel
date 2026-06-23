# Parakeet Integration — No-Compromise Plan

> **Status:** Plan for review (pre-implementation).
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
- Fast on CPU: int8 RTF ~0.12 (real-time) on a desktop core; far faster on GPU.

> **Decision:** integrate Parakeet as a **new local STT engine backed by the `sherpa-onnx-offline`
> child process**, mirroring the whisper.cpp wrapper. NeMo and the cloud Riva API are explicit
> non-goals (below).

### Architecture fit (mirrors the proven whisper path)

```text
renderer mic --16kHz mono PCM16 WAV (base64)--> transcription:transcribe (IPC)
  main TranscriptionService -> resolveTranscriber(engine) ->
     whisper:  whisper-cli  -m ggml-*.bin  -f wav            (today)
     parakeet: sherpa-onnx-offline --encoder/--decoder/--joiner/--tokens --model-type=nemo_transducer wav   (NEW)
  -> parse stdout -> text -> renderer
```

The renderer already emits **16 kHz mono 16-bit PCM WAV** (`src/lib/audio/wav.ts`), which
`sherpa-onnx-offline` accepts directly (single-channel 16-bit; it resamples internally if needed).
**No capture changes are required.**

---

## 3. What we ship: binary + model

### 3.1 The engine binary (`sherpa-onnx-offline`)

- Prebuilt binaries are published per release on
  [k2-fsa/sherpa-onnx releases](https://github.com/k2-fsa/sherpa-onnx/releases) (pin a version, e.g.
  `v1.13.3`), with **separate CPU and CUDA** archives per platform:
  - Windows x64 CPU + Windows x64 CUDA
  - Linux x64 CPU + CUDA
  - macOS arm64/x64 (CPU; Apple uses CoreML/CPU EP)
- Layout: the executable + onnxruntime shared lib(s). On Windows the binaries are commonly nested
  under a `bin/` (and historically `Release/`) folder — the resolver supports both, like whisper.
- A `scripts/fetch-parakeet.mjs` downloads + extracts the binary into `app/vendor/parakeet/`
  (git-ignored), exactly like `fetch-whisper.mjs`.

### 3.2 The model (multi-file ONNX bundle)

This is the **key structural difference** from whisper/llama: a Parakeet model is **not** a single
file — it is a directory of ONNX parts + tokens, distributed as a `.tar.bz2`:

| Model id | Languages | Asset | Extracted size | Files |
|---|---|---|---|---|
| `sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8` | **25 EU languages** | `sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2` | ~640 MB | `encoder.int8.onnx` (622M), `decoder.int8.onnx` (12M), `joiner.int8.onnx` (6.1M), `tokens.txt` (92K) |
| `sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8` | English | `...-v2-int8.tar.bz2` | ~640 MB | same shape (encoder 622M, decoder/joiner/tokens) |

- Source: `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/<asset>`.
- v2 also has `fp16` and non-quantized variants; **int8 is the default** (smallest, fast, negligible
  WER loss). fp16/fp32 can be offered later for max accuracy on GPU.
- v3 (multilingual) is the **recommended default** to match the UI's "Parakeet TDT 0.6B v3" entry.

> **Implication:** the model layer must support a **multi-asset model** (a `.tar.bz2` that extracts to
> a directory the engine points `--encoder/--decoder/--joiner/--tokens` at), plus an archive
> extraction step. Whisper/llama are single-file; this is the one real new capability in the data
> layer.

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

### Output (last non-log line is JSON)

```json
{"lang":"","emotion":"","event":"","text":" Ask not what your country can do for you, ...","timestamps":[...],"tokens":[...],"words":[]}
```

- The transcript is `json.text` (trim leading space).
- `timestamps` (word/token) are available for future features (subtitles, highlighting); not needed
  for dictation.
- Decoding defaults to `greedy_search`; punctuation + casing are built in (no post-clean needed,
  though Khonjel's dictation cleanup still applies downstream).

---

## 5. Code changes (files to touch)

### 5.1 New: the Parakeet wrapper (mirror `stt/whisper.ts`)

`app/electron/main/stt/parakeet.ts` — **PURE** arg builder + JSON parser + injected-runner transcriber:

```ts
export interface ParakeetModelDir { encoder: string; decoder: string; joiner: string; tokens: string; }

export interface SherpaArgsOptions {
  model: ParakeetModelDir;
  audioPath: string;
  numThreads?: number;
  provider?: "cpu" | "cuda";
}

/** PURE: the sherpa-onnx-offline argv. */
export function buildSherpaArgs(opts: SherpaArgsOptions): string[];

/** PURE: extract the transcript from sherpa-onnx-offline stdout (the JSON line). */
export function parseSherpaText(stdout: string): string;

/** Same Transcriber shape as whisper.ts, so the service is engine-agnostic. */
export function createParakeetTranscriber(o: {
  binPath: string; model: ParakeetModelDir; run: RunCommand; numThreads?: number; provider?: "cpu" | "cuda";
}): Transcriber;
```

`Transcriber` is the **existing** interface from `stt/whisper.ts` (`transcribe(audioPath, opts)`), so
nothing downstream changes.

### 5.2 New: the Parakeet runtime resolver (mirror `stt/runtime.ts`)

`app/electron/main/stt/parakeet-runtime.ts` — finds the binary + the model directory, returns a
`Transcriber | undefined`:

```ts
export function resolveParakeetTranscriber(cfg: {
  userDataDir: string; appDir: string; isWindows: boolean; env: Record<string,string|undefined>;
  provider?: "cpu" | "cuda";
}): Transcriber | undefined;
// binary:  KHONJEL_SHERPA_BIN | <userData>/runtime/parakeet[/bin] | <appDir>/vendor/parakeet[/bin]
// model:   KHONJEL_PARAKEET_MODEL_DIR | a dir under <userData>/models or <appDir>/models holding
//          encoder.*.onnx + decoder.*.onnx + joiner.*.onnx + tokens.txt
```

### 5.3 Engine-agnostic STT selection

Today `main.ts` wires a single `transcriber` (whisper) into `createTranscriptionService`. Make the
**active STT engine** a function of the selected model's `engine`:

- Add a resolver `resolveActiveTranscriber(selectedSttModelId)` that returns the whisper transcriber
  for `engine: "whisper"` models and the Parakeet transcriber for `engine: "parakeet"` models.
- `TranscriptionService` already accepts `transcriber?: Transcriber` — no contract change; we just
  choose **which** transcriber based on the `stt.dictation.model` setting. (Cloud routing still wins
  when a slot is bound.)

### 5.4 Multi-asset model support (the one data-layer addition)

- Extend the catalog entry so a model can declare **multiple files** (or an **archive** that extracts
  to a directory):

```ts
// catalog.ts
"sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8": {
  engine: "parakeet",
  // NEW: an archive that extracts to a model directory; expectFiles asserts completeness.
  archive: { url: `${GH}/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2`, sha256: "<pinned>" },
  expectFiles: ["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"],
}
```

- Extend the downloader to: download `.tar.bz2` -> verify sha256 -> **extract** (bzip2 + tar) into the
  model directory -> assert `expectFiles`. The atomic-install + resumable-download mechanics already
  exist in [models/downloader.ts](../../../app/electron/main/models/downloader.ts) and the
  [GPU provisioning pipeline](gpu-acceleration/02-backend-provisioning-and-rollback.md) (which already
  does download->verify->extract->expectFiles->atomic-rename); reuse that extraction code path.
- Storage accounting (`models:storage`) sums the directory rather than a single file.

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
  ([02 §2](gpu-acceleration/02-backend-provisioning-and-rollback.md)) for `engine: "whisper"`'s
  sibling — model it as a new acceleration engine `"parakeet"` (or reuse the STT slot). The CUDA
  sherpa binary + the onnxruntime CUDA provider DLLs + the CUDA `cudart` redist are the parts; the
  same **pin -> download -> verify -> extract -> probe -> activate/rollback** lifecycle applies.
- The runtime simply passes `--provider=cuda` when the GPU backend is active and probed; otherwise
  `--provider=cpu`. The **probe** ([gpu 02 §5](gpu-acceleration/02-backend-provisioning-and-rollback.md))
  runs sherpa on a tiny bundled WAV and confirms a non-empty transcript on the GPU provider.
- This gives Parakeet the same **graceful fallback**: GPU when it is proven, CPU otherwise. Parakeet
  is already real-time on CPU (int8), so the CPU floor is excellent.

> Because Parakeet's CPU performance is strong, GPU is an enhancement, not a requirement — fully
> consistent with the GPU spec's "CPU is the floor" principle.

---

## 7. Long-form / streaming (reuse the capture pipeline)

- **Dictation (short):** one `sherpa-onnx-offline` invocation per utterance — identical to whisper
  today.
- **Note recording / uploads / meetings (long):** sherpa-onnx is **non-streaming** for this model, so
  long audio is chunked. Khonjel already has a **VAD/segmenter** ([stt/segmenter.ts](../../../app/electron/main/stt/segmenter.ts))
  + streaming capture session; route Parakeet through the **same segmentation** that whisper uses for
  long-form, transcribing each window. Optionally adopt sherpa's bundled `silero_vad.onnx` later for
  parity, but the existing segmenter is sufficient to ship.

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
| `stt/parakeet.test.ts` | `buildSherpaArgs` (correct `--encoder/--decoder/--joiner/--tokens/--model-type/--provider/--num-threads` + wav last); `parseSherpaText` (extracts `text` from the JSON line, ignores log lines, trims) |
| `stt/parakeet-runtime.test.ts` | binary + model-dir resolution precedence (env > runtime > vendor); returns undefined when incomplete |
| `models/catalog.test.ts` (extend) | the Parakeet entry has an `archive` source + `expectFiles`; `engine: "parakeet"` |
| `models/downloader.test.ts` (extend) | archive download -> verify -> extract -> expectFiles asserted; tamper -> reject |
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
| **P2 — Multi-asset model** | catalog `archive` + `expectFiles`; downloader extract (tar.bz2); storage accounting | archive download->verify->extract->assert; resumable; tamper rejected |
| **P3 — Runtime + engine-agnostic STT** | `parakeet-runtime.ts`; `resolveActiveTranscriber(selectedSttModelId)`; wire into `TranscriptionService` | dictation with Parakeet selected transcribes via sherpa; whisper unaffected; cloud routing still wins |
| **P4 — Flip the stubs + readiness** | catalog source, `engineReady("parakeet")`, compatibility `supported`; UI shows Download/Ready | UI no longer shows "Unavailable"; download -> Ready -> In use; electron EDD green |
| **P5 — GPU provider** | sherpa CUDA backend in the GPU manifest; `--provider=cuda` when active+probed; CPU fallback | GPU acceleration card lights up for STT; probe-gated; graceful CPU fallback |
| **P6 — Multilingual + long-form** | `transcriptionLanguage` -> v3; long audio via the existing segmenter; (optional) silero VAD | non-English dictation works on v3; uploads/notes transcribe long audio |
| **P7 — EDD + polish** | browser + electron EDD scenarios + detector; docs cross-links; honest copy | all suites green; Parakeet is a first-class, honest STT option |

Feature-flag (`KHONJEL_FEATURE_PARAKEET`) until P4 lands, mirroring the GPU rollout.

---

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Model is large (~640 MB) | int8 default; on-demand download with progress + resumable; clear size label; never bundled |
| Multi-file model + archive extraction is new | reuse the GPU provisioning extract/verify/atomic pipeline; BE1-test the extractor; `expectFiles` gate |
| sherpa binary + onnxruntime DLL layout (Windows nests under `bin/`) | resolver checks both `bin/` and root, like whisper's `Release/` handling |
| GPU provider needs onnxruntime-CUDA + cudart | model it as a pinned GPU backend with the cudart redist (same as llama CUDA); probe-gated; CPU fallback |
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
2. After download, Parakeet is **Ready/In use** and dictation transcribes through `sherpa-onnx-offline`
   (verified by electron EDD routing to the Parakeet engine).
3. Whisper is untouched; cloud STT routing still takes precedence when bound.
4. Optional **GPU** acceleration works through the existing acceleration system, probe-gated, with
   transparent CPU fallback.
5. Multilingual (v3) dictation works; long audio transcribes via the segmenter.
6. All artifacts pinned + verified; no elevation; no new egress hosts.
7. `npm run verify:quick`, `npm run eval`, `npm run eval:electron` all green; the three stubs are gone.
