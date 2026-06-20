# Khonjel — Information Architecture & Sitemap

> The complete structural map: every surface, every screen, every settings page, and
> how they nest. This is the backbone the navigation model and screen specs build on.

---

## 1. Surface taxonomy

Khonjel has **four top-level surfaces**:

| Surface | Window type | Purpose |
|---|---|---|
| **Main Window** | Primary app window (sidebar + content) | History, libraries, insights, review |
| **Settings** | Modal over the main window | All configuration |
| **Khonjel Bar** | Always-on floating pill | Live capture surface |
| **Overlays** | Transient floating panels | Agent overlay, Meeting Mode panel, Transform preview, notifications |

---

## 2. Main Window sitemap

```
Main Window
└── App Shell (window chrome + left sidebar + content area + optional right rail)
    │
    ├── Home                         [primary]   dictation history timeline + stats rail
    │   ├── History entry detail (inline/expand)
    │   └── Voice Profile switcher
    │
    ├── Insights                     [primary]
    │   ├── Your Usage   (tab, default)
    │   └── Your Voice   (tab)
    │
    ├── Dictionary                   [primary, library]
    │   ├── All | Personal | Shared with team   (tabs)
    │   ├── Add new (entry editor)
    │   └── Entry detail (edit/delete)
    │
    ├── Snippets                     [primary, library]
    │   ├── All | Personal | Shared with team   (tabs)
    │   ├── Add new (snippet editor)
    │   └── Snippet detail (edit/delete)
    │
    ├── Style                        [primary, library]
    │   └── Personal messages | Work messages | Email | Other | Auto Cleanup(Beta)  (tabs)
    │
    ├── Transforms                   [primary, library]
    │   ├── Opt-in toggle + view-changes hotkey
    │   ├── My Transforms (cards)
    │   └── Create New / Edit Transform (editor)
    │
    ├── Scratchpad                   [primary]
    │   ├── Recents (notes list)
    │   └── Note editor (record FAB)
    │
    └── Sidebar footer
        ├── Invite your team         (P2)
        ├── Settings  ───────────────▶ opens Settings modal
        └── Help
```

> **Capture is not a nav destination.** Dictation/Meeting/Agent are invoked by global
> hotkeys and surface on the Khonjel Bar / overlays — independent of which Main Window
> page is open (or whether the window is even visible).

---

## 3. Settings sitemap (modal)

Settings is a **modal with its own two-pane IA** (nav rail + content). Grouped:

```
Settings (modal)
├── GENERAL
│   ├── General                 shortcuts, microphone, dictation languages, app language
│   ├── Hotkeys                  dictation (Tap/Hold), meeting mode, agent overlay
│   └── Appearance              theme (system/light/dark), density, accent   [NEW]
│
├── AI MODELS
│   ├── Speech-to-Text          mode pills (Dictation | Note Recording) + engine + config
│   └── Language Models         purpose pills (Cleanup | Voice Agent | Note Formatting | Chat)
│                                + engine + config + Prompt Studio
│
├── SYSTEM
│   ├── System                  launch/login, Khonjel Bar, dock, sound, notifications,
│   │                            scratchpad behaviour, extras, data management, updates,
│   │                            debug logging, reset
│   └── Vibe coding             variable recognition, file tagging (IDE)        (P2)
│
├── PRIVACY & DATA
│   └── Privacy & Data          privacy mode, off-by-default toggles, retention,
│                                local-vs-cloud storage, context awareness, HIPAA
│
└── ACCOUNT
    ├── Account                 name, email, avatar, sign out, delete           (P2)
    ├── Team                    members, shared vocab                           (P2)
    └── Plans & Billing         managed-tier billing (optional)                 (P2)
```

### 3.1 Settings IA rationale (merging both references)
- OpenWhispr grouped settings as **ACCOUNT / APP / AI MODELS / SYSTEM**; Wispr Flow as
  **SETTINGS / ACCOUNT**. Khonjel merges into **GENERAL / AI MODELS / SYSTEM /
  PRIVACY & DATA / ACCOUNT** — keeping OpenWhispr's strong model+privacy separation and
  Wispr's general/system split.
- **Hotkeys** is its own page (from OpenWhispr) rather than buried in General.
- **Appearance** is added (NEW) to host theme/accent/density (both refs imply theming).
- **Vibe coding** retained under SYSTEM as a P2 developer page (from Wispr).

---

## 4. Khonjel Bar & Overlays IA

```
Khonjel Bar (always-on floating pill)
├── Idle (compact)            mic glyph; click = start; right-click = quick menu
├── Listening                 waveform + timer + cancel
├── Processing                transcribing / cleaning
└── Quick menu (popover)      mode (Dictation/Note/Agent), mic, language, open Main Window, settings

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
| 1 | Home / History | Main | P0 | screen-specs §Home |
| 2 | History entry detail | Main | P0 | §Home |
| 3 | Insights — Your Usage | Main | P1 | §Insights |
| 4 | Insights — Your Voice | Main | P2 | §Insights |
| 5 | Dictionary | Main | P0 | §Library |
| 6 | Dictionary entry editor | Main | P0 | §Library |
| 7 | Snippets | Main | P1 | §Library |
| 8 | Snippet editor | Main | P1 | §Library |
| 9 | Style | Main | P1 | §Library |
| 10 | Transforms | Main | P1 | §Library |
| 11 | Transform editor | Main | P1 | §Library |
| 12 | Scratchpad | Main | P1 | §Scratchpad |
| 13 | Note editor | Main | P1 | §Scratchpad |
| 14 | Settings — General | Settings | P0 | settings-spec |
| 15 | Settings — Hotkeys | Settings | P0 | settings-spec |
| 16 | Settings — Appearance | Settings | P1 | settings-spec |
| 17 | Settings — Speech-to-Text | Settings | P0 | settings-spec |
| 18 | Settings — Language Models | Settings | P0 | settings-spec |
| 19 | Prompt Studio (in LM) | Settings | P1 | settings-spec |
| 20 | Settings — System | Settings | P0 | settings-spec |
| 21 | Settings — Vibe coding | Settings | P2 | settings-spec |
| 22 | Settings — Privacy & Data | Settings | P0 | settings-spec |
| 23 | Settings — Account | Settings | P1 | settings-spec |
| 24 | Settings — Team | Settings | P2 | settings-spec |
| 25 | Settings — Plans & Billing | Settings | P2 | settings-spec |
| 26 | Khonjel Bar (all states) | Bar | P0 | floating-bar |
| 27 | Agent overlay | Overlay | P1 | floating-bar |
| 28 | Meeting Mode panel | Overlay | P1 | floating-bar |
| 29 | Transform preview | Overlay | P1 | floating-bar |
| 30 | First-run onboarding | Modal | P0 | screen-specs §Onboarding |

---

## 6. Depth & disclosure rules
- **L1** = sidebar destinations (Home, Insights, libraries, Scratchpad).
- **L2** = in-page tabs (Insights tabs, library scope tabs, STT/LM pills).
- **L3** = editors/detail (entry editor, Transform editor, Prompt Studio Test) — shown
  inline or as a focused sub-view with breadcrumb, never a deep modal stack.
- Short confirmations/destructive actions → dialog. Substantial sub-workflows →
  L3 sub-view. Reference detail → inline expander. (Per progressive-disclosure rule.)
