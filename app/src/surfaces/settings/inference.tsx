import { useState } from "react";
import { Check, Eye, EyeOff, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { useSettingsStore } from "@stores/settings";
import type { ModelInfo } from "@services/ports";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Select } from "@components/ui/select";
import { cn } from "@lib/utils";

export type InferenceMode = "cloud" | "providers" | "local" | "self-hosted" | "enterprise";

const MODE_META: Record<InferenceMode, { label: string; description: string }> = {
  cloud: { label: "Khonjel Cloud", description: "Managed, no setup. Needs a free account." },
  providers: { label: "Providers", description: "Bring your own API key." },
  local: { label: "Local", description: "On-device models, fully private." },
  "self-hosted": { label: "Self-Hosted", description: "OpenAI-compatible server on your network." },
  enterprise: { label: "Enterprise", description: "AWS Bedrock, Azure OpenAI, or Google Vertex." },
};

const STT_PROVIDERS = ["Deepgram", "AssemblyAI", "ElevenLabs", "Speechmatics", "Mistral Voxtral", "xAI", "Custom"];
const LLM_PROVIDERS = [
  "OpenAI",
  "Anthropic",
  "Google Gemini",
  "Groq",
  "Mistral",
  "DeepSeek",
  "xAI",
  "Cohere",
  "Together",
  "OpenRouter",
  "Perplexity",
  "Custom",
];
const HELPERS = ["Ollama", "LM Studio", "vLLM", "llama-server"];
const ENTERPRISE = ["AWS Bedrock", "Azure OpenAI", "Google Vertex"];

function toOptions(values: string[]) {
  return values.map((v) => ({ value: v.toLowerCase().replace(/\s+/g, "-"), label: v }));
}

export function InferenceModeSelector({ modeKey, modes }: { modeKey: string; modes: InferenceMode[] }) {
  const value = useSettingsStore((s) => s.values[modeKey] ?? "local");
  const setValue = useSettingsStore((s) => s.setValue);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {modes.map((mode) => {
        const meta = MODE_META[mode];
        const active = value === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setValue(modeKey, mode)}
            className={cn(
              "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
              active ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-2",
            )}
          >
            <span
              className={cn(
                "mt-0.5 grid size-4 shrink-0 place-items-center rounded-pill border",
                active ? "border-accent bg-accent text-primary-foreground" : "border-border",
              )}
            >
              {active ? <Check className="size-3" /> : null}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{meta.label}</span>
              <span className="block text-xs text-muted-foreground">{meta.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ValueInput({ valueKey, placeholder }: { valueKey: string; placeholder?: string }) {
  const value = useSettingsStore((s) => s.values[valueKey] ?? "");
  const setValue = useSettingsStore((s) => s.setValue);
  return (
    <Input value={value} placeholder={placeholder} onChange={(e) => setValue(valueKey, e.target.value)} />
  );
}

function ValueSelect({
  valueKey,
  options,
}: {
  valueKey: string;
  options: { value: string; label: string }[];
}) {
  const value = useSettingsStore((s) => s.values[valueKey] ?? options[0]?.value ?? "");
  const setValue = useSettingsStore((s) => s.setValue);
  return (
    <Select
      value={value}
      onValueChange={(v) => setValue(valueKey, v)}
      options={options}
      className="w-full"
    />
  );
}

function PasswordInput({ valueKey, placeholder }: { valueKey: string; placeholder?: string }) {
  const value = useSettingsStore((s) => s.values[valueKey] ?? "");
  const setValue = useSettingsStore((s) => s.setValue);
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? "text" : "password"}
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(valueKey, e.target.value)}
        className="pe-9"
      />
      <button
        type="button"
        aria-label={show ? "Hide value" : "Show value"}
        onClick={() => setShow((v) => !v)}
        className="absolute top-1/2 -translate-y-1/2 text-tertiary-foreground end-2"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function modelOptions(models: ModelInfo[]) {
  return models.map((m) => ({
    value: m.id,
    label: `${m.name} · ${m.sizeLabel}${m.recommended ? " (Recommended)" : ""}`,
  }));
}

export function InferenceConfigBlock({
  prefix,
  kind,
  models,
}: {
  prefix: string;
  kind: "stt" | "llm";
  models: ModelInfo[];
}) {
  const mode = useSettingsStore((s) => s.values[`${prefix}.mode`] ?? "local");

  if (mode === "cloud") {
    return (
      <p className="text-sm text-muted-foreground">
        Processing happens on Khonjel&apos;s managed servers. Sign in to enable.
      </p>
    );
  }

  if (mode === "providers") {
    return (
      <div className="flex flex-col gap-4">
        <Field label="Provider">
          <ValueSelect
            valueKey={`${prefix}.provider`}
            options={toOptions(kind === "stt" ? STT_PROVIDERS : LLM_PROVIDERS)}
          />
        </Field>
        <Field label="API key">
          <PasswordInput valueKey={`${prefix}.apiKey`} placeholder="sk-…" />
        </Field>
        <Field label="Model">
          <ValueSelect valueKey={`${prefix}.model`} options={modelOptions(models)} />
        </Field>
      </div>
    );
  }

  if (mode === "self-hosted") {
    return (
      <div className="flex flex-col gap-4">
        <Field label="Base URL">
          <ValueInput valueKey={`${prefix}.baseUrl`} placeholder="http://localhost:8000" />
        </Field>
        <Field label="Helper">
          <ValueSelect valueKey={`${prefix}.helper`} options={toOptions(HELPERS)} />
        </Field>
        <Field label="API key (optional)">
          <PasswordInput valueKey={`${prefix}.apiKey`} placeholder="Bearer token" />
        </Field>
        <Button variant="secondary" size="sm" className="self-start">
          <RefreshCw />
          Refresh models
        </Button>
      </div>
    );
  }

  if (mode === "enterprise") {
    return (
      <div className="flex flex-col gap-4">
        <Field label="Provider">
          <ValueSelect valueKey={`${prefix}.enterprise`} options={toOptions(ENTERPRISE)} />
        </Field>
        <Field label="Region">
          <ValueInput valueKey={`${prefix}.region`} placeholder="us-east-1" />
        </Field>
        <Field label="Deployment">
          <ValueInput valueKey={`${prefix}.deployment`} placeholder="deployment name" />
        </Field>
        <Button variant="secondary" size="sm" className="self-start">
          Test connection
        </Button>
      </div>
    );
  }

  // local
  return (
    <div className="flex flex-col gap-4">
      {kind === "stt" ? (
        <Field label="Provider">
          <LocalProviderPicker valueKey={`${prefix}.localProvider`} />
        </Field>
      ) : null}
      <Field label="Model">
        <ValueSelect valueKey={`${prefix}.model`} options={modelOptions(models)} />
      </Field>
      <p className="text-xs text-tertiary-foreground">Runs on device. GPU auto-detected.</p>
    </div>
  );
}

function LocalProviderPicker({ valueKey }: { valueKey: string }) {
  const value = useSettingsStore((s) => s.values[valueKey] ?? "whisper");
  const setValue = useSettingsStore((s) => s.setValue);
  const options = [
    { value: "whisper", label: "Whisper" },
    { value: "parakeet", label: "NVIDIA Parakeet" },
  ];
  return (
    <div className="flex gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setValue(valueKey, opt.value)}
            className={cn(
              "rounded-pill border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
