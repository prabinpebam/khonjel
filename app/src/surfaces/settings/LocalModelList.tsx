import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import { useServices } from "@services";
import type { ModelStatus } from "@services/ports";
import { useSettingsStore } from "@stores/settings";
import { useModelsStore } from "@stores/models";
import { Button } from "@components/ui/button";
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
  const selectedKey = `${prefix}.model`;
  const selected = useSettingsStore((s) => s.values[selectedKey] ?? "");
  const setValue = useSettingsStore((s) => s.setValue);
  const autoSelect = useRef<Set<string>>(new Set());

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

  const rows = Object.values(statuses)
    .filter((s) => s.kind === kind)
    .sort((a, b) => Number(b.recommended) - Number(a.recommended) || a.name.localeCompare(b.name));

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
          onSelect={() => model.state === "installed" && setValue(selectedKey, model.id)}
          onDownload={() => {
            autoSelect.current.add(model.id);
            void services.models.download(model.id);
          }}
          onCancel={() => void services.models.cancel(model.id)}
          onRemove={() => void services.models.remove(model.id)}
          onVerify={() => void services.models.verify(model.id)}
        />
      ))}
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
}

function ModelRow({ model, selected, onSelect, onDownload, onCancel, onRemove, onVerify }: RowProps) {
  const busy =
    model.state === "downloading" ||
    model.state === "queued" ||
    model.state === "verifying" ||
    model.state === "paused";
  const pct = model.bytesTotal
    ? Math.min(100, Math.round(((model.bytesDone ?? 0) / model.bytesTotal) * 100))
    : 0;

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
        disabled={model.state !== "installed"}
        onClick={onSelect}
        aria-label={`Select ${model.name}`}
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-pill border",
          selected ? "border-accent bg-accent text-primary-foreground" : "border-border",
          model.state !== "installed" && "opacity-40",
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
        </div>

        {busy ? (
          <div className="mt-1 flex items-center gap-2">
            <div className="h-1.5 w-32 overflow-hidden rounded-pill bg-surface-2">
              <div
                className="h-full rounded-pill bg-accent"
                role="progressbar"
                aria-valuenow={pct}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {model.state === "verifying"
                ? "Verifying…"
                : model.state === "queued"
                  ? "Waiting…"
                  : `${fmt(model.bytesDone)} / ${fmt(model.bytesTotal)}`}
            </span>
          </div>
        ) : model.state === "error" ? (
          <p className="mt-0.5 text-xs text-danger">
            {model.error?.message ?? "Couldn't finish downloading."}
          </p>
        ) : model.state === "installed" && !model.engineReady ? (
          <p className="mt-0.5 text-xs text-muted-foreground">Installed — engine not set up yet.</p>
        ) : null}
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
