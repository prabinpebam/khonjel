# Khonjel — Floating Bar, Overlays & Settings Specification

> The runtime surfaces (Khonjel Bar, overlays) and the complete Settings UI spec.
> Settings screens are the most heavily referenced in OpenWhispr/Wispr Flow, so they
> are specified row-by-row. Tokens: [`01-design-language.md`](01-design-language.md).

---

# PART A — DICTATION PANEL, OVERLAYS & WINDOWS

> Khonjel is a **multi-window Electron app** (per OpenWhispr). Beyond the Control Panel
> (main window) and Settings (modal), these floating windows exist:

## 1. Dictation Panel / Khonjel Bar (always-on)  *(P0 — OpenWhispr Dictation Panel)*

The default small window — the live capture surface (the **Khonjel Bar**). Position +
auto-hide via **Settings ▸ General ▸ Floating Icon** (`bottom-right / center /
bottom-left`).

**Anatomy & states.**
```
idle:        ( ● )                      compact circular/pill, mic glyph
listening:   ( ▮▮▮▯▮  0:04  ✕ )         waveform + timer + cancel
transcribing:( ◌  Transcribing… )       spinner + label
cleaning:    ( ◌  Cleaning… )           spinner + label
inserting:   ( ✓ )                      brief success → auto-paste at cursor
error:       ( ! message  ↻ )           inline error + retry
```
- **Placement:** per Floating Icon setting; draggable; remembers position; snaps to edges; auto-hide.
- **Idle interactions:** click = start; quick menu (mode · microphone · dictation language · open Control Panel · Settings).
- **Listening:** live waveform (`--accent`/`--dataviz`), elapsed timer, `✕`/`Esc` cancel.
- **Sizing:** ~`220×44` idle/processing, expands to ~`320×56` listening.
- **Shadow** `--shadow-pop`; `--radius-pill`; theme-aware.
- **Reduced motion:** static level meter instead of animated waveform.

## 2. Agent Overlay  *(P1 — OpenWhispr `?agent=true` / AgentOverlay)*
- A separate floating window opened by the **Voice Agent** or **Chat Agent** hotkey.
- Prompt input (voice/text), streaming answer/action, apply/insert controls. Uses the
  Voice Agent / Chat purpose; reasoning/thinking-mode aware.
- Distinct accent header ("Agent") signals **instruction mode** (security: only
  here/the dedicated hotkey treats speech as a command, never dictated content).

## 3. Meeting Mode + Meeting Notification  *(P1 — OpenWhispr)*
- **Meeting notification overlay** (`?meeting-notification=true`): appears when a
  Zoom/Teams/FaceTime call is **auto-detected**, offering to start recording.
- **Meeting panel** (layout `Full width` / `Side panel` per hotkey setting): live
  transcript with **speaker labels** (diarization + voice fingerprint), elapsed time,
  pause/stop, save-as-note (auto-title). Calendar-aware (upcoming meetings).

## 4. Transcription Preview overlay  *(P1 — OpenWhispr `?transcription-preview=true`)*
- Optional live HUD showing transcription as you speak (toggle in Speech-to-Text).

## 5. Update Notification overlay  *(P1 — OpenWhispr `?update-notification=true`)*
- Non-intrusive toast when an update is ready (hover-reveal dismiss). Ties to
  Settings ▸ System ▸ Software Updates.

## 6. Command palette  *(P1 — OpenWhispr CommandSearch)*
- `⌘K` / `Ctrl K` overlay to search and jump to any view/action.

*(Additive, Wispr Flow: a Transform "view-changes" diff preview overlay, if Transforms
are enabled.)*

---

# PART B — SETTINGS SPECIFICATION

> Modal shell from [`02-app-shell-and-layout.md`](02-app-shell-and-layout.md#4-settings-layout-modal).
> Pattern: each page = `H2 title` → `[section header (+subtitle)]` → `card(s) of setting
> rows`. **Setting row** = title (+badge) + subtitle on the left, control on the right.
> The **engine card** + **engine-specific config** pattern is defined once in §B2 and
> reused by Speech-to-Text and Language Models.

## B0. Settings nav rail  *(aligned to OpenWhispr `SettingsSectionType`)*
```
General            appearance · sound · notifications · meeting detection · clipboard ·
                   save-notes-as-files · floating icon · language · startup · microphone · dictionary
Hotkeys            Dictation · Voice Agent · Meeting · Chat Agent
Speech-to-Text     tabs: Dictation | Note Recording
Language Models    tabs: Dictation Cleanup | Voice Agent | Note Formatting | Chat
Privacy & Data     privacy · audio retention · data retention · permissions
System             updates · developer tools · data management
Account            (optional — hidden/disabled when auth is off)
Workspace          (optional — feature-flagged)
─────────────────────────────────────────
footer: Khonjel v1.0 · (optional) ☁ sync/health dot
```
> **Dropped vs OpenWhispr:** the **Plans & Billing** section is removed entirely (no
> subscription). **Account/Workspace** are optional and local-first.

## B1. General  *(P0 — OpenWhispr `SettingsPage` "general")*
Ordered sections, each a `SectionHeader` + `SettingsPanel` of `SettingsRow`s:

| Section | Rows / controls |
|---|---|
| **Appearance** | `Theme` segmented **Light / Dark / Auto** (Sun/Moon/Monitor) |
| **Sound Effects** | `Dictation sounds` toggle · `Pause media while dictating` toggle |
| **Notifications** | `Disable all` · `Meeting detection` · `Calendar reminders` · `Updates` |
| **Meeting Detection** | `Audio detection` toggle (auto-detect calls) |
| **Clipboard** | `Auto-paste` toggle · `Keep transcription in clipboard` toggle |
| **Save Notes as Files** | toggle + folder `path` (Change) + `Rebuild` |
| **Floating Icon** | `Auto-hide` toggle · `Start position` (bottom-right / center / bottom-left) |
| **Language** | `UI language` (10 locales) · `Transcription language` |
| **Startup** | `Launch at login` (not Linux) · `Start minimized` |
| **Microphone** | `Prefer built-in mic` · device select |
| **Dictionary** | `Auto-learn from corrections` toggle |
| **Wayland Paste** *(Linux/Wayland only)* | ydotool component checks + setup guide |

## B2. Hotkeys  *(P0 — 4 global hotkeys, OpenWhispr "hotkeys")*
Each is a `HotkeyInput` (press-to-capture, live combo, conflict validation across all 4):
- **Dictation Hotkey** + **Activation Mode** (`Tap` / `Push-to-talk`) + `reset to default`.
- **Voice Agent Hotkey** (clearable) — routes dictation to the agent as a command.
- **Meeting Mode Hotkey** (clearable) + **layout** select (`Full width` / `Side panel`).
- **Chat Agent Hotkey** (clearable) — opens/sends to the chat agent.

### Inference mode pattern (reused by B4 Speech-to-Text and B5 Language Models)
Per OpenWhispr's `InferenceModeSelector` + `InferenceConfigEditor`. A single-select
**mode** row group swaps the **config block** below it:
```
{InferenceModeSelector}
  ○ Khonjel Cloud    Managed. No setup. (optional; needs free account)   [Cloud]
  ○ Providers        Bring your own API key.                              [Key]
  ◉ Local            On-device models. Fully private.   (default)         [Cpu]
  ○ Self-Hosted      OpenAI-compatible server on your network.            [Network]
  ○ Enterprise       AWS Bedrock / Azure OpenAI / Google Vertex.  (LLM only) [Building]
{config block — keyed to the selected mode}
```
- **Local (LLM):** llama.cpp/llama-server; model picker; **GPU device** selector (multi-GPU). Background downloads.
- **Local (STT):** provider toggle **Whisper** (whisper.cpp) / **NVIDIA Parakeet** (sherpa-onnx) → model picker; **Silero VAD** tuning; **GPU device**.
- **Self-Hosted:** `Base URL` (mono) + helper (`Ollama, LM Studio, vLLM, llama-server`); `API Key (Optional)` (Bearer, keychain); `Available Models` + `Refresh` (queries `/models`, inline raw error); `Disable thinking output` / **reasoning mode**.
- **Providers (wide, extensible):** provider chips — LLM: OpenAI · Anthropic · Google Gemini · Groq · Mistral · DeepSeek · xAI · Cohere · Together · Fireworks · OpenRouter · Perplexity · Hugging Face · **Custom**; STT adds Deepgram · AssemblyAI · ElevenLabs · Speechmatics · Mistral (Voxtral) · xAI. Each: `API Key` + `Get your API key →`; `Select Model` (name + capability line) + optional base URL. The list is generated from the **provider registry** and the **Custom (OpenAI-compatible)** chip reaches anything else.
- **Enterprise:** Bedrock / Azure OpenAI / Vertex + account/region/deployment + credentials (`TestConnectionButton`).
- **Khonjel Cloud:** none (managed/optional).

## B3. Appearance  *(folded into General, per OpenWhispr)*
Theme lives under **General ▸ Appearance** (`Light / Dark / Auto`). Accent/density/
reduce-motion are Khonjel additions (optional), kept under General.

## B4. Speech-to-Text  *(P0 — OpenWhispr "speechToText")*
- **Tabs (`ProviderTabs`):** `Dictation` (Mic) | `Note Recording` (FileAudio) — independent config per tab.
- **`InferenceModeSelector`** (§B2 pattern): `Khonjel Cloud` (needs free account) · `Providers` (BYOK) · `Local` · `Self-Hosted`.
- **Local config:** provider toggle **Whisper** / **NVIDIA Parakeet** → model picker; **Silero VAD** tuning (threshold, min speech ms, min silence ms, max speech s, speech pad ms, samples overlap); **GPU device** selector (multi-GPU); **Transcription preview** toggle.
- **Providers config:** transcription provider + model + optional base URL.
- **Self-Hosted config:** `SelfHostedPanel` (base URL + key + test).
- **Note Recording** tab → `MeetingTranscriptionPanel` (diarization + speaker labels).

## B5. Language Models  *(P0 — OpenWhispr "llms")*
- **Tabs (`ProviderTabs`):** `Dictation Cleanup` (Wand2) | `Voice Agent` (Sparkles) | `Note Formatting` (BookOpen) | `Chat` (MessageSquare).
- Per tab: `[enable/feature control] → [InferenceModeSelector §B2] → [InferenceConfigEditor] → [extras]`.

| Purpose | Enable / control | Extras |
|---|---|---|
| Dictation Cleanup | `Enable text cleanup` toggle | **Prompt Studio**; `Disable thinking output`; GPU selector |
| Voice Agent | (hotkey-driven; routes dictation as a command) | reasoning/thinking mode |
| Note Formatting | `Auto-generate note title` toggle | — |
| Chat | *(always available)* | `ChatAgentSettings`; system prompt; reasoning mode |

Modes here include **Enterprise** (Bedrock/Azure/Vertex) in addition to the four STT
modes. Reasoning/**thinking mode** is selectable; self-hosted OpenAI-compatible parity.

### B5.1 Prompt Studio  *(P1 — Ref: OW S5–S7)*
- Subtitle `View, customize, and test the unified system prompt that powers text
  cleanup and instruction detection`.
- **Underline tabs:** `View | Customize | Test`.
  - **View:** read-only default prompt + `Copy`.
  - **Customize:** caution banner ("Keep the `{{agentName}}` placeholder…"); syntax-
    highlighted editable prompt (violet `{{agentName}}` tokens). Save/Reset.
  - **Test:** `MODEL` / `PROVIDER`; `Input` textarea + mode tag `CLEANUP`; helper
    ("Try addressing '{{agentName}}' to test instruction mode"); `Run Test`; result.
- Default prompt verbatim in [`../01-product/04-text-intelligence.md`](../01-product/04-text-intelligence.md#54-default-prompt-carried-from-the-reference-agent-name-templated).

## B6. Privacy & Data  *(P0 — OpenWhispr "privacyData")*
- **Privacy:** `Cloud backup` (only when signed in; shows migration progress + last-synced) · `Usage analytics` **(off; removed/optional — no telemetry by default)**.
- **Audio Retention:** dropdown **Disabled / 7 / 14 / 30 / 60 / 90 days** + **Storage Usage** (`n files, x MB`) + `Clear All Audio`.
- **Data Retention:** toggle + `Save discarded transcriptions` toggle.
- **Permissions** (`PermissionCard` with grant + status): **Microphone** · **Accessibility** (macOS) · **System Audio** (macOS / where manageable). macOS troubleshooting: reset accessibility permissions.
- *(Additive, optional: Privacy Mode "no training", HIPAA BAA, context awareness — kept as opt-in extras, not defaults.)*

## B7. System  *(P0 — OpenWhispr "system")*
- **Software Updates:** `Current version` + `Latest`/`Update` badge + `Check for Updates` → `Download` (progress) → `Install & Restart`; release-notes panel.
- **Developer Tools** (`DeveloperSection`): diagnostics/logging.
- **Data Management:** `Model cache` + path (mono) → `Open` + `Clear Cache` (danger). `Reset app data` → `Reset` (danger; confirm) — "Permanently delete all local settings, transcriptions, audio recordings, downloaded models, and cached data."

## B8. Integrations  *(P1 — OpenWhispr `IntegrationsView`; ungated/free)*
Sectioned list (icon tile + title + description + action):
- **Calendar → Google Calendar** — OAuth connect (multi-account), `primary only` toggle, connected-account rows (disconnect), `add another`.
- **API → Public API** — `Manage` → API-keys dialog (`ApiKeysSection`) + docs link. **Free (ungated).**
- **MCP → MCP server** (`McpIntegrationCard`) — connect an AI assistant. **Free.**
- **CLI → CLI bridge** (`CliIntegrationCard`) — local HTTP bridge. **Free.**

*(Integrations is also reachable as a Control Panel destination — see screen specs.)*

## B9. Account / Workspace  *(P2 — optional, local-first)*
- **Local profile (default):** a name/avatar/preferences profile lives **on-device**, requires **no sign-in**, and never leaves the machine. All data is keyed to it.
- **Account (optional cloud):** hidden/disabled when auth is off (`AUTH_URL` unset → "Account features disabled"). When signed in: avatar + name + email + **Signed In** badge; `Sign out`; `Delete account` (danger). Signed-out shows an **Offline** badge. **No account is required to use Khonjel** — sign-in only enables optional cross-device sync.
- **Workspace** *(feature-flagged)*: members / teams tabs; invite; shared Dictionary/Snippets.
- **~~Plans & Billing~~ — removed.** No pricing, checkout, billing portal, or quotas.

---

## C. Settings acceptance checklist
- [ ] Modal shell with OpenWhispr nav (General · Hotkeys · Speech-to-Text · Language Models · Privacy & Data · System · Account? · Workspace?) + footer.
- [ ] Inference-mode selector + per-scope config reused on STT and all 4 LM purposes.
- [ ] Local default; Self-Hosted `/models` discovery with inline errors; providers (OpenAI/Anthropic/Gemini/Groq/Custom + Deepgram/xAI for STT); Enterprise (Bedrock/Azure/Vertex).
- [ ] STT Local exposes Whisper/Parakeet toggle, Silero VAD tuning, GPU device, preview.
- [ ] Prompt Studio View/Customize/Test with `{{agentName}}` preserved.
- [ ] System = Updates + Developer Tools + Data Management; destructive actions confirm.
- [ ] Privacy: audio retention 0–90d + storage meter + clear; data retention (+discarded); permissions (mic/AX/system-audio); no telemetry by default.
- [ ] Integrations (Google Calendar/API/MCP/CLI) present and **ungated/free**.
- [ ] **Dropped:** Plans & Billing, referral, upgrade/limit banners, quotas; Account/Workspace optional.
- [ ] Multi-window: Dictation Panel, Control Panel, Agent overlay, meeting/transcription-preview/update overlays, command palette.
