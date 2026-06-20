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
| **Engine archetype** | One of the five ways Khonjel can run a model task. The same set appears for both speech and language tasks: |
| → **Managed Cloud** | Khonjel Cloud. Hosted, no setup, optional. (Ref: "OpenWhispr Cloud".) |
| → **Cloud Providers** | Bring-your-own-API-key to a third-party provider (OpenAI, Anthropic, Gemini, Groq, Custom). |
| → **Local** | On-device models, downloaded and run locally. Fully private. The **default**. |
| → **Self-Hosted** | An OpenAI-compatible server on your network (Ollama, LM Studio, vLLM, `llama-server`) addressed by Endpoint URL. |
| → **Enterprise** | An organization cloud account: AWS Bedrock, Azure OpenAI, or Google Vertex. |
| **STT** | Speech-to-Text engine (the transcription model). |
| **LLM** | Language model used for the four **purposes** below. |
| **Purpose** | A distinct LLM use with its *own* engine + model + settings. The four purposes: **Dictation Cleanup**, **Voice Agent**, **Note Formatting**, **Chat**. |
| **Provider** | A specific vendor under *Cloud Providers* (OpenAI, Anthropic, Google Gemini, Groq, Custom). |
| **Model family** | A group of local models (Qwen, Mistral, Meta Llama, OpenAI/`gpt-oss`, Gemma) shown as chips in the local download manager. |
| **Endpoint URL** | The base URL of a Self-Hosted OpenAI-compatible server; queried at `/models` for discovery. |
| **Model discovery** | The explicit `Refresh` action that queries `{endpoint}/models` and lists available models (with inline error surfacing). |
| **Prompt Studio** | The tool to **View / Customize / Test** the unified system prompt that powers cleanup + instruction detection. |
| **`{{agentName}}`** | The template variable in prompts that binds to the configurable agent name/wake word. Must be preserved for agent detection. |
| **Disable thinking output** | A toggle to suppress reasoning tokens from reasoning-capable models (cleaner output). |

---

## 4. UI building blocks

| Term | Definition |
|---|---|
| **Engine card** | The single-select list of engine archetype rows (icon + title + subtitle + radio). |
| **Purpose pills** | The segmented control selecting Dictation Cleanup / Voice Agent / Note Formatting / Chat. |
| **Mode pills** | The segmented control selecting Dictation / Note Recording on the Speech-to-Text page. |
| **Engine-specific config** | The block of fields that renders below the engine card, keyed to the selected archetype. |
| **Setting row** | Title + subtitle on the left, a control (toggle/dropdown/button) right-aligned. |
| **Library page** | The shared template for Dictionary / Snippets / Style / Transforms (title + Add new + tabs + icon cluster + promo + entries). |
| **Keycap chip** | A small key-cap styled chip rendering a captured shortcut (e.g. `Ctrl` `Win`). |
| **Promo/education banner** | A dismissible card (photo bg, serif headline, examples) introducing a feature. |

---

## 5. Engine archetype copy map (reference → Khonjel)

| Reference label | Khonjel label |
|---|---|
| OpenWhispr Cloud | **Khonjel Cloud** |
| Cloud Providers / "Bring your own key" | **Cloud Providers** (BYO key) |
| Local | **Local** (default) |
| Self-Hosted / Self-hosted | **Self-Hosted** |
| Enterprise | **Enterprise** |
| "OpenWhispr" wake word | **"Khonjel"** (configurable) |
| "Flow bar" | **Khonjel Bar** |
