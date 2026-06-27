/**
 * Quirky "what's happening" lines for the launch splash. The bulk are assembled from segment pools
 * (action x subject x suffix = thousands of combinations) and mixed with hand-written one-liners, so
 * the rotation almost never repeats during a launch. Text only -- no emoji (design-system rule).
 */

const ACTIONS = [
  "Warming up",
  "Spinning up",
  "Bribing",
  "Coaxing",
  "Untangling",
  "Summoning",
  "Negotiating with",
  "Booting",
  "Polishing",
  "Herding",
  "Caffeinating",
  "Reticulating",
  "Defragmenting",
  "Whispering to",
  "Aligning",
  "Calibrating",
  "Persuading",
  "Wrangling",
  "Fine-tuning",
  "Nudging",
  "Greasing",
  "Limbering up",
  "Sweet-talking",
  "Unfolding",
  "Priming",
  "Buffing",
  "Rallying",
  "Tickling",
] as const;

const SUBJECTS = [
  "the neural pathways",
  "the GPU",
  "the language model",
  "the dictation engine",
  "the token stream",
  "the silicon",
  "a few billion parameters",
  "the local model",
  "the speech recognizer",
  "the inference runtime",
  "the audio pipeline",
  "the hotkey daemon",
  "the embeddings",
  "the transformer stack",
  "the attention heads",
  "the on-device brain",
  "the cleanup crew",
  "the autocorrect gremlins",
  "the matrix multipliers",
  "the floating bar",
  "the context window",
  "the whisper of your voice",
  "the privacy bubble",
  "the vector soup",
] as const;

const SUFFIXES = [
  "...",
  " (this is fine)",
  ", almost there",
  ", hold tight",
  ", any moment now",
  " for science",
  " with great care",
  " as fast as physics allows",
  ", promise",
  " -- won't be long",
  ", looking good",
  ", nearly there",
] as const;

const ONE_LINERS = [
  "Teaching the robot to listen...",
  "Counting to a few billion...",
  "Asking the GPU nicely...",
  "Pretending to load (just kidding)...",
  "Locating the on switch...",
  "Translating thoughts into text...",
  "Making your words feel important...",
  "Doing math no human should attempt...",
  "Keeping everything on your device, as promised...",
  "Convincing electrons to cooperate...",
  "Loading the part that makes it clever...",
  "Stretching before the heavy lifting...",
  "Reading the manual we never wrote...",
  "Pouring coffee for the silicon...",
  "Untangling a very long sentence...",
  "Rounding up stray tokens...",
  "Double-checking we didn't leave the mic on...",
  "Reminding the model who is boss...",
  "Folding a thousand paper cranes of math...",
  "Putting the smart in the smart parts...",
  "Tuning the ears before the brain...",
  "Letting the parameters stretch their legs...",
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

let last = "";

/** A quirky status line. ~1 in 4 is a hand-written one-liner; the rest are mixed from the pools. */
export function randomSplashMessage(): string {
  for (let i = 0; i < 6; i++) {
    const msg =
      Math.random() < 0.25 ? pick(ONE_LINERS) : `${pick(ACTIONS)} ${pick(SUBJECTS)}${pick(SUFFIXES)}`;
    if (msg !== last) {
      last = msg;
      return msg;
    }
  }
  return last;
}
