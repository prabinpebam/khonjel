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

## 2A. Long-form & streaming transcription (dictation / notes / meetings)

> **Why this section exists.** §2 above defines the *frame* contract, but the unit of
> *transcription* was left implicit — and the live code transcribes the **whole recording at once**.
> That is correct for a one-line dictation and wrong for a long session. This section makes the unit
> of work a **segment/window that is transcribed as you speak**, never the whole file, so latency and
> memory are bounded by *seconds*, not session length.

### 2A.1 Current state vs target (the gap this closes)

> **Today the live path is single-shot, not streaming.** The renderer accumulates *every* Web-Audio
> block for the whole session ([`recorder.ts`](../../../../app/src/lib/audio/recorder.ts)), then sends
> one base64 WAV over a single `transcription:transcribe` call, and main runs `whisper-cli` over the
> entire file once ([`transcription.ts`](../../../../app/electron/main/services/transcription.ts)).
> Consequences for a long session: time-to-first-feedback = `stop + full-file decode`; renderer memory
> grows ~0.2 MB/s **unbounded** with several full-size copies plus a multi-MB base64 IPC payload. The
> contract below is the **target**; §9 gates the migration. The single-shot call survives **only** for
> file **Upload** (audio already on disk), never for live capture.

### 2A.2 How the field does it (benchmark)

| Tool | Capture | Long-form transcription | Feedback |
|---|---|---|---|
| **Wispr Flow** | continuous mic stream to cloud | **realtime streaming** STT built for flow/long-form; words land as you speak | live partials, ~instant |
| **FreeFlow** | non-blocking start; forwards frames immediately | **OpenAI Realtime (WSS)** persistent socket (partial+final) with a **warm backup** connection and a **parallel batch fallback**; on-device **Parakeet in 15 s windows** | sub-second median (self-reported) |
| **OpenWhispr** | `audioManager` mic capture | whisper.cpp / Parakeet child process, largely **per-utterance batch**; cloud providers incl. Deepgram/AssemblyAI are streaming-capable | mostly after stop |
| **Khonjel (target)** | 16 kHz/mono frames → main, disk-backed | **VAD-segmented rolling windows** for batch engines (whisper) + **true frame-streaming** for transducers (Parakeet) + **realtime WSS** for cloud | live partials per segment |

**Imported rules:** FreeFlow's *stream-or-window, never the whole file*; its *warm-connection +
parallel-batch* latency trick; Wispr Flow's *partials-as-you-speak* expectation. Detail in
[01 FreeFlow](01-benchmark-freeflow.md) / [00 OpenWhispr](00-benchmark-openwhispr.md).

### 2A.3 The transcription loop (segment, don't wait)

A capture **session** runs a loop whose cost is independent of total length:

```text
frames ─▶ VAD ─▶ segmenter ─▶ StreamingTranscriber ─▶ partial/final ─▶ stitch ─▶ live transcript
                   │ close a segment on: Silero silence-tail  OR  a hard cap (~20–30 s, whisper)
                   ▼                                          OR  continuously (transducer / cloud)
             disk-backed PCM  (retention + crash recovery)
```

- **Segment boundary** = Silero silence-tail **or** a hard window cap, so a non-stop talker still
  flushes. Each closed segment is transcribed **immediately**, not at stop.
- **Context carry-over:** prepend a short tail (~1–2 s / last few tokens) of the previous segment so
  word-splits across a boundary heal; de-dup the overlap when stitching.
- **Polish off the hot path:** the [3-stage pipeline](01-benchmark-freeflow.md) (`isClean` skip → LLM
  → deterministic fallback) runs **per finalized segment** for notes/meetings, or **once on the final
  text** for short dictation — never blocking capture.

### 2A.4 One port, three engine strategies

Mirror FreeFlow's `DictationProviding` (batch) vs `StreamingDictationProviding` (stream) split: a
single `StreamingTranscriber` port, with **batch engines wrapped by the VAD-segmenter** so they look
streaming to the loop. Extends the `TranscriptionService` in [08 §3](08-ipc-and-ports-contracts.md) /
[10 §1–2](10-providers-and-models.md).

| Engine | Native streaming? | Long-form strategy |
|---|---|---|
| **whisper.cpp** (local default) | No — full-file batch | VAD-segmented rolling windows (~20–30 s) + context carry; emit each window as it closes |
| **Parakeet TDT** (local, sherpa-onnx) | **Yes** — online transducer | feed frames to the online recognizer; emit partial+final tokens continuously (FreeFlow: 15 s CoreML windows) |
| **Cloud realtime** (OpenAI Realtime / Deepgram / AssemblyAI) | **Yes** — WSS | one persistent socket per session; forward frames; **warm backup** + **parallel batch fallback** |
| **Cloud batch** (Azure / OpenAI file) | No | segment like whisper; POST each closed window (or one POST for a short clip) |

### 2A.5 Memory & size (bounded by seconds, not session length)

- The capture layer emits **16 kHz/mono/16-bit frames** to main over a MessagePort; the renderer
  **never accumulates the whole session** — this removes the current ~0.2 MB/s unbounded growth and
  the multi-MB base64 IPC payload.
- Main keeps a **bounded ring buffer** (a few seconds; §2 backpressure) for in-flight frames and —
  only when retention/recovery needs it — **appends raw PCM to a disk-backed temp file**. Peak memory
  is the ring buffer, **independent of recording length**.

### 2A.6 Streaming the result (partials + finalize + recovery)

- New session IPC (the partials stream that [08 §2](08-ipc-and-ports-contracts.md) already
  anticipates): `capture:start` / `capture:stop` plus `transcription:partial { text, segmentId }` and
  `transcription:final { text, segmentId }` events; the surface renders a **live, growing transcript**.
- **Finalize** on VAD auto-stop or explicit stop: flush the open segment, run final polish, persist.
  For long notes/meetings the running transcript is already on screen, so finalize is cheap.
- **Recovery:** finalized segments live in the disk-backed buffer + a `TranscriptBuffer` (FreeFlow);
  a crash or lost injection target keeps the text for **re-paste / resume**, never silently dropped.

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
| first spoken words → first on-screen **partial** | streaming/transducer < 1 s; whisper-segmented ≤ first window (~2–3 s) |
| silence/stop → final text | streaming < 0.5 s after last words; whisper ≤ last-window decode |
| final text → injected at cursor | < 50 ms after pipeline returns |
| memory during a 60-min session | bounded by the ring buffer (seconds), **not** duration (§2A.5) |

## 9. Acceptance
- [ ] All STT consumers receive **16 kHz/mono/16-bit PCM**, regardless of device or OS.
- [ ] Live capture **streams** frames to main; the renderer never buffers a whole session, and the live path carries **no** single multi-MB base64 payload (§2A.1/§2A.5).
- [ ] **Partial transcripts** appear *during* capture (not only after stop) for every engine; batch engines (whisper) are VAD-segmented into rolling windows (§2A.3/§2A.4).
- [ ] A 30+ min session runs with **bounded memory** (ring buffer) and disk-backed audio; finalized segments survive a mid-session crash (§2A.5/§2A.6).
- [ ] Each STT engine maps to its §2A.4 strategy (whisper = windows, Parakeet = transducer stream, cloud realtime = WSS + parallel-batch fallback).
- [ ] Mic, system-audio, AEC, hotkey, injection, and app-context helpers exist for Win/macOS/Linux behind the OS ports.
- [ ] Hotkey → "listening" < 100 ms; tap and hold both work; conflicts detected on rebind.
- [ ] Injection uses the per-app strategy table, refuses secure fields, and restores the clipboard.
- [ ] Meeting capture produces two tagged streams with AEC; diarization runs post-STT.
- [ ] Field-content reading is strictly opt-in; default reads app + title only.
- [ ] Wayland injection path validated on at least one Wayland compositor.
