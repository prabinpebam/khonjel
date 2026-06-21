import { AudioLines, Server, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "@lib/utils";

// Monochrome brand SVGs (currentColor, 1em) from @lobehub/icons-static-svg (MIT).
import openai from "@lobehub/icons-static-svg/icons/openai.svg?raw";
import anthropic from "@lobehub/icons-static-svg/icons/anthropic.svg?raw";
import gemini from "@lobehub/icons-static-svg/icons/gemini.svg?raw";
import groq from "@lobehub/icons-static-svg/icons/groq.svg?raw";
import mistral from "@lobehub/icons-static-svg/icons/mistral.svg?raw";
import deepseek from "@lobehub/icons-static-svg/icons/deepseek.svg?raw";
import xai from "@lobehub/icons-static-svg/icons/xai.svg?raw";
import cohere from "@lobehub/icons-static-svg/icons/cohere.svg?raw";
import together from "@lobehub/icons-static-svg/icons/together.svg?raw";
import openrouter from "@lobehub/icons-static-svg/icons/openrouter.svg?raw";
import perplexity from "@lobehub/icons-static-svg/icons/perplexity.svg?raw";
import assemblyai from "@lobehub/icons-static-svg/icons/assemblyai.svg?raw";
import elevenlabs from "@lobehub/icons-static-svg/icons/elevenlabs.svg?raw";
import ollama from "@lobehub/icons-static-svg/icons/ollama.svg?raw";
import lmstudio from "@lobehub/icons-static-svg/icons/lmstudio.svg?raw";
import vllm from "@lobehub/icons-static-svg/icons/vllm.svg?raw";
import bedrock from "@lobehub/icons-static-svg/icons/bedrock.svg?raw";
import azure from "@lobehub/icons-static-svg/icons/azure.svg?raw";
import google from "@lobehub/icons-static-svg/icons/google.svg?raw";
import nvidia from "@lobehub/icons-static-svg/icons/nvidia.svg?raw";

/** Provider slug (from the option value) -> inline brand SVG markup. */
const SVGS: Record<string, string> = {
  openai,
  whisper: openai,
  anthropic,
  "google-gemini": gemini,
  groq,
  mistral,
  "mistral-voxtral": mistral,
  deepseek,
  xai,
  cohere,
  together,
  openrouter,
  perplexity,
  assemblyai,
  elevenlabs,
  ollama,
  "lm-studio": lmstudio,
  vllm,
  "aws-bedrock": bedrock,
  "azure-openai": azure,
  "google-vertex": google,
  parakeet: nvidia,
};

/** Providers without a dedicated brand mark fall back to a tasteful lucide glyph. */
const FALLBACK: Record<string, LucideIcon> = {
  deepgram: AudioLines,
  speechmatics: AudioLines,
  "llama-server": Server,
  custom: Wrench,
};

interface ProviderIconProps {
  provider: string;
  className?: string;
}

/** Brand icon for an inference provider, rendered monochrome in currentColor. */
export function ProviderIcon({ provider, className }: ProviderIconProps) {
  const svg = SVGS[provider];
  if (svg) {
    return (
      <span
        aria-hidden
        className={cn("inline-flex shrink-0 [&>svg]:size-4", className)}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  const Icon = FALLBACK[provider] ?? Server;
  return <Icon aria-hidden className={cn("size-4 shrink-0", className)} />;
}
