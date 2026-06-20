# Khonjel — Notes, History, Insights & Collaboration

> The review and account surfaces: the Home history timeline, saved Notes, the
> Insights analytics dashboard, Voice Profiles, and the team/account/billing layer.

---

## 1. Home & dictation history — Ref: WF W1

**Home is the dictation history timeline** — the productivity "home base".

- **Greeting** `Welcome back, {name}`.
- **Day dividers** (`JUNE 18, 2026`) group entries; reverse-chronological.
- **Entry row:** `[timestamp] [transcript body]`. Transcripts retain rich formatting
  (bullet lists, paragraphs).
- **Per-entry actions** (on hover / select): copy, re-insert, edit, delete, re-run
  cleanup, re-transcribe (if audio retained), create snippet from, view source audio.
- **Right rail — personal stats card:** `total words`, `wpm`, `streak (days)`, and the
  active **Voice Profile** (e.g. "Design Critique").
- **Search & filter:** by text, date, app, language.

### 1.1 Voice Profiles — Ref: WF W1 (P2)
- Named dictation personas that tune behaviour/cleanup/style for a context.
- Switchable from Home; one active at a time.

---

## 2. Notes — OpenWhispr `personal-notes` (TipTap)

The primary note workspace (replaces the Wispr "Scratchpad"). Built on **TipTap 3**.

- **Organization:** **Folders** (tree) + flat list; per-note tags.
- **Local semantic search:** **Qdrant + MiniLM embeddings**, fully on-device — search
  by meaning across note content (`?q=…`), not just keywords.
- **Note object:** title (auto via Note Formatting / manual), rich body (TipTap JSON +
  markdown), folderId, tags, source audio (optional, per retention), speakers (if from
  a meeting), created/updated, optional `filePath` (save-as-files), `syncState`.
- **Editor:** headings, bullet/ordered/**task** lists, code, links, markdown I/O;
  **record/append** dictation into a note; **AI actions** (summarize, rewrite, extract
  todos) using the **Note Formatting / Chat** scopes.
- **Save notes as files (P2):** mirror notes to a chosen folder on disk; rebuild index.
- **Sync (P2):** optional cloud backup/sync for cross-device access (**off by default**,
  no subscription). Empty state: `No notes yet`.

---

## 3. Insights *(merged from Wispr Flow)* — Ref: WF W2

> **Home in Khonjel:** a **first-class sidebar destination** (`/insights`), computed
> entirely from **local history**. It originates from Wispr Flow but is fully merged
> into the unified app — not an optional add-on.

A **gamified analytics dashboard**. Tabs: `Your Usage` · `Your Voice`. Shareable.

### 3.1 Your Usage
- **Words per minute** — big number + semicircular gauge + percentile (e.g. "Top 0.2%").
- **Fixes made** — total + breakdown (`words corrected`, `dictionary fixes`).
- **Total words dictated** — total + per-surface (Desktop), "Download on mobile" (P2).
- **App usage** — `TOTAL APPS USED | n` + horizontal bar chart by category:
  *AI prompts · other tasks · work messages · emails · personal messages · documents*.
- **Streak** — `current streak` + `LONGEST STREAK | n` + GitHub-style contribution
  heatmap (month paging, weekday rows, intensity ramp, More/Less legend).

### 3.2 Your Voice (P2)
- Voice/speaking analytics (pace, filler rate over time, vocabulary growth).

### 3.3 Data sourcing & privacy
- Insights are computed from **local history**; no content leaves the device.
- If Data Retention is off, Insights show only aggregate counts (no transcript bodies).

---

## 4. Profile, Collaboration & Team

> Khonjel works fully **without any account**. There is always a **local profile**;
> cloud sign-in is an optional extra used only for opt-in sync/teams.

### 4.1 Local profile (default — on-device)
- A **local profile** lives on the device: display name, avatar, and preferences. It is
  **not an account**, requires **no sign-in**, and **never leaves the machine**.
- All of a user's data (history, notes, dictionary, snippets, settings, models) is keyed
  to this local profile and stored locally.

### 4.2 Cloud account — optional
- **Optional and skippable.** When auth is disabled (no `AUTH_URL`), the Account page
  shows "Account features disabled" and Khonjel runs **fully local with only the local
  profile**.
- When signed in: avatar + name + email (read-only) + **Signed In** badge; `Sign out`;
  `Delete account` (danger). Signed-out shows an **Offline** badge.
- A cloud account exists **only** to enable optional cross-device **sync** / workspaces —
  never required, never for billing.

### 4.3 Workspace / Team (optional, feature-flagged)
- Invite members; shared **Dictionary** and **Snippets**; roles (admin/member).
- Gated by a feature flag; entirely optional; local-first by default.

### 4.4 ~~Plans & Billing~~ — REMOVED
- **There is no subscription, billing, pricing, checkout, quota, referral, or upgrade
  surface.** Local use is free and unmetered; Public API / MCP / CLI are **free**.
- "Khonjel Cloud" (optional sync backend) is **not** a paid tier and is self-hostable.

---

## 5. Notifications — OpenWhispr (General ▸ Notifications)
- **Categories (toggle each):** `Disable all` · `Meeting detection` (auto-detected
  calls) · `Calendar reminders` (upcoming meetings) · `Updates` (new versions).
- *(Additive, Wispr Flow: Suggestions / Announcements / Milestones if Insights enabled.)*

---

## 6. Empty, loading & error states
| Surface | Empty | Loading | Error |
|---|---|---|---|
| Home history | "Nothing dictated yet — press {hotkey} and speak." | skeleton rows | retry banner |
| Notes | `No notes found` + record CTA | skeleton list | retry |
| Insights | "Start dictating to see insights." | shimmer cards | partial + note |

---

## 7. Requirements & acceptance
- [ ] Home shows day-grouped, reverse-chron history with formatting retained + per-entry actions.
- [ ] Notes support auto/manual titles, edit, delete, optional audio, diarized speakers.
- [ ] Insights renders WPM/percentile, fixes, totals, per-app usage, and streak heatmap from local data.
- [ ] Account is optional; local-only profile works; team sharing is additive (P2).
- [ ] No content leaves the device to compute Insights.
