/**
 * Transcription domain service (main): turns a base64 WAV from the renderer into text via the
 * local whisper.cpp transcriber. Decode -> temp file -> transcribe -> clean up the temp file.
 *
 * The transcriber + temp-file IO are injected, so this is BE1-tested without the binary or fs.
 * When no STT model is installed the transcriber is undefined and the service reports a structured
 * `model_unavailable` error the renderer can turn into a "download a model" prompt.
 */
import { ipcError } from "../../shared/ipc-contract";
import type { TranscriptionRequest, TranscriptionResult } from "../../../src/services/ports";
import type { Transcriber } from "../stt/whisper";

export interface TranscriptionDeps {
  /** Undefined when no STT model/binary is available. */
  transcriber?: Transcriber;
  /** Persist decoded WAV bytes to a temp path and return it. */
  writeTempWav: (bytes: Buffer) => string;
  /** Remove a temp file (best-effort). */
  cleanup: (filePath: string) => void;
}

export interface TranscriptionServiceImpl {
  transcribe: (req: TranscriptionRequest) => Promise<TranscriptionResult>;
}

export function createTranscriptionService(deps: TranscriptionDeps): TranscriptionServiceImpl {
  return {
    transcribe: async (req) => {
      if (!deps.transcriber) {
        throw ipcError(
          "model_unavailable",
          "No speech-to-text model is installed. Run `npm run fetch:whisper` or pick a model in Settings.",
        );
      }
      const bytes = Buffer.from(req.audioBase64, "base64");
      if (bytes.length === 0) {
        throw ipcError("validation", "Empty audio payload.");
      }
      const wavPath = deps.writeTempWav(bytes);
      try {
        const text = await deps.transcriber.transcribe(wavPath, {
          language: req.language,
          translate: req.translate,
        });
        return { text };
      } finally {
        deps.cleanup(wavPath);
      }
    },
  };
}
