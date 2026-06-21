/**
 * whisper.cpp speech-to-text engine (child-process wrapper).
 *
 * Khonjel shells out to the prebuilt `whisper-cli` executable (standalone binary -> no native ABI
 * rebuild, same approach as the llama-server wrapper). The argv construction and stdout parsing are
 * PURE (BE1-tested); the actual process spawn is injected as `run`, so the transcriber is unit-
 * tested without the binary. The composition root wires the real spawn + a resolved model path.
 * See backend/10 (local STT) and stt/* siblings.
 */

export interface WhisperArgsOptions {
  modelPath: string;
  audioPath: string;
  /** BCP-47-ish whisper code, or "auto" to detect. */
  language?: string;
  /** Translate the audio to English instead of transcribing in-language. */
  translate?: boolean;
  threads?: number;
}

/** PURE: the whisper-cli argv that prints a clean, timestamp-free transcript to stdout. */
export function buildWhisperArgs(opts: WhisperArgsOptions): string[] {
  const args = [
    "-m",
    opts.modelPath,
    "-f",
    opts.audioPath,
    "-nt", // no timestamps
    "-np", // no prints (suppress system/model info; leave only the transcript)
    "-l",
    opts.language && opts.language.length > 0 ? opts.language : "auto",
  ];
  if (opts.translate) args.push("-tr");
  if (typeof opts.threads === "number") args.push("-t", String(opts.threads));
  return args;
}

/** PURE: collapse whisper-cli stdout into a single transcript string (strips any stray [timestamps]). */
export function parseWhisperText(stdout: string): string {
  return stdout
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\[[0-9:.\s\->]+\]\s*/, "").trim())
    .filter((line) => line.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Injected process runner: returns the command's stdout. The real one uses execFile. */
export type RunCommand = (bin: string, args: string[]) => Promise<string>;

export interface WhisperTranscriberOptions {
  binPath: string;
  modelPath: string;
  run: RunCommand;
  language?: string;
  threads?: number;
}

export interface Transcriber {
  transcribe: (audioPath: string, opts?: { language?: string; translate?: boolean }) => Promise<string>;
}

/** A real STT transcriber backed by whisper-cli. `transcribe` takes a path to a 16kHz mono WAV. */
export function createWhisperTranscriber(options: WhisperTranscriberOptions): Transcriber {
  return {
    transcribe: async (audioPath, opts = {}) => {
      const args = buildWhisperArgs({
        modelPath: options.modelPath,
        audioPath,
        language: opts.language ?? options.language,
        translate: opts.translate,
        threads: options.threads,
      });
      const stdout = await options.run(options.binPath, args);
      return parseWhisperText(stdout);
    },
  };
}
