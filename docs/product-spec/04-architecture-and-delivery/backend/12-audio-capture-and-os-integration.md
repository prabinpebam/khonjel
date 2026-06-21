# 12 — Audio capture & OS integration

> The contract for the **native, per-OS** layer the rest of the backend depends on but that the
> benchmarks handle very differently (FreeFlow = macOS-native; OpenWhispr = per-OS helper
> binaries). This is the **highest-risk, lowest-portability** work, so it gets its own spec.
> Implements the OS-facing ports from [08](08-ipc-and-ports-contracts.md)
> (`TranscriptionService` capture, `InjectorService`, `AppContextService`, `HotkeyService`) and
> the audio side of `MeetingService`/`UploadService`.

---

## 1. Why this is its own document
- It is the only layer that **cannot** be written once in TypeScript — each OS needs native
  helpers (key listener, audio tap, text injection).
- It owns the **hot-path latency budget** (hotkey → "listening" < 100 ms) and the **trust
  surface** (microphone, accessibility/automation permissions).
- Getting the **audio format contract** wrong breaks every STT provider at once.

## 2. Audio capture contract

```ts
interface AudioChunk { pcm: Int16Array; sampleRate: 16000; channels: 1; seq: number; tMs: number }
interface CaptureOpts {
  source: "microphone" | "system" | "both";   // 'both' = meetings (mic + loopback)
  deviceId?: string;                            // selected input; default = OS default
  vad: boolean;                                 // Silero gate on/off
  muteMedia?: boolean;                          // pause system media during capture
}
interface AudioCapture {
  start(o: CaptureOpts): Promise<{ captureId: string }>;
  stop(captureId: string): Promise<void>;
  // stream (MessagePort): "audio:chunk" AudioChunk, "audio:level" {rms}, "audio:vad" {speech:boolean}
}
```

**Canonical format (the contract every STT consumes):** **16 kHz, mono, 16-bit PCM**, little-
endian, ~20–40 ms frames. Capture device audio at its native rate, then **resample in the
capture layer** so providers/sidecars never see anything else. Cloud providers that want a
container (e.g. wav/opus) get one wrapped at the egress boundary, not upstream.

- **Chunking:** fixed frames with monotonically increasing `seq` + `tMs` for ordering/recovery.
- **VAD:** Silero gates frames; on silence beyond a tunable tail, capture auto-stops (mode-dependent).
- **Backpressure:** the capture layer owns a bounded ring buffer; if a sidecar stalls, oldest
  non-speech frames drop first (never speech frames).

## 3. System audio & meetings (AEC)
- **System/loopback capture** is per-OS (table below). Meetings use `source:"both"` → two
  streams (mic + system) tagged for diarization (`You:` / `Them:`).
- **Acoustic echo cancellation (AEC)** + noise suppression run in a native helper before STT so
  the meeting's far-end audio doesn't echo into the mic transcript.
- **Diarization** (speaker labelling) is a post-STT step on the meeting transcript, not part of capture.

## 4. Per-OS native helper matrix

| Capability | Windows | macOS | Linux | Permission gate |
|---|---|---|---|---|
| Global hotkey listen | `windows-key-listener` | `globalShortcut` / globe-listener | `linux-key-listener` (X11) / portal (Wayland) | — |
| Mic capture | WASAPI helper | CoreAudio | PipeWire / PulseAudio | **mic permission** |
| System audio | WASAPI **loopback** | `macos-audio-tap` (ScreenCapture/CoreAudio) | PipeWire monitor | **screen/audio capture** (macOS) |
| AEC / NS | native AEC helper | native AEC helper | native AEC helper | — |
| Text injection | `windows-fast-paste` / SendInput | `macos-fast-paste` / CGEvent | `ydotool` (Wayland) / XTEST (X11) | **accessibility/automation** (macOS), **uinput** (Linux Wayland) |
| Active-app context | Win32 foreground window | `NSWorkspace` | X11 `_NET_ACTIVE_WINDOW` / portal | — |

> Each cell is a swappable helper behind the OS port; feature code stays platform-agnostic.
> **Wayland** is the hardest case (injection needs `ydotool`/`uinput` or a portal) and must be
> validated early — see [13 open-questions](13-open-questions-and-risks.md).

## 5. Hotkey contract
- 4 global binds (`hotkey.dictation`, `hotkey.voiceAgent`, `hotkey.meeting`, `hotkey.chatAgent`)
  + transform binds, registered at OS level; `hotkey:fired { id }` emitted to main.
- **Tap vs hold** (`hotkey.dictation.mode`): tap = toggle, hold = push-to-talk (release stops).
- **Conflict detection** on rebind (`hotkeys:rebind` returns `{ok, conflict?}`); never silently
  steals an OS-reserved combo.

## 6. Text injection contract (ported from FreeFlow)
- `insertAtCursor(text)` chooses a strategy **per active-app bundle/exe id** from a maintained
  table: `paste` (clipboard swap+restore), `keystroke` (synthetic typing), or `accessibility`
  (AX API set-value). Default `paste`; overrides for apps that mishandle it (terminals, editors).
- **Secure fields:** detect password/secure inputs and **refuse injection** (no clipboard write).
- **Clipboard hygiene:** the paste strategy saves and restores prior clipboard content; if
  `keepInClipboard` is off, the injected text is not left behind.
- **Recovery:** `TranscriptBuffer` holds the last final text for `repasteLast()` and for the
  no-focus case (injection target lost) — surfaced as "paste last," never silently dropped.

## 7. Active-app context contract
- `AppContextService.current()` → `{ appName, windowTitle, bundleId, fieldHint? }`, read at
  capture time, used for (a) history `app`/`app_category` and (b) the **tone hint**
  ([05 §4](05-prompt-library.md)).
- **Field/content reading is opt-in** (`Context awareness`); when off, only app + window title
  are read, never field contents.

## 8. Latency budget (hot path)
| Step | Budget |
|---|---|
| hotkey → "listening" UI | < 100 ms |
| stop → first STT partial | model-dependent; show honest progress |
| final text → injected at cursor | < 50 ms after pipeline returns |

## 9. Acceptance
- [ ] All STT consumers receive **16 kHz/mono/16-bit PCM**, regardless of device or OS.
- [ ] Mic, system-audio, AEC, hotkey, injection, and app-context helpers exist for Win/macOS/Linux behind the OS ports.
- [ ] Hotkey → "listening" < 100 ms; tap and hold both work; conflicts detected on rebind.
- [ ] Injection uses the per-app strategy table, refuses secure fields, and restores the clipboard.
- [ ] Meeting capture produces two tagged streams with AEC; diarization runs post-STT.
- [ ] Field-content reading is strictly opt-in; default reads app + title only.
- [ ] Wayland injection path validated on at least one Wayland compositor.
