# Khonjel — Master Feature Map

> The complete, merged inventory of every feature shown across both reference designs,
> unified for Khonjel. Each feature notes its **source** and **v1 priority**.
>
> Source legend: **OW** = OpenWhispr (open-wisper) · **WF** = Wispr Flow (wisper-flow)
> · **NEW** = Khonjel synthesis. Priority: **P0** (v1 must), **P1** (v1 should),
> **P2** (later).

---

## 1. Feature domains at a glance

```
Khonjel
├── Capture & Modes ............ how voice becomes text/notes
│   ├── Dictation (Tap/Hold)            OW+WF  P0
│   ├── Note Recording (+ diarization)  OW     P1
│   ├── Meeting Mode (side panel)       OW     P1
│   ├── Voice Agent (wake word)         OW     P1
│   └── Scratchpad (dictated notes)     WF     P1
├── AI Engines & Providers ..... the model backbone
│   ├── Speech-to-Text engine           OW     P0
│   ├── Language Models × 4 purposes    OW     P0
│   ├── Engine archetypes (×5)          OW     P0
│   ├── Cloud provider matrix           OW     P0
│   ├── Local model download manager    OW     P0
│   ├── Self-hosted endpoint + discovery OW    P0
│   ├── Enterprise accounts             OW     P1
│   └── Prompt Studio (View/Cust/Test)  OW     P1
├── Text Intelligence .......... what happens to the text
│   ├── Dictation Cleanup               OW+WF  P0
│   ├── Transforms (hotkey rewrites)    WF     P1
│   ├── Style (per-context tone)        WF     P1
│   ├── Snippets (voice text-expansion) WF     P1
│   ├── Dictionary (vocab + substitutions) WF  P0
│   └── Auto-formatting / note titles   OW+WF  P1
├── Notes, History & Insights .. review & analytics
│   ├── Home history timeline           WF     P0
│   ├── Insights dashboard              WF     P1
│   ├── Voice Profiles                  WF     P2
│   └── Notes (saved transcripts)       OW+WF  P1
├── Collaboration & Account .... teams, identity, plans
│   ├── Account                         WF     P0
│   ├── Team & sharing (Personal/Shared) WF    P2
│   └── Plans & Billing (optional)      OW+WF  P2
├── Privacy, Data & Security ... trust
│   ├── Privacy Mode (no training)      WF     P0
│   ├── Everything-off-by-default       OW     P0
│   ├── Audio/Data retention controls   OW     P0
│   ├── Local vs cloud storage          OW+WF  P0
│   ├── Context awareness (read screen) WF     P1
│   └── HIPAA BAA                        WF     P2
├── Platform & System .......... OS integration
│   ├── Global hotkeys (×3)             OW     P0
│   ├── Khonjel Bar (always-on)         WF     P0
│   ├── Launch at login / dock / sounds WF     P1
│   ├── Notifications (categories)      WF     P1
│   ├── Updates / version               OW     P1
│   ├── Debug logging                   OW     P1
│   ├── Data management / reset         OW+WF  P0
│   └── Vibe coding (IDE integration)   WF     P2
└── Input & Localization
    ├── Microphone selection            WF     P0
    ├── Dictation languages             WF     P0
    └── App (UI) language               WF     P1
```

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
| Global hotkeys ×3 | OW S15 | P0 | Dictation, Meeting Mode, Agent overlay. |
| Khonjel Bar | WF W9 | P0 | Always-on floating dictation surface. |
| OS integration | WF W9 | P1 | Launch at login, show in dock, dictation reminder. |
| Sound | WF W9–W10 | P1 | Dictation/notification sounds; mute music while dictating. |
| Notifications | WF W10–W11 | P1 | Suggestions / Announcements / Milestones. |
| Updates | OW S8 | P1 | Version + check for updates. |
| Debug logging | OW S8 | P1 | Toggle + "what gets logged" transparency. |
| Data management | OW S8–S9 | P0 | Model cache (Open/Clear) + Reset app data. |
| Vibe coding | WF W14–W15 | P2 | Variable recognition + file tagging for IDEs. |

### 2.8 Input & Localization → see [`../03-ux-ui/04-floating-bar-overlays-and-settings.md`](../03-ux-ui/04-floating-bar-overlays-and-settings.md)

| Feature | Source | Pri | Summary |
|---|---|---|---|
| Microphone selection | WF W8 | P0 | Choose input device. |
| Dictation languages | WF W8 | P0 | One or more recognition languages. |
| App (UI) language | WF W8 | P1 | Interface language. |

---

## 3. What Khonjel drops or reframes from the references

| Reference element | Decision | Why |
|---|---|---|
| "OpenWhispr Cloud" as default engine | **Reframe** → *Local* is default; Khonjel Cloud is optional | Local-first principle. |
| Word quota ("313 words remaining") | **Soften** → honest, dismissible; no hard cap on local use | No dark patterns; local is free. |
| "Add to LinkedIn" / Creator mode branding | **Drop** | Vendor self-promo, not user value. |
| "Get a free month" referral nags | **Drop / make optional** | Honest, no nags. |
| Usage analytics default | **Off by default** | Privacy by default. |
| Mobile app | **Defer to P2** | Desktop-first v1. |

---

## 4. Cross-cutting requirements
- Every model-backed feature exposes the **same engine archetype selector**.
- Every destructive action has a confirm + an "advised only" tone (per references).
- Every feature must function with **Local** engines (no feature is cloud-only).
- Every list/library supports search; every entry supports edit/delete.
