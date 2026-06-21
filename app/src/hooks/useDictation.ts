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
  /** Start when idle, finish + transcribe when recording. */
  toggle: () => void;
}

export function useDictation(
  onResult: (text: string) => void,
  opts: { onLevel?: (level: number) => void } = {},
): UseDictation {
  const { transcription, inference, content } = useServices();
  const micDevice = useSettingsStore((s) => s.values["micDevice"] ?? "default");
  const preferBuiltIn = useSettingsStore((s) => s.toggles["preferBuiltInMic"] ?? false);
  const saveHistory = useSettingsStore((s) => s.toggles["saveHistory"] ?? true);
  const cleanupEnabled = useSettingsStore((s) => s.toggles["llm.cleanup.enabled"] ?? true);
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const startedAtRef = useRef(0);

  const start = async () => {
    setError(null);
    try {
      const deviceId = await resolveMicDeviceId(micDevice, preferBuiltIn);
      recorderRef.current = await startRecording({ deviceId, onLevel: opts.onLevel });
      startedAtRef.current = Date.now();
      setStatus("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone unavailable");
      setStatus("error");
    }
  };

  const stop = async () => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    recorderRef.current = null;
    setStatus("transcribing");
    try {
      const durationSec = Math.max(0, Math.round((Date.now() - startedAtRef.current) / 1000));
      const audioBase64 = await recorder.stop();
      const { text } = await transcription.transcribe({ audioBase64 });
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
      setError(e instanceof Error ? e.message : "Transcription failed");
      setStatus("error");
    }
  };

  const toggle = () => {
    if (status === "recording") void stop();
    else void start();
  };

  return { status, error, toggle };
}
