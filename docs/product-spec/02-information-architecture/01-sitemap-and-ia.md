# Khonjel — Information Architecture & Sitemap

> The complete structural map: every surface, every screen, every settings page, and
> how they nest. This is the backbone the navigation model and screen specs build on.

---

## 1. Surface taxonomy

Khonjel is a **multi-window Electron app** (per the OpenWhispr architecture), routed by
window/URL params on one renderer bundle:

| Surface | Window type | Purpose |
|---|---|---|
| **Dictation Panel** | Small always-available window (default route) | The compact live-dictation surface (a.k.a. **Khonjel Bar**) |
| **Control Panel** | Main window (sidebar + content) | Home, Chat, Notes, Upload, Dictionary, Integrations |
| **Settings** | Modal over the Control Panel | All configuration |
| **Agent Overlay** | Floating window (`?agent=true`) | Voice-agent command/answer surface |
| **Transient overlays** | Floating windows | Meeting-notification, transcription-preview, update-notification |
| **Onboarding / Auth** | First-run / optional | Setup wizard; optional, skippable sign-in |

> **Capture is global, not a nav destination.** Dictation / Voice Agent / Meeting / Chat
> are invoked by **four global hotkeys** and surface on the Dictation Panel / Agent
> Overlay — independent of the Control Panel.

---

## 2. Control Panel sitemap (main window)

Primary navigation is the **OpenWhispr spine** (`ControlPanelView`) with the **Wispr
Flow surfaces woven in as first-class destinations** — one coherent sidebar, not a
base app with extras bolted on:

```
Control Panel
└── App Shell (window chrome + left sidebar + content view)
    │
    ├── ⌘K Command palette          quick search/jump (CommandSearch)
    ├── Workspace switcher           (optional, if workspaces enabled)
    │
    ├── Home              [primary]  dictation/transcription HISTORY (incl. discarded)
    │   ├── History entry detail (inline)   copy/re-insert/edit/delete/re-transcribe
    │   ├── Personal stats rail (words · wpm · streak)      ← WF
    │   ├── Voice Profile switcher                          ← WF
    │   └── Upcoming meetings (when calendar connected)
    │
    ├── Insights          [primary]  analytics dashboard                    ← WF
    │   └── Your Usage | Your Voice (tabs)
    │
    ├── Chat              [primary]  conversational AI agent (reasoning mode)
    │
    ├── Notes             [primary]  rich notes (TipTap)  ← OW Notes ⊕ WF Scratchpad
    │   ├── Folders / list / semantic search
    │   ├── Note editor (record/append, AI actions)
    │   └── Save-as-files (optional)
    │
    ├── Upload            [primary]  transcribe an existing audio file
    │
    ├── Dictionary        [primary]  text customization hub
    │   ├── Dictionary entries (auto-learn from corrections)   ← OW ⊕ WF
    │   └── Snippets (spoken-trigger expansion)                ← OW ⊕ WF
    │
    ├── Transforms        [primary]  hotkey-bound AI rewrites (saved prompts)  ← WF
    │   └── My Transforms (cards) · Create/Edit · view-changes preview
    │
    ├── Integrations      [primary]  Google Calendar · Public API · MCP · CLI
    │
    └── Sidebar footer
        ├── Settings ─────────────▶ opens Settings modal
        ├── Support (Help)
        └── Account / profile row  (optional)
```

### 2.1 Wispr Flow integration map (every "goodness" has one definite home)

Khonjel keeps **all** the Wispr Flow value. Each feature is merged into a single
coherent home — nothing is optional-vague or duplicated:

| Wispr Flow feature | Coherent home in Khonjel | Status |
|---|---|---|
| Home history timeline | **Home** (same destination as OpenWhispr history — unified) | merged |
| Personal stats rail (words/wpm/streak) | **Home** right rail | merged |
| Insights dashboard (Usage/Voice, gauges, heatmap) | **Insights** primary nav item (computed from local history) | first-class |
| Style (per-context tone/formatting) | **Settings ▸ Language Models ▸ Dictation Cleanup ▸ Styles** (Style *is* cleanup tone per app/context) | folded into cleanup |
| Transforms (hotkey rewrites) | **Transforms** primary nav item + hotkeys in Settings ▸ Hotkeys | first-class |
| Snippets (spoken-trigger expansion) | **Dictionary** view (Snippets tab) — OpenWhispr already groups them | merged |
| Scratchpad (dictated notes) | **Notes** (OpenWhispr Notes absorbs it; richer: folders + semantic search) | merged |
| Voice Profiles | **Home** switcher + a setting; tunes cleanup/style | merged |
| Warm light theme | The **Light** theme (Settings ▸ General ▸ Appearance: Light/Dark/Auto) | merged |
| Library page template (title+tabs+promo+entries) | Shared **UI pattern** for Dictionary/Snippets/Transforms | merged |
| Streaks / milestones | Inside **Insights** + a notification category | merged |
| Always-on Flow bar | **Dictation Panel / Khonjel Bar** | merged |

> Result: a single, unified app. The sidebar is **Home · Insights · Chat · Notes ·
> Upload · Dictionary · Transforms · Integrations** — the OpenWhispr base and the Wispr
> Flow surfaces as **one navigation**, with Style folded where it belongs (cleanup) and
> Scratchpad/history/snippets de-duplicated into their natural OpenWhispr homes.

---


## 3. Settings sitemap (modal)

Settings is a **modal with its own two-pane IA** (nav rail + scrolling content),
aligned to OpenWhispr's `SettingsSectionType`:

```
Settings (modal)
├── General            appearance(theme) · sound · notifications · meeting detection ·
│                      clipboard(auto-paste) · save-notes-as-files · floating icon ·
│                      language(UI + dictation) · startup · microphone · dictionary(auto-learn)
├── Hotkeys            Dictation(+activation) · Voice Agent · Meeting(+layout) · Chat Agent
├── Speech-to-Text     tabs: Dictation | Note Recording
│                      modes: OpenWhispr/Khonjel Cloud · Providers · Local · Self-Hosted
│                      (Whisper / NVIDIA Parakeet) · VAD tuning · GPU device · preview
├── Language Models    tabs: Dictation Cleanup | Voice Agent | Note Formatting | Chat
│                      modes (×5) + Inference config + Prompt Studio + thinking mode
├── Privacy & Data     cloud backup(opt) · usage analytics(off) · audio retention(0–90d) ·
│                      data retention(+discarded) · permissions(mic/AX/system-audio)
├── System             software updates · developer tools · data management (cache/reset)
├── Account            optional (skippable; disabled when AUTH unset)           (P2)
├── Workspace          members / teams (feature-flagged)                        (P2)
└──  ~~Plans & Billing~~   DROPPED — no subscription
```

### 3.1 Settings IA rationale
- The structure **mirrors OpenWhispr** (General / Hotkeys / Speech-to-Text / Language
  Models / Privacy & Data / System / Account / Workspace) so the captured app is
  reproduced faithfully.
- **Plans & Billing is removed entirely.** **Account** and **Workspace** are optional
  and local-first (Account features compile out when auth is disabled).
- The earlier "Vibe coding / Appearance density" notes are folded in: **Appearance**
  (theme Light/Dark/Auto) lives under **General**, matching the real app.

---

## 4. Dictation Panel, Agent Overlay & transient overlays

```
Dictation Panel (Khonjel Bar — always-on floating)
├── Idle (compact)            mic glyph; click = start; floating-icon position/auto-hide
├── Listening                 waveform + timer + cancel
├── Processing                transcribing / cleaning
└── Quick menu (popover)      mode, mic, language, open Control Panel, settings

Overlays (transient)
├── Agent overlay             voice-agent input/answer surface
├── Meeting Mode panel        side-snapped capture (layout per setting)
├── Transform preview         before/after diff (view-changes hotkey)
└── Notification toasts       suggestions / announcements / milestones
```

---

## 5. Full screen inventory (build checklist)

| # | Screen | Surface | Priority | Spec |
|---|---|---|---|---|
| 1 | Home / History | Control Panel | P0 | screen-specs §Home |
| 2 | History entry detail | Control Panel | P0 | §Home |
| 3 | Chat (AI agent) | Control Panel | P1 | §Chat |
| 4 | Notes (list + folders + semantic search) | Control Panel | P1 | §Notes |
| 5 | Note editor (TipTap, AI actions) | Control Panel | P1 | §Notes |
| 6 | Upload (file transcription) | Control Panel | P1 | §Upload |
| 7 | Dictionary | Control Panel | P0 | §Library |
| 8 | Dictionary entry editor | Control Panel | P0 | §Library |
| 9 | Snippets (within Dictionary) | Control Panel | P1 | §Library |
| 10 | Integrations (GCal/API/MCP/CLI) | Control Panel | P1 | §Integrations |
| 11 | Command palette (⌘K) | Overlay | P1 | screen-specs |
| 12 | Settings — General | Settings | P0 | settings-spec |
| 13 | Settings — Hotkeys | Settings | P0 | settings-spec |
| 14 | Settings — Speech-to-Text | Settings | P0 | settings-spec |
| 15 | Settings — Language Models + Prompt Studio | Settings | P0 | settings-spec |
| 16 | Settings — Privacy & Data | Settings | P0 | settings-spec |
| 17 | Settings — System | Settings | P0 | settings-spec |
| 18 | Settings — Account (optional) | Settings | P2 | settings-spec |
| 19 | Settings — Workspace (optional) | Settings | P2 | settings-spec |
| 20 | Dictation Panel / Khonjel Bar (all states) | Panel | P0 | floating-bar |
| 21 | Agent overlay | Overlay | P1 | floating-bar |
| 22 | Meeting Mode panel + notification | Overlay | P1 | floating-bar |
| 23 | Transcription preview overlay | Overlay | P1 | floating-bar |
| 24 | Update notification overlay | Overlay | P1 | floating-bar |
| 25 | First-run onboarding (local, no account) | Modal | P0 | screen-specs §Onboarding |
| — | ~~Settings — Plans & Billing~~ | — | — | DROPPED (no subscription) |
| 26 | Insights (Your Usage / Your Voice) | Control Panel | P1 | screen-specs §Insights |
| 27 | Transforms (cards + editor) | Control Panel | P1 | screen-specs §Library |
| 28 | Style (within LM ▸ Cleanup) | Settings | P1 | settings-spec |

---

## 6. Depth & disclosure rules
- **L1** = sidebar destinations (Home, Insights, Chat, Notes, Upload, Dictionary, Transforms, Integrations).
- **L2** = in-page tabs (STT modes, LM purposes, Notes folders, Dictionary/Snippets).
- **L3** = editors/detail (note editor, entry editor, Prompt Studio Test) — shown
  inline or as a focused sub-view with breadcrumb, never a deep modal stack.
- Short confirmations/destructive actions → dialog. Substantial sub-workflows →
  L3 sub-view. Reference detail → inline expander. (Per progressive-disclosure rule.)
