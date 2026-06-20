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

## 2. Primary navigation (Control Panel sidebar)

The **OpenWhispr spine** with the **Wispr Flow surfaces merged in** as first-class
destinations (lucide icons, `w-48` rail) — one unified sidebar:

```
[Brand: Khonjel]  [theme-aware logo]
────────────────────────────────────
 🔍 Search…                    ⌘K     (Command palette)
────────────────────────────────────
 Home            (Home)          history + stats rail + Voice Profile   ← OW ⊕ WF
 Insights        (BarChart3)     analytics dashboard                    ← WF
 Chat            (MessageSquare) AI agent
 Notes           (NotebookPen)   notes (absorbs WF Scratchpad)          ← OW ⊕ WF
 Upload          (Upload)        file transcription
 Dictionary      (BookOpen)      dictionary + snippets tabs             ← OW ⊕ WF
 Transforms      (Wand2/Shuffle) hotkey AI rewrites                     ← WF
 Integrations    (Blocks)        calendar · API · MCP · CLI
────────────────────────────────────
 (flex spacer)
 (optional engine status / update action)
────────────────────────────────────
 Invite teammate / Create workspace   (UserPlus, optional)
 Settings        (Settings) ──▶ modal
 Support         (HelpCircle dropdown)
 ──────────────
 [avatar] Name / email  (or "Not signed in")
```

- **Selected state:** `bg-primary/8` fill + `text-primary` glyph + medium label (per OpenWhispr).
- **Command palette** (`⌘K` / `Ctrl K`) opens `CommandSearch` to jump anywhere/run actions.
- **Wispr Flow merge (definite homes):** **Insights** and **Transforms** are first-class
  nav items; **Style** lives under Settings ▸ Language Models ▸ Dictation Cleanup;
  **Snippets** under Dictionary; **Scratchpad** is folded into **Notes**; **Voice
  Profiles** + **stats** live on **Home**; the **warm light theme** is the Light theme.
  See the integration map in
  [`01-sitemap-and-ia.md`](01-sitemap-and-ia.md#21-reference-integration-map-every-goodness-has-one-definite-home).
- **Dropped:** the Upgrade/limit/referral banners from OpenWhispr's sidebar.

---

## 3. Secondary navigation (in-page)

| Page | Tabs / pills | Style |
|---|---|---|
| Home | history list + stats rail + Voice Profile switcher | list + rail |
| Insights | Your Usage · Your Voice | underline tabs |
| Notes | Folders / list + semantic search | tree + search |
| Dictionary | Dictionary entries · Snippets | tabs |
| Transforms | My Transforms (cards) · Create/Edit | cards + editor |
| Speech-to-Text | Dictation · Note Recording | tabs (ProviderTabs) |
| Speech-to-Text modes | OpenWhispr/Khonjel Cloud · Providers · Local · Self-Hosted | InferenceModeSelector |
| Language Models | Dictation Cleanup · Voice Agent · Note Formatting · Chat | tabs (ProviderTabs) |
| ↳ Dictation Cleanup | Cleanup · **Styles** (per-context tone) | sub-tabs |
| LM modes | Cloud · Providers · Local · Self-Hosted · Enterprise | InferenceModeSelector |
| Prompt Studio | View · Customize · Test | underline tabs |
| Integrations | Calendar · API · MCP · CLI | sectioned list |

**Pattern:** `ProviderTabs` for purpose/mode tabs; `InferenceModeSelector` for the
mode choice that swaps the config form below.

---

## 4. Settings navigation
- Opens as a **centered modal**; left nav rail (OpenWhispr `SettingsSectionType`):
  **General · Hotkeys · Speech-to-Text · Language Models · Privacy & Data · System ·
  Account (optional) · Workspace (optional)**. **No Plans & Billing.**
- Selecting a rail item swaps the right content pane; the pane scrolls independently.
- `×` (top-right) or `Esc` closes and restores the Control Panel state.
- Footer: version + (optional) cloud-sync/health indicator.
- **Deep-linking:** other surfaces open Settings to a specific page (e.g. a "no model"
  error links to Settings ▸ Language Models; "connect calendar" → Integrations).

---

## 5. Routing map (windows + logical routes)

**Windows (URL-param routed, per OpenWhispr `AppRouter`):**
```
(default)                     Dictation Panel  (Khonjel Bar)
?panel=true | /control        Control Panel    (main window)
?agent=true                   Agent Overlay
?meeting-notification=true    Meeting notification overlay
?transcription-preview=true   Transcription preview overlay
?update-notification=true     Update notification overlay
```

**Control Panel views & sub-routes:**
```
/home
/insights            ?tab=usage|voice
/chat
/notes               /notes/:id              ?folder=…   ?q=<semantic search>
/upload
/dictionary          /dictionary/new  /dictionary/:id     (tab: entries | snippets)
/transforms          /transforms/new  /transforms/:id
/integrations        ?section=calendar|api|mcp|cli
/settings/general
/settings/hotkeys
/settings/speech-to-text     ?tab=dictation|noteRecording   ?mode=cloud|providers|local|self-hosted
/settings/language-models    ?tab=cleanup|voice-agent|note-formatting|chat   ?cleanup=cleanup|styles   #prompt-studio
/settings/privacy
/settings/system
/settings/account            (optional)
/settings/workspace          (optional)
```

Overlays/panel are window state, not routes (e.g. `bar.state = listening`,
`overlay.agent = open`).

---

## 6. Keyboard & global model

### 6.1 Global hotkeys (system-wide, per OpenWhispr)
| Action | Default | Configurable |
|---|---|---|
| Dictation | `Ctrl + Win` (Tap / Push-to-talk) | yes |
| Voice Agent | unset | yes (clearable) |
| Meeting Mode | unset (+ layout: Full width / Side panel) | yes (clearable) |
| Chat Agent | unset | yes (clearable) |
| Command palette | `Ctrl/⌘ + K` | yes |
| Cancel capture | `Esc` | — |
| **Transform: Polish** (WF) | `Win + Alt + 1` | yes |
| **Transform: Prompt Engineer** (WF) | `Win + Alt + 2` | yes |
| **Transform: view changes** (WF) | `Win + Alt + O` | yes |

The **Transforms** hotkeys are part of the merged package (managed on the Transforms
page and in Settings ▸ Hotkeys). Conflicts are validated across all slots.

### 6.2 In-app keyboard
- `Ctrl/Cmd + ,` open Settings; `Ctrl/Cmd + K` command palette; `Ctrl/Cmd + F` search
  current list; arrow keys move list selection; `Enter` open; `Del` delete (with
  confirm); `Tab`/`Shift+Tab` traverse; full focus-visible rings. (See a11y doc.)

---

## 7. Navigation state & persistence
- Last-visited Main Window page is restored on launch.
- Library scope tab and Insights tab persist per page.
- Settings always opens to last-viewed settings page.
- Khonjel Bar visibility follows the "Show Khonjel Bar at all times" setting.

---

## PART B — CONTENT / DATA MODEL

> Persisted in **better-sqlite3** (via **kysely**); secrets in the **OS keychain**
> (`@napi-rs/keyring`); note vectors in **Qdrant** (local). Mirrors OpenWhispr's data.

## 8. Core entities

```
HistoryEntry
  id, createdAt, app, language, voiceProfileId?
  rawTranscript, finalText, formatting(richtext)
  cleanupApplied(bool), styleContext, audioRef?(if retained)
  wordCount, durationMs, source(mode), discarded(bool)   // discarded kept if enabled

Note                    (TipTap rich content)
  id, title(auto|manual), bodyJSON(tiptap), bodyMarkdown
  folderId?, tags[], createdAt, updatedAt
  audioRef?, speakers[]?(diarized), sharingScope, syncState
  filePath?(if "save notes as files"), embeddingId?(vector)

Folder                  (notes organization)
  id, name, parentId?, createdAt

NoteVector              (semantic search, local Qdrant)
  id, noteId, embedding(MiniLM), chunkText

DictionaryEntry
  id, type(term|substitution), term|trigger, replacement?, scope(personal|team)
  source(manual|auto-learn), createdAt

Snippet
  id, trigger, expansion(richtext), scope(personal|team), createdAt, updatedAt

InferenceConfig         (one per slot: STT.dictation, STT.note,
                         LLM.dictationCleanup, LLM.voiceAgent, LLM.noteFormatting, LLM.chat)
  mode(openwhisprCloud|providers|local|selfHosted|enterprise)
  providerId?, model?, baseUrl?, apiKeyRef?(keychain), region?, deployment?
  options{ disableThinking, reasoningMode, ... }
  // STT-specific: localProvider(whisper|parakeet), whisperModel?, parakeetModel?,
  //               vad{ enabled, threshold, minSpeechMs, minSilenceMs, maxSpeechS,
  //                    speechPadMs, samplesOverlap }, gpuIndex

ModelAsset             (local model manager)
  id, family, name, sizeBytes, recommended(bool),
  state(available|downloading|installed), path?, kind(stt|llm), runtime(whisper|parakeet|llama)

PromptConfig
  id(unified), template(with {{agentName}}), customized(bool)

GcalAccount            (integration)
  email, connectedAt, primaryOnly(bool)

ApiKey                 (Public API; ungated)
  id, label, hashedKey, createdAt, lastUsedAt

Meeting                (meeting transcription)
  id, source(zoom|teams|facetime|manual), startedAt, endedAt
  transcript(segments[ {speakerId, text, t} ]), speakers[], calendarEventId?

SpeakerProfile         (voice fingerprint)
  id, label, fingerprint, createdAt

Workspace              (optional; feature-flagged)
  id, name, members[ {userId, role} ]

Transform              (additive, Wispr Flow)
  id, name, description, prompt, hotkey, inferenceConfigRef, builtin(bool), enabled

StyleProfile           (additive, Wispr Flow)
  id, context(personal|work|email|other|auto), tone, formality, lengthBias,
  formatting, examples[], appMappings[]

VoiceProfile           (additive, Wispr Flow)
  id, name, cleanupOverrides, styleOverrides, active(bool)

Settings
  general{ micId, preferBuiltInMic, dictationLanguage, uiLanguage, theme,
           launchAtLogin, startMinimized, audioCues, pauseMediaOnDictation,
           autoPaste, keepInClipboard, floatingIcon{autoHide, startPosition},
           saveNotesAsFiles{enabled, path}, autoLearnDictionary,
           notifications{enabled, meetingDetection, calendarReminders, updates} }
  hotkeys{ dictation{combo, activation(tap|push)}, voiceAgent{combo},
           meeting{combo, layout(full-width|side-panel)}, chatAgent{combo} }
  privacy{ cloudBackup(opt), usageAnalytics(off), audioRetentionDays(0..90),
           dataRetention, saveDiscarded, permissions{mic, accessibility, systemAudio} }

Account                (optional; absent when AUTH disabled)
  id, name, email(readonly), avatar, workspaceId?

InsightsAggregate      (derived, local; additive)
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
