// @vitest-environment node
import { describe, it, expect } from "vitest";
import { AutoGain, applyGainLimited, softLimit, DEFAULT_AGC } from "./agc";

/** A constant-amplitude block (a crude steady tone) of `n` samples. */
function block(amp: number, n = 1024): Float32Array {
  const b = new Float32Array(n);
  b.fill(amp);
  return b;
}

/** Run the same block through the AGC `iters` times to let the gain settle. */
function settle(agc: AutoGain, b: Float32Array, iters: number) {
  let last = agc.process(b);
  for (let i = 1; i < iters; i++) last = agc.process(b);
  return last;
}

describe("softLimit", () => {
  it("is the identity below the knee", () => {
    expect(softLimit(0)).toBe(0);
    expect(softLimit(0.5)).toBeCloseTo(0.5, 6);
    expect(softLimit(-0.5)).toBeCloseTo(-0.5, 6);
  });

  it("never reaches the clipping ceiling, even for huge input", () => {
    expect(Math.abs(softLimit(100))).toBeLessThan(1);
    expect(Math.abs(softLimit(-100))).toBeLessThan(1);
    expect(softLimit(1e6)).toBeLessThan(1);
    expect(softLimit(1e6)).toBeGreaterThan(0.95);
  });

  it("is monotonic and sign-preserving past the knee", () => {
    expect(softLimit(0.9)).toBeGreaterThan(softLimit(0.85));
    expect(softLimit(-0.9)).toBeLessThan(softLimit(-0.85));
  });
});

describe("applyGainLimited", () => {
  it("scales quiet samples linearly", () => {
    const out = applyGainLimited(block(0.1, 4), 4);
    for (const v of out) expect(v).toBeCloseTo(0.4, 6);
  });

  it("keeps every output strictly inside (-1, 1) under extreme gain", () => {
    const out = applyGainLimited(block(0.9, 8), 50);
    for (const v of out) expect(Math.abs(v)).toBeLessThan(1);
  });
});

describe("AutoGain", () => {
  it("amplifies persistently quiet speech toward the target", () => {
    const agc = new AutoGain();
    const before = agc.process(block(0.05)).gain;
    const after = settle(agc, block(0.05), 200).gain;
    expect(after).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(1);
    expect(after).toBeLessThanOrEqual(DEFAULT_AGC.maxGain);
  });

  it("pulls a loud signal down below unity gain", () => {
    const agc = new AutoGain();
    const after = settle(agc, block(0.95), 200).gain;
    expect(after).toBeLessThan(1);
    expect(after).toBeGreaterThanOrEqual(DEFAULT_AGC.minGain);
  });

  it("reports a zero meter level for silence and holds gain", () => {
    const agc = new AutoGain();
    settle(agc, block(0.2), 100); // establish some gain on speech
    const held = agc.currentGain;
    const res = agc.process(block(0)); // pure silence -> gated
    expect(res.level).toBe(0);
    expect(agc.currentGain).toBeCloseTo(held, 6); // gain did not run away on silence
  });

  it("keeps the meter level within [0, 1] for any input", () => {
    const agc = new AutoGain();
    for (const amp of [0, 0.01, 0.1, 0.5, 0.99]) {
      const res = settle(agc, block(amp), 50);
      expect(res.level).toBeGreaterThanOrEqual(0);
      expect(res.level).toBeLessThanOrEqual(1);
    }
  });

  it("produces a non-zero meter level for audible speech", () => {
    const agc = new AutoGain();
    const res = settle(agc, block(0.2), 50);
    expect(res.level).toBeGreaterThan(0);
  });
});
