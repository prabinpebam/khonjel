/**
 * Short UI sound cues for dictation start/stop, synthesized with the Web Audio API so we ship no
 * audio files. Everything no-ops gracefully when AudioContext is unavailable (tests / SSR), and
 * the context is created lazily + resumed on demand since cues fire from user gestures.
 */

type AudioContextCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Play a single sine tone at `freq` Hz for `durationMs`, optionally delayed by `startOffsetMs`. */
function tone(freq: number, durationMs: number, startOffsetMs = 0): void {
  const ac = audioContext();
  if (!ac) return;
  if (ac.state === "suspended") void ac.resume();
  const now = ac.currentTime + startOffsetMs / 1000;
  const dur = durationMs / 1000;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  // Quick fade in/out so the tone doesn't click.
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
  gain.gain.linearRampToValueAtTime(0, now + dur);
  osc.connect(gain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

/** Rising two-note cue: recording started. */
export function playStartCue(): void {
  tone(660, 90);
  tone(990, 110, 90);
}

/** Falling two-note cue: recording stopped, transcription begins. */
export function playStopCue(): void {
  tone(880, 90);
  tone(520, 120, 90);
}
