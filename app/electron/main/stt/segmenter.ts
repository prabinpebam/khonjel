/**
 * Capture segmenter (PURE, BE1-tested) — the "segment, don't wait" core of the long-form strategy
 * (12 §2A.3). It consumes 16 kHz mono 16-bit PCM frames and decides where one transcription unit
 * ends, so a long session is transcribed window-by-window instead of as one whole file.
 *
 * A segment closes on either:
 *   - a **silence tail** (RMS below a threshold for `silenceTailMs`) after some voiced speech, or
 *   - a **hard window cap** (`maxWindowSec`) so a non-stop talker still flushes.
 *
 * This is intentionally an energy/RMS gate, not a Silero ONNX model: it is native-free and testable.
 * Silero is a drop-in upgrade behind the same `push`/`flush` shape (12 §2A: "Silero gates frames").
 */
export interface SegmenterConfig {
  /** Frames are mono 16-bit PCM at this rate. */
  sampleRate: number;
  /** Close a (voiced) segment after this much trailing silence. */
  silenceTailMs: number;
  /** Hard cap so a continuous talker still produces segments. */
  maxWindowSec: number;
  /** RMS (0..1, on samples normalized to [-1,1]) below which a frame counts as silence. */
  silenceRmsThreshold: number;
  /** Don't emit a segment shorter than this (ignores tiny blips). */
  minSegmentMs: number;
}

export const DEFAULT_SEGMENTER: SegmenterConfig = {
  sampleRate: 16000,
  // Close on a ~0.5 s pause (a natural phrase/sentence boundary), so live updates land frequently
  // *and* at clean boundaries (no mid-word splits) — the live-vs-quality balance (12 §2A.3).
  silenceTailMs: 500,
  // A run-on talker with no pause still flushes a window this often.
  maxWindowSec: 7,
  silenceRmsThreshold: 0.012,
  minSegmentMs: 300,
};

export interface Segmenter {
  /** Feed one PCM frame; returns the closed segment's samples when a boundary is reached, else null. */
  push: (frame: Int16Array) => Int16Array | null;
  /** End of capture: return whatever voiced audio remains (or null if it's just silence). */
  flush: () => Int16Array | null;
}

/** RMS of a 16-bit PCM frame, normalized to [0,1]. */
export function frameRms(frame: Int16Array): number {
  if (frame.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < frame.length; i++) {
    const s = frame[i]! / 32768;
    sum += s * s;
  }
  return Math.sqrt(sum / frame.length);
}

function concat(chunks: Int16Array[], total: number): Int16Array {
  const out = new Int16Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export function createSegmenter(config: SegmenterConfig = DEFAULT_SEGMENTER): Segmenter {
  const msPerSample = 1000 / config.sampleRate;
  let chunks: Int16Array[] = [];
  let total = 0;
  let silenceMs = 0;
  let voicedMs = 0;

  const reset = () => {
    chunks = [];
    total = 0;
    silenceMs = 0;
    voicedMs = 0;
  };

  const close = (): Int16Array | null => {
    if (total === 0) return null;
    const seg = concat(chunks, total);
    reset();
    return seg;
  };

  return {
    push: (frame) => {
      if (frame.length === 0) return null;
      chunks.push(frame);
      total += frame.length;
      const frameMs = frame.length * msPerSample;
      if (frameRms(frame) < config.silenceRmsThreshold) {
        silenceMs += frameMs;
      } else {
        silenceMs = 0;
        voicedMs += frameMs;
      }
      const segMs = total * msPerSample;
      const silenceBoundary =
        voicedMs >= config.minSegmentMs && silenceMs >= config.silenceTailMs;
      const hardCap = segMs >= config.maxWindowSec * 1000;
      if (silenceBoundary || hardCap) return close();
      return null;
    },
    flush: () => {
      if (voicedMs < config.minSegmentMs) {
        reset();
        return null;
      }
      return close();
    },
  };
}
