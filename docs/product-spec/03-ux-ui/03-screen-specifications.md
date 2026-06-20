# Khonjel — Screen Specifications (Main Window)

> Reproduction-grade specs for every Main Window screen: layout regions, exact
> components, copy, formatting, and states. Settings screens are in
> [`04-floating-bar-overlays-and-settings.md`](04-floating-bar-overlays-and-settings.md).
> Visual tokens from [`01-design-language.md`](01-design-language.md); shell from
> [`02-app-shell-and-layout.md`](02-app-shell-and-layout.md). Reference fidelity in
> [`../99-reference-analysis/`](../99-reference-analysis/).

Each screen below specifies: **Purpose · Layout · Components · Copy · States · A11y**.

---

## 0. First-run Onboarding  *(P0, NEW — synthesises a local-first start)*

**Purpose.** Get a user from launch to a successful local dictation with **no account
and no cloud**.

**Layout.** Centered modal, 3 steps, progress dots; "Skip setup" text link.

| Step | Content | Primary action |
|---|---|---|
| 1 · Welcome | Brand, one-line value ("Speak. Khonjel writes — privately, on your device."), theme = System | `Get started` |
| 2 · Choose a local model | Recommended on-device STT + LLM (sized to machine), with size + `Recommended` badge; alternatives expandable; "Use Khonjel Cloud instead" is a small secondary link | `Download & continue` (background download) |
| 3 · Set your hotkey | Dictation hotkey capture (default `Ctrl+Win`), Tap/Hold choice, mic picker, language | `Finish` |
| Success | "Hold {hotkey} and say a sentence" → live test field shows inserted text | `Done` |

**States.** Download progress inline (never blocks finishing); offline = local only;
error → retry + pick smaller model. **A11y.** Fully keyboard-navigable; focus trapped
in modal; announces step changes.

---

## 1. Home / History  *(P0 — Ref: WF W1)*

**Purpose.** The dictation history timeline + personal stats; the default landing page.

**Layout** (timeline + rail archetype):
```
Welcome back, {firstName}                                  ┌ stats rail (260) ┐
                                                           │  3,599           │
── JUNE 18, 2026 ───────────────────────────────           │  total words     │
06:39 pm   Cleaned transcript text on one or more lines.   │  140  wpm        │
06:38 pm   Another entry…                                  │  1    day        │
04:14 pm   • bulleted                                      │ ───────────────  │
           • formatted output retained                     │ Voice Profile    │
── JUNE 17, 2026 ───────────────────────────────           │ Design Critique  │
…                                                          └──────────────────┘
```

**Components & formatting.**
- **H1 greeting** `Welcome back, {firstName}` (`--font-h1`).
- **Date dividers** (`--font-label`, uppercase, `--text-tertiary`, hairline rule).
- **Entry row:** timestamp column (90px, `--font-small`, `--text-tertiary`) + transcript
  (`--font-body`, `--text-primary`); rich text (paragraphs, bullets, links) preserved;
  hairline divider between rows; `56` min height, grows with content.
- **Entry hover/selected:** row tint + trailing action cluster: `Copy`, `Re-insert`,
  `Edit`, `New snippet`, `Re-run cleanup`, `Re-transcribe` (if audio), `Delete` (danger,
  confirm). Overflow in a `⋯` menu.
- **Stats rail:** three `--font-stat` numbers with captions; divider; active **Voice
  Profile** (name + small illustration/avatar). Click a stat → Insights.
- **Top-right of page:** search field (filter history) + filter (date/app/language).

**States.**
- *Empty:* centered "Nothing dictated yet — press `{hotkey}` and speak." + show-bar hint.
- *Loading:* skeleton rows.
- *Data retention off:* banner "History is off — transcripts are inserted but not saved.
  Turn on in Privacy & Data." (link).

**A11y.** List is a keyboarded listbox; each row focusable; actions reachable via
context key; timestamps have full datetime labels.

---

## 2. Insights  *(P1 — Ref: WF W2)*

**Purpose.** Gamified analytics from local data. Tabs: `Your Usage` (default) ·
`Your Voice`. Top-right `Share`.

**Layout** (dashboard grid). **Your Usage:**
```
Insights            [Your Usage | Your Voice]                      [Share ●]
┌ WPM ───────────┐ ┌ FIXES ─────────┐ ┌ TOTAL WORDS ───────────┐
│ 140            │ │ 61             │ │ 3,599                  │
│ WORDS/MINUTE   │ │ FIXES MADE     │ │ TOTAL WORDS DICTATED   │
│  ◠ Top 0.2%    │ │ 27 corrected   │ │ Desktop 3,599          │
│                │ │ 34 dict fixes  │ │ [Download on mobile]   │
└────────────────┘ └────────────────┘ └────────────────────────┘
┌ Desktop usage ───────────────┐ ┌ Streak ─────────────────────┐
│ TOTAL APPS USED | 7          │ │ 1 day   LONGEST | 3 DAYS     │
│ ▓▓▓▓▓▓▓ 93% AI prompts (161) │ │  Mar Apr May Jun  ‹ ›        │
│ ▓ 7% other tasks (23)        │ │  ▢▢▣▣▢▢ heatmap (teal)       │
│ 0% work / emails / docs …    │ │  More ▮▮▮▯ Less              │
└──────────────────────────────┘ └─────────────────────────────┘
```

**Components & formatting.**
- **Stat cards:** `--font-stat` number, `--font-label` caption, optional `ⓘ`.
- **Gauge:** semicircular, `--dataviz` arc; center percentile text.
- **Bar chart:** category rows = icon + `--dataviz` bar (width=%) + in-bar % + label
  (`count CATEGORY`). Categories: AI prompts, other tasks, work messages, emails,
  personal messages, documents.
- **Heatmap:** month headers + `‹ ›` paging; weekday rows Sun–Sat; cells greige→teal
  ramp; `More ▮▮▮▯ Less` legend.
- **Share:** circular rotating sticker badge → export image/share sheet.

**Your Voice (P2):** speaking pace over time, filler-rate trend, vocabulary growth.

**States.** Empty: "Start dictating to see insights." Loading: shimmer cards. Privacy:
if data retention off → counts only, "Enable history for full insights" note.

**A11y.** Every chart has a text/table equivalent; gauge/heatmap values are read out;
color is never the only signal (labels + values present).

---

## 3. Library pages — shared template  *(Dictionary P0, Snippets P1, Style P1, Transforms P1)*

All four share the **library template** (Ref: WF W3–W6). Differences are tabulated
after the common spec.

**Common layout.**
```
{Title}                                                        [Add new] / —
── {tabs} ───────────────────────────────────  [search][sort][refresh]
┌ promo banner (dismissible, photo bg, serif headline, examples, ×) ┐
└───────────────────────────────────────────────────────────────────┘
{entries: rows or card grid}
```
- **Header row:** `--font-h2` title + primary `Add new` (black-on-photo or `--accent`).
- **Tab row:** underline tabs (scopes/contexts) + right icon cluster (search, sort,
  refresh).
- **Promo banner:** `--radius-lg`, darkened photo, `--font-display` serif headline with
  one italic word, body line, inline example chips, an action chip, `×` (dismissal
  persisted per page).
- **Entries:** single card of divided rows (Dictionary/Snippets) or 3-up card grid
  (Transforms); each row/card has edit + delete (delete = danger, confirm).

### 3.1 Dictionary  *(P0 — Ref: WF W3)*
- **Tabs:** `All` · `Personal` · `Shared with team`.
- **Promo:** serif `Khonjel spells the way you do.`; quick-add chips.
- **Entry row:** term (e.g. `Prabin Pebam`) OR substitution `btw → by the way`
  (trigger `--text-primary`, arrow `--text-tertiary`, replacement `--text-secondary`).
- **Entry editor (L3):** Type (Term | Substitution); Term/Trigger; Replacement (if
  substitution); Scope; Save/Cancel. "Auto-add corrected words" hint links to System.

### 3.2 Snippets  *(P1 — Ref: WF W4)*
- **Tabs:** `All` · `Personal` · `Shared with team`.
- **Promo:** serif `The stuff you shouldn't have to re-type.`; trigger→expansion example chips.
- **Entry row:** `trigger → expansion` (expansion truncated with `…`).
- **Editor (L3):** Trigger phrase; Expansion (rich text); Scope; Save/Cancel; live
  preview of insertion.

### 3.3 Style  *(P1 — Ref: WF W5)*
- **Tabs (contexts):** `Personal messages` · `Work messages` · `Email` · `Other` ·
  `Auto Cleanup` `Beta`. No `Add new`/icon cluster.
- **Pre-setup:** promo `Make Khonjel sound like you` + `Start now`.
- **Configured per context:** tone (slider: casual↔formal), length bias, formatting
  preferences (bullets, greetings/sign-offs), example samples, and **app mappings**
  (which apps map to this context, user-editable). `Auto Cleanup` holds the global
  smart-formatting profile.

### 3.4 Transforms  *(P1 — Ref: WF W6)*
- **Header extras:** `Opt in` toggle + `ⓘ` + view-changes hotkey hint (`Win+Alt+O`).
- **Promo:** serif `Transforms work anywhere you write`; `Try it out` + `How it works`.
- **`My Transforms`** + `Reset to defaults` + `Create New`.
- **Card grid (3-up):** each card = keycap binding (`Win Alt 1`) + name + description.
  Defaults: **Polish** ("Improve clarity and conciseness"), **Prompt Engineer**
  ("Constructs optimal prompts"); a `+` **Create your own** card.
- **Editor (L3):** Name; Description; Prompt (syntax-highlighted); Hotkey capture;
  Engine/purpose; Enabled; Save/Delete. Import/export prompt file.

**Library states.** Empty (no entries) → "No {items} yet — Add new." Search no-match →
"No matches for '{q}'." Loading → skeleton. Team scope without account → CTA to sign in
(P2).

**Library a11y.** Tabs are a tablist; icon cluster buttons are labelled; entries are a
keyboarded list; editors are focus-trapped sub-views with breadcrumb back.

---

## 4. Scratchpad  *(P1 — Ref: WF W7)*

**Purpose.** Freeform dictated-notes workspace.

**Layout.**
```
Scratchpad  [Beta]
Recents                                          [search][+][refresh]
{note list  |  empty: "No notes found"}                         (●↑ FAB)
```
- **Header:** `--font-h2` title + `Beta` badge.
- **`Recents`** section header + icon cluster (search, add `+`, refresh).
- **Note list:** rows = title + preview + updated time; click → note editor.
- **FAB:** bottom-right, `--radius-pill`, dark circle, `↑`/record glyph → starts a
  dictated note.
- **Note editor (L3):** title (auto/manual), rich-text body, record/append button,
  re-run formatting, speakers (if diarized), share scope (P2), delete.

**States.** Empty: centered `No notes found` + FAB hint. Open behaviour honors
System ▸ "Scratchpad open behavior" (e.g. Resume last note). Loading: skeleton list.

**A11y.** FAB labelled "New dictated note"; list keyboarded; editor is a standard
rich-text region with AT support.

---

## 4b. OpenWhispr Control Panel screens (authoritative)

> Khonjel's primary navigation is **one unified sidebar**: **Home · Insights · Chat ·
> Notes · Upload · Dictionary · Transforms · Integrations**. The OpenWhispr base and the
> Wispr Flow surfaces are **merged into a single package**: **Insights** and
> **Transforms** are first-class destinations (specs in §2 and §3); **Style** folds into
> Settings ▸ Language Models ▸ Dictation Cleanup; **Snippets** sit under **Dictionary**;
> **Scratchpad** is absorbed by **Notes** (richer: folders + semantic search); **Voice
> Profiles** + stats live on **Home**. See the integration map in
> [`../02-information-architecture/01-sitemap-and-ia.md`](../02-information-architecture/01-sitemap-and-ia.md#21-reference-integration-map-every-goodness-has-one-definite-home).

### 4b.1 Chat  *(P1 — OpenWhispr `chat`)*
**Purpose.** Conversational AI agent inside Khonjel.
```
Chat
┌ message thread (user / assistant bubbles, markdown, streaming) ┐
│  … thinking/reasoning shimmer when reasoning mode on            │
└────────────────────────────────────────────────────────────────┘
[ message composer  · mic · send ]                    model/provider badge
```
- Streaming responses; **reasoning/thinking mode** indicator; markdown (react-markdown).
- Uses the **Chat** LLM purpose (any engine: local/providers/self-hosted/enterprise).
- Empty state: shared illustration + short prompt suggestions.
- Voice input via mic; or the **Chat Agent** global hotkey opens the **Agent Overlay**.

### 4b.2 Notes  *(P1 — OpenWhispr `personal-notes`, replaces Scratchpad)*
**Purpose.** Rich, searchable note workspace (TipTap).
```
Notes                                              [search ⌘K] [+ New]
┌ folders (tree) ┐ ┌ note list ────────┐ ┌ Note editor (TipTap) ───────┐
│ All            │ │ title · preview ·  │ │ Title (auto/manual)          │
│ ▸ Folder A     │ │ updated            │ │ rich body: headings, lists,  │
│ ▸ Folder B     │ │ …                  │ │ tasks, code, links           │
└────────────────┘ └────────────────────┘ │ [record/append] [AI actions] │
                                           └──────────────────────────────┘
```
- **Folders** + **semantic search** (Qdrant + MiniLM, **local**) over note content.
- **Note editor:** TipTap (headings, bullet/ordered/task lists, code, links, markdown
  I/O); record/append dictation; **AI actions** (summarize, rewrite, extract todos);
  speakers if from a meeting; optional **save-as-files** to a folder; optional sync.
- States: empty "No notes yet"; search no-match; loading skeletons.
- A11y: tree is a treeview; editor is an AT-friendly rich-text region.

### 4b.3 Upload  *(P1 — OpenWhispr `upload`)*
**Purpose.** Transcribe an **existing audio file**.
```
Upload
┌ drop zone:  "Drop an audio file or click to browse"  ┐
└──────────────────────────────────────────────────────┘
{queued file → transcribing (progress) → result → save as Note / copy}
```
- Drag-drop or browse; shows duration/format; runs the selected **STT engine**
  (local/cloud); progress; result becomes a History entry / Note; diarization optional.
- States: empty drop zone; invalid-format error; transcribing progress; done.

### 4b.4 Integrations  *(P1 — OpenWhispr `integrations`; ungated/free)*
**Purpose.** Connect external services. Sectioned list (icon tile + title + desc + action).
```
Integrations
CALENDAR   Google Calendar     [Connect]  (multi-account; primary-only toggle; disconnect)
API        Public API          [Manage]   → API keys dialog + docs        (FREE)
MCP        MCP server          [Set up]                                   (FREE)
CLI        CLI bridge          [Set up]                                   (FREE)
```
- **Google Calendar:** OAuth connect, connected-account rows, "primary calendars only",
  add-another; powers meeting auto-detection + reminders.
- **Public API / MCP / CLI:** **free in Khonjel** (OpenWhispr gates these behind Pro).
- A11y: each row is a labelled group; dialogs are focus-trapped.

---

## 5. Cross-screen conventions
- **Primary action** top-right of page (`Add new` / `Create New`); **destructive**
  actions always confirm and use `--danger`.
- **Search** filters the current page's list; `Ctrl/Cmd+F` focuses it.
- **Promo banners** are dismissible and remembered.
- **Right rail / dashboards** reflow per the responsive rules.
- **Every list entry** supports keyboard selection, open, edit, delete.
- **No emoji**; icons only. **No nags**; the only "upgrade" surface is honest and
  optional.

---

## 6. Per-screen acceptance checklist
- [ ] Onboarding completes fully offline with a local model; no forced account/cloud.
- [ ] Home renders day-grouped history with retained formatting + per-entry actions + stats rail.
- [ ] Chat streams responses with reasoning-mode indicator; uses the Chat purpose on any engine.
- [ ] Notes: folders + local semantic search (Qdrant+MiniLM) + TipTap editor + AI actions + optional save-as-files.
- [ ] Upload transcribes a file via the selected STT engine with progress and save-as-Note.
- [ ] Integrations: Google Calendar OAuth + Public API/MCP/CLI **free**; dialogs accessible.
- [ ] Dictionary (+ Snippets) follow the library template with entries and editors.
- [ ] Additive (WF): Insights/Style/Transforms render correctly where enabled.
