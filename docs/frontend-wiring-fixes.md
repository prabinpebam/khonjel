# Frontend Wiring Fixes — Tracking List

Source: systematic view-by-view audit of every interactive control in the renderer.
Goal: no UI that lies. Every control must either **do something real** or **not be shown**.

**Legend:** `[ ]` pending · `[~]` in progress · `[x]` done · `[-]` won't-do (with reason)

**Resolution types:**
- **WIRE** — connect the existing control to real runtime behavior.
- **IMPLEMENT** — build the missing handler/capability behind the control.
- **REMOVE** — delete/hide the control because the feature needs unbuilt infrastructure (keeps the UI honest).
- **SOFTEN** — replace a fake indicator with an honest one.

> Progress: **39 / 64 done** (updated as work proceeds).
>
> **Decisions (from review):**
> - Cloud/team features (Account, Workspace, cloud backup, Integrations OAuth) -> **REMOVE** the non-functional UI.
> - **BUILD the floating dictation bar** (capture audio -> transcribe -> clean -> paste into the focused app). Core value prop. This re-classifies the `floating*` + `stt.dictation.preview` settings from REMOVE to **WIRE**.
> - Small local features -> **WIRE all** for real.
> - Meeting mode + Voice agent surfaces were not requested -> their settings/hotkeys stay **REMOVE**.

---

## A. Dead buttons (no handler)

- [x] **A1** System → "Check now" (updates) — REMOVE (no update server; see C8).
- [x] **A2** System → "Open logs" — IMPLEMENT (open log file/folder via main).
- [x] **A3** System → "Open DevTools" — IMPLEMENT (main opens webContents devtools).
- [x] **A4** System → "Open" (model cache folder) — IMPLEMENT (open userData/models in OS).
- [x] **A5** System → "Clear cache" — IMPLEMENT (delete downloaded models, confirm).
- [x] **A6** System → "Reset all data" — IMPLEMENT (wipe settings/content/audio + relaunch, confirm).
- [x] **A7** Account → "Delete account" — REMOVE (no cloud account).
- [x] **A8** Account → "Sign in/out" (fake `useState`) — REMOVE (no auth backend).
- [x] **A9** Workspace → "Invite" — REMOVE (no team backend).
- [x] **A10** Workspace → "Create team" — REMOVE (no team backend).

## B. Cosmetic mock sections / fake data

- [x] **B1** AccountSettings is a fake mock — REMOVE/replace with honest "local-only" copy.
- [x] **B2** WorkspaceSettings hardcoded members/teams — REMOVE the section + nav entry.
- [x] **B3** System fake version/log-size/cache-size — WIRE to real values (app.getVersion, fs sizes).
- [x] **B4** Integrations fake connect/disconnect (no OAuth) — REMOVE fake status; link to real setup.
- [ ] **B5** Sidebar "Ready" dot always green — SOFTEN (reflect real model availability or drop the word).
- [ ] **B6** Insights "Your Voice" placeholder tab — REMOVE tab (re-add when built).
- [ ] **B7** Dictionary "Shared with team" scope + Team badges — REMOVE team scope (no sharing).

## C. Dead settings (persist, never consumed)

- [x] **C1** `micDevice` — WIRE (enumerate real devices + pass `deviceId` to getUserMedia). _Done: real device picker in General settings; recorder + useDictation honor it._
- [x] **C2** `preferBuiltInMic` — WIRE (bias default device selection). _Done: resolveMicDeviceId picks a built-in input when no explicit device._
- [ ] **C3** `dictationSounds` — IMPLEMENT (play start/stop cue) or REMOVE.
- [ ] **C4** `pauseMedia` — REMOVE (no reliable media-pause without extra APIs).
- [x] **C5** `disableNotifications` — WIRE once a notification exists (see C8), else REMOVE.
- [x] **C6** `meetingDetection` — REMOVE (no meeting detection surface).
- [x] **C7** `calendarReminders` — REMOVE (no calendar integration).
- [x] **C8** `updates` notifications — REMOVE (no updater).
- [ ] **C9** `autoDetectCalls` — REMOVE (orphan default, no UI, no backend).
- [ ] **C10** `autoPaste` — WIRE (gate inject strategy: paste vs leave-in-clipboard).
- [ ] **C11** `keepInClipboard` — WIRE (keep transcript on clipboard after inject).
- [ ] **C12** `autoLearnDictionary` — IMPLEMENT (add corrected terms) or REMOVE.
- [x] **C13** `launchAtLogin` — WIRE (app.setLoginItemSettings). _Done: applied on boot for the packaged app._
- [x] **C14** `startMinimized` — WIRE (honor on boot). _Done: window starts minimized when set._
- [ ] **C15** `saveNotesAsFiles` — IMPLEMENT (write notes to disk) or REMOVE.
- [x] **C16** `floatingAutoHide` — WIRE (auto-hide the floating bar when idle/unfocused). _Done: bar hides on idle when on; pinned visible when off._
- [x] **C17** `floatingStartPosition` — WIRE (position the floating bar). _Done: bottom-right / center / bottom-left honored._
- [x] **C18** `uiLanguage` — REMOVE (no i18n).
- [ ] **C19** `transcriptionLanguage` — WIRE (pass language to STT) or REMOVE (en-only model).
- [x] **C20** `cloudBackup` — REMOVE (no sync).
- [ ] **C21** `audioRetentionDays` — IMPLEMENT (retention cleanup) or REMOVE.
- [x] **C22** `saveHistory` — WIRE (gate addHistory). _Done: dictation only records history when enabled._
- [ ] **C23** `includeDiscarded` — REMOVE (no discard flow).
- [ ] **C24** `loggingLevel` — WIRE (set main log level) or REMOVE.
- [x] **C25** `stt.dictation.preview` — WIRE (toggle the floating bar HUD). _Done: when off, dictation still records/injects but the bar stays hidden._
- [x] **C26** `stt.note.diarization` — REMOVE (no diarization/note-record surface).
- [x] **C27** `stt.note.speakerLabels` — REMOVE (same).
- [x] **C28** `llm.cleanup.enabled` — WIRE (pass cleanupEnabled from renderer). _Done: useDictation passes the toggle into cleanup._
- [ ] **C29** `llm.cleanup.systemPrompt` — WIRE (use as cleanup system prompt).
- [ ] **C30** `llm.chat.systemPrompt` — WIRE (use as chat system prompt).
- [ ] **C31** `llm.cleanup.disableThinking` — WIRE (pass to engine) or REMOVE.
- [ ] **C32** `llm.agent.reasoning` — REMOVE (no agent surface).
- [ ] **C33** `llm.chat.reasoning` — WIRE (toggle reasoning) or REMOVE.
- [ ] **C34** `llm.note.autoTitle` — IMPLEMENT (auto-title generated notes) or REMOVE.

## D. Hotkeys

- [x] **D1** `hotkey.voiceAgent` never registered — REMOVE (no voice-agent surface).
- [x] **D2** `hotkey.meeting` (+layout) never registered — REMOVE (no meeting surface).
- [x] **D3** `hotkey.chatAgent` never registered — REMOVE (no chat overlay).
- [ ] **D4** `hotkey.dictation.mode` tap/push — IMPLEMENT push-to-talk or REMOVE the mode select.

## E. Misleading affordances

- [x] **E1** CommandPalette `Ctrl+1..8` nav hints not wired — IMPLEMENT the shortcuts. _Done in ControlPanel keydown._
- [x] **E2** CommandPalette `Ctrl+,` settings hint not wired — IMPLEMENT the shortcut. _Done in ControlPanel keydown._
- [x] **E3** Transforms hardcoded "View changes: Win+Alt+O" — WIRE to real value or REMOVE. _Done: replaced with accurate usage hint._

## F. Missing surfaces (large; track separately)

- [x] **F1** Floating dictation bar / HUD — **BUILD** (priority; core value prop). _Done + EDD-validated in real Electron:_ always-on-top, non-focusable, transparent bar window; the dictation hotkey shows it and drives record -> transcribe -> clean -> inject into the previously focused app; honors `floatingStartPosition` / `floatingAutoHide` / `stt.dictation.preview`; media permission granted in main so live mic works. Eval: `eval/scenarios/floating-bar.eval.electron.mjs`. _Polish remaining (optional):_ cancel/Escape, drag-to-reposition persistence.
- [ ] **F2** Meeting capture surface — DEFER (not requested; remove dependent settings).
- [ ] **F3** Voice agent surface/dispatcher — DEFER (not requested; remove dependent settings).
- [ ] **F4** Notes folder CRUD / move-note + live counts — IMPLEMENT (folder management).
- [x] **F5** Home history not live — WIRE real-time refresh. _Done + EDD-validated in real Electron:_ main broadcasts `khonjel:content-changed` to every window after a `content:addHistory` dispatch; a new `content.onChanged` seam port (preload relay + mock in-memory notifier) lets Home re-fetch history + stats the instant a dictation completes — including captures made in the floating-bar window — with no reload or view switch. Refetched data is guarded from re-triggering the persist effect. Eval: `eval/scenarios/home-history.eval.electron.mjs`.

## G. Minor / dead code

- [ ] **G1** `components/common/Placeholder.tsx` unused — REMOVE.
- [x] **G2** Transforms promo banner not dismissible — WIRE `onDismiss`. _Done._
- [ ] **G3** Connections AAD auth no token refresh — DEFER (document limitation).

---

### Notes on big "REMOVE" decisions
The app is **local-first**. Account/Workspace/Integrations/cloud-backup/i18n/notifications/floating-bar/
meeting/voice-agent all require infrastructure or surfaces that aren't built. The honest fix now is to
**remove the controls** so nothing is shown that doesn't work. Each is reversible — re-add the control
when the backing feature lands. If you'd rather I **build** any of these instead of removing, say which.
