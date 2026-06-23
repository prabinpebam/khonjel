/**
 * Auto gain control (AGC) for mic capture — PURE + unit-tested (jsdom), like the WAV helpers.
 *
 * Two jobs, both so dictation "records at the right volume" without the user touching a slider:
 *   1. {@link AutoGain.process} watches the signal and adapts a gain that pulls quiet speech up and
 *      loud speech down toward a target peak, with fast attack (anti-clip) and slow release (no pump).
 *   2. It also returns a **normalized 0..1 meter level** so the waveform reflects the gained signal
 *      and can never exceed its bounds — the visual and the audio are normalized together.
 *
 * {@link applyGainLimited} applies the gain through a soft limiter whose output is always strictly
 * inside (-1, 1), so the recorded audio cannot hard-clip even on a sudden shout.
 */
export interface AgcConfig {
  /** Desired post-gain peak. Below 1.0 to leave headroom so transients do not slam the ceiling. */
  targetPeak: number;
  /** Never amplify more than this (keeps the noise floor from being blown up during pauses). */
  maxGain: number;
  /** Never attenuate below this. */
  minGain: number;
  /** RMS below which a block is treated as silence: gain holds and the meter reads 0. */
  gateRms: number;
  /** Peak-follower rise smoothing (0..1), high so loud onsets are seen immediately. */
  attack: number;
  /** Peak-follower fall smoothing (0..1), low so the envelope decays gently. */
  release: number;
  /** Gain increase smoothing (0..1), low so quiet passages ramp up without pumping. */
  riseRate: number;
  /** Gain decrease smoothing (0..1), high so a loud onset pulls gain down fast (anti-clip). */
  fallRate: number;
  /** Scales post-gain RMS into the 0..1 meter range; clamped, so the meter never clips. */
  meterGain: number;
}

export const DEFAULT_AGC: AgcConfig = {
  targetPeak: 0.9,
  maxGain: 8,
  minGain: 0.5,
  gateRms: 0.006,
  attack: 0.6,
  release: 0.05,
  riseRate: 0.08,
  fallRate: 0.5,
  meterGain: 3.5,
};

export interface AgcResult {
  /** Gain to apply to this block's samples. */
  gain: number;
  /** Normalized meter level in [0, 1] for the waveform (0 while gated/silent). */
  level: number;
  /** This block's peak magnitude (pre-gain). */
  peak: number;
  /** This block's RMS (pre-gain). */
  rms: number;
}

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

/**
 * Soft limiter: identity below {@link KNEE}, then a saturating curve that approaches but never
 * reaches 1.0, so the output magnitude is always strictly less than 1 (no hard clipping).
 */
const KNEE = 0.8;
export function softLimit(x: number): number {
  const a = Math.abs(x);
  if (a <= KNEE) return x;
  const sign = x < 0 ? -1 : 1;
  const over = a - KNEE; // > 0
  const range = 1 - KNEE; // headroom to the ceiling
  return sign * (KNEE + (range * over) / (over + range));
}

/** Apply `gain` to every sample through the soft limiter. Returns a new array (callers need a copy). */
export function applyGainLimited(block: Float32Array, gain: number, out?: Float32Array): Float32Array {
  const dst = out ?? new Float32Array(block.length);
  for (let i = 0; i < block.length; i++) dst[i] = softLimit((block[i] ?? 0) * gain);
  return dst;
}

/**
 * Stateful auto-gain. Feed it each audio block in order; it advances an internal peak envelope and
 * gain and tells you the gain to apply plus a normalized meter level.
 */
export class AutoGain {
  private gain = 1;
  private env = 0;
  private readonly cfg: AgcConfig;

  constructor(cfg: Partial<AgcConfig> = {}) {
    this.cfg = { ...DEFAULT_AGC, ...cfg };
  }

  get currentGain(): number {
    return this.gain;
  }

  process(block: Float32Array): AgcResult {
    const cfg = this.cfg;
    let peak = 0;
    let sumSq = 0;
    for (let i = 0; i < block.length; i++) {
      const v = block[i] ?? 0;
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      sumSq += v * v;
    }
    const rms = block.length > 0 ? Math.sqrt(sumSq / block.length) : 0;

    // Peak follower: fast attack, slow release.
    const coeff = peak > this.env ? cfg.attack : cfg.release;
    this.env += coeff * (peak - this.env);

    const voiced = rms >= cfg.gateRms;
    if (voiced) {
      // Aim the envelope at the target; move gain up slowly, down quickly.
      const desired = clamp(cfg.targetPeak / Math.max(this.env, 1e-4), cfg.minGain, cfg.maxGain);
      const rate = desired < this.gain ? cfg.fallRate : cfg.riseRate;
      this.gain += rate * (desired - this.gain);
    }
    // While gated (silence) the gain simply holds, so noise is not amplified up to the target.

    const level = voiced ? clamp(rms * this.gain * cfg.meterGain, 0, 1) : 0;
    return { gain: this.gain, level, peak, rms };
  }
}
