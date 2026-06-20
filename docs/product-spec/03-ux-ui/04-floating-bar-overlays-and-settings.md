# Khonjel — Floating Bar, Overlays & Settings Specification

> The runtime surfaces (Khonjel Bar, overlays) and the complete Settings UI spec.
> Settings screens are the most heavily referenced in OpenWhispr/Wispr Flow, so they
> are specified row-by-row. Tokens: [`01-design-language.md`](01-design-language.md).

---

# PART A — KHONJEL BAR & OVERLAYS

## 1. Khonjel Bar (always-on floating pill)  *(P0 — Ref: WF "Flow bar")*

A small always-available window that is the live capture surface. Visibility follows
System ▸ "Show Khonjel Bar at all times"; otherwise it appears only during capture.

**Anatomy & states.**
```
idle:        ( ● )                      compact circular/pill, mic glyph
listening:   ( ▮▮▮▯▮  0:04  ✕ )         waveform + timer + cancel
transcribing:( ◌  Transcribing… )       spinner + label
cleaning:    ( ◌  Cleaning… )           spinner + label
inserting:   ( ✓ )                      brief success
error:       ( ! message  ↻ )           inline error + retry
```
- **Placement:** bottom-center by default; draggable; remembers position; snaps to edges.
- **Idle interactions:** click = start; right-click = **quick menu** (mode:
  Dictation/Note/Agent · microphone · dictation language · open Main Window · Settings).
- **Listening:** live waveform (`--accent`/`--dataviz`), elapsed timer, `✕`/`Esc` cancel.
- **Sizing:** ~`220×44` idle/processing, expands to ~`320×56` listening.
- **Shadow** `--shadow-pop`; `--radius-pill`; theme-aware.
- **Reduced motion:** static level meter instead of animated waveform.

## 2. Agent overlay  *(P1 — Ref: OW agent hotkey)*
- Toggled by the Agent hotkey or by saying the agent name during dictation.
- A focused floating panel: prompt input (voice or text), streaming answer/action,
  and "apply"/"insert" controls. Uses the **Voice Agent** purpose.
- Clear visual distinction from dictation (accent header "Agent") to signal
  instruction mode (security: only here/wake-word is speech treated as a command).

## 3. Meeting Mode panel  *(P1 — Ref: OW S15)*
- Side-snapped panel (left/right per layout setting; "open in" = `Full width` option).
- Shows live transcript with **speaker labels** (or You/Others), elapsed time,
  pause/stop, and a save-as-note action. Auto-title on save.

## 4. Transform preview  *(P1 — Ref: WF W6 "view changes")*
- Triggered by the view-changes hotkey after a Transform.
- Before/after **diff** (additions/removals highlighted); `Apply` / `Discard`.

## 5. Notification toasts  *(P1 — Ref: WF W10–W11)*
- Categories: Suggestions, Announcements, Milestones (each toggleable).
- Elevated pill/card, icon + text + optional action; auto-dismiss; stack bottom-right;
  never interrupt capture.

---

# PART B — SETTINGS SPECIFICATION

> Modal shell from [`02-app-shell-and-layout.md`](02-app-shell-and-layout.md#4-settings-layout-modal).
> Pattern: each page = `H2 title` → `[section header (+subtitle)]` → `card(s) of setting
> rows`. **Setting row** = title (+badge) + subtitle on the left, control on the right.
> The **engine card** + **engine-specific config** pattern is defined once in §B2 and
> reused by Speech-to-Text and Language Models.

## B0. Settings nav rail
```
GENERAL        General · Hotkeys · Appearance
AI MODELS      Speech-to-Text · Language Models
SYSTEM         System · Vibe coding(P2)
PRIVACY & DATA Privacy & Data
ACCOUNT        Account(P2) · Team(P2) · Plans & Billing(P2)
─────────────────────────────────────────
footer: Khonjel v1.0 · ☁ health/sync dot
```

## B1. General  *(P0 — Ref: WF W8)*
Card rows:
| Row | Subtitle/value | Control |
|---|---|---|
| `Shortcuts` (badge if unset) | `Hold` `Ctrl`+`Win` `and speak.` `Learn more →` | `Change` |
| `Microphone` | current device, e.g. `(Logitech Webcam C930e)` | `Change` (device list) |
| `Dictation Languages` | `English` (one or more) | `Change` (multi-select) |
| `App Language` | `Select your preferred Khonjel language` | dropdown |

## B2. Hotkeys  *(P0 — Ref: OW S15)*
- **Dictation Hotkey** section: `Hotkey` → keycap chips (`Ctrl` `Win`) + `click to
  change`; **Activation Mode** segmented `Tap | Hold`.
- **Meeting Mode Hotkey** section: setter button `Click to set hotkey`; row `When
  triggered by hotkey, open in:` → dropdown (`Full width` / side panel).
- **Agent Hotkey** section: setter `Click to set hotkey` (`toggle the agent overlay`).
- **Transforms** (link to Transforms page): lists transform hotkeys (Polish, Prompt
  Engineer, view-changes) for reference.
- **Capture UX:** clicking a setter enters "press keys" mode; shows live combo; detects
  conflicts (warns if a combo is taken by OS/another action).

### Engine card pattern (reused by B4, B5)
```
{engine card: single-select rows}
  ◉ Local            On-device models. Fully private.        (default)
  ○ Self-Hosted      Your own server on your network.
  ○ Cloud Providers  Bring your own API key.
  ○ Enterprise       Use your org cloud account (AWS, Azure, GCP).
  ○ Khonjel Cloud    Managed. No setup. (optional)
{engine-specific config block — keyed to selection}
```
- **Local:** family chips (Qwen·Mistral·Llama·OpenAI·Gemma) → Available Models list
  (name·size·Learn more·Recommended·Download/Use/Remove). Background downloads.
- **Self-Hosted:** `Endpoint URL` (mono) + helper (`Ollama, LM Studio, vLLM,
  llama-server`); `API Key (Optional)` (Bearer); `Available Models` + `Refresh`
  (queries `/models`, inline raw error); `Disable thinking output` toggle.
- **Cloud Providers:** provider chips (OpenAI·Anthropic·Google Gemini·Groq·Custom);
  `API Key` + `Get your API key →`; `Select Model` (name + capability line).
- **Enterprise:** provider (Bedrock/Azure OpenAI/Vertex) + account/region/deployment + key.
- **Khonjel Cloud:** none (managed).

## B3. Appearance  *(P1 — NEW)*
- `Theme` → segmented `System | Light | Dark`.
- `Accent` → swatch picker (default violet).
- `Density` → `Comfortable | Compact`.
- `Reduce motion` → toggle (also follows OS).

## B4. Speech-to-Text  *(P0 — Ref: OW S1–S3)*
- Subtitle `Pick an engine for dictation and note recording`.
- **Mode pills:** `Dictation | Note Recording` (independent engine per mode).
- **Engine card** (§B2) + **engine-specific config**.
- **Note Recording** adds: `Identify and label speakers` toggle (off → "You"/"Others").

## B5. Language Models  *(P0 — Ref: OW S4–S13)*
- Subtitle `Configure models for cleanup, note formatting, and chat`.
- **Purpose pills:** `Dictation Cleanup | Voice Agent | Note Formatting | Chat`.
- Per purpose: `[enable toggle card] → [engine card §B2] → [config] → [extras]`.

| Purpose | Enable toggle | Extras |
|---|---|---|
| Dictation Cleanup | `Enable text cleanup` — "remove fillers, fix grammar, polish punctuation" | **Prompt Studio**; `Disable thinking output` |
| Voice Agent | `Enable voice agent` — "Activate by saying '{{agentName}}'." | wake-word field |
| Note Formatting | `Auto-generate note titles` | — |
| Chat | *(none)* | `System Prompt` textarea ("Custom instructions for the agent") |

### B5.1 Prompt Studio  *(P1 — Ref: OW S5–S7)*
- Subtitle `View, customize, and test the unified system prompt that powers text
  cleanup and instruction detection`.
- **Underline tabs:** `View | Customize | Test`.
  - **View:** read-only default prompt + `Copy`.
  - **Customize:** caution banner ("Keep the `{{agentName}}` placeholder…"); syntax-
    highlighted editable prompt (violet `{{agentName}}` tokens). Save/Reset.
  - **Test:** `MODEL` / `PROVIDER`; `Input` textarea + mode tag `CLEANUP`; helper
    ("Try addressing '{{agentName}}' to test instruction mode"); `Run Test`; result.
- Default prompt verbatim in [`../01-product/04-text-intelligence.md`](../01-product/04-text-intelligence.md#54-default-prompt-carried-from-the-reference-agent-name-templated).

## B6. System  *(P0 — Ref: OW S8–S9, WF W9–W13)*
Sections (each header + card). Toggles ON = `--accent`/black.

**App**
- `Launch app at login` (ON) · `Show Khonjel Bar at all times` (ON) · `Dictation
  reminder` (preview chip + `Customize`, "Not configured") · `Show app in dock` (ON).

**Sound**
- `Dictation and notification sounds` (ON) · `Mute music while dictating` (ON).

**Notifications**
- `Suggestions` ("Tips about setup/usage") · `Announcements` ("New features") ·
  `Milestones` ("Word-count milestones, streaks").

**Scratchpad**
- `Scratchpad open behavior` (`Resume last note`) + `Customize`.

**Extras**
- `Auto-add to dictionary` ("Adds corrected words automatically", ON).
- *(Dropped from references: Creator/branding mode, "Add to LinkedIn".)*

**Updates**
- `Current version` `1.0.0` + `Latest` badge + `Check for Updates`.

**Debug Logging**
- `Debug mode` (OFF) + **What gets logged** (two bulleted columns: Audio processing ·
  FFmpeg/audio ops · Transcription pipeline | Model/API requests · System diagnostics ·
  Error details).

**Data Management**
- `Model cache` + path (mono) → `Open` + `Clear Cache` (danger filled).
- `Reset app data` → `Reset` (danger outline) — "Permanently delete all local settings,
  transcriptions, audio recordings, downloaded models, and cached data." Confirm dialog.

## B7. Vibe coding  *(P2 — Ref: WF W14–W15)*
- `Variable recognition (VS Code, Cursor, Windsurf)` + `Set up` (popover: enable IDE
  Screen Reader mode; code chips for steps).
- `File Tagging in Chat (Cursor & Windsurf)` toggle ("Automatically tags files like
  `index.tsx`").

## B8. Privacy & Data  *(P0 — Ref: OW S14, WF W17–W18)*
- Subtitle `Control what data leaves your device. Everything is off by default.`

**Privacy**
- `Privacy Mode` → dropdown ("none of your dictation data will be used to train or
  improve AI models, by Khonjel or any third party").
- `Cloud backup` (OFF) · `Usage analytics` (OFF — "anonymous metrics only; never
  transcription content").
- `Context awareness` (toggle) — "Allow Khonjel to use limited, relevant text from the
  app you're dictating in to spell names correctly." (privacy/utility tradeoff).

**Storage & retention**
- `Local data storage` → dropdown `Store data locally` (default).
- `Audio Retention` → dropdown (`30 days` …) + `Storage Usage` (`n files, x MB`) +
  `Clear All Audio`.
- `Data Retention` (ON) — "Store transcriptions and audio locally in history. When
  disabled, transcriptions are pasted but not saved."

**Sharing & compliance (P2)**
- `Notes sharing` → default scope dropdown (`Anyone with the link`).
- `Cloud Sync` (OFF) · `Hard refresh all notes` + `Sync notes`.
- `Enable HIPAA` + `View and accept` (BAA). `Read about our Data Controls` link.

## B9. Account / Team / Plans & Billing  *(P2 — Ref: WF W16)*
- **Account:** `First name`, `Last name` (inputs), `Email` (read-only), `Profile
  picture`; `Sign out` · `Delete account` (text link) · `Save`.
- **Team:** members list, invite, shared Dictionary/Snippets governance, roles.
- **Plans & Billing:** managed-tier plan, seats, invoices. Honest quota; local use free.

---

## C. Settings acceptance checklist
- [ ] Modal shell with the five nav groups + version/health footer.
- [ ] Engine card + engine-specific config reused identically on STT and all LM purposes.
- [ ] Local default; Self-Hosted `/models` discovery with inline errors; provider matrix complete; Enterprise providers present.
- [ ] Prompt Studio View/Customize/Test with `{{agentName}}` preserved.
- [ ] System covers app/sound/notifications/scratchpad/extras/updates/debug/data-management; destructive actions confirm.
- [ ] Privacy everything-off-by-default; retention + storage meter + clear; data-retention semantics honored.
- [ ] Dropped: creator/branding/LinkedIn promos and referral nags.
