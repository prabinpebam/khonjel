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
