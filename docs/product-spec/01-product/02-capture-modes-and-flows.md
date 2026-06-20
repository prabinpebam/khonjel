# Khonjel — Capture Modes & Flows

> How voice becomes text and notes. Defines every capture mode, its activation, its
> runtime surface, its states, and its end-to-end flow. Pairs with the runtime UI in
> [`../03-ux-ui/04-floating-bar-overlays-and-settings.md`](../03-ux-ui/04-floating-bar-overlays-and-settings.md).

---

## 1. The four capture modes

| Mode | Trigger | Surface | Output |
|---|---|---|---|
| **Dictation** | Dictation hotkey (Tap/Hold), default `Ctrl+Win` | Khonjel Bar | Cleaned text inserted at cursor in active app |
| **Note Recording** | From Scratchpad / Meeting Mode | Khonjel Bar or side panel | Saved note (optionally diarized) |
| **Meeting Mode** | Meeting Mode hotkey | Side-snapped panel | Long transcript + note |
| **Voice Agent** | Agent hotkey, or saying the agent name during dictation | Agent overlay | Action / answer (not raw transcript) |

All four share one capture pipeline; they differ in **surface**, **post-processing
purpose**, and **destination**.

---

## 2. Dictation (primary mode)

### 2.1 Activation
- **Default hotkey:** `Ctrl + Win` (rebindable). (Ref: OW S15, WF W8.)
- **Activation modes** (Ref: OW S15):
  - **Tap** — tap to start, tap to stop (hands-free for long dictation).
  - **Hold** — hold to talk, release to stop (push-to-talk for quick bursts).
- Optional **voice activation** later (P2): start on wake word.

### 2.2 Runtime states (Khonjel Bar)
```
idle ──hotkey──▶ listening ──stop──▶ transcribing ──▶ cleaning ──▶ inserting ──▶ idle
                    │                                                    │
                    └──────────────── cancel (Esc) ─────────────────────┘
```
| State | Bar shows | Notes |
|---|---|---|
| Idle | Compact pill (mic glyph) | Visible only if "Show Khonjel Bar at all times" |
| Listening | Live waveform + elapsed time | Audio level animates; Esc cancels |
| Transcribing | Spinner + "Transcribing…" | STT engine runs (local/cloud) |
| Cleaning | Spinner + "Cleaning…" | Only if Cleanup enabled |
| Inserting | Brief check | Text placed at cursor; sound if enabled |
| Error | Inline error + retry | e.g. no model, endpoint down |

### 2.3 End-to-end flow
1. User focuses a text field in any app and triggers the hotkey.
2. Khonjel Bar enters **listening**; audio is captured (mic per settings); music optionally muted.
3. On stop, audio → **STT engine** (selected archetype) → raw transcript.
4. **Dictionary** substitutions + recognition hints applied.
5. If **Cleanup** is enabled → **LLM (Dictation Cleanup purpose)** removes fillers, fixes grammar/punctuation; **Style** may adapt tone to the target app.
6. **Snippets** triggers expand; if the agent name is detected → hand off to **Voice Agent**.
7. Final text inserted at the cursor; entry appended to **History**; audio retained per **Audio Retention**.

### 2.4 Insertion semantics
- Default: paste/insert at cursor in the active app.
- If "Data Retention" is **off**: text is inserted but **not saved** to history (Ref: OW S14).
- Respects **Context awareness** (P1): optionally reads nearby on-screen text to spell names right (Ref: WF W17).

---

## 3. Note Recording & diarization

- Captures a longer passage as a **saved note** rather than inserting into another app.
- **Speaker diarization** (Ref: OW S3): "Identify and label speakers".
  - On → transcript segments are attributed to detected speakers.
  - Off → segments labelled generically as **"You"** and **"Others"**.
- Note Recording uses its own **STT engine selection tab** (Dictation vs Note Recording) — they can use different engines (Ref: OW S1/S3).
- After capture: **Note Formatting** purpose may auto-generate a **title** (Ref: OW S13) and structure the note.
- Saved into **Notes / Scratchpad** and **History**.

---

## 4. Meeting Mode

- Dedicated hotkey (Ref: OW S15).
- On trigger, the capture UI **snaps to the side of the screen** as a panel for an
  ongoing session (so it doesn't block the conversation/app).
- **"When triggered by hotkey, open in:"** layout option (e.g. `Full width`, side
  panel) (Ref: OW S15).
- Produces a long transcript with diarization → saved as a note. Suited to calls,
  interviews, and lectures.
- v1 scope: single-device microphone/system-audio capture; large-scale multi-party
  infrastructure is **out of scope** (see vision non-goals).

---

## 5. Voice Agent

- **Two entry points:**
  1. **Agent hotkey** toggles the **agent overlay** (Ref: OW S15).
  2. **Inline wake word** — saying the **agent name** ("Khonjel") during dictation switches that utterance from *transcribe* to *instruct* (Ref: OW S6/S11).
- Speech is interpreted as an **instruction** and routed to the **Voice Agent LLM
  purpose**, which can answer, rewrite, or perform an action — rather than being
  pasted verbatim.
- **Security:** the default cleanup prompt treats transcribed speech as *data, not
  instructions* (Ref: OW S7). Only the explicit wake word / agent overlay switches to
  instruction mode. This prevents prompt-injection via dictated content. See
  [`04-text-intelligence.md`](04-text-intelligence.md#5-prompt-studio--the-unified-prompt).
- Configurable enable toggle and wake word (Ref: OW S11).

---

## 6. Scratchpad

- A **freeform dictated-notes workspace** (Ref: WF W7): a `Recents` list + search +
  add + refresh, and a **record FAB**.
- **Open behaviour** setting: e.g. **Resume last note** (Ref: WF W11).
- Notes are full transcripts (not inserted elsewhere); editable; titled (auto or
  manual); optionally cloud-synced (P2).
- Empty state: `No notes found`.

---

## 7. Cross-mode behaviours

| Concern | Behaviour |
|---|---|
| **Cancel** | `Esc` cancels any in-progress capture without inserting/saving. |
| **Sounds** | Start/stop/notification sounds (toggle); mute music while dictating (Ref: WF W10). |
| **Language** | Uses configured Dictation Language(s) (Ref: WF W8); multi-language supported by Local STT. |
| **Microphone** | Uses selected input device (Ref: WF W8). |
| **Offline** | Dictation + Cleanup must work fully offline with Local engines (core principle). |
| **Auto-add to Dictionary** | Corrected words can be auto-added (Ref: WF W12). |

---

## 8. Mode → engine/purpose mapping

```
Dictation        → STT(Dictation tab)      → Cleanup purpose → Style → insert
Note Recording   → STT(Note Recording tab) → Note Formatting purpose → save note
Meeting Mode     → STT(Note Recording tab) + diarization     → Note Formatting → save
Voice Agent      → STT                      → Voice Agent purpose → act/answer
Scratchpad       → STT                      → (Cleanup/Note Formatting) → save note
```

Each STT/LLM choice is configured independently per the engine system in
[`03-ai-engines-and-providers.md`](03-ai-engines-and-providers.md).
