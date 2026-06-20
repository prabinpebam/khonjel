# Reference Analysis — Wispr Flow (wisper-flow)

> High-fidelity, screen-by-screen capture of the **wisper-flow** reference design.
> Purpose: preserve enough layout, copy, and visual detail to faithfully reproduce
> and adapt these screens for **Khonjel**. Copy is transcribed **verbatim** where
> legible. Pixel values are visual estimates expressed as ratios/scale.
>
> Source: `docs/reference-designs/wisper-flow/` (18 screenshots).
> The Khonjel adaptation lives in
> [`../03-ux-ui/03-screen-specifications.md`](../03-ux-ui/03-screen-specifications.md).

---

## Global shell & visual system (wisper-flow)

**Theme.** Light, **warm**. Window/sidebar background is a warm off-white/greige
(`~#F2F1EE`). Content surfaces are pure white (`#FFFFFF`) cards with a hairline warm
border (`~#E6E4DF`) and a soft shadow. Text: warm near-black (`~#2A2A28`) primary,
warm gray (`~#8A8780`) secondary, lighter gray for meta. **Accent = violet**
(`~#6C5CE7`) used sparingly (numbers, highlights, links); primary CTA is **solid
black** (`Upgrade to Pro`). Corners are generously rounded (~10–16px) throughout.

**Window chrome.** Custom title bar (~52px), greige. **Left cluster:** sidebar-
collapse glyph + account/avatar glyph. **Right cluster:** notification **bell**,
then native **minimize / maximize / close**. (This is a Windows build.)

**Left sidebar (~218px).** Sits on the greige; no hard divider — the white content
panel is a **rounded card floating on the greige** (rounded top-left corner where
they meet). Sidebar contents, top→bottom:

1. **Brand** — `Flow` wordmark + small waveform/bars glyph + **plan badge** (`Basic`, rounded outline pill).
2. **Primary nav** (icon + label rows, ~40px; selected = white rounded pill with soft shadow):
   `Home` (grid) · `Insights` (bar chart) · `Dictionary` (book) · `Snippets` (scissors) · `Style` (`Tt`) · `Transforms` (shuffle) · `Scratchpad` (note).
3. **Quota card** (white, rounded, near the bottom):
   - `313` **words remaining** (the number in violet/bold)
   - `You get 2,000 words per week. Upgrade for unlimited access.`
   - **`Upgrade to Pro`** button (black fill, full width).
4. **Footer nav** (plain icon+label rows):
   `Invite your team` (people) · `Get a free month` (gift) · `Settings` (gear, **red "1" badge**) · `Help` (question).

**Main content pattern.** Page leads with a large bold **greeting/title** (~28px),
optional date dividers, then the page body. A **secondary right rail** (~250px) can
float stat/summary cards alongside the main column.

---

## W1 — Home
*(092024)*

**Region map:**
- **Title** `Welcome back, Prabin` (large bold).
- **Date divider** `JUNE 18, 2026` (small uppercase, letter-spaced, gray).
- **Dictation history list** — reverse-chronological rows, each:
  - left **timestamp** column (~90px) e.g. `06:39 pm` (gray);
  - **transcript** body (warm near-black, ~15px), single- or multi-line; one entry
    (`04:14 pm`) renders a **bulleted list**, proving formatted (Markdown-ish) output
    is stored and displayed inline.
  - rows separated by very light hairlines.
- **Right rail — stats card** (white, rounded):
  - `3,599` **total words**
  - `140` **wpm**
  - `1` **day**
  - divider, then `Voice Profile` / `Design Critique` with a character illustration.

**Reproduction note:** Home is the **dictation history timeline** (grouped by day) +
a lightweight personal-stats rail and an active **Voice Profile**. Transcripts retain
rich formatting (bullets). This is the productivity "home base" missing from
open-wisper.

---

## W2 — Insights ▸ Your Usage
*(092037)*

> **Data-viz accent = teal/green** (`~#1F5C54`), distinct from the app's violet UI
> accent. Charts, gauges, bars, and the heatmap all use the teal ramp.

**Region map:**
- **Title** `Insights`; **underline tab bar** `Your Usage` (active) · `Your Voice`.
- Top-right: a circular **`SHARE · SHARE · SHARE`** sticker badge (rotating text, upload glyph center).
- **Card grid — row 1 (three stat cards):**
  1. `140` / `WORDS PER MINUTE` (ⓘ) + a **semicircular gauge** reading `Top 0.2%`.
  2. `61` / `FIXES MADE BY FLOW`; divided rows `27 words corrected` (ⓘ), `34 dictionary fixes` (ⓘ).
  3. `3,599` / `TOTAL WORDS DICTATED`; `Desktop / 3,599 words` + `Download on mobile` (outline button).
- **Card grid — row 2 (two wide cards):**
  4. **`Desktop usage`** + `TOTAL APPS USED | 7`. Horizontal **bar chart**, each row = category icon + teal bar (width = %) + in-bar % + label:
     `93% · 161 AI PROMPTS` · `7% · 23 OTHER TASKS` · `0% · 3 WORK MESSAGES` · `0% · 0 EMAILS` · `0% · 0 PERSONAL MESSAGES` · `0% · 0 DOCUMENTS`.
  5. **`1 day streak`** + `LONGEST STREAK | 3 DAYS`. **GitHub-style contribution heatmap**: month headers `Mar Apr May Jun` with ‹ › paging; weekday rows `Sun…Sat`; greige-to-teal cells; legend `More ▮▮▮▯ Less`.

**Reproduction note:** Insights is a **gamified analytics dashboard** — WPM percentile,
correction counts, total words, per-app usage breakdown (by message category), and a
streak heatmap. `Your Voice` is a second tab (not screenshotted). Shareable.

---

## Library page template (Dictionary, Snippets, Style, Transforms share this)

All four "library" pages reuse one chrome:
1. **Title** (left) + **`Add new`** primary button (black fill, right) — *(Style/Transforms vary)*.
2. **Underline tab bar** (left) + right-aligned **icon cluster**: search, sort, refresh.
3. **Dismissible promo/education banner** — rounded card with a **photographic
   background**, a **serif display headline** (with an italic emphasis word), a short
   body line, inline **example chips**, a primary chip action, and an `×` close.
4. **Entries list** — white container of divided rows.

---

## W3 — Dictionary
*(092043)*

- Title `Dictionary` + `Add new`.
- Tabs `All` (active) · `Personal` · `Shared with team`; icons search/sort/refresh.
- **Promo banner** (warm brown photo bg): serif headline `Flow spells the way you do.`
  (`you` italic); body `Flow learns your unique words and names — automatically or
  manually. Add personal terms, company jargon, client names, or industry-specific
  lingo. Share them with your team so everyone stays on the same page.`; quick-add
  chips `Add new word` · `Wispr Flow` · `Samir` · `Sara` · `Karol` · `Spyder`.
- **Entries** (one per row): `Prabin` · `prabinpebam@gmail.com` · `Prabin Pebam` ·
  `Wispr Flow` · `btw → by the way` (substitution rule rendered `trigger → output`).

**Reproduction note:** Dictionary = recognition/spelling vocabulary + simple
substitution rules. Two visibility scopes (Personal / Shared with team).

---

## W4 — Snippets
*(092100)*

- Title `Snippets` + `Add new`; same tabs + icon cluster.
- **Promo banner** (photo bg, person at desk): serif headline `The stuff you
  shouldn't have to re-type.` (`you` italic); body `Save anything you type often —
  your email, an intro, a prompt — and say a word or phrase to immediately replace
  it in place.`; example **trigger→expansion** chip pairs:
  `"my LinkedIn" → https://www.linkedin.com/in/john-doe/` ·
  `"rewrite prompt" → Rewrite this to be more concise…` ·
  `"intro email" → Hey, would love to find some time to chat later…`; action chip `Add new snippet`.
- **Entries** (rendered `trigger → expansion`, truncated):
  `my Flow referral → Hey, use my referral link to get 1 month off Wispr Flow! https://wisprflow.ai/r?PR…` ·
  `my email address → prabinpebam@gmail.com` ·
  `organize thoughts prompt → Organize these unstructured thoughts into a clear, polished version wi…`

**Reproduction note:** Snippets = **voice-triggered text expansion** for long, reused
text (signatures, links, prompts). Distinct from Dictionary: Dictionary fixes how
words are *recognised/spelled*; Snippets *insert* saved blocks on a spoken trigger.

---

## W5 — Style
*(092114)*

- Title `Style`.
- **Underline tabs** `Personal messages` (active) · `Work messages` · `Email` ·
  `Other` · `Auto Cleanup` **`Beta`** (violet badge). *(No `Add new`/icon cluster.)*
- **Promo banner** (dark photo bg, two people): serif headline `Make Flow sound like
  you` (`you` italic); body `Set up different writing styles for different apps.`;
  CTA chip `Start now` (a violet cursor-hint dot points at it).
- Remainder empty — this is the **pre-setup empty state**.

**Reproduction note:** Style = **per-context writing style** (tone/formatting) keyed
to the kind of app you're dictating into (personal vs work vs email vs other) plus an
`Auto Cleanup` (Beta) tab. Each tab holds a style configuration once set up.

---

## W6 — Transforms
*(092128)*

- Title `Transforms` **`Beta`** (black badge).
- Top-right: `Opt in` (ⓘ) + **toggle (ON)** + hotkey hint keycaps `Win` `Alt` `o`
  `to view changes`.
- **Promo banner** (desktop wallpaper bg with floating app icons — Slack, Gmail,
  LinkedIn, notes, etc.): serif headline `Transform works anywhere you write`; body
  `Apply a Transform to rewrite, clean up, or restructure text after you dictate.`;
  buttons `Try it out` (chip) + `How it works` (text link).
- **`My Transforms`** heading + `Reset to defaults` (text/refresh) + **`Create New`** (black button).
- **Transform cards** (3-up, white, rounded), each = keycap binding + name + description:
  - `Win Alt 1` · **`Polish`** · `Improve clarity and conciseness`
  - `Win Alt 2` · **`Prompt Engineer`** · `Constructs optimal prompts`
  - `+` · **`Create your own`** · `Upload your own prompt`

**Reproduction note:** Transforms = **hotkey-bound, on-demand AI rewrite actions**
that work system-wide on dictated/selected text. Each transform is a saved prompt
with its own global shortcut. Ships with defaults; users add their own.

---

## W7 — Scratchpad
*(092137)*

- Title `Scratchpad` **`Beta`** (black badge).
- Section header `Recents` + icon cluster search / `+` / refresh.
- **Empty state** centered: `No notes found`.
- **FAB** bottom-right: black circular button with an up-arrow (↑) glyph (dictate / new note).

**Reproduction note:** Scratchpad = a **freeform dictated-notes workspace** (a notes
list with a record FAB). Pairs with the Scratchpad settings (open behaviour, cloud
sync) seen later.

---

## Settings shell (modal)

Settings opens as a **centered modal** (~950×640, rounded ~16px, white, soft shadow)
over the dimmed app. Internal two-pane layout:

**Left nav rail (~190px, light greige):**

| Group | Items (icon) |
|---|---|
| `SETTINGS` | General (sliders, **red "1"**), System (monitor), Vibe coding (`#`) |
| `ACCOUNT` | Account (person), Team (people), Plans and Billing (card), Data and Privacy (shield) |

Footer: `Flow v1.5.897` + cloud-sync glyph.

**Right content pane.** Page title, then **setting cards**: a rounded greige container
of divided rows; each row = **label** (+ optional badge) and **sub-value/description**
on the left, **control** (Change button / dropdown / toggle) right-aligned.

---

## W8 — Settings ▸ General
*(092149)*

Card rows:
1. `Shortcuts` (red `1` badge) / `Hold` **`Ctrl`** `+` **`Win`** `and speak.` `Learn more →` (blue link) → `Change` button.
2. `Microphone` / `(Logitech Webcam C930e) (USB)` → `Change`.
3. `Dictation Languages` / `English` → `Change`.
4. `App Language` / `Select your preferred Wispr Flow Hub language` → dropdown `English`.

**Reproduction note:** General = push-to-talk shortcut (keycap chips), input device,
dictation language(s), and UI language. The "Shortcuts" badge mirrors the sidebar
Settings "1" — an attention/onboarding marker.

---

## W9-W13 - Settings - System
*(092155 / 092211 / 092216 / 092220 / 092225 - one scrolling page)*

Sections (each a bold sub-heading + a greige card of divided rows). Toggles render
**black when ON**.

**App settings**
- `Launch app at login` - ON
- `Show Flow bar at all times` - ON
- `Dictation reminder` - preview chip `Hold Ctrl Win to dictate` / `Not configured` -> `Customize`
- `Show app in dock` - ON

**Sound**
- `Dictation and notification sounds` - ON
- `Mute music while dictating` - ON

**Notifications**
- `Suggestions` / `Tips about getting set up or improving how you use Flow.` - ON
- `Announcements` / `New features or capabilities` - ON
- `Milestones` / `Word-count milestones, streaks, and referral activity` - ON

**Scratchpad**
- `Scratchpad open behavior` / `Resume last note` -> `Customize`

**Extras**
- `Auto-add to dictionary` / `Adds corrected words automatically` - ON
- `Creator mode` / `Show "Dictating with Wispr Flow" when dictating` - OFF
- `Smart Formatting` / `Smart Formatting has moved to the Auto Cleanup tab.` (link)
- `Add Wispr Flow to LinkedIn` / `Showcase Wispr Flow under Apps on your LinkedIn profile` -> `Add to LinkedIn`

**Data**
- `Reset app` / `Reset only if advised by Flow support. Learn more ->` -> `Reset & restart`

**Reproduction note:** System bundles OS-integration (launch at login, always-on bar,
dock, dictation-reminder overlay), sound, notification categories, Scratchpad resume
behaviour, "extras" (auto-dictionary, creator/branding mode, social), and a guarded
app reset. The **always-on bar** ("Show Flow bar at all times") is the persistent
floating dictation surface - a core runtime concept.

**Khonjel adaptation flag:** drop `Add to LinkedIn` / `Creator mode` branding
promos; keep the functional toggles.

---

## W14-W15 - Settings - Vibe coding
*(092246 popover; 092252 full)*

Card rows:
1. `Variable recognition (VS Code, Cursor, Windsurf)` / `Better understands variables in code. Learn more ->` -> `Set up` button.
   - **Setup popover** (`Set up variable recognition`): `Variable recognition reads your open file to better understand code as you dictate. It requires Screen Reader mode to be enabled in your IDE.` then steps for Cursor/Windsurf with code chips: open Command Palette `Cmd+Shift+P`, run `Toggle Screen Reader Accessibility Mode`, confirm `Screen Reader Optimized` flag.
2. `File Tagging in Chat (Cursor & Windsurf)` / `Automatically tags files in your IDE (like index.tsx)` -> toggle **ON**.

**Reproduction note:** developer-focused dictation. Reads the active IDE file to
transcribe code/variable names correctly and to auto-tag files in IDE chats. Niche /
advanced; optional for Khonjel.

---

## W16 - Settings - Account
*(092257)*

Card rows: `First name` -> input `Prabin`; `Last name` -> input `Pebam`; `Email` ->
read-only `prabinpebam@gmail.com`; `Profile picture` -> circular avatar. Action row
below the card: `Sign out` (button) - `Delete account` (text link) - `Save` (button).

**Reproduction note:** standard identity page; email immutable; destructive `Delete
account` is a low-emphasis text link, `Save` is the primary.

---

## W17-W18 - Settings - Data and Privacy
*(092307 top; 092313 scrolled)*

Single card, divided rows:
- `Privacy Mode` (lock glyph) / `If enabled, none of your dictation data will be used to train or improve AI models, by Wispr or any third party. Learn more ->` -> dropdown `Privacy Mode`.
- `Cloud Sync` / `Stores transcripts and audio on Wispr's servers to enable cross-device sync for Wispr Scratchpad. Learn more ->` -> toggle **OFF**.
- `Context awareness` / `Allow Flow to use limited, relevant text content from the app you're dictating in to spell names correctly and better understand you.` -> toggle **ON**.
- `Local data storage` / `Control how your transcripts are stored.` -> dropdown `Store data locally`.
- `Notes sharing` / `Default setting for newly created notes` -> dropdown `Anyone with the link`.
- `Hard refresh all notes` / `Force a full one-time sync to rescan and retrieve all your notes from the cloud.` -> `Sync notes` button (disabled).
- `Enable HIPAA` / `This is the HIPAA Business Associate Agreement (BAA) for yourself.` -> `View and accept`.

Below the card: `Read about our Data Controls` (outline button).

**Reproduction note:** the privacy surface = no-training Privacy Mode, optional cloud
sync, context awareness (reads on-screen text for accuracy - a privacy/utility
tradeoff), local-vs-cloud storage choice, default note-sharing scope, manual resync,
and an optional HIPAA BAA. Strong enterprise/compliance posture.

---

## Coverage notes (wisper-flow)

- Captured: Home, Insights (Your Usage), Dictionary, Snippets, Style, Transforms,
  Scratchpad, and Settings (General, System, Vibe coding, Account, Data and Privacy).
- **Not individually screenshotted** (nav exists): Insights `Your Voice` tab, `Team`,
  `Plans and Billing`. Khonjel defines these in the screen specs.
- Dominant patterns to carry into Khonjel: the **warm light app shell** with a
  **persistent left sidebar**, the **library page template** (title + Add new + tabs +
  icon cluster + dismissible promo + entries), the **stat/insights dashboard**, the
  **always-on floating bar**, and the **modal settings shell**.
