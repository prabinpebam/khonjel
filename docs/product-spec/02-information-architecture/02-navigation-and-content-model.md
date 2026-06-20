# Khonjel — Navigation Model & Content Model

> How users move through Khonjel, and the data entities behind every screen. Covers
> the navigation system, routing, keyboard model, and the content/data model.

---

## PART A — NAVIGATION MODEL

## 1. Navigation principles
1. **Persistent primary nav.** The left sidebar is always present in the Main Window;
   the current destination is always highlighted.
2. **Capture is global, not navigational.** Dictation/Meeting/Agent are reached by
   hotkeys from anywhere; they never require navigating the Main Window.
3. **Settings is modal.** Configuration overlays the app and returns you exactly where
   you were — it is not a sidebar destination competing with work surfaces.
4. **Tabs for siblings, not for hierarchy.** In-page tabs switch between peer views
   (Insights Usage/Voice; library scopes; STT modes; LM purposes). They never replace
   primary nav.
5. **One back-affordance per depth.** L3 editors/sub-views have a single clear
   back/breadcrumb; no nested modal stacks.

---

## 2. Primary navigation (left sidebar)

Order and grouping (Ref: WF sidebar, adapted):

```
[Brand: Khonjel]  [theme-aware logo]
────────────────────────────────────
 Home            (grid glyph)
 Insights        (bar-chart glyph)
 Dictionary      (book glyph)
 Snippets        (scissors glyph)
 Style           (Tt glyph)
 Transforms      (shuffle glyph)
 Scratchpad      (note glyph)
────────────────────────────────────
 (optional status / model card)
────────────────────────────────────
 Invite your team   (P2)
 Settings           (gear) ──▶ modal
 Help
```

- **Selected state:** raised pill (light theme) / subtle fill (dark) + bold label.
- **Collapsible:** the chrome sidebar-toggle collapses to icons-only (tooltips on hover).
- **Status card (NEW, replaces the quota nag):** shows the active **engine** (e.g.
  "Local · Qwen3.5 4B") and a model-download/health indicator. Honest, not a sales nag.

---

## 3. Secondary navigation (in-page)

| Page | Tabs / pills | Style |
|---|---|---|
| Insights | Your Usage · Your Voice | underline tabs |
| Dictionary / Snippets | All · Personal · Shared with team | underline tabs |
| Style | Personal · Work · Email · Other · Auto Cleanup | underline tabs |
| Speech-to-Text | Dictation · Note Recording | segmented pills |
| Language Models | Cleanup · Voice Agent · Note Formatting · Chat | segmented pills |
| Prompt Studio | View · Customize · Test | underline tabs |

**Pills vs tabs:** *segmented pills* for mutually-exclusive **modes/purposes that
change the whole form below** (STT modes, LM purposes); *underline tabs* for **filtering
peer content** (scopes, insights, prompt studio). Consistent across the app.

---

## 4. Settings navigation
- Opens as a **centered modal**; left nav rail groups: GENERAL · AI MODELS · SYSTEM ·
  PRIVACY & DATA · ACCOUNT (see IA doc).
- Selecting a rail item swaps the right content pane; the modal scrolls within the pane.
- `×` (top-right) or `Esc` closes and restores the previous Main Window state.
- Footer: version + cloud-sync/health indicator (Ref: WF settings footer).
- **Deep-linking:** other surfaces can open Settings to a specific page (e.g. a "no
  model" error links to Settings ▸ Language Models).

---

## 5. Routing map (logical routes)

```
/home
/insights            ?tab=usage|voice
/dictionary          ?scope=all|personal|team   /dictionary/new   /dictionary/:id
/snippets            ?scope=all|personal|team   /snippets/new     /snippets/:id
/style               ?context=personal|work|email|other|auto
/transforms          /transforms/new            /transforms/:id
/scratchpad          /scratchpad/:noteId
/settings/general
/settings/hotkeys
/settings/appearance
/settings/speech-to-text     ?mode=dictation|note
/settings/language-models    ?purpose=cleanup|agent|format|chat   #prompt-studio
/settings/system
/settings/vibe-coding
/settings/privacy
/settings/account
/settings/team
/settings/billing
```

Overlays/bar are state, not routes (e.g. `bar.state = listening`, `overlay.agent = open`).

---

## 6. Keyboard & global model

### 6.1 Global hotkeys (system-wide, Ref: OW S15)
| Action | Default | Configurable |
|---|---|---|
| Dictation | `Ctrl + Win` (Tap/Hold) | yes |
| Meeting Mode | unset | yes |
| Agent overlay | unset | yes |
| Transform: Polish | `Win + Alt + 1` | yes |
| Transform: Prompt Engineer | `Win + Alt + 2` | yes |
| Transform: view changes | `Win + Alt + O` | yes |
| Cancel capture | `Esc` | — |

### 6.2 In-app keyboard
- `Ctrl/Cmd + ,` open Settings; `Ctrl/Cmd + F` search current list; `Ctrl/Cmd + N` add
  new (in libraries); arrow keys move list selection; `Enter` open; `Del` delete (with
  confirm); `Tab`/`Shift+Tab` traverse; full focus-visible rings. (See a11y doc.)

---

## 7. Navigation state & persistence
- Last-visited Main Window page is restored on launch.
- Library scope tab and Insights tab persist per page.
- Settings always opens to last-viewed settings page.
- Khonjel Bar visibility follows the "Show Khonjel Bar at all times" setting.

---

## PART B — CONTENT / DATA MODEL

## 8. Core entities

```
HistoryEntry
  id, createdAt, app, language, voiceProfileId?
  rawTranscript, finalText, formatting(richtext)
  cleanupApplied(bool), styleContext, audioRef?(if retained)
  wordCount, durationMs, source(mode)

Note
  id, title(auto|manual), body(richtext), createdAt, updatedAt
  audioRef?, speakers[]?(diarized), tags[], sharingScope, syncState

DictionaryEntry
  id, type(term|substitution), term|trigger, replacement?, scope(personal|team)
  source(manual|auto), createdAt

Snippet
  id, trigger, expansion(richtext), scope(personal|team), createdAt, updatedAt

Transform
  id, name, description, prompt, hotkey, enginePurposeRef, builtin(bool), enabled

StyleProfile
  id, context(personal|work|email|other|auto), tone, formality, lengthBias,
  formatting, examples[], appMappings[]

VoiceProfile
  id, name, cleanupOverrides, styleOverrides, active(bool)

EngineConfig            (one per slot: STT.dictation, STT.note, LLM.cleanup, LLM.agent, LLM.format, LLM.chat)
  archetype(local|self|cloud|enterprise|managed)
  providerId?, model?, endpointUrl?, apiKeyRef?, region?, deployment?
  options{ disableThinking, ... }

ModelAsset             (local download manager)
  id, family, name, sizeBytes, recommended(bool), state(available|downloading|installed), path?

PromptConfig
  id(unified), template(with {{agentName}}), customized(bool)

Settings
  general{ micId, dictationLanguages[], appLanguage }
  hotkeys{ dictation{combo,mode}, meeting{combo,openIn}, agent{combo}, transforms[] }
  appearance{ theme, accent, density }
  system{ launchAtLogin, showBarAlways, showInDock, sounds, muteMusic,
          notifications{suggestions,announcements,milestones}, scratchpadOpen }
  privacy{ privacyMode, cloudBackup, analytics, audioRetentionDays, dataRetention,
           localStorageMode, contextAwareness, hipaaAccepted }

Account                (P2)
  id, firstName, lastName, email(readonly), avatar, teamId?, plan

InsightsAggregate      (derived, local)
  wpm, wpmPercentile, fixes{wordsCorrected, dictionaryFixes}, totalWords,
  appUsage[{category,count,pct}], streak{current,longest, heatmap[]}
```

## 9. Key relationships
- `HistoryEntry.voiceProfileId → VoiceProfile`; `Note.speakers[]` only when diarized.
- Each capture slot references an independent `EngineConfig` (per-purpose independence).
- `DictionaryEntry`/`Snippet`/`StyleProfile` have `scope`; team scope requires Account+Team.
- `InsightsAggregate` is computed **locally** from `HistoryEntry`/`Note` — never server-side when local.

## 10. Storage & retention (ties to Privacy & Data)
- Default `localStorageMode = local`. `audioRetentionDays` time-boxes `audioRef`.
- `dataRetention = off` → `HistoryEntry` is **not persisted** (text inserted only).
- Model assets live in the model cache (Open / Clear via System ▸ Data Management).
- Reset app data wipes settings, history, notes, models, cache (guarded).
