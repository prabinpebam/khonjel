import type { CaptureService, TranscriptEvent } from "@services/ports";

/**
 * Mock capture — simulates the streaming long-form loop (12 §2A) in the browser preview: each batch
 * of pushed frames advances a fake transcript, emitting a `final` window every few chunks so the UI
 * shows a live, growing transcript exactly as it will under the real backend.
 */
const PHRASES = [
  "this is a live transcript",
  "appearing as you speak",
  "window by window",
  "without waiting for the end",
];

interface MockSession {
  chunks: number;
  segments: string[];
  segId: number;
}

let counter = 0;
const sessions = new Map<string, MockSession>();
const listeners = new Set<(event: TranscriptEvent) => void>();

function emit(event: TranscriptEvent): void {
  for (const cb of listeners) cb(event);
}

export const mockCaptureService: CaptureService = {
  start: async () => {
    const id = `mock-capture-${++counter}`;
    sessions.set(id, { chunks: 0, segments: [], segId: 0 });
    return id;
  },
  pushChunk: (sessionId) => {
    const s = sessions.get(sessionId);
    if (!s) return;
    s.chunks += 1;
    // Close a fake window every ~6 chunks (~1.5 s) until we run out of phrases.
    if (s.chunks % 6 === 0 && s.segId < PHRASES.length) {
      const seg = PHRASES[s.segId]!;
      s.segId += 1;
      s.segments.push(seg);
      emit({
        sessionId,
        kind: "final",
        segmentId: s.segId,
        text: seg,
        fullText: s.segments.join(" "),
      });
    }
  },
  stop: async (sessionId) => {
    const s = sessions.get(sessionId);
    sessions.delete(sessionId);
    return { text: s ? s.segments.join(" ") : "" };
  },
  onTranscript: (callback) => {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
};
