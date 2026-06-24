import { useEffect, useRef } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { useServices } from "@services";
import { useDictation } from "@hooks/useDictation";
import { MicWaveform } from "@components/common/MicWaveform";
import { playStartCue, playStopCue } from "@lib/audio/cues";
import { cn } from "@lib/utils";

/**
 * The floating dictation bar (Khonjel Bar) — the app's core capture surface. Runs in its own
 * always-on-top, non-focusable window so it never steals focus from the app you are typing into.
 * Records the mic, transcribes + cleans up on device, and injects the final text at the cursor.
 */
export function FloatingBar() {
  const { system } = useServices();
  const levelRef = useRef(0);
  const dictation = useDictation(
    (text) => {
      // Inject into whatever app had focus (no-op under the browser mock).
      void system.injectText(text);
    },
    { onLevel: (n) => (levelRef.current = n) },
  );

  // Keep the latest dictation API in a ref so the hotkey subscription is set up once.
  const apiRef = useRef(dictation);
  apiRef.current = dictation;

  // Main relays the dictation hotkey as a session toggle: "dictation:start" begins a capture and
  // "dictation:stop" ends it. Ending while recording transcribes + injects; ending in any other
  // state (a failed or still-starting capture) just dismisses — so the bar is always escapable.
  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.khonjel : undefined;
    if (!bridge?.onHotkey) return;
    return bridge.onHotkey((action) => {
      const api = apiRef.current;
      if (action === "dictation:start") {
        api.start();
      } else if (action === "dictation:stop" || action === "dictation") {
        if (api.status === "recording") {
          api.stop();
        } else {
          api.cancel();
          window.electronAPI?.floatingIdle?.();
        }
      } else if (action === "cue:start") {
        // Main sequences the cues around the system-audio mute so the beeps aren't muted with it.
        playStartCue();
      } else if (action === "cue:stop") {
        playStopCue();
      }
    });
  }, []);

  // When a capture ends — success (idle) OR failure (error) — let main auto-hide the bar. Hiding on
  // error too is what keeps a missing model or mic failure from leaving the bar stuck on screen.
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (dictation.status === "recording" || dictation.status === "transcribing") {
      wasActiveRef.current = true;
    } else if (
      (dictation.status === "idle" || dictation.status === "error") &&
      wasActiveRef.current
    ) {
      wasActiveRef.current = false;
      window.electronAPI?.floatingIdle?.();
    }
  }, [dictation.status]);

  // Tell main when the mic is actually capturing, so it can mute other system audio for a clean
  // recording and restore it the instant recording stops.
  const recordingSignalRef = useRef(false);
  useEffect(() => {
    const isRecording = dictation.status === "recording";
    if (isRecording && !recordingSignalRef.current) {
      recordingSignalRef.current = true;
      window.electronAPI?.setRecordingActive?.(true);
    } else if (!isRecording && recordingSignalRef.current) {
      recordingSignalRef.current = false;
      window.electronAPI?.setRecordingActive?.(false);
    }
  }, [dictation.status]);

  const recording = dictation.status === "recording";
  const transcribing = dictation.status === "transcribing";
  const errored = dictation.status === "error";
  // Keep the bar compact: show a short status word, not the live transcript (the streaming text
  // overflows this pill and breaks the layout; the transcript is injected at the cursor instead).
  const label = errored
    ? (dictation.error ?? "Something went wrong")
    : transcribing
      ? "Transcribing"
      : recording
        ? "Listening"
        : "Click to dictate";

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      <div className="app-drag flex items-center gap-3 rounded-pill border border-border bg-surface/95 px-4 py-2 shadow-modal backdrop-blur">
        <button
          type="button"
          aria-label={recording ? "Stop dictation" : "Start dictation"}
          disabled={transcribing}
          onClick={dictation.toggle}
          className={cn(
            "app-no-drag grid size-9 shrink-0 place-items-center rounded-pill text-primary-foreground transition-colors",
            recording ? "bg-danger" : "bg-accent",
            transcribing && "opacity-60",
          )}
        >
          {transcribing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : recording ? (
            <Square className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </button>
        <MicWaveform levelRef={levelRef} active={recording} />
        <span
          className={cn(
            "min-w-20 max-w-44 truncate text-sm font-medium",
            errored ? "text-danger" : "text-foreground",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
