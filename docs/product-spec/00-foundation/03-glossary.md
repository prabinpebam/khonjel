# Khonjel — Glossary & Naming

> Canonical terminology for the product. Use these terms consistently across spec,
> UI copy, and code. Where the reference apps used a brand-specific term, the Khonjel
> term and its origin are given.

---

## 1. Brand & naming

| Term | Definition |
|---|---|
| **Khonjel** | The product. Manipuri for *"Voice"*. Replaces "Wispr Flow" / "OpenWhispr" from the references. |
| **Khonjel Bar** | The always-on floating dictation surface (pill/bar) that shows listening state and quick actions. (Ref: Wispr "Flow bar".) |
| **Agent name / Wake word** | The configurable spoken name that switches dictation into instruction/agent mode. **Default: "Khonjel"**. Bound in prompts via the `{{agentName}}` template variable. (Ref: "OpenWhispr".) |
| **Khonjel Cloud** | The *optional* managed cloud tier (hosted STT + LLM, no setup). Equivalent to the references' "OpenWhispr Cloud" / Wispr cloud. Never required. |

---

## 2. Core concepts

| Term | Definition |
|---|---|
| **Dictation** | Speaking to insert transcribed (and cleaned-up) text at the cursor in the active app. The primary mode. |
| **Note Recording** | Recording a longer passage/conversation as a saved note, optionally with speaker labels. (Pairs with Meeting Mode.) |
| **Meeting Mode** | A runtime where the capture UI snaps to the side of the screen for longer recording sessions. Triggered by its own hotkey. |
| **Voice Agent** | Mode where speech addressed to the **agent name** is treated as an instruction to act on, not text to transcribe. |
| **Chat** | A conversational LLM surface inside Khonjel (free-form, with a custom system prompt). |
| **Scratchpad** | A freeform workspace of dictated notes (list of notes + record action). |
| **Cleanup** | LLM post-processing that removes fillers, fixes grammar/punctuation, and polishes transcribed speech. |
| **Transform** | A hotkey-bound, on-demand AI rewrite action (a saved prompt) applied to dictated/selected text anywhere. e.g. *Polish*, *Prompt Engineer*. |
| **Style** | Per-context writing tone/formatting applied automatically based on the target app/category (personal, work, email, other). |
| **Snippet** | A saved block of text inserted on a spoken **trigger phrase** (signatures, links, prompts). |
| **Dictionary entry** | A custom vocabulary item (name/term/jargon) or a `trigger → replacement` substitution that improves recognition/spelling. |
| **Voice Profile** | A named persona/context that tunes dictation behaviour (e.g. "Design Critique"). |
| **Insights** | The analytics dashboard (WPM, fixes, totals, per-app usage, streaks). |

---

## 3. The model system

| Term | Definition |
|---|---|
| **Inference mode** | One of the five ways Khonjel runs a model task (OpenWhispr's `InferenceModeSelector`). Same set for speech and language: |
| → **Khonjel Cloud** | Optional managed/self-hostable backend. **Not a paid tier** (subscription removed). (Ref: "OpenWhispr Cloud".) |
| → **Providers** | Bring-your-own-API-key (OpenAI, Anthropic, Gemini, Groq, Custom; STT adds Deepgram, xAI). |
| → **Local** | On-device models, run locally. Fully private. The **default**. |
| → **Self-Hosted** | An OpenAI-compatible server on your network (Ollama, LM Studio, vLLM, `llama-server`) by base URL. |
| → **Enterprise** *(LLM)* | An organization cloud account: AWS Bedrock, Azure OpenAI, or Google Vertex. |
| **STT** | Speech-to-Text engine. Local engines: **Whisper** (whisper.cpp) and **NVIDIA Parakeet** (sherpa-onnx). |
| **Parakeet** | NVIDIA's fast multilingual ASR model, run locally via sherpa-onnx/ONNX. |
| **VAD** | Voice-activity detection (**Silero**), tunable per capture mode. |
| **LLM** | Language model (local via **llama.cpp/llama-server**) used for the four **scopes** below. |
| **Scope / Purpose** | A distinct LLM use with its *own* mode + model + settings: **Dictation Cleanup**, **Voice Agent** (`dictationAgent`), **Note Formatting**, **Chat** (`chatIntelligence`). |
| **Reasoning / thinking mode** | Toggle for reasoning-token output on capable models. |
| **Provider** | A vendor under *Providers* (OpenAI, Anthropic, Gemini, Groq, Mistral, DeepSeek, xAI, Cohere, Deepgram, AssemblyAI, ElevenLabs, Together, Fireworks, OpenRouter, Perplexity, HF, Custom…). Both STT and LLM. |
| **Universal / OpenAI-compatible adapter** | The "Custom" option present for **both** STT and LLM: any `base URL` + key + `/models` discovery — reaches providers Khonjel doesn't ship first-class. |
| **Provider registry** | Declarative config (id, label, kind, base URL, auth, models, "get key" link) that makes the provider/model list **extensible without an app release**. |
| **Base URL / `/models`** | Endpoint for Self-Hosted/Custom; `Refresh` queries `{baseUrl}/models` for discovery (inline errors). |
| **GPU device** | Selectable inference GPU when multiple are present. |
| **Semantic search** | Local meaning-based search over Notes (**Qdrant** vector DB + **MiniLM** embeddings). |
| **Prompt Studio** | Tool to **View / Customize / Test** the unified system prompt (cleanup + instruction detection). |
| **`{{agentName}}`** | Prompt template variable bound to the configurable agent name/wake word. |
| **Local profile** | The on-device identity (name/avatar/preferences). **Not an account**, requires no sign-in, never leaves the device. All user data is keyed to it. |
| **Local storage** | All app data (history, notes, dictionary, snippets, settings, models, vectors) stored on-device by default (better-sqlite3 + Qdrant + files + OS keychain). |

---

## 3b. Windows, views & integrations (OpenWhispr)

| Term | Definition |
|---|---|
| **Dictation Panel** | The small always-on capture window = the **Khonjel Bar**. |
| **Control Panel** | The main window (sidebar + content views). |
| **Agent Overlay** | Floating window for the Voice/Chat agent. |
| **Control Panel views** | **Home · Chat · Notes · Upload · Dictionary · Integrations**. |
| **Upload** | Transcribe an existing audio file. |
| **Command palette** | `⌘K`/`Ctrl K` quick-search/jump (CommandSearch). |
| **Integrations** | Google Calendar · Public API · MCP server · CLI bridge (**all free**). |
| **MCP server** | Model Context Protocol endpoint to connect an AI assistant. |
| **Meeting auto-detect** | Detect Zoom/Teams/FaceTime calls to offer recording. |
| **Voice fingerprint** | On-device speaker recognition across meetings. |
| **Workspace** | Optional, feature-flagged team layer. |
| **Khonjel Cloud** | Optional sync backend (not paid). |

---

## 4. UI building blocks

| Term | Definition |
|---|---|
| **Inference mode selector** | The single-select list of mode rows (icon + title + subtitle) that swaps the config below. (OpenWhispr `InferenceModeSelector`.) |
| **Inference config editor** | The per-scope config block keyed to the selected mode. |
| **Purpose / mode tabs** | `ProviderTabs` selecting STT modes or LLM purposes. |
| **Setting row** | Title + subtitle on the left, a control (toggle/dropdown/button) right-aligned (`SettingsRow`). |
| **Settings panel** | A rounded bordered card grouping setting rows (`SettingsPanel`). |
| **Keycap chip** | A key-cap styled chip rendering a captured shortcut (e.g. `Ctrl` `Win`). |
| **Library page** *(additive)* | The Wispr-Flow template for Dictionary / Snippets / Style / Transforms. |

---

## 5. Naming map (OpenWhispr → Khonjel)

| OpenWhispr | Khonjel |
|---|---|
| OpenWhispr (app, wake word, logo) | **Khonjel** (app, wake word "Khonjel", logo) |
| OpenWhispr Cloud (paid tier) | **Khonjel Cloud** (optional, **free**, self-hostable) |
| Inference modes (cloud/providers/local/self-hosted/enterprise) | **same** |
| Dictation Panel / Control Panel / Agent Overlay | **same** |
| "Flow bar" (Wispr) | **Khonjel Bar** = Dictation Panel |
| **Plans & Billing / referral / upgrade / quotas** | **removed** |
