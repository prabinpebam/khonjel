import type { TranscriptionService } from "@services/ports";

/** Mock STT — returns a canned transcript so the browser/dev shell works without whisper.cpp. */
export const mockTranscriptionService: TranscriptionService = {
  transcribe: async () => ({
    text: "This is a sample transcription from the mock speech-to-text adapter.",
  }),
};
