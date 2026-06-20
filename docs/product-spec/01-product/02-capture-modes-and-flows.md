# Khonjel — Capture Modes & Flows

> How voice becomes text and notes. Defines every capture mode, its activation, its
> runtime surface, its states, and its end-to-end flow. Pairs with the runtime UI in
> [`../03-ux-ui/04-floating-bar-overlays-and-settings.md`](../03-ux-ui/04-floating-bar-overlays-and-settings.md).

---

## 1. Capture modes

| Mode | Trigger | Surface | Output |
|---|---|---|---|
| **Dictation** | Dictation hotkey (Tap/Push-to-talk), default `Ctrl+Win` | Dictation Panel (Khonjel Bar) | Cleaned text **auto-pasted** at cursor |
| **Voice Agent** | Voice Agent hotkey (dedicated) | Agent overlay | Dictation sent to AI agent as a **command** (no wake word, no cleanup) |
| **Chat Agent** | Chat Agent hotkey | Agent overlay / Chat | Conversational turn |
| **Note Recording** | From Notes / Meeting | Bar or panel | Saved note (optionally diarized) |
| **Meeting Mode** | Meeting hotkey **or auto-detect** | Side/full panel | Long transcript + note (diarized) |
| **Upload** | Control Panel ▸ Upload | Upload view | Transcribe an existing audio file |

All share one capture pipeline; they differ in **surface**, **post-processing scope**,
and **destination**. Four **global hotkeys**: Dictation · Voice Agent · Meeting · Chat
Agent (per OpenWhispr).

---

## 2. Dictation (primary mode)

### 2.1 Activation
- **Default hotkey:** `Ctrl + Win` (rebindable). (OpenWhispr Hotkeys.)
- **Activation modes:**
  - **Tap** — tap to start, tap to stop (hands-free for long dictation).
  - **Push-to-talk (Hold)** — hold to talk, release to stop (quick bursts).
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

- **Dedicated hotkey** *and* **auto-detection**: Khonjel detects active **Zoom / Teams /
  FaceTime** calls and shows a **meeting-notification overlay** offering to record.
- On start, the capture UI opens in the configured **layout** (`Full width` or
  `Side panel`) so it doesn't block the call.
- Captures mic **+ system audio** (native helpers; **AEC/VAD** via meeting-aec-helper).
- Produces a long transcript with **live speaker diarization** + **voice fingerprint**
  (recognise speakers across meetings, on-device) → saved as a **Note** (auto-title).
- **Google Calendar** integration surfaces **upcoming meetings** and reminders.
- Suited to calls, interviews, lectures. v1: single-device capture; large-scale
  multi-party infrastructure is out of scope (see vision non-goals).

---

## 4b. Upload (file transcription)

- **Control Panel ▸ Upload**: drag-drop or browse an **existing audio file**.
- Runs the selected **STT engine** (local/cloud) with progress; optional diarization.
- Result becomes a **History** entry and/or a **Note**; copy/save actions.

---

## 5. Voice Agent & Chat Agent

- **Voice Agent (dedicated hotkey):** dictation is sent **straight to the AI agent as a
  command** — **no wake word needed and no cleanup pass** (per OpenWhispr). Routed to
  the **Voice Agent** LLM scope; answers/acts in the **Agent overlay**.
- **Chat Agent (hotkey) / Chat view:** conversational turns with the **Chat** scope
  (reasoning/thinking mode aware).
- **Inline wake word** (optional): saying the **agent name** ("Khonjel") during
  dictation can switch that utterance from *transcribe* to *instruct*.
- **Security:** the default cleanup prompt treats transcribed speech as *data, not
  instructions*. Only the dedicated agent hotkey / explicit wake word enters instruction
  mode — preventing prompt-injection via dictated content. See
  [`04-text-intelligence.md`](04-text-intelligence.md#5-prompt-studio--the-unified-prompt).

---

## 6. Notes (capture destination)

- The **Notes** workspace (TipTap, folders, **local semantic search**) is the home for
  recorded/dictated notes and meeting transcripts (replaces the Wispr "Scratchpad").
- Notes are full transcripts; editable; titled (auto via Note Formatting or manual);
  support **AI actions** (summarize/rewrite/extract todos); optional **save-as-files**
  and optional sync. Empty state: "No notes yet".

---

## 7. Cross-mode behaviours

| Concern | Behaviour |
|---|---|
| **Cancel** | `Esc` cancels any in-progress capture without inserting/saving. |
| **Auto-paste** | Final dictation text is pasted at the cursor (toggle); optionally kept in clipboard. |
| **Sounds** | Dictation cues (toggle); pause media while dictating. |
| **Language** | Uses configured Dictation Language; multilingual via Local STT (Whisper/Parakeet). |
| **Microphone** | Uses selected input device; prefer-built-in option. |
| **Offline** | Dictation + Cleanup work fully offline with Local engines (core principle). |
| **Auto-learn Dictionary** | Corrected words can be auto-added to the dictionary. |

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
