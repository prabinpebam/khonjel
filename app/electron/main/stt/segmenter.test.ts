// @vitest-environment node
import { describe, it, expect } from "vitest";
import { createSegmenter, frameRms, DEFAULT_SEGMENTER } from "./segmenter";

/** A 10 ms (160-sample) frame at a constant amplitude (0..1 -> 16-bit). */
function frame(amp: number): Int16Array {
  const f = new Int16Array(160);
  f.fill(Math.round(amp * 32767));
  return f;
}
const LOUD = frame(0.5); // well above the 0.01 silence gate
const QUIET = frame(0); // silence

describe("frameRms", () => {
  it("is ~0 for silence and high for a loud tone", () => {
    expect(frameRms(QUIET)).toBeCloseTo(0, 5);
    expect(frameRms(LOUD)).toBeGreaterThan(0.4);
  });
});

describe("createSegmenter", () => {
  it("closes a segment after a silence tail following speech", () => {
    const seg = createSegmenter({ ...DEFAULT_SEGMENTER, silenceTailMs: 300, minSegmentMs: 100 });
    // 500 ms of speech -> no boundary yet.
    let closed: Int16Array | null = null;
    for (let i = 0; i < 50; i++) closed = closed ?? seg.push(LOUD);
    expect(closed).toBeNull();
    // 300 ms of silence -> boundary.
    let out: Int16Array | null = null;
    for (let i = 0; i < 30 && !out; i++) out = seg.push(QUIET);
    expect(out).not.toBeNull();
    // The closed segment spans the speech + the trailing silence frames pushed so far.
    expect(out!.length).toBeGreaterThan(50 * 160);
  });

  it("does not close on silence alone (no voiced content)", () => {
    const seg = createSegmenter({ ...DEFAULT_SEGMENTER, silenceTailMs: 200, minSegmentMs: 100 });
    let out: Int16Array | null = null;
    for (let i = 0; i < 100 && !out; i++) out = seg.push(QUIET);
    expect(out).toBeNull();
    expect(seg.flush()).toBeNull(); // pure silence flushes to nothing
  });

  it("hard-caps a continuous talker into a window", () => {
    const seg = createSegmenter({ ...DEFAULT_SEGMENTER, maxWindowSec: 1, silenceTailMs: 9999 });
    let out: Int16Array | null = null;
    // 1 s = 100 frames of 10 ms; the 100th hits the cap.
    for (let i = 0; i < 120 && !out; i++) out = seg.push(LOUD);
    expect(out).not.toBeNull();
    expect(out!.length).toBe(100 * 160);
  });

  it("flush returns the trailing voiced segment at stop", () => {
    const seg = createSegmenter({ ...DEFAULT_SEGMENTER, silenceTailMs: 9999, minSegmentMs: 100 });
    for (let i = 0; i < 40; i++) seg.push(LOUD);
    const tail = seg.flush();
    expect(tail).not.toBeNull();
    expect(tail!.length).toBe(40 * 160);
    expect(seg.flush()).toBeNull(); // drained
  });
});
