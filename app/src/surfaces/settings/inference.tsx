import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { useServices } from "@services";
import { useSettingsStore } from "@stores/settings";
import type { ConnectionProfile, ConnectionTestResult } from "@services/ports";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Select } from "@components/ui/select";
import { ProviderIcon } from "@components/brand/provider-icon";
import { cn } from "@lib/utils";
import { LocalModelList } from "./LocalModelList";
import { AccelerationCard } from "./AccelerationCard";

export type InferenceMode = "cloud" | "providers" | "local" | "self-hosted" | "enterprise";

const MODE_META: Record<InferenceMode, { label: string; description: string }> = {
  cloud: { label: "Khonjel Cloud", description: "Managed cloud service. Coming soon." },
  providers: { label: "Providers", description: "Bring your own API key." },
  local: { label: "Local", description: "On-device models, fully private." },
  "self-hosted": { label: "Self-Hosted", description: "OpenAI-compatible server on your network." },
  enterprise: { label: "Enterprise", description: "AWS Bedrock, Azure OpenAI, or Google Vertex." },
};

/** Modes shown as non-selectable placeholders (planned, not yet available). */
const PLACEHOLDER_MODES = new Set<InferenceMode>(["cloud"]);

export function InferenceModeSelector({ modeKey, modes }: { modeKey: string; modes: InferenceMode[] }) {
  const value = useSettingsStore((s) => s.values[modeKey] ?? "local");
  const setValue = useSettingsStore((s) => s.setValue);
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {modes.map((mode) => {
        const meta = MODE_META[mode];
        const active = value === mode;
        const isPlaceholder = PLACEHOLDER_MODES.has(mode);
        return (
          <button
            key={mode}
            type="button"
            disabled={isPlaceholder}
            onClick={() => setValue(modeKey, mode)}
            className={cn(
              "flex items-start gap-3 rounded-md border p-3 text-left transition-colors",
              active ? "border-accent bg-accent-soft" : "border-border bg-surface hover:bg-surface-2",
              isPlaceholder && "cursor-not-allowed opacity-60 hover:bg-surface",
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
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {meta.label}
                {isPlaceholder ? (
                  <span className="rounded-pill border border-border px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Soon
                  </span>
                ) : null}
              </span>
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

export function InferenceConfigBlock({
  prefix,
  kind,
}: {
  prefix: string;
  kind: "stt" | "llm";
}) {
  const mode = useSettingsStore((s) => s.values[`${prefix}.mode`] ?? "local");

  if (mode === "cloud") {
    return (
      <p className="text-sm text-muted-foreground">
        Khonjel Cloud is coming soon. Use Local, Providers, Self-Hosted, or Enterprise for now.
      </p>
    );
  }

  if (mode === "providers" || mode === "enterprise" || mode === "self-hosted") {
    return <ConnectionSlotConfig prefix={prefix} kind={kind} />;
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
        <LocalModelList kind={kind} prefix={prefix} />
      </Field>
      {kind === "llm" ? (
        <AccelerationCard />
      ) : (
        <p className="text-xs text-tertiary-foreground">Runs on device. Voice typing runs on the CPU.</p>
      )}
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
              "inline-flex items-center gap-2 rounded-pill border px-3 py-1.5 text-sm transition-colors",
              active
                ? "border-accent bg-accent-soft text-accent"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <ProviderIcon provider={opt.value} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Cloud / self-hosted / enterprise slot config: bind this slot to a saved Connection (created in
 * Settings -> Connections, including Azure OpenAI and custom OpenAI-compatible URLs) plus a model /
 * deployment, and test it. Writes `{prefix}.connectionId` + `{prefix}.target` to settings, which
 * the main-process provider router reads to route the request.
 */
function ConnectionSlotConfig({ prefix, kind }: { prefix: string; kind: "stt" | "llm" }) {
  const { connections } = useServices();
  const [list, setList] = useState<ConnectionProfile[]>([]);
  const connectionId = useSettingsStore((s) => s.values[`${prefix}.connectionId`] ?? "");
  const target = useSettingsStore((s) => s.values[`${prefix}.target`] ?? "");
  const setValue = useSettingsStore((s) => s.setValue);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<ConnectionTestResult | null>(null);

  useEffect(() => {
    let live = true;
    void connections.list().then((l) => {
      if (live) setList(l);
    });
    return () => {
      live = false;
    };
  }, [connections]);

  async function runTest() {
    if (!connectionId) return;
    setTesting(true);
    setResult(null);
    try {
      setResult(await connections.test(connectionId, target, kind === "stt" ? "transcription" : "chat"));
    } finally {
      setTesting(false);
    }
  }

  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No connections yet. Add one in Settings -&gt; Connections (Azure OpenAI, an OpenAI-compatible
        custom URL, or a provider), then select it here.
      </p>
    );
  }

  const selected = list.find((c) => c.id === connectionId);

  return (
    <div className="flex flex-col gap-4">
      <Field label="Connection">
        <Select
          aria-label="Connection"
          value={connectionId}
          onValueChange={(v) => setValue(`${prefix}.connectionId`, v)}
          options={list.map((c) => ({
            value: c.id,
            label: `${c.id} (${c.kind})`,
            icon: <ProviderIcon provider={c.kind} />,
          }))}
          placeholder="Select a connection"
        />
      </Field>
      <Field label="Model / deployment (optional override)">
        <ValueInput
          valueKey={`${prefix}.target`}
          placeholder={
            selected?.model
              ? `Uses "${selected.model}" from the connection`
              : "Set a model on the connection, or override it here"
          }
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          className="self-start"
          disabled={!connectionId || testing}
          onClick={() => void runTest()}
        >
          {testing ? "Testing connection" : "Test connection"}
        </Button>
        {result ? (
          <span className={cn("text-sm", result.ok ? "text-accent" : "text-danger")}>
            {result.ok ? "Connected" : (result.message ?? "Failed")}
          </span>
        ) : null}
      </div>
    </div>
  );
}
