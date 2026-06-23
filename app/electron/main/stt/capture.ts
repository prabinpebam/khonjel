/**
 * Capture session (main, BE1-tested) — the streaming long-form loop (12 §2A.3/§2A.6). It receives
 * 16 kHz mono 16-bit PCM frames (as base64 batches), runs the pure {@link Segmenter}, and transcribes
 * each closed window **immediately** via an injected `transcribeSegment`, emitting a `final` event per
 * window so the surface shows a live, growing transcript. Memory is bounded by the open segment, not
 * the session length: a closed window is transcribed and dropped.
 *
 * `transcribeSegment` is injected (not the engine), so this stays native-free and BE1-tested, and the
 * composition root can route a window to local whisper or a cloud provider behind the same seam.
 */
import { createSegmenter, type SegmenterConfig } from "./segmenter";
import type { TranscriptEvent } from "../../../src/services/ports";

export type { TranscriptEvent };

export interface CaptureSessionDeps {
  sessionId: string;
  /** Transcribe one window (16 kHz mono WAV) to text; '' for an empty/blank window. May reject. */
  transcribeSegment: (wav: Buffer) => Promise<string>;
  emit: (event: TranscriptEvent) => void;
  config?: SegmenterConfig;
}

export interface CaptureSession {
  /** Feed a base64 batch of 16 kHz mono 16-bit PCM frames. */
  pushChunk: (base64Pcm16: string) => void;
  /** End capture: flush the open window, finish pending transcriptions, return the full transcript. */
  stop: () => Promise<{ text: string }>;
}

/** Build a canonical 16-bit mono WAV Buffer around PCM samples. */
export function wavFromPcm16(samples: Int16Array, sampleRate: number): Buffer {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits/sample
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i]!, 44 + i * 2);
  return buf;
}

function pcm16FromBase64(base64: string): Int16Array {
  const buf = Buffer.from(base64, "base64");
  const n = buf.length >> 1;
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}

export function createCaptureSession(deps: CaptureSessionDeps): CaptureSession {
  const segmenter = createSegmenter(deps.config);
  const finalized: string[] = [];
  let segmentId = 0;
  let lastError: unknown = null;
  let chain: Promise<void> = Promise.resolve();

  const transcribe = (window: Int16Array): void => {
    if (window.length === 0) return;
    const wav = wavFromPcm16(window, deps.config?.sampleRate ?? 16000);
    chain = chain.then(async () => {
      try {
        const text = (await deps.transcribeSegment(wav)).trim();
        if (text.length === 0) return;
        finalized.push(text);
        segmentId += 1;
        deps.emit({
          sessionId: deps.sessionId,
          kind: "final",
          segmentId,
          text,
          fullText: finalized.join(" "),
        });
      } catch (err) {
        lastError = err;
      }
    });
  };

  return {
    pushChunk: (base64Pcm16) => {
      const closed = segmenter.push(pcm16FromBase64(base64Pcm16));
      if (closed) transcribe(closed);
    },
    stop: async () => {
      const tail = segmenter.flush();
      if (tail) transcribe(tail);
      await chain;
      if (finalized.length === 0 && lastError) throw lastError;
      return { text: finalized.join(" ") };
    },
  };
}
