/**
 * useDictation — the renderer-side dictation flow: record mic -> transcribe (STT) -> clean up (LLM)
 * -> hand the final text to the caller. Composes the audio recorder with the transcription +
 * inference ports, so it runs on the mock in the browser and on real whisper.cpp + llama.cpp under
 * Electron, with no change to the calling component.
 */
import { useRef, useState } from "react";
import { useServices } from "@services";
import { useSettingsStore } from "@stores/settings";
import { startRecording, resolveMicDeviceId, type Recorder } from "@lib/audio/recorder";

export type DictationStatus = "idle" | "recording" | "transcribing" | "error";

export interface UseDictation {
  status: DictationStatus;
  error: string | null;
  /** Live, growing transcript while recording (streamed window-by-window from the backend, 12 §2A). */
  partialText: string;
  /** Start when idle, finish + transcribe when recording. */
  toggle: () => void;
  /** Begin recording (no-op if already starting/recording/transcribing). */
  start: () => void;
  /** Stop recording and transcribe (no-op if not recording). */
  stop: () => void;
  /** Abandon the current capture without transcribing and return to idle. */
  cancel: () => void;
}

export function useDictation(
  onResult: (text: string) => void,
  opts: { onLevel?: (level: number) => void } = {},
): UseDictation {
  const { capture, inference, content } = useServices();
  const micDevice = useSettingsStore((s) => s.values["micDevice"] ?? "default");
  const preferBuiltIn = useSettingsStore((s) => s.toggles["preferBuiltInMic"] ?? false);
  const saveHistory = useSettingsStore((s) => s.toggles["saveHistory"] ?? true);
  const cleanupEnabled = useSettingsStore((s) => s.toggles["llm.cleanup.enabled"] ?? true);
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [partialText, setPartialText] = useState("");
  const recorderRef = useRef<Recorder | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const startedAtRef = useRef(0);
  // Guards: ignore re-entrant starts, and let cancel() abort a start that's still awaiting the mic.
  const startingRef = useRef(false);
  const abortRef = useRef(false);

  const unsubscribe = () => {
    unsubRef.current?.();
    unsubRef.current = null;
  };

  const start = async () => {
    if (startingRef.current || status === "recording" || status === "transcribing") return;
    startingRef.current = true;
    abortRef.current = false;
    setError(null);
    setPartialText("");
    let sessionId: string | null = null;
    try {
      const deviceId = await resolveMicDeviceId(micDevice, preferBuiltIn);
      // Open a streaming capture session: the backend segments + transcribes window-by-window and
      // broadcasts a live transcript we surface as partial text (12 §2A) — no whole-file wait.
      sessionId = await capture.start();
      if (abortRef.current) {
        void capture.stop(sessionId);
        return;
      }
      unsubRef.current = capture.onTranscript((event) => {
        if (event.sessionId === sessionId) setPartialText(event.fullText);
      });
      const recorder = await startRecording({
        deviceId,
        onLevel: opts.onLevel,
        onChunk: (chunk) => capture.pushChunk(sessionId!, chunk),
      });
      if (abortRef.current) {
        recorder.cancel();
        unsubscribe();
        void capture.stop(sessionId);
        return;
      }
      recorderRef.current = recorder;
      sessionIdRef.current = sessionId;
      startedAtRef.current = Date.now();
      setStatus("recording");
    } catch (e) {
      unsubscribe();
      if (sessionId) void capture.stop(sessionId);
      setError(e instanceof Error ? e.message : "Microphone unavailable");
      setStatus("error");
    } finally {
      startingRef.current = false;
    }
  };

  const cancel = () => {
    abortRef.current = true;
    startingRef.current = false;
    const recorder = recorderRef.current;
    const sessionId = sessionIdRef.current;
    recorderRef.current = null;
    sessionIdRef.current = null;
    recorder?.cancel();
    if (sessionId) void capture.stop(sessionId);
    unsubscribe();
    setPartialText("");
    setStatus("idle");
  };

  const stop = async () => {
    const recorder = recorderRef.current;
    const sessionId = sessionIdRef.current;
    if (!recorder || !sessionId) return;
    recorderRef.current = null;
    sessionIdRef.current = null;
    setStatus("transcribing");
    try {
      const durationSec = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
      await recorder.stop(); // flush the last frames + tear down the mic
      const { text } = await capture.stop(sessionId);
      unsubscribe();
      setPartialText("");
      const trimmed = text.trim();
      if (trimmed.length === 0) {
        setStatus("idle");
        return;
      }
      // Apply the user's dictionary + snippets during cleanup (spoken terms, substitutions).
      const [dictionary, snippets] = await Promise.all([content.dictionary(), content.snippets()]);
      const cleaned = await inference.cleanup(trimmed, { dictionary, snippets, cleanupEnabled });
      // Honor the "Save transcription history" privacy setting.
      if (saveHistory) {
        void content.addHistory({
          finalText: cleaned.text,
          app: "Khonjel",
          language: "auto",
          durationSec,
          mode: "dictation",
          hasAudio: false,
          cleanupApplied: cleaned.cleaned,
        });
      }
      onResult(cleaned.text);
      setStatus("idle");
    } catch (e) {
      unsubscribe();
      setPartialText("");
      setError(e instanceof Error ? e.message : "Transcription failed");
      setStatus("error");
    }
  };

  const toggle = () => {
    if (status === "recording") void stop();
    else void start();
  };

  return {
    status,
    error,
    partialText,
    toggle,
    start: () => void start(),
    stop: () => void stop(),
    cancel,
  };
}
