// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { createCaptureSession, wavFromPcm16, type TranscriptEvent } from "./capture";
import { DEFAULT_SEGMENTER } from "./segmenter";

/** A base64 batch of a 10 ms frame at amplitude `amp`. */
function chunk(amp: number): string {
  const f = new Int16Array(160);
  f.fill(Math.round(amp * 32767));
  return Buffer.from(f.buffer, f.byteOffset, f.byteLength).toString("base64");
}
const LOUD = chunk(0.5);
const QUIET = chunk(0);

describe("wavFromPcm16", () => {
  it("writes a 44-byte canonical 16 kHz mono header", () => {
    const wav = wavFromPcm16(new Int16Array([1, -1, 100]), 16000);
    expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(wav.subarray(8, 12).toString("ascii")).toBe("WAVE");
    expect(wav.readUInt32LE(24)).toBe(16000); // sample rate
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.length).toBe(44 + 3 * 2);
  });
});

describe("createCaptureSession", () => {
  function build(transcribeSegment: (wav: Buffer) => Promise<string>) {
    const events: TranscriptEvent[] = [];
    const session = createCaptureSession({
      sessionId: "s1",
      transcribeSegment,
      emit: (e) => events.push(e),
      config: { ...DEFAULT_SEGMENTER, silenceTailMs: 200, minSegmentMs: 100, maxWindowSec: 1 },
    });
    return { session, events };
  }

  it("emits a final per closed window and returns the joined transcript", async () => {
    let n = 0;
    const { session, events } = build(async () => `seg${++n}`);
    // speech then silence -> one window closes mid-stream.
    for (let i = 0; i < 40; i++) session.pushChunk(LOUD);
    for (let i = 0; i < 30; i++) session.pushChunk(QUIET);
    // more speech, then stop flushes the second window.
    for (let i = 0; i < 20; i++) session.pushChunk(LOUD);
    const result = await session.stop();

    expect(events.length).toBeGreaterThanOrEqual(2);
    expect(events[0]!.kind).toBe("final");
    expect(events[0]!.text).toBe("seg1");
    expect(events.at(-1)!.fullText).toBe(result.text);
    expect(result.text).toContain("seg1");
    expect(result.text).toContain("seg2");
  });

  it("skips empty windows and surfaces a transcription error only when nothing was produced", async () => {
    const { session } = build(async () => {
      throw Object.assign(new Error("no model"), { code: "model_unavailable" });
    });
    for (let i = 0; i < 40; i++) session.pushChunk(LOUD);
    await expect(session.stop()).rejects.toMatchObject({ code: "model_unavailable" });
  });

  it("transcribes each window with a valid WAV payload", async () => {
    const seen: number[] = [];
    const transcribe = vi.fn(async (wav: Buffer) => {
      expect(wav.subarray(0, 4).toString("ascii")).toBe("RIFF");
      seen.push(wav.length);
      return "ok";
    });
    const { session } = build(transcribe);
    for (let i = 0; i < 40; i++) session.pushChunk(LOUD);
    for (let i = 0; i < 30; i++) session.pushChunk(QUIET);
    await session.stop();
    expect(transcribe).toHaveBeenCalled();
    expect(seen.every((len) => len > 44)).toBe(true);
  });
});
