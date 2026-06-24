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
import type { ProviderRouter } from "../providers/router";

export interface TranscriptionDeps {
  /**
   * Resolve the active local transcriber for THIS request (whisper or Parakeet, per the selected
   * STT model). A thunk rather than a fixed transcriber so switching the model in Settings takes
   * effect immediately, with no restart. Undefined / returning undefined => no local STT installed.
   */
  resolveTranscriber?: () => Transcriber | undefined;
  /** Cloud STT router (Azure/OpenAI); when a slot is bound it takes precedence over local engines. */
  router?: ProviderRouter;
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
      const bytes = Buffer.from(req.audioBase64, "base64");
      if (bytes.length === 0) {
        throw ipcError("validation", "Empty audio payload.");
      }
      // A cloud-bound `stt.dictation` slot transcribes remotely (Azure/OpenAI); errors surface as
      // IpcError(provider_error). Otherwise fall back to the active local engine (whisper/Parakeet).
      const cloud = await deps.router?.transcribeForSlot("stt.dictation", bytes, {
        language: req.language,
      });
      if (cloud != null) {
        return { text: cloud };
      }
      const transcriber = deps.resolveTranscriber?.();
      if (!transcriber) {
        throw ipcError(
          "model_unavailable",
          "No speech-to-text model is installed. Run `npm run fetch:whisper` or pick a model in Settings.",
        );
      }
      const wavPath = deps.writeTempWav(bytes);
      try {
        const text = await transcriber.transcribe(wavPath, {
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
