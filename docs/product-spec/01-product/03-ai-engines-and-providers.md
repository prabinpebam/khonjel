# Khonjel — AI Engines & Providers

> **The model backbone — and a headline feature.** Khonjel offers **strong, wide
> support for all sorts of transcription (STT) and language (LLM) models**: local,
> self-hosted, BYO-key cloud, and enterprise — through **one consistent model system**.
> Local/open models are the **default**; the provider surface is **broad and
> extensible** (a registry + a universal OpenAI-compatible adapter) so virtually any
> model the user can reach is usable.
>
> Authoritative basis: the **OpenWhispr app** (Speech-to-Text & Language Models)
> ([`../99-reference-analysis/03-openwhispr-repo-analysis.md`](../99-reference-analysis/03-openwhispr-repo-analysis.md)).
> Implemented with **Vercel AI SDK** + whisper.cpp / sherpa-onnx (Parakeet) / llama.cpp —
> see [`../04-architecture-and-delivery/04-technology-stack.md`](../04-architecture-and-delivery/04-technology-stack.md).

---

## 1. The one model abstraction

Everywhere Khonjel needs a model, it presents the **same five inference modes**
(OpenWhispr's `InferenceModeSelector`):

| Mode | What it is | Setup | Privacy | Cost |
|---|---|---|---|---|
| **Local** *(default)* | On-device model (Whisper/Parakeet, llama.cpp) | Download once | Fully private | Free |
| **Self-Hosted** | OpenAI-compatible server on your network | Base URL (+ key) | Private to your network | Your infra |
| **Providers** | BYO API key to a 3rd-party | API key + model | Sent to provider | Provider billing |
| **Enterprise** *(LLM)* | Org cloud account | Account creds | Per org policy | Org billing |
| **Khonjel Cloud** *(optional)* | Managed/self-hostable backend | Optional sign-in | Sent to backend | **Free — no subscription** |

> **Default selection is Local.** **Khonjel Cloud is optional and NOT a paid tier** —
> the subscription/billing layer of OpenWhispr is removed. Cloud is opt-in convenience
> (and self-hostable), never required.

This abstraction appears for:
- **Speech-to-Text** (one per capture mode: Dictation, Note Recording).
- **Language Models**, separately for each of **four purposes/scopes**.

---

## 2. Speech-to-Text (STT)

**Page:** Settings ▸ Speech-to-Text. **Tabs:** `Dictation` · `Note Recording`
(each has an independent inference mode + model). Modes: **Khonjel Cloud · Providers ·
Local · Self-Hosted**.

### 2.1 Local STT engines (the real stack)
- **Whisper** via **whisper.cpp** — Whisper-family transcription, multilingual.
- **NVIDIA Parakeet** via **sherpa-onnx** (onnxruntime) — fast multilingual ASR.
- A provider toggle picks **Whisper vs Parakeet**, then a **model picker**.
- **Silero VAD** — voice-activity detection, **tunable per mode** (threshold, min
  speech ms, min silence ms, max speech s, speech pad ms, samples overlap).
- **GPU device selector** when multiple GPUs are present.
- **Transcription preview** — optional live HUD as you speak.

### 2.2 Cloud / Self-Hosted / Enterprise STT
- **Providers (BYOK):** OpenAI, Groq, **Deepgram** (streaming), **xAI**, and others;
  model + optional base URL.
- **Self-Hosted:** OpenAI-compatible `/audio/transcriptions` or compatible ASR server
  (`SelfHostedPanel`: base URL + key + test).
- **Khonjel Cloud:** managed/optional transcription (no subscription).

### 2.3 Note Recording extras
- **Speaker diarization** + **voice fingerprint** (on-device); off → "You"/"Others".
- Powers **Meeting Mode** (auto-detect Zoom/Teams/FaceTime; AEC/VAD native helper).

---

## 3. Language Models — four purposes/scopes

**Page:** Settings ▸ Language Models. **Tabs:** `Dictation Cleanup` · `Voice Agent`
(`dictationAgent`) · `Note Formatting` · `Chat` (`chatIntelligence`). **Each is
configured independently** (`InferenceConfigEditor` per scope). Local LLM runs on
**llama.cpp/llama-server**; reasoning/**thinking mode** selectable.

| Purpose | Enable control | Purpose-specific settings |
|---|---|---|
| **Dictation Cleanup** | `Enable text cleanup` | Prompt Studio; `Disable thinking output` |
| **Voice Agent** | `Enable voice agent` (+ wake word) | Activation by agent name |
| **Note Formatting** | `Auto-generate note titles` | — |
| **Chat** | *(always available)* | `System Prompt` textarea |

The page layout pattern per purpose:
```
[purpose pills]
[feature-enable toggle card]      (except Chat)
[engine archetype card]           (the 5 rows)
[engine-specific config block]    (keyed to the selected archetype)
[purpose-specific extras]         (Prompt Studio / System Prompt / etc.)
```

---

## 4. Provider & model matrix — **wide support is a key feature**

> **Universal model support is a headline feature of Khonjel.** The goal is to run
> *any* speech or language model the user can reach — local, self-hosted, or cloud —
> through one consistent UI. Breadth is achieved three ways:
> 1. **First-class providers** with curated model lists and "get your key" links.
> 2. A **universal OpenAI-compatible / Custom adapter** (base URL + key + `/models`
>    discovery) that reaches *everything else*, including new providers on day one.
> 3. An **extensible provider registry** so providers/models are data, not code —
>    new providers ship as config, not releases.

### 4.1 Speech-to-Text (STT) — providers

**Local (on-device, default, fully private):**

| Engine | Runtime | Notes |
|---|---|---|
| **Whisper** (tiny→large-v3, turbo) | whisper.cpp | Multilingual; all sizes; quantized |
| **Distil-Whisper / faster-whisper** | whisper.cpp / CTranslate2 | Faster, smaller |
| **NVIDIA Parakeet / Canary** | sherpa-onnx (ONNX) | Fast multilingual ASR |
| **Moonshine**, **Vosk**, **NeMo** (extensible) | sherpa-onnx / ONNX | Lightweight / streaming options |

**Cloud / API (BYO key) — broad, extensible:**

| Provider | Example models |
|---|---|
| **OpenAI** | `whisper-1`, `gpt-4o-transcribe`, `gpt-4o-mini-transcribe` |
| **Groq** | Whisper-large-v3 (fast) |
| **Deepgram** | Nova (streaming) |
| **AssemblyAI** | Universal / streaming |
| **ElevenLabs** | Scribe |
| **Speechmatics** | Real-time / batch |
| **Mistral** | Voxtral |
| **xAI** | speech-to-text |
| **Azure AI Speech** | (Enterprise) |
| **Google Cloud Speech-to-Text** | (Enterprise) |
| **Amazon Transcribe** | (Enterprise) |
| **Custom (OpenAI-compatible)** | any `/audio/transcriptions` endpoint |

> The list above is **seeded, not fixed** — any OpenAI-compatible transcription endpoint
> works via **Custom**, and new first-class providers are added through the registry.

### 4.2 Language Models (LLM) — providers

**Local (on-device, default):** via **llama.cpp / llama-server** (bundled) or any
**Self-Hosted** runtime (Ollama, LM Studio, vLLM, KoboldCpp, text-generation-webui).
Model families include **Llama, Qwen, Mistral/Mixtral, Gemma, Phi, DeepSeek, gpt-oss,
Command-R, SmolLM** (and more — the catalog is extensible).

**Cloud / API (BYO key) — broad, extensible:**

| Provider | Family |
|---|---|
| **OpenAI** | GPT / o-series |
| **Anthropic** | Claude |
| **Google Gemini** | Gemini |
| **Groq** | Llama/Qwen/Mixtral (fast) |
| **Mistral** | Mistral / Mixtral / Magistral |
| **DeepSeek** | DeepSeek-V/R |
| **xAI** | Grok |
| **Cohere** | Command |
| **Together AI** | many open models |
| **Fireworks AI** | many open models |
| **OpenRouter** | aggregator (many providers/models) |
| **Perplexity** | Sonar |
| **Hugging Face** | Inference providers |
| **Custom (OpenAI-compatible)** | any `/chat/completions` endpoint |

**Enterprise accounts:** **AWS Bedrock · Azure OpenAI · Google Vertex** (account /
region / deployment credentials).

> Implemented on the **Vercel AI SDK** (`@ai-sdk/*`) plus a generic OpenAI-compatible
> adapter, so the provider surface is wide and grows without core changes.

### 4.3 The universal adapter (covers "everything else")

For **both** STT and LLM, a **Custom / OpenAI-compatible** option is always present:
- **Base URL** (e.g. `http://localhost:11434/v1`, a corporate gateway, or any provider).
- **API Key (optional)** — sent as a Bearer token (stored in the OS keychain).
- **`Refresh`** → queries `{baseURL}/models` for discovery; **inline raw errors**.
- **Disable thinking output** (suppress reasoning tokens; some servers ignore).

This guarantees Khonjel supports providers it has never heard of, including brand-new
ones and private/internal gateways.

### 4.4 Extensible provider registry

Providers and models are **declarative config** (id, label, kind STT/LLM, base URL,
auth style, model list / discovery, capability notes, "get key" link). Benefits:
- New providers/models can be added by editing config or a bundled registry update — no
  app release required.
- Per-provider model lists stay current; discovery fills gaps.
- The UI (provider chips + model picker) is generated from the registry.

### 4.5 Khonjel Cloud (optional, free, self-hostable)
Zero-config STT + LLM for users who don't want to choose. **Optional, never default,
not a paid tier** (subscription removed); self-hostable.

---

## 5. Local model download manager — Ref: OW S11

The Local archetype is a **download manager**, not just a toggle.

- **Model-family chips:** `Qwen` · `Mistral` · `Meta Llama` · `OpenAI` (open weights,
  e.g. `gpt-oss`) · `Gemma (Google)`. (Extensible.)
- **Available Models list**, each row:
  `[brand] [name]   [on-disk size]   [Learn more ↗]   [Recommended?]   [Download ⬇]`
  - e.g. `Qwen3.5 9B · 5.5 GB · Recommended · Download`; `Qwen3.5 4B · 2.7 GB · Download`.
- **States per model:** Available → Downloading (progress) → Installed (Use / Remove).
- Downloads happen **in the background**, never blocking dictation (hot-path principle).
- Storage is visible and clearable via **Data Management** (model cache).

### 5.1 Recommendations
- Khonjel recommends a default local STT model and a default local LLM sized to the
  machine (a "Recommended" badge). First-run picks one automatically.
- Hardware-aware guidance (RAM/VRAM) determines which variants are recommended.

---

## 6. Configuration scope & precedence

- **Per-purpose independence:** Cleanup can be Local while Chat is a Cloud Provider, etc.
- **STT independence:** Dictation and Note Recording can use different STT engines.
- **Fallbacks:** if a selected engine is unavailable (endpoint down, model missing),
  Khonjel surfaces a clear error and offers the **Local** fallback where possible.
- **Offline:** with Local selected for STT + Cleanup, the core loop is fully offline.

---

## 7. Prompt Studio — Ref: OW S5–S7

A tool to **View / Customize / Test** the unified system prompt that powers cleanup +
instruction detection. Details and the default prompt in
[`04-text-intelligence.md`](04-text-intelligence.md#5-prompt-studio--the-unified-prompt).

- **View** — read-only default prompt + Copy.
- **Customize** — editable, syntax-highlighted; must keep the `{{agentName}}` placeholder; caution banner.
- **Test** — input sample text, see MODEL/PROVIDER, run against the selected model, view CLEANUP vs instruction behaviour.

---

## 8. Requirements & acceptance

- [ ] The five inference modes appear, with identical semantics, on STT and on all four LLM purposes.
- [ ] Local is the default; Khonjel Cloud is never preselected.
- [ ] **Wide STT support:** local Whisper (all sizes) + Parakeet, and cloud providers incl. OpenAI, Groq, Deepgram, AssemblyAI, ElevenLabs, Speechmatics, Mistral, xAI (+ Azure/Google/Amazon enterprise) + **Custom OpenAI-compatible**.
- [ ] **Wide LLM support:** local via llama.cpp/Ollama/LM Studio/vLLM (Llama/Qwen/Mistral/Gemma/Phi/DeepSeek/gpt-oss…), and cloud incl. OpenAI, Anthropic, Gemini, Groq, Mistral, DeepSeek, xAI, Cohere, Together, Fireworks, OpenRouter, Perplexity, HF (+ Bedrock/Azure/Vertex) + **Custom OpenAI-compatible**.
- [ ] **Universal adapter:** any OpenAI-compatible base URL works for both STT and LLM, with `/models` discovery and inline raw errors.
- [ ] **Extensible registry:** providers/models are declarative config; new providers add without an app release.
- [ ] Local manager lists families + sized variants with Recommended + background Download; hardware-aware.
- [ ] Every purpose is independently configurable and persists separately.
- [ ] The full loop (dictate → cleanup → insert) works offline on Local engines.
