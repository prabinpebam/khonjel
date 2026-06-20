# Reference Analysis — OpenWhispr Source Repository

> High-fidelity capture of the **actual OpenWhispr application** (source repo, not just
> screenshots). This is the **authoritative reference** for Khonjel: we build on the
> **same tech stack**, replicate the **UI, navigation, and feature set**, and **drop only
> the subscription/billing layer**.
>
> Source: `github.com/OpenWhispr/openwhispr` (MIT, open source, v1.7.x).
> Companion to the screenshot analyses in
> [`01-open-wisper-screen-by-screen.md`](01-open-wisper-screen-by-screen.md).

---

## 1. What OpenWhispr is

A privacy-first, cross-platform (macOS / Windows / Linux) voice-to-text desktop app:
press a hotkey, speak, and text appears at your cursor. Fully local (Whisper / NVIDIA
Parakeet) or cloud (BYOK). Adds an AI voice agent, meeting transcription with speaker
diarization, and a notes system with semantic search. **No telemetry, no data
collection, fully open source.** Positioned as the free/open alternative to Wispr Flow
and Granola.

> **Khonjel = OpenWhispr, rebranded, on the same stack, minus the subscription/billing
> layer, plus the additive productivity polish from the Wispr Flow reference.**

---

## 2. Technology stack (we adopt this verbatim)

| Layer | Choice |
|---|---|
| Desktop shell | **Electron 41** (Node **24+**), `main.js` + `preload.js`, multi-window |
| Build/update | **Vite 8**, **electron-builder 26**, **electron-updater** |
| UI | **React 19**, **TypeScript 6**, **Tailwind CSS v4**, **shadcn/ui** (Radix primitives), **lucide-react** icons |
| Styling utils | class-variance-authority, clsx, tailwind-merge, tw-animate-css |
| State | **Zustand 5** stores |
| i18n | **i18next** + react-i18next (10 UI languages) |
| Notes editor | **TipTap 3** (+ tiptap-markdown, react-markdown) |
| AI orchestration | **Vercel `ai` SDK 6** + `@ai-sdk/{openai,anthropic,google,google-vertex,groq,amazon-bedrock,azure}`, `@aws-sdk/credential-providers`, **zod** |
| Local STT | **whisper.cpp** (Whisper), **sherpa-onnx** (NVIDIA **Parakeet**), onnxruntime-node, Silero **VAD** |
| Local LLM | **llama.cpp / llama-server** |
| Semantic search | **Qdrant** (`@qdrant/js-client-rest`) + **MiniLM** embeddings + onnxruntime |
| Local DB | **better-sqlite3 12** + **kysely** |
| Secrets | **@napi-rs/keyring** (OS keychain) |
| Auth (optional) | **better-auth** + Microsoft / Apple sign-in (compile-out via `AUTH_URL`) |
| Diarization/meetings | diarization-models + native **meeting-aec-helper** (AEC/VAD), ffmpeg-static |
| Lists | @tanstack/react-virtual |

**Per-OS native helpers** (compiled in `scripts/`): globe-listener, fast-paste
(mac/win/linux), key-listener (win/linux), mic-listener (mac), audio-tap (mac),
text-monitor, media-remote, linux-system-audio (**PipeWire**), nircmd (win), ydotool
(Linux/Wayland paste), dbus-next (Linux).

> Full Khonjel tech-stack spec: [`../04-architecture-and-delivery/04-technology-stack.md`](../04-architecture-and-delivery/04-technology-stack.md).

---

## 3. Window & routing architecture (`src/AppRouter.jsx`)

A **multi-window Electron app**, routed by URL params on a single renderer bundle:

| Surface | Route trigger | Component | Role |
|---|---|---|---|
| **Dictation Panel** | default | `App` | Small always-available dictation window (the "panel") |
| **Control Panel** | `?panel=true` / `/control` | `ControlPanel` | The **main window** (sidebar + views) |
| **Agent Overlay** | `?agent=true` | `AgentOverlay` | Voice-agent input/answer surface |
| **Meeting notification** | `?meeting-notification=true` | `MeetingNotificationOverlay` | Auto-detected-meeting prompt |
| **Transcription preview** | `?transcription-preview=true` | `TranscriptionPreviewOverlay` | Live transcription HUD |
| **Update notification** | `?update-notification=true` | `UpdateNotificationOverlay` | Update toast |
| **Onboarding** | first run | `OnboardingFlow` | Setup wizard |
| **Authentication** | optional | `AuthenticationStep` | Sign-in; **"Continue without account"** path |

**Auth is optional and skippable** (`authenticationSkipped` / `skipAuth` in
localStorage; `AUTH_URL` can be unset to disable account features entirely). This is
the hook Khonjel uses to be fully local/no-account by default.

---

## 4. Control Panel — primary navigation (`ControlPanelSidebar.tsx`)

Sidebar width **w-48 (192px)**, `bg-surface-1`, right hairline border. Top→bottom:

1. **Drag region** (40px).
2. **Workspace switcher** (only if `WORKSPACES_ENABLED` && signed in).
3. **Command Search** button — placeholder + `⌘K` / `Ctrl K` kbd hint → opens `CommandSearch`.
4. **Primary nav** (`ControlPanelView`), 8px-gap rows, active = `bg-primary/8` + `text-primary`:

   | id | label | lucide icon |
   |---|---|---|
   | `home` | Home | `Home` |
   | `chat` | Chat | `MessageSquare` |
   | `personal-notes` | Notes | `NotebookPen` |
   | `upload` | Upload | `Upload` |
   | `dictionary` | Dictionary | `BookOpen` |
   | `integrations` | Integrations | `Blocks` |

5. *(flex spacer)*
6. **Upgrade / limit banners** — *(Khonjel: **DROP**)*.
7. **Update action** (when an update is ready).
8. **Referrals** (Gift, if signed in) — *(Khonjel: **DROP**)*.
9. **Invite teammate / Create workspace** (UserPlus, if workspaces enabled).
10. **Settings** (gear) → opens Settings modal.
11. **Support** (HelpCircle) dropdown.
12. Divider, then **user profile row** (avatar + name + email, or "Not signed in").

> Khonjel keeps items 1–5 and 7, 9–12; drops the subscription banners/referrals.

---

## 5. Control Panel views (the six destinations)

| View | Component(s) | What it is |
|---|---|---|
| **Home** | `HistoryView`, `UpcomingMeetings` | Dictation/transcription **history** (incl. discarded), upcoming meetings |
| **Chat** | `chat/`, `AgentOverlay`, `ChatAgentSettings` | Conversational AI agent (reasoning/thinking mode, self-hosted parity) |
| **Notes** | `notes/`, `NoteEditor` | Rich notes (**TipTap**), folders, **semantic search**, AI actions, optional cloud sync, save-as-files |
| **Upload** | upload flow | **Transcribe an existing audio file** |
| **Dictionary** | `DictionaryView`, `SnippetsView` | Custom vocabulary + **Snippets** (spoken-trigger expansion), cross-device sync |
| **Integrations** | `IntegrationsView` | Google Calendar, Public API, MCP server, CLI |

---

## 6. Integrations (`IntegrationsView.tsx`)

Sectioned list (each = icon tile + title + description + action):

1. **Calendar → Google Calendar** — OAuth connect (multi-account), "primary calendars
   only" toggle, connected-account rows with disconnect. Powers meeting detection.
2. **API → Public API** — manage API keys (dialog → `ApiKeysSection`); docs link.
   *(OpenWhispr gates this behind Pro; **Khonjel ungates it — free**.)*
3. **MCP → MCP server** (`McpIntegrationCard`) — connect an AI assistant via Model
   Context Protocol.
4. **CLI → CLI integration** (`CliIntegrationCard`) — local HTTP bridge / unified CLI.
5. Info note: "Not a bot" disclaimer.

---

## 7. Settings (`SettingsPage.tsx`) — sections & rows

`SettingsSectionType = account | plansBilling | workspace | general | hotkeys |
speechToText | llms | privacyData | system`. Building blocks: `SectionHeader`,
`SettingsPanel` (rounded bordered card), `SettingsPanelRow`, `SettingsRow`
(label + description + right-aligned control), `Toggle`, `Select`, `ProviderTabs`,
`InferenceModeSelector`, `InferenceConfigEditor`.

> **Khonjel drops `plansBilling` entirely; makes `account` + `workspace` optional/local.**

### 7.1 General (ordered sections)
Appearance (theme **Light/Dark/Auto** segmented, Sun/Moon/Monitor) · Sound Effects
(dictation sounds; pause media while dictating) · Notifications (disable all; meeting
detection; calendar reminders; updates) · Meeting Detection (audio detection) ·
Clipboard (auto-paste; keep transcription in clipboard) · Save Notes as Files
(toggle + folder path + rebuild) · Floating Icon (auto-hide; start position
bottom-right/center/bottom-left) · Language (UI language; transcription language) ·
Startup (launch at login [not Linux]; start minimized) · Microphone (prefer built-in;
device select) · Dictionary (auto-learn from corrections) · Wayland Paste diagnostics
(Linux/Wayland: ydotool setup guide).

### 7.2 Hotkeys (4 global)
Dictation Hotkey (`HotkeyInput` + **Activation Mode** tap/push + reset-to-default) ·
Voice Agent Hotkey (clearable) · Meeting Mode Hotkey (+ layout **Full width /
Side panel**) · Chat Agent Hotkey (clearable). Conflict validation across all four.

### 7.3 Speech-to-Text (tabs: `dictation` Mic · `noteRecording` FileAudio)
`InferenceModeSelector` modes: **OpenWhispr Cloud** (needs free account) · **Providers**
(BYOK) · **Local** (Cpu) · **Self-Hosted** (Network). Local provider toggle **Whisper**
vs **NVIDIA Parakeet** → model picker. **Silero VAD** tuning (threshold, min speech ms,
min silence ms, max speech s, speech pad ms, samples overlap) per mode. **GPU device
selector** (multi-GPU). Transcription **preview** toggle. Note Recording →
`MeetingTranscriptionPanel`.

### 7.4 Language Models / LLMs (tabs)
`dictationCleanup` (Wand2) · `dictationAgent` = **Voice Agent** (Sparkles) ·
`noteFormatting` (BookOpen) · `chatIntelligence` = **Chat** (MessageSquare). Each uses
`InferenceConfigEditor` with modes **OpenWhispr Cloud / Providers / Local / Self-Hosted /
Enterprise** (5). Cleanup adds **Prompt Studio** + enable-cleanup toggle + GPU selector.
Note Formatting adds **auto-generate note title** toggle. Reasoning/**thinking mode**
selectable; self-hosted OpenAI-compatible parity.

### 7.5 Privacy & Data
Cloud backup (only if signed in; shows migration progress + last-synced) · Usage
analytics / telemetry toggle · **Audio Retention** (Disabled/7/14/30/60/90 days +
storage usage + **Clear All Audio**) · **Data Retention** (+ save discarded
transcriptions) · **Permissions** (microphone; accessibility [mac]; system audio
[mac/manageable]) with grant buttons + troubleshooting.

### 7.6 System
**Software Updates** (current version + check/download/install + release notes) ·
**Developer Tools** (`DeveloperSection`) · **Data Management** (model cache Open /
**Clear Cache**; **Reset app data**). Cache path hint `%USERPROFILE%\.cache\openwhispr`
or `~/.cache/openwhispr`.

### 7.7 Account / Workspace / Plans & Billing
**Account**: disabled when `!AUTH_URL`; otherwise avatar + name + email + Signed-In
badge, Sign out, Delete account. Signed-out shows an **Offline** badge + optional trial
CTA. **Workspace**: `WorkspaceSection` (members/teams/developer/billing tabs), gated by
`WORKSPACES_ENABLED`. **Plans & Billing**: Free/Pro/Business/Enterprise pricing,
checkout, billing portal — **Khonjel removes this entirely.**

---

## 8. Feature inventory (actual app)

| Feature | Notes |
|---|---|
| Voice dictation | Global hotkey → transcribe → **auto-paste** at cursor |
| Activation modes | Tap / Push-to-talk (Hold), platform-aware |
| Dictation cleanup | LLM removes fillers, fixes grammar; Prompt Studio; toggle |
| Voice Agent | Dedicated hotkey → dictation goes to AI agent as a **command** (no wake word, no cleanup) |
| Chat agent | Conversational AI (GPT-5/Claude/Gemini/Groq/local), reasoning/thinking mode |
| Meeting transcription | Auto-detect **Zoom/Teams/FaceTime**, live **speaker diarization**, **voice fingerprint**, **Google Calendar** |
| Local diarization | On-device speaker labelling + voice fingerprint, no cloud |
| Notes | Folders, **semantic search** (Qdrant+MiniLM), AI actions, optional cloud sync, save-as-files (TipTap editor) |
| Upload | Transcribe existing audio files |
| Dictionary | Custom vocabulary; auto-learn from corrections; cross-device sync |
| Snippets | Spoken-trigger text expansion |
| History | Dictation/transcription history incl. discarded; searchable |
| Transcription preview | Live preview overlay toggle |
| Local STT | Whisper (whisper.cpp) + **NVIDIA Parakeet** (sherpa-onnx); Silero VAD; GPU select |
| Cloud STT | BYOK providers (OpenAI, Groq, Deepgram streaming, xAI, …) + base-URL |
| LLM engines | OpenWhispr Cloud / Providers / Local (llama.cpp) / Self-Hosted (OpenAI-compatible) / Enterprise (Bedrock/Azure/Vertex) |
| Public API & MCP | Programmatic notes/transcriptions; MCP server; CLI bridge |
| Updates | In-app check/download/install + release notes |
| i18n | 10 UI languages; independent transcription language |
| Platforms | macOS (arm64/x64), Windows, Linux (AppImage/deb/rpm/tar) |
| **No telemetry** | No data collection by default |

---

## 9. What Khonjel changes vs OpenWhispr

| Area | Decision |
|---|---|
| **Subscription / Plans & Billing** | **Remove** the entire `plansBilling` section, pricing cards, checkout, billing portal |
| Referral / Upgrade banners, usage limits/quota | **Remove** |
| Paid "OpenWhispr Cloud" managed tier | **Reframe** as optional/self-hostable sync; **not** a paid gate. Local is the default |
| Public API / MCP / CLI "Pro-gated" | **Ungate** — free for everyone |
| Account / Auth | **Optional**, local-first; sign-in only for optional sync/workspaces |
| Telemetry | **Off / removed** |
| Branding | OpenWhispr → **Khonjel**; wake word default **"Khonjel"**; bar = **Khonjel Bar** |
| Additive (from Wispr Flow ref) | Keep **Insights**, **Style**, **Transforms** polish where they don't conflict |

Everything else (UI, navigation, features, tech stack) is **preserved**.
