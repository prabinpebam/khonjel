// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createTranscriptionService } from "./transcription";
import { isIpcError } from "../../shared/ipc-contract";
import type { Transcriber } from "../stt/whisper";

const fakeTranscriber: Transcriber = {
  transcribe: async (audioPath) => `transcript of ${audioPath}`,
};

describe("createTranscriptionService", () => {
  it("decodes base64, writes a temp WAV, transcribes, and cleans up", async () => {
    const cleanup = vi.fn();
    let written: Buffer | null = null;
    const service = createTranscriptionService({
      transcriber: fakeTranscriber,
      writeTempWav: (bytes) => {
        written = bytes;
        return "/tmp/clip.wav";
      },
      cleanup,
    });
    const audioBase64 = Buffer.from("RIFFfake").toString("base64");
    const result = await service.transcribe({ audioBase64, language: "en" });
    expect(result.text).toBe("transcript of /tmp/clip.wav");
    expect(written).not.toBeNull();
    expect(cleanup).toHaveBeenCalledWith("/tmp/clip.wav");
  });

  it("cleans up the temp file even when transcription throws", async () => {
    const cleanup = vi.fn();
    const service = createTranscriptionService({
      transcriber: {
        transcribe: async () => {
          throw new Error("whisper crashed");
        },
      },
      writeTempWav: () => "/tmp/clip.wav",
      cleanup,
    });
    await expect(
      service.transcribe({ audioBase64: Buffer.from("x").toString("base64") }),
    ).rejects.toThrow("whisper crashed");
    expect(cleanup).toHaveBeenCalledWith("/tmp/clip.wav");
  });

  it("reports model_unavailable when no transcriber is wired", async () => {
    const service = createTranscriptionService({
      writeTempWav: () => "/tmp/x.wav",
      cleanup: () => {},
    });
    await expect(
      service.transcribe({ audioBase64: Buffer.from("x").toString("base64") }),
    ).rejects.toSatisfy((e: unknown) => isIpcError(e) && e.code === "model_unavailable");
  });

  it("rejects an empty audio payload", async () => {
    const service = createTranscriptionService({
      transcriber: fakeTranscriber,
      writeTempWav: () => "/tmp/x.wav",
      cleanup: () => {},
    });
    await expect(service.transcribe({ audioBase64: "" })).rejects.toSatisfy(
      (e: unknown) => isIpcError(e) && e.code === "validation",
    );
  });
});
