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

## 2. Notes — Ref: OW + WF (Scratchpad)

Saved transcripts and recordings (from Note Recording, Meeting Mode, Scratchpad).

- **List:** `Recents` with search, add, refresh; empty state `No notes found`.
- **Note object:** title (auto/manual), body (formatted transcript), source audio
  (optional, per retention), speakers (if diarized), created/updated, tags, sharing
  scope.
- **Editing:** full text edit; re-run formatting/cleanup; rename; delete.
- **Sync (P2):** optional cloud sync for cross-device access (off by default).
- **Sharing (P2):** per-note sharing scope (e.g. "Anyone with the link"); default set
  in Data & Privacy (Ref: WF W18).

---

## 3. Insights — Ref: WF W2

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

## 4. Collaboration & Team (P2)

> Optional layer for teams/enterprises. Khonjel works fully without any account.

### 4.1 Account — Ref: WF W16
- Fields: `First name`, `Last name`, `Email` (read-only), `Profile picture`.
- Actions: `Sign out`, `Delete account` (low-emphasis text link), `Save` (primary).
- **Local-only mode:** account is optional; a local profile works without sign-in.

### 4.2 Team
- Invite members; shared **Dictionary** and **Snippets** ("Shared with team" scope).
- Roles/permissions (admin/member); shared vocabulary governance.

### 4.3 Plans & Billing (optional)
- Only relevant to **Khonjel Cloud** managed tier and team seats.
- Honest, dismissible quota; **local use is unmetered and free** (no hard caps).
- Drops the references' referral nags / social-promo upsells.

---

## 5. Notifications & milestones — Ref: WF W10–W11
- **Categories (toggle each):** `Suggestions` (setup/usage tips), `Announcements`
  (new features), `Milestones` (word-count milestones, streaks, referral activity).
- Milestones tie into Insights gamification.

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
