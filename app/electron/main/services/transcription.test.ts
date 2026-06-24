// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createTranscriptionService, sttLanguage } from "./transcription";
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
      resolveTranscriber: () => fakeTranscriber,
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
      resolveTranscriber: () => ({
        transcribe: async () => {
          throw new Error("whisper crashed");
        },
      }),
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

  it("reports model_unavailable when the resolver yields no transcriber", async () => {
    const service = createTranscriptionService({
      resolveTranscriber: () => undefined,
      writeTempWav: () => "/tmp/x.wav",
      cleanup: () => {},
    });
    await expect(
      service.transcribe({ audioBase64: Buffer.from("x").toString("base64") }),
    ).rejects.toSatisfy((e: unknown) => isIpcError(e) && e.code === "model_unavailable");
  });

  it("resolves the transcriber per request, so switching the STT engine takes effect immediately", async () => {
    let engine: Transcriber = { transcribe: async () => "whisper text" };
    const service = createTranscriptionService({
      resolveTranscriber: () => engine,
      writeTempWav: () => "/tmp/x.wav",
      cleanup: () => {},
    });
    const first = await service.transcribe({ audioBase64: Buffer.from("x").toString("base64") });
    expect(first.text).toBe("whisper text");
    engine = { transcribe: async () => "parakeet text" }; // user picked Parakeet in Settings
    const second = await service.transcribe({ audioBase64: Buffer.from("x").toString("base64") });
    expect(second.text).toBe("parakeet text");
  });

  it("rejects an empty audio payload", async () => {
    const service = createTranscriptionService({
      resolveTranscriber: () => fakeTranscriber,
      writeTempWav: () => "/tmp/x.wav",
      cleanup: () => {},
    });
    await expect(service.transcribe({ audioBase64: "" })).rejects.toSatisfy(
      (e: unknown) => isIpcError(e) && e.code === "validation",
    );
  });

  it("falls back to defaultLanguage when the request omits a language", async () => {
    let seen: string | undefined = "untouched";
    const service = createTranscriptionService({
      resolveTranscriber: () => ({
        transcribe: async (_path, opts) => {
          seen = opts?.language;
          return "ok";
        },
      }),
      defaultLanguage: () => "en",
      writeTempWav: () => "/tmp/x.wav",
      cleanup: () => {},
    });
    await service.transcribe({ audioBase64: Buffer.from("x").toString("base64") });
    expect(seen).toBe("en");
  });

  it("lets an explicit request language win over defaultLanguage", async () => {
    let seen: string | undefined;
    const service = createTranscriptionService({
      resolveTranscriber: () => ({
        transcribe: async (_path, opts) => {
          seen = opts?.language;
          return "ok";
        },
      }),
      defaultLanguage: () => "en",
      writeTempWav: () => "/tmp/x.wav",
      cleanup: () => {},
    });
    await service.transcribe({ audioBase64: Buffer.from("x").toString("base64"), language: "fr" });
    expect(seen).toBe("fr");
  });
});

describe("sttLanguage", () => {
  it("strips the region from a BCP-47 tag", () => {
    expect(sttLanguage("en-US")).toBe("en");
    expect(sttLanguage("en-GB")).toBe("en");
    expect(sttLanguage("es-ES")).toBe("es");
    expect(sttLanguage("ja-JP")).toBe("ja");
  });

  it("lowercases and accepts a bare language code", () => {
    expect(sttLanguage("FR")).toBe("fr");
    expect(sttLanguage("de")).toBe("de");
  });

  it("returns undefined (auto-detect) for empty or missing input", () => {
    expect(sttLanguage(undefined)).toBeUndefined();
    expect(sttLanguage("")).toBeUndefined();
  });
});
