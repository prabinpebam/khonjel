/**
 * Parakeet (NVIDIA) speech-to-text engine via sherpa-onnx (child-process wrapper).
 *
 * Khonjel shells out to the prebuilt `sherpa-onnx-offline` executable (and, for warm dictation, the
 * `sherpa-onnx-offline-websocket-server` — see stt/parakeet-server.ts). Both are standalone binaries
 * backed by ONNX Runtime -> no Python, no native ABI rebuild, the same approach as whisper-cli and
 * llama-server. The argv construction and JSON parsing are PURE (BE1-tested); the process spawn is
 * injected as `run`, so the one-shot transcriber is unit-tested without the binary. The runtime
 * resolver (stt/parakeet-runtime.ts) wires the real spawn + a resolved model directory.
 * See docs/archive/delivery-plans/parakeet-integration-plan.md.
 */
import type { RunCommand, Transcriber } from "./whisper";

/** The four on-disk parts of an exported sherpa-onnx Parakeet model. */
export interface ParakeetModelDir {
  encoder: string;
  decoder: string;
  joiner: string;
  tokens: string;
}

export interface SherpaArgsOptions {
  model: ParakeetModelDir;
  audioPath: string;
  numThreads?: number;
  provider?: "cpu" | "cuda";
}

/** The shared model + provider flags both the one-shot CLI and the server accept. */
function modelArgs(
  model: ParakeetModelDir,
  numThreads: number | undefined,
  provider: "cpu" | "cuda" | undefined,
): string[] {
  const args = [
    `--encoder=${model.encoder}`,
    `--decoder=${model.decoder}`,
    `--joiner=${model.joiner}`,
    `--tokens=${model.tokens}`,
    "--model-type=nemo_transducer",
    `--provider=${provider ?? "cpu"}`,
  ];
  if (typeof numThreads === "number") args.push(`--num-threads=${numThreads}`);
  return args;
}

/** PURE: the one-shot `sherpa-onnx-offline` argv (the audio path is the final positional arg). */
export function buildSherpaArgs(opts: SherpaArgsOptions): string[] {
  return [...modelArgs(opts.model, opts.numThreads, opts.provider), opts.audioPath];
}

/** PURE: the `sherpa-onnx-offline-websocket-server` argv (model + `--port`, no audio). */
export function buildSherpaServerArgs(o: {
  model: ParakeetModelDir;
  port: number;
  numThreads?: number;
  provider?: "cpu" | "cuda";
}): string[] {
  return [...modelArgs(o.model, o.numThreads, o.provider), `--port=${o.port}`];
}

/**
 * PURE: extract the transcript from a sherpa result/stdout. sherpa-onnx-offline prints config + log
 * lines and one JSON object with a `text` field; the websocket server returns that JSON directly.
 * Find the first line containing a JSON object whose `text` is a string, and trim it.
 */
export function parseSherpaText(out: string): string {
  for (const line of out.split(/\r?\n/)) {
    const start = line.indexOf("{");
    const end = line.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    try {
      const obj = JSON.parse(line.slice(start, end + 1)) as unknown;
      if (obj && typeof obj === "object" && "text" in obj) {
        const text = (obj as { text?: unknown }).text;
        if (typeof text === "string") return text.trim();
      }
    } catch {
      // not a JSON transcript line; keep scanning
    }
  }
  return "";
}

export interface ParakeetTranscriberOptions {
  binPath: string;
  model: ParakeetModelDir;
  run: RunCommand;
  numThreads?: number;
  provider?: "cpu" | "cuda";
}

/**
 * A one-shot Parakeet transcriber backed by `sherpa-onnx-offline`. Reloads the model on every call,
 * so it is the simple P1 stepping stone / non-interactive fallback; warm dictation uses the
 * persistent server (stt/parakeet-server.ts). Same `Transcriber` shape as whisper, so the
 * transcription service is engine-agnostic. `transcribe` takes a path to a 16 kHz mono WAV.
 */
export function createParakeetTranscriber(options: ParakeetTranscriberOptions): Transcriber {
  return {
    transcribe: async (audioPath) => {
      const args = buildSherpaArgs({
        model: options.model,
        audioPath,
        numThreads: options.numThreads,
        provider: options.provider,
      });
      const stdout = await options.run(options.binPath, args);
      return parseSherpaText(stdout);
    },
  };
}
