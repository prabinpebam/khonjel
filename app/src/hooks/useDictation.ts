/**
 * useDictation — the renderer-side dictation flow: record mic -> transcribe (STT) -> clean up (LLM)
 * -> hand the final text to the caller. Composes the audio recorder with the transcription +
 * inference ports, so it runs on the mock in the browser and on real whisper.cpp + llama.cpp under
 * Electron, with no change to the calling component.
 */
import { useRef, useState } from "react";
import { useServices } from "@services";
import { startRecording, type Recorder } from "@lib/audio/recorder";

export type DictationStatus = "idle" | "recording" | "transcribing" | "error";

export interface UseDictation {
  status: DictationStatus;
  error: string | null;
  /** Start when idle, finish + transcribe when recording. */
  toggle: () => void;
}

export function useDictation(onResult: (text: string) => void): UseDictation {
  const { transcription, inference, content } = useServices();
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const startedAtRef = useRef(0);

  const start = async () => {
    setError(null);
    try {
      recorderRef.current = await startRecording();
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
      const cleaned = await inference.cleanup(trimmed, {});
      void content.addHistory({
        finalText: cleaned.text,
        app: "Khonjel",
        language: "auto",
        durationSec,
        mode: "dictation",
        hasAudio: false,
        cleanupApplied: cleaned.cleaned,
      });
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
