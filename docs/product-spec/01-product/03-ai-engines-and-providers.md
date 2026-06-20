# Khonjel — AI Engines & Providers

> The model backbone. This is Khonjel's central differentiator: **one consistent
> model system** for both speech and language tasks, defaulting to local/open models
> and supporting a wide range of cloud, self-hosted, and enterprise APIs.
>
> Reference basis: OpenWhispr Speech-to-Text & Language Models pages
> ([`../99-reference-analysis/01-open-wisper-screen-by-screen.md`](../99-reference-analysis/01-open-wisper-screen-by-screen.md), S1–S13).

---

## 1. The one model abstraction

Everywhere Khonjel needs a model, it presents the **same five engine archetypes**:

| Archetype | What it is | Setup | Privacy | Cost |
|---|---|---|---|---|
| **Local** *(default)* | On-device model | Download once | Fully private | Free |
| **Self-Hosted** | OpenAI-compatible server on your network | Endpoint URL (+ key) | Private to your network | Your infra |
| **Cloud Providers** | BYO API key to a 3rd-party | API key + model | Sent to provider | Provider billing |
| **Enterprise** | Org cloud account | Account creds | Per org policy | Org billing |
| **Khonjel Cloud** | Managed hosted service | None | Sent to Khonjel | Managed tier |

> **Default selection is Local.** Khonjel Cloud is offered but never preselected or
> required (this is the key reframing from the references, where managed cloud was the
> default).

This abstraction appears for:
- **Speech-to-Text** (one per capture mode: Dictation, Note Recording).
- **Language Models**, separately for each of **four purposes**.

---

## 2. Speech-to-Text (STT)

**Page:** Settings ▸ Speech-to-Text. **Mode pills:** `Dictation` · `Note Recording`
(each mode has an independent engine choice). (Ref: OW S1–S3.)

### 2.1 Engine archetypes for STT
- **Local** — on-device speech models (e.g. Whisper-family / faster-whisper / open
  ASR). Downloaded via the local model manager (§5). Default.
- **Self-Hosted** — an OpenAI-compatible `/audio/transcriptions` endpoint or a
  compatible local ASR server.
- **Cloud Providers** — BYO key to a transcription API.
- **Enterprise** — org transcription service.
- **Khonjel Cloud** — managed transcription.

### 2.2 Note Recording extras
- **Identify and label speakers** (diarization) toggle. Off → "You"/"Others". (Ref: OW S3.)

---

## 3. Language Models — four purposes

**Page:** Settings ▸ Language Models. **Purpose pills:** `Dictation Cleanup` ·
`Voice Agent` · `Note Formatting` · `Chat`. **Each purpose is configured
independently** (its own engine archetype, model, and settings). (Ref: OW S4, S11–S13.)

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
