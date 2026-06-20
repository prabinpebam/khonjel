# Khonjel — AI Engines & Providers

> The model backbone. This is Khonjel's central differentiator: **one consistent
> model system** for both speech and language tasks, defaulting to local/open models
> and supporting a wide range of cloud, self-hosted, and enterprise APIs.
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

## 4. Provider & endpoint matrix

### 4.1 Cloud Providers (Bring Your Own Key) — Ref: OW S10
Provider chips, each with API key entry (+ contextual "Get your API key →" link) and
a model picker:

| Provider | Notes |
|---|---|
| **OpenAI** | GPT family. |
| **Anthropic** | Claude family. |
| **Google Gemini** | Gemini family. |
| **Groq** | Fast inference of open models. |
| **Custom** | Any OpenAI-compatible provider (base URL + key). |

Flow: pick provider chip → enter API key → **Select Model** (each model shows a
one-line capability description, e.g. *"Frontier model for complex reasoning"*).

### 4.2 Self-Hosted (OpenAI-compatible) — Ref: OW S4–S5
For local/network servers: **Ollama, LM Studio, vLLM, `llama-server`**, or any
OpenAI-compatible server.

- **Endpoint URL** field (e.g. `http://localhost:11434/v1`).
- **API Key (Optional)** — sent as a Bearer token; separate from any OpenAI key.
- **Available Models** + **Refresh** → queries `{endpoint}/models`.
  - Success → selectable model list.
  - Failure → **inline raw error** (e.g. `404 {"error":…}`) + `No models available`.
- **Disable thinking output** toggle (suppress reasoning tokens; some servers ignore).

### 4.3 Enterprise — Ref: OW S11
Organization cloud accounts: **AWS Bedrock · Azure OpenAI · Google Vertex**.
Configured with account/region/deployment credentials per provider.

### 4.4 Khonjel Cloud (optional managed)
Zero-config hosted STT + LLM. No API key. Opt-in only.

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

- [ ] The five engine archetypes appear, with identical semantics, on STT and on all four LLM purposes.
- [ ] Local is the default; Khonjel Cloud is never preselected.
- [ ] Self-Hosted discovery hits `{endpoint}/models` and surfaces raw errors inline.
- [ ] Provider matrix includes OpenAI, Anthropic, Gemini, Groq, Custom (+ Bedrock/Azure/Vertex for Enterprise).
- [ ] Local manager lists families + sized variants with Recommended + background Download.
- [ ] Every purpose is independently configurable and persists separately.
- [ ] The full loop (dictate → cleanup → insert) works offline on Local engines.
