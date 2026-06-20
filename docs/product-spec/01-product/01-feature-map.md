# Khonjel — Master Feature Map

> The complete, merged inventory of every feature for Khonjel. Each feature notes its
> **source** and **v1 priority**.
>
> Source legend: **OW** = OpenWhispr (open-wisper screenshots) · **OWR** = OpenWhispr
> **source repository** (the authoritative build,
> [`../99-reference-analysis/03-openwhispr-repo-analysis.md`](../99-reference-analysis/03-openwhispr-repo-analysis.md))
> · **WF** = productivity reference · **NEW** = Khonjel synthesis. Priority: **P0**
> (v1 must), **P1** (v1 should), **P2** (later).
>
> **Khonjel is built on the OpenWhispr open-source app (same tech stack), replicating
> its full UI/navigation/feature set, and dropping only the subscription/billing
> layer.** Where the productivity reference adds polish (Insights, Style,
> Transforms), Khonjel keeps it as additive.

---

## 1. Feature domains at a glance

```
Khonjel
├── Capture & Modes ............ how voice becomes text/notes
│   ├── Dictation (Tap/Push-to-talk)    OWR    P0   global hotkey → auto-paste
│   ├── Upload (transcribe a file)      OWR    P1   transcribe existing audio
│   ├── Note Recording                  OWR    P1   longer capture saved as note
│   ├── Meeting Mode (auto-detect)      OWR    P1   Zoom/Teams/FaceTime + calendar
│   ├── Speaker diarization + fingerprint OWR  P1   on-device, voice fingerprint
│   └── Voice Agent (dedicated hotkey)  OWR    P1   dictation → agent command
├── AI Agent & Chat ............ converse & command
│   ├── Chat (conversational agent)     OWR    P1   GPT/Claude/Gemini/Groq/local
│   ├── Reasoning / thinking mode       OWR    P1   toggle reasoning output
│   └── Agent overlay                   OWR    P1   floating command surface
├── AI Engines & Providers ..... the model backbone
│   ├── Speech-to-Text (Whisper+Parakeet) OWR  P0   local engines + VAD + GPU
│   ├── Language Models × 4 purposes    OWR    P0   cleanup/agent/format/chat
│   ├── Inference modes (×5)            OWR    P0   cloud/providers/local/self/enterprise
│   ├── Cloud provider matrix (BYOK)    OWR    P0   OpenAI/Anthropic/Gemini/Groq/xAI…
│   ├── Local model manager             OWR    P0   download + GPU device select
│   ├── Self-hosted (OpenAI-compatible) OWR    P0   Ollama/LM Studio/vLLM/llama-server
│   ├── Enterprise (Bedrock/Azure/Vertex) OWR  P1
│   ├── Prompt Studio (View/Cust/Test)  OWR    P1
│   └── VAD tuning (Silero)             OWR    P1   per-mode speech detection
├── Text Intelligence .......... what happens to the text
│   ├── Dictation Cleanup               OWR    P0   fillers/grammar/punctuation
│   ├── Dictionary (vocab + auto-learn) OWR    P0   + cross-device sync
│   ├── Snippets (spoken trigger)       OWR    P1   text expansion
│   ├── Auto note titles / formatting   OWR    P1
│   ├── Transforms (hotkey rewrites)    WF     P1   additive
│   └── Style (per-context tone)        WF     P1   additive
├── Notes & History ............ review & knowledge
│   ├── History timeline (incl. discarded) OWR P0
│   ├── Notes (TipTap, folders)         OWR    P1   rich editor
│   ├── Semantic search (Qdrant+MiniLM) OWR    P1   local vector search
│   ├── AI actions on notes             OWR    P1
│   ├── Save notes as files             OWR    P2
│   ├── Insights dashboard              WF     P1   additive
│   └── Voice Profiles                  WF     P2   additive
├── Integrations ............... connect the outside
│   ├── Google Calendar                 OWR    P1   meeting detection
│   ├── Public API                      OWR    P1   ungated (free)
│   ├── MCP server                      OWR    P1   AI-assistant access
│   └── CLI bridge                      OWR    P2
├── Collaboration & Account .... optional, local-first
│   ├── Account (optional auth)         OWR    P2   skippable; local profile
│   ├── Workspaces / Team               OWR    P2   feature-flagged
│   └── ~~Plans & Billing~~             —      —    DROPPED (no subscription)
├── Privacy, Data & Security ... trust
│   ├── No telemetry by default         OWR    P0
│   ├── Everything-off-by-default       OW     P0
│   ├── Audio retention (0–90 days)     OWR    P0   + storage meter + clear
│   ├── Data retention (+ discarded)    OWR    P0
│   ├── Permissions (mic/AX/sys-audio)  OWR    P0
│   ├── Local vs cloud storage          OWR    P0
│   └── HIPAA BAA                        WF     P2   additive
├── Platform & System .......... OS integration
│   ├── Global hotkeys (×4)             OWR    P0   dictation/voice-agent/meeting/chat
│   ├── Command palette (⌘K)            OWR    P1
│   ├── Khonjel Bar + floating icon     OWR    P0   always-on; auto-hide; position
│   ├── Launch at login / start min.    OWR    P1
│   ├── Sound (cues, pause media)       OWR    P1
│   ├── Notifications (categories)      OWR    P1
│   ├── Clipboard (auto-paste, keep)    OWR    P0
│   ├── Updates (check/download/install) OWR   P1
│   ├── Developer tools / data mgmt     OWR    P1
│   └── Multi-window (panel/control/overlays) OWR P0
└── Input & Localization
    ├── Microphone selection            OWR    P0
    ├── Dictation language              OWR    P0
    └── UI language (10 locales)        OWR    P1
```

> **OWR = OpenWhispr source repo** (authoritative). The subscription/billing layer is
> the only thing removed; Public API / MCP / CLI are **ungated (free)** in Khonjel.

---

## 2. Feature catalog (detailed)

### 2.1 Capture & Modes → see [`02-capture-modes-and-flows.md`](02-capture-modes-and-flows.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Dictation (Tap / Hold) | OW S15, WF W8 | P0 | Push-to-talk; Tap toggles, Hold = press-and-hold. Default `Ctrl+Win`. |
| Note Recording | OW S3 | P1 | Longer capture saved as a note; optional speaker labels. |
| Speaker diarization | OW S3 | P1 | "Identify and label speakers"; off → "You"/"Others". |
| Meeting Mode | OW S15 | P1 | Side-snapped capture panel; own hotkey; "open in" layout. |
| Voice Agent | OW S11 | P1 | Speech addressed to the agent name = instruction. |
| Scratchpad | WF W7 | P1 | Notes list + record FAB; resume-last-note behaviour. |

### 2.2 AI Engines & Providers → see [`03-ai-engines-and-providers.md`](03-ai-engines-and-providers.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| STT engine selection | OW S1–S3 | P0 | Engine archetype for transcription; Dictation vs Note Recording. |
| LLM purposes ×4 | OW S4,S11–S13 | P0 | Cleanup / Voice Agent / Note Formatting / Chat, each independently configured. |
| Engine archetypes ×5 | OW S4 | P0 | Managed Cloud · Cloud Providers · Local · Self-Hosted · Enterprise. |
| Cloud provider matrix | OW S10 | P0 | OpenAI · Anthropic · Google Gemini · Groq · Custom; API key + model pick. |
| Local download manager | OW S11 | P0 | Family chips + per-model size/Recommended/Download. |
| Self-hosted + discovery | OW S4–S5 | P0 | Endpoint URL + key; `Refresh` queries `/models`; inline errors. |
| Disable thinking output | OW S5 | P1 | Suppress reasoning tokens. |
| Enterprise accounts | OW S11 | P1 | AWS Bedrock · Azure OpenAI · Google Vertex. |
| Prompt Studio | OW S5–S7 | P1 | View/Customize/Test unified prompt; `{{agentName}}`. |

### 2.3 Text Intelligence → see [`04-text-intelligence.md`](04-text-intelligence.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Dictation Cleanup | OW S4, WF | P0 | Remove fillers, fix grammar/punctuation, polish. Toggleable. |
| Transforms | WF W6 | P1 | Hotkey-bound rewrite actions; defaults Polish, Prompt Engineer; custom. |
| Style | WF W5 | P1 | Per-context tone/formatting; Personal/Work/Email/Other/Auto Cleanup. |
| Snippets | WF W4 | P1 | Voice-triggered text expansion; Personal/Shared. |
| Dictionary | WF W3 | P0 | Vocabulary + `trigger → replacement`; Personal/Shared; auto-add. |
| Auto note titles | OW S13 | P1 | LLM-generated short titles for notes. |

### 2.4 Notes, History & Insights → see [`05-notes-insights-collaboration.md`](05-notes-insights-collaboration.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Home history timeline | WF W1 | P0 | Reverse-chron entries grouped by day; rich formatting retained. |
| Personal stats rail | WF W1 | P1 | Total words / WPM / streak / active Voice Profile. |
| Insights dashboard | WF W2 | P1 | WPM percentile, fixes, totals, per-app usage, streak heatmap; Your Usage / Your Voice. |
| Voice Profiles | WF W1 | P2 | Named dictation personas. |
| Notes store | OW+WF | P1 | Saved transcripts/recordings with titles, searchable. |

### 2.5 Collaboration & Account → see [`05-notes-insights-collaboration.md`](05-notes-insights-collaboration.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Account | WF W16 | P0 | Name, email (read-only), avatar, sign out, delete. |
| Team & sharing | WF W3/W4/W8 | P2 | Personal vs Shared-with-team scopes; invite. |
| Plans & Billing | OW+WF | P2 | Optional managed-tier billing; honest quota. |

### 2.6 Privacy, Data & Security → see [`../04-architecture-and-delivery/02-privacy-data-security.md`](../04-architecture-and-delivery/02-privacy-data-security.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Privacy Mode | WF W17 | P0 | No data used to train any model. |
| Off-by-default | OW S14 | P0 | Cloud backup, analytics off until enabled. |
| Audio retention | OW S14 | P0 | Period dropdown + storage meter + Clear All Audio. |
| Data retention | OW S14 | P0 | Toggle local history of transcripts/audio. |
| Local vs cloud storage | OW+WF | P0 | "Store data locally" default. |
| Context awareness | WF W17 | P1 | Optionally read on-screen text for accuracy. |
| HIPAA BAA | WF W18 | P2 | Optional compliance agreement. |
| Cloud Sync | WF W17 | P2 | Optional cross-device sync. |

### 2.7 Platform & System → see [`../03-ux-ui/04-floating-bar-overlays-and-settings.md`](../03-ux-ui/04-floating-bar-overlays-and-settings.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Global hotkeys ×4 | OWR | P0 | Dictation, Voice Agent, Meeting Mode, Chat Agent. |
| Command palette (⌘K) | OWR | P1 | Quick search/jump across the app. |
| Khonjel Bar + floating icon | OWR | P0 | Always-on dictation surface; auto-hide; start position. |
| Multi-window | OWR | P0 | Dictation Panel, Control Panel, Agent overlay, transient overlays. |
| OS integration | OWR | P1 | Launch at login, start minimized, clipboard auto-paste. |
| Sound | OWR | P1 | Dictation cues; pause media while dictating. |
| Notifications | OWR | P1 | Disable-all; meeting detection; calendar reminders; updates. |
| Updates | OWR | P1 | Check / download / install + release notes. |
| Developer tools | OWR | P1 | Diagnostics; "what gets logged" transparency. |
| Data management | OWR | P0 | Model cache (Open/Clear) + Reset app data. |

### 2.8 Input & Localization → see [`../03-ux-ui/04-floating-bar-overlays-and-settings.md`](../03-ux-ui/04-floating-bar-overlays-and-settings.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Microphone selection | WF W8 | P0 | Choose input device. |
| Dictation languages | WF W8 | P0 | One or more recognition languages. |
| App (UI) language | WF W8 | P1 | Interface language. |

### 2.9 AI Agent & Chat → see [`04-text-intelligence.md`](04-text-intelligence.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Chat view | OWR | P1 | Conversational AI agent (GPT-5/Claude/Gemini/Groq/local) as a primary nav destination. |
| Reasoning / thinking mode | OWR | P1 | Toggle reasoning-token output; self-hosted OpenAI-compatible parity. |
| Voice Agent (dedicated hotkey) | OWR | P1 | Dictation routed to the agent as a command — no wake word, no cleanup pass. |
| Agent overlay | OWR | P1 | Floating command/answer surface (separate window). |

### 2.10 Integrations → see [`../99-reference-analysis/03-openwhispr-repo-analysis.md`](../99-reference-analysis/03-openwhispr-repo-analysis.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Google Calendar | OWR | P1 | OAuth (multi-account), primary-only toggle; powers meeting detection. |
| Public API | OWR | P1 | API keys to manage notes/transcriptions programmatically. **Ungated/free.** |
| MCP server | OWR | P1 | Connect an AI assistant via Model Context Protocol. **Ungated/free.** |
| CLI bridge | OWR | P2 | Local HTTP bridge / unified CLI. **Ungated/free.** |

### 2.11 Meetings → see [`02-capture-modes-and-flows.md`](02-capture-modes-and-flows.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Meeting auto-detection | OWR | P1 | Detect Zoom/Teams/FaceTime calls; notification overlay to start. |
| Live speaker diarization | OWR | P1 | On-device speaker labelling. |
| Voice fingerprint | OWR | P2 | Recognise speakers across meetings. |
| Calendar reminders | OWR | P2 | Upcoming meetings; reminders. |
| AEC / VAD | OWR | P1 | Echo cancellation + voice-activity detection (native helper). |

---

## 3. What Khonjel drops or reframes from OpenWhispr

> Per the directive: **"we are not going to have the subscription part of it and have
> pretty much everything else."** Everything below the line is removed; everything else
> in the OpenWhispr app is preserved.

| OpenWhispr element | Decision | Why |
|---|---|---|
| **Plans & Billing** section (Free/Pro/Business pricing, checkout, billing portal, switch-plan) | **Drop entirely** | No subscription. |
| **Referral** dashboard/modal, "Get a free month" | **Drop** | No referral mechanics. |
| **Upgrade prompts / limit banners** (sidebar `UpgradePrompt`, `UsageDisplay`) | **Drop** | No quotas/upsell. |
| **Word/usage limits & quotas** | **Drop** | Local use is free and unmetered. |
| Paid **"OpenWhispr Cloud"** managed tier as default | **Reframe** → *Local* is default; managed/synced cloud is optional & not a paid gate | Local-first. |
| **Public API / MCP / CLI** gated behind Pro | **Ungate (free)** | Everyone gets integrations. |
| **Account / auth** required | **Optional** (skippable; `AUTH_URL` compile-out) | Local-first, no account needed. |
| **Usage analytics / telemetry** | **Off / removed by default** | No data collection. |
| Branding (OpenWhispr name, logo, wake word) | **Rebrand** → Khonjel; wake word "Khonjel"; Khonjel Bar | Product identity. |

**Kept and coherently merged from the productivity reference (one unified package):** every
reference "goodness" is retained and given a **single definite home** in the app
— not bolted on. **Insights** and **Transforms** become first-class sidebar
destinations; **Style** folds into Language Models ▸ Dictation Cleanup; **Snippets**
sit under Dictionary; **Scratchpad** is absorbed by **Notes**; **Voice Profiles** +
stats live on **Home**; the **warm light theme** is the Light theme. Full mapping:
[`../02-information-architecture/01-sitemap-and-ia.md`](../02-information-architecture/01-sitemap-and-ia.md#21-reference-integration-map-every-goodness-has-one-definite-home).
(HIPAA BAA is an optional compliance extra.)

---

## 4. Key cross-cutting features & requirements

**Headline feature — universal model support (P0).** Strong, wide support for *all
sorts* of transcription and language models, through one consistent UI:
- **Local** (default): Whisper/Parakeet STT, llama.cpp LLM, GPU-aware, fully offline.
- **Self-Hosted:** Ollama / LM Studio / vLLM / `llama-server` / any OpenAI-compatible.
- **Cloud (BYO key):** OpenAI, Anthropic, Gemini, Groq, Mistral, DeepSeek, xAI, Cohere,
  Deepgram, AssemblyAI, ElevenLabs, Speechmatics, Together, Fireworks, OpenRouter,
  Perplexity, Hugging Face… (STT + LLM).
- **Enterprise:** AWS Bedrock, Azure OpenAI, Google Vertex.
- **Universal adapter + extensible registry:** any OpenAI-compatible base URL works;
  new providers are config, not code. Details:
  [`03-ai-engines-and-providers.md`](03-ai-engines-and-providers.md#4-provider--model-matrix--wide-support-is-a-key-feature).

**Headline feature — everything on-device (P0).** The **local profile/identity** and
**all storage** (history, notes, dictionary, snippets, settings, models, search index)
live on the device. No account required; no telemetry; cloud only when explicitly
opted in. Details:
[`../04-architecture-and-delivery/02-privacy-data-security.md`](../04-architecture-and-delivery/02-privacy-data-security.md).

**General requirements:**
- Every model-backed feature exposes the **same inference-mode selector** (STT + LLM).
- Every destructive action confirms with an "advised only" tone.
- Every feature must function with **Local** engines (no feature is cloud-only).
- Every list/library supports search; every entry supports edit/delete.
