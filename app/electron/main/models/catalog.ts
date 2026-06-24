/**
 * Model catalog — the static registry of STT/LLM models the picker offers. PURE data + a filter;
 * download/cache/hardware-probe are native runtime concerns (P3) handled separately. The concrete
 * ids are wired against real model cards (backend/10 §5-6); verify filenames/checksums at build.
 */
import type { ModelInfo } from "../../../src/services/ports";

export type ModelKind = "stt" | "llm";

const STT_MODELS: ModelInfo[] = [
  { id: "ggml-base.en.bin", name: "Whisper Base (English)", sizeLabel: "142 MB", recommended: false },
  { id: "ggml-small.bin", name: "Whisper Small", sizeLabel: "466 MB", recommended: true },
  { id: "ggml-large-v3-turbo.bin", name: "Whisper Large v3 Turbo", sizeLabel: "1.5 GB", recommended: false },
  { id: "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3", name: "Parakeet TDT 0.6B v3", sizeLabel: "0.6 GB", recommended: false },
  { id: "gpt-4o-mini-transcribe", name: "OpenAI gpt-4o-mini-transcribe (cloud)", sizeLabel: "cloud", recommended: false },
  { id: "nova-3", name: "Deepgram Nova-3 (cloud)", sizeLabel: "cloud", recommended: false },
];

const LLM_MODELS: ModelInfo[] = [
  { id: "qwen2.5-1.5b-instruct-q4_k_m.gguf", name: "Qwen2.5 1.5B Instruct", sizeLabel: "1.1 GB", recommended: false },
  { id: "qwen2.5-3b-instruct-q4_k_m.gguf", name: "Qwen2.5 3B Instruct", sizeLabel: "2.0 GB", recommended: true },
  { id: "llama-3.2-3b-instruct-q4_k_m.gguf", name: "Llama 3.2 3B Instruct", sizeLabel: "2.0 GB", recommended: false },
  { id: "qwen2.5-7b-instruct-q4_k_m.gguf", name: "Qwen2.5 7B Instruct", sizeLabel: "4.7 GB", recommended: false },
  { id: "mistral-7b-instruct-v0.3.q4_k_m.gguf", name: "Mistral 7B Instruct v0.3", sizeLabel: "4.4 GB", recommended: false },
  { id: "gpt-4o-mini", name: "OpenAI gpt-4o-mini (cloud)", sizeLabel: "cloud", recommended: false },
  { id: "claude-3-5-haiku", name: "Anthropic Claude 3.5 Haiku (cloud)", sizeLabel: "cloud", recommended: false },
];

export function listModels(kind: ModelKind): ModelInfo[] {
  return kind === "stt" ? [...STT_MODELS] : [...LLM_MODELS];
}

export function recommendedModel(kind: ModelKind): ModelInfo | undefined {
  return listModels(kind).find((model) => model.recommended);
}

/**
 * Download/verify manifest for a local model (07 §3). `bytes`/`sha256` are optional: when present we
 * verify exactly; when absent we accept a fully-transferred file (content-length complete). The
 * first `sources[]` entry matches the URL the fetch scripts already use, so an in-app download and
 * `npm run fetch:*` pull byte-identical files. Cloud catalog entries have NO manifest.
 *
 * A model is usually a single file (`fileName` + `sources`). A few engines (sherpa-onnx Parakeet)
 * ship as a SET of files; those declare `files[]` and `fileName` names the per-model directory the
 * parts land in (`<modelsDir>/<fileName>/<part>`). Multi-file models leave `sources` empty.
 */
export interface ModelFile {
  /** On-disk filename within the model directory. */
  name: string;
  /** Ordered mirrors for this individual part. */
  sources: string[];
  bytes?: number;
  sha256?: string;
}

export interface ModelManifest {
  engine: "whisper" | "parakeet" | "llama";
  /** Single-file: the on-disk filename. Multi-file: the per-model directory name. */
  fileName: string;
  /** Ordered mirrors; sources[0] == the script URL today. Empty for multi-file models. */
  sources: string[];
  bytes?: number;
  sha256?: string;
  /** When present, a multi-file model: each part lands in `<modelsDir>/<fileName>/<part.name>`. */
  files?: ModelFile[];
}

const HF = "https://huggingface.co";

const MANIFESTS: Record<string, ModelManifest> = {
  "ggml-base.en.bin": {
    engine: "whisper",
    fileName: "ggml-base.en.bin",
    sources: [`${HF}/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin`],
  },
  "ggml-small.bin": {
    engine: "whisper",
    fileName: "ggml-small.bin",
    sources: [`${HF}/ggerganov/whisper.cpp/resolve/main/ggml-small.bin`],
  },
  "ggml-large-v3-turbo.bin": {
    engine: "whisper",
    fileName: "ggml-large-v3-turbo.bin",
    sources: [`${HF}/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin`],
  },
  "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3": {
    engine: "parakeet",
    // Multi-file model: the parts live in <modelsDir>/<fileName>/. The int8 export is the default
    // (smallest, real-time on CPU). Pinned checksums must be filled at build (verify-model-pins.mjs).
    fileName: "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
    sources: [],
    files: [
      {
        name: "encoder.int8.onnx",
        sources: [`${HF}/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/main/encoder.int8.onnx`],
      },
      {
        name: "decoder.int8.onnx",
        sources: [`${HF}/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/main/decoder.int8.onnx`],
      },
      {
        name: "joiner.int8.onnx",
        sources: [`${HF}/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/main/joiner.int8.onnx`],
      },
      {
        name: "tokens.txt",
        sources: [`${HF}/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/main/tokens.txt`],
      },
    ],
  },
  "qwen2.5-1.5b-instruct-q4_k_m.gguf": {
    engine: "llama",
    fileName: "qwen2.5-1.5b-instruct-q4_k_m.gguf",
    sources: [`${HF}/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf`],
  },
  "qwen2.5-3b-instruct-q4_k_m.gguf": {
    engine: "llama",
    fileName: "qwen2.5-3b-instruct-q4_k_m.gguf",
    sources: [`${HF}/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf`],
  },
  "llama-3.2-3b-instruct-q4_k_m.gguf": {
    engine: "llama",
    fileName: "llama-3.2-3b-instruct-q4_k_m.gguf",
    sources: [`${HF}/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf`],
  },
  "qwen2.5-7b-instruct-q4_k_m.gguf": {
    engine: "llama",
    fileName: "qwen2.5-7b-instruct-q4_k_m.gguf",
    sources: [`${HF}/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/main/qwen2.5-7b-instruct-q4_k_m.gguf`],
  },
  "mistral-7b-instruct-v0.3.q4_k_m.gguf": {
    engine: "llama",
    fileName: "mistral-7b-instruct-v0.3.q4_k_m.gguf",
    sources: [`${HF}/bartowski/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3-Q4_K_M.gguf`],
  },
};

/** The manifest for a model id, or undefined for cloud/unknown ids (not locally managed). */
export function modelManifest(id: string): ModelManifest | undefined {
  return MANIFESTS[id];
}

/** `stt` | `llm` for a known local id, else undefined. */
export function modelKindOf(id: string): ModelKind | undefined {
  if (STT_MODELS.some((m) => m.id === id)) return "stt";
  if (LLM_MODELS.some((m) => m.id === id)) return "llm";
  return undefined;
}

/** Every locally-managed model (those with a manifest), joined with its catalog info + kind. */
export function localModels(): { info: ModelInfo; kind: ModelKind; manifest: ModelManifest }[] {
  const out: { info: ModelInfo; kind: ModelKind; manifest: ModelManifest }[] = [];
  for (const kind of ["stt", "llm"] as const) {
    for (const info of listModels(kind)) {
      const manifest = MANIFESTS[info.id];
      if (manifest) out.push({ info, kind, manifest });
    }
  }
  return out;
}
