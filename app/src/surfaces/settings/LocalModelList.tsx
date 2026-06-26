import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ShieldCheck } from "lucide-react";
import { useServices } from "@services";
import type { ModelCompatibility, ModelReadiness, ModelStatus } from "@services/ports";
import { useSettingsStore } from "@stores/settings";
import { useModelsStore } from "@stores/models";
import { Button } from "@components/ui/button";
import { Progress } from "@components/ui/progress";
import { cn } from "@lib/utils";

/** Bytes to a short "466 MB" / "1.5 GB" label for progress text. */
function fmt(bytes?: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

/**
 * The one local-model surface (07 §5): the model list that lives inline in the Local config of
 * Speech-to-Text / Language Models. Each row shows one of four states (Available · Downloading ·
 * Installed · Failed) with a single action. Picking an installed row binds it to the slot; choosing
 * an available row downloads it and selects it on success.
 */
export function LocalModelList({ kind, prefix }: { kind: "stt" | "llm"; prefix: string }) {
  const services = useServices();
  const init = useModelsStore((s) => s.init);
  const statuses = useModelsStore((s) => s.statuses);
  const compatibility = useModelsStore((s) => s.compatibility);
  const readiness = useModelsStore((s) => s.readiness);
  const selectedKey = `${prefix}.model`;
  const selected = useSettingsStore((s) => s.values[selectedKey] ?? "");
  const setValue = useSettingsStore((s) => s.setValue);
  const autoSelect = useRef<Set<string>>(new Set());
  const [flash, setFlash] = useState<Record<string, "ok" | "fail">>({});
  const [showUnavailable, setShowUnavailable] = useState(false);

  useEffect(() => {
    init(services);
  }, [init, services]);

  // Bind a model to this slot the moment a user-initiated download finishes (07 §5/§8).
  useEffect(() => {
    for (const id of [...autoSelect.current]) {
      if (statuses[id]?.state === "installed") {
        setValue(selectedKey, id);
        autoSelect.current.delete(id);
      }
    }
  }, [statuses, selectedKey, setValue]);

  const compatibilityById = useMemo(
    () => Object.fromEntries((compatibility?.models ?? []).map((m) => [m.modelId, m])),
    [compatibility],
  );

  const allRows = Object.values(statuses)
    .filter((s) => s.kind === kind)
    .sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name));
  const rows = allRows.filter((s) => showUnavailable || compatibilityById[s.id]?.level !== "unsupported");
  const hidden = allRows.length - rows.length;

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No on-device models for this engine.</p>;
  }

  return (
    <div className="flex flex-col gap-2" role="radiogroup" aria-label="On-device model">
      {rows.map((model) => (
        <ModelRow
          key={model.id}
          model={model}
          selected={selected === model.id}
          compatibility={compatibilityById[model.id]}
          readiness={readiness[model.id]}
          onSelect={() => {
            if (model.state === "installed" && compatibilityById[model.id]?.level !== "unsupported") {
              setValue(selectedKey, model.id);
              void services.models.prepare(model.id);
            }
          }}
          onDownload={() => {
            autoSelect.current.add(model.id);
            void services.models.download(model.id);
          }}
          onCancel={() => void services.models.cancel(model.id)}
          onRemove={() => void services.models.remove(model.id)}
          flash={flash[model.id]}
          onVerify={() => {
            void services.models.verify(model.id).then(({ ok }) => {
              setFlash((f) => ({ ...f, [model.id]: ok ? "ok" : "fail" }));
              window.setTimeout(
                () =>
                  setFlash((f) => {
                    const next = { ...f };
                    delete next[model.id];
                    return next;
                  }),
                2500,
              );
            });
          }}
        />
      ))}
      {hidden > 0 ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setShowUnavailable((v) => !v)}
        >
          <ChevronDown className={cn("size-3 transition-transform", showUnavailable && "rotate-180")} />
          {showUnavailable ? "Hide unavailable and advanced models" : `Show ${hidden} unavailable or advanced models`}
        </button>
      ) : null}
    </div>
  );
}

interface RowProps {
  model: ModelStatus;
  selected: boolean;
  onSelect: () => void;
  onDownload: () => void;
  onCancel: () => void;
  onRemove: () => void;
  onVerify: () => void;
  flash?: "ok" | "fail";
  compatibility?: ModelCompatibility;
  readiness?: ModelReadiness;
}

function ModelRow({ model, selected, onSelect, onDownload, onCancel, onRemove, onVerify, flash, compatibility, readiness }: RowProps) {
  const busy =
    model.state === "downloading" ||
    model.state === "queued" ||
    model.state === "verifying" ||
    model.state === "paused";
  const pct = model.bytesTotal
    ? Math.min(100, Math.round(((model.bytesDone ?? 0) / model.bytesTotal) * 100))
    : 0;
  const unsupported = compatibility?.level === "unsupported" || readiness?.state === "unsupported";
  const readinessText = readinessLabel(readiness, model);
  const compatibilityText = compatibility?.summary ?? (model.engineReady ? "Works on this PC." : "Runtime missing.");

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors",
        selected ? "border-accent bg-accent-soft" : "border-border bg-surface",
      )}
    >
      <button
        type="button"
        role="radio"
        aria-checked={selected}
        disabled={model.state !== "installed" || unsupported}
        onClick={onSelect}
        aria-label={`Select ${model.name}`}
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-pill border",
          selected ? "border-accent bg-accent text-primary-foreground" : "border-border",
          (model.state !== "installed" || unsupported) && "opacity-40",
        )}
      >
        {selected ? <Check className="size-3" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
          <span className="truncate">{model.name}</span>
          <span className="text-xs text-muted-foreground">{model.sizeLabel}</span>
          {model.recommended ? (
            <span className="rounded-pill border border-border px-1.5 py-0.5 text-xs uppercase tracking-wide text-muted-foreground">
              Recommended
            </span>
          ) : null}
          {model.inUse && selected ? <span className="text-xs text-accent">In use</span> : null}
          <span
            className={cn(
              "rounded-pill border px-1.5 py-0.5 text-xs",
              unsupported
                ? "border-danger text-danger"
                : compatibility?.level === "limited"
                  ? "border-warning text-warning"
                  : "border-accent text-accent",
            )}
          >
            {unsupported ? "Not supported" : compatibility?.level === "recommended" ? "Recommended" : compatibility?.level === "limited" ? "Works, slower" : "Works"}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldCheck className="size-3" /> Private
          </span>
          {flash === "ok" ? <span className="text-xs text-success">Verified</span> : null}
          {flash === "fail" ? <span className="text-xs text-danger">Re-downloading…</span> : null}
        </div>

        {busy ? (
          <div className="mt-1 flex items-center gap-2">
            <Progress value={pct} tone="accent" className="h-1.5 w-32" />
            <span className="text-xs text-muted-foreground">
              {model.state === "verifying"
                ? "Verifying…"
                : model.state === "queued"
                  ? "Waiting…"
                  : `${fmt(model.bytesDone)} / ${fmt(model.bytesTotal)}`}
            </span>
          </div>
        ) : unsupported ? (
          <p className="mt-0.5 text-xs text-danger">{compatibilityText}</p>
        ) : model.state === "error" ? (
          <p className="mt-0.5 text-xs text-danger">
            {model.error?.message ?? "Couldn't finish downloading."}
          </p>
        ) : model.state === "installed" && !model.engineReady ? (
          <p className="mt-0.5 text-xs text-muted-foreground">Installed — engine not set up yet.</p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">{readinessText}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {model.state === "installed" ? (
          <>
            <Button variant="ghost" size="sm" onClick={onVerify} aria-label={`Re-verify ${model.name}`}>
              Verify
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={onRemove}
              aria-label={`Remove ${model.name}`}
            >
              Remove
            </Button>
          </>
        ) : busy ? (
          <Button variant="ghost" size="sm" onClick={onCancel} aria-label={`Cancel download of ${model.name}`}>
            Cancel
          </Button>
        ) : unsupported ? (
          <Button variant="ghost" size="sm" disabled aria-label={`${model.name} is not supported`}>
            Unavailable
          </Button>
        ) : model.state === "error" ? (
          <Button variant="secondary" size="sm" onClick={onDownload} aria-label={`Retry ${model.name}`}>
            Retry
          </Button>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={onDownload}
            aria-label={`Download ${model.name}, ${model.sizeLabel}`}
          >
            Download
          </Button>
        )}
      </div>
    </div>
  );
}

function readinessLabel(readiness: ModelReadiness | undefined, model: ModelStatus): string {
  if (!readiness) return model.state === "installed" ? "Installed." : "Download needed.";
  switch (readiness.state) {
    case "ready":
      return "Ready for local use.";
    case "runtime-missing":
      return readiness.reason ?? "Runtime missing.";
    case "not-installed":
      return "Download needed.";
    case "downloading":
      return "Downloading model.";
    case "verifying":
      return "Verifying download.";
    case "failed":
      return readiness.reason ?? "Needs attention.";
    case "unsupported":
      return readiness.reason ?? "Not supported yet.";
    default:
      return "Installed.";
  }
}
