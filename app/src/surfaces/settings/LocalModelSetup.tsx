import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Cpu,
  Download,
  HardDrive,
  Info,
  Loader2,
  MonitorUp,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useServices } from "@services";
import { useModelsStore } from "@stores/models";
import type { ModelReadiness, ModelStatus } from "@services/ports";
import { Button } from "@components/ui/button";
import { cn } from "@lib/utils";

const BUSY_STATES = new Set<ModelStatus["state"]>(["downloading", "queued", "paused", "verifying"]);
const errMsg = (e: unknown): string => (e instanceof Error ? e.message : "Something went wrong.");
const pctOf = (model?: ModelStatus): number =>
  model?.bytesTotal ? Math.min(100, Math.round(((model.bytesDone ?? 0) / model.bytesTotal) * 100)) : 0;

function fmt(bytes?: number): string {
  if (!bytes || bytes <= 0) return "Unknown";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

function shortModelName(model?: ModelStatus): string {
  return model?.name ?? "Not selected";
}

function gpuSummary(gpus: { name: string; vramBytes?: number }[]): string {
  const gpu = gpus.find((g) => /nvidia|geforce|rtx|gtx|amd|radeon|intel|iris/i.test(g.name)) ?? gpus[0];
  if (!gpu) return "No GPU detected";
  return gpu.vramBytes ? `${gpu.name} · ${fmt(gpu.vramBytes)}` : gpu.name;
}

export function LocalModelSetup({ compact = false }: { compact?: boolean }) {
  const services = useServices();
  const init = useModelsStore((s) => s.init);
  const refresh = useModelsStore((s) => s.refresh);
  const statuses = useModelsStore((s) => s.statuses);
  const compatibility = useModelsStore((s) => s.compatibility);
  const readiness = useModelsStore((s) => s.readiness);
  const active = useModelsStore((s) => s.active);

  // "idle" = nothing in flight; "running" = a setup we kicked off is progressing; "error" = it failed.
  const [phase, setPhase] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Models we have already kicked `prepare()` for in this run (so we do it exactly once each).
  const prepared = useRef<Set<string>>(new Set());

  useEffect(() => {
    init(services);
  }, [init, services]);

  const sttId = compatibility?.recommended.stt;
  const llmId = compatibility?.recommended.llm;

  const fail = (e: unknown) => {
    setError(errMsg(e));
    setPhase("error");
  };

  // Drive the multi-step setup from live store state (downloads are fire-and-forget + streamed):
  // when a model finishes downloading, prepare its runtime; surface model errors; finish when ready.
  useEffect(() => {
    if (phase !== "running") return;
    const ids = [sttId, llmId].filter((x): x is string => Boolean(x));
    if (ids.length === 0) return;

    for (const id of ids) {
      const st = statuses[id];
      if (st?.state === "error") {
        setError(st.error?.message ?? readiness[id]?.reason ?? "Download failed.");
        setPhase("error");
        return;
      }
      if (st?.state === "installed" && readiness[id]?.state !== "ready" && !prepared.current.has(id)) {
        prepared.current.add(id);
        void services.models.prepare(id).catch(fail);
      }
    }

    if (ids.every((id) => readiness[id]?.state === "ready")) {
      setPhase("idle");
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, statuses, readiness, sttId, llmId]);

  if (!compatibility) return null;

  const recommendedStt = sttId ? statuses[sttId] : undefined;
  const recommendedLlm = llmId ? statuses[llmId] : undefined;
  const targets = [recommendedStt, recommendedLlm].filter((m): m is ModelStatus => Boolean(m));
  const speechReady = sttId ? readiness[sttId]?.state === "ready" : false;
  const languageReady = llmId ? readiness[llmId]?.state === "ready" : false;
  const allReady = speechReady && languageReady;

  const anyBusy = targets.some((m) => BUSY_STATES.has(m.state));
  const running = phase === "running" || anyBusy;

  const totalBytes = targets.reduce((sum, m) => sum + (m.bytesTotal ?? 0), 0);
  const doneBytes = targets.reduce(
    (sum, m) => sum + (m.state === "installed" ? (m.bytesTotal ?? m.installedBytes ?? 0) : (m.bytesDone ?? 0)),
    0,
  );
  const pct = totalBytes > 0 ? Math.min(100, Math.round((doneBytes / totalBytes) * 100)) : 0;

  const startSetup = (only?: string) => {
    setError(null);
    if (!only) prepared.current.clear();
    const ids = (only ? [only] : [sttId, llmId]).filter((x): x is string => Boolean(x));
    if (ids.length === 0) return;
    setPhase("running");
    const snap = useModelsStore.getState();
    for (const id of ids) {
      if (snap.readiness[id]?.state === "ready") continue;
      const st = snap.statuses[id];
      if (st?.state === "installed") {
        prepared.current.add(id);
        void services.models.prepare(id).catch(fail);
      } else if (!st || !BUSY_STATES.has(st.state)) {
        void services.models.download(id).catch(fail);
      }
    }
  };

  const onPrimary = () => {
    if (running) return;
    if (allReady) {
      void refresh();
      return;
    }
    startSetup();
  };

  return (
    <section
      data-eval="local-model-setup"
      className="rounded-md border border-border bg-surface p-4"
      aria-label="Local model setup"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <ShieldCheck className="size-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Private local model setup</h3>
            </div>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Khonjel can run speech and language models on this computer. Local mode keeps audio and
              text on this device.
            </p>
          </div>
          <span
            data-eval="hardware-summary"
            className={cn(
              "rounded-pill border px-2.5 py-1 text-xs font-medium",
              compatibility.summary.level === "great" || compatibility.summary.level === "good"
                ? "border-accent text-accent"
                : compatibility.summary.level === "limited"
                  ? "border-warning text-warning"
                  : "border-danger text-danger",
            )}
          >
            {compatibility.summary.title}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <SetupFact icon={<Cpu />} label="Computer" value={compatibility.hardware.cpuName ?? compatibility.hardware.arch} />
          <SetupFact icon={<MonitorUp />} label="Graphics" value={gpuSummary(compatibility.hardware.gpus)} />
          <SetupFact icon={<HardDrive />} label="Free space" value={fmt(compatibility.hardware.freeDiskBytes)} />
          <SetupFact
            icon={<Info />}
            label="Memory"
            value={`${fmt(compatibility.hardware.availableRamBytes)} available`}
          />
        </div>

        {!compact ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <RecommendedCard
              title="Speech model"
              model={recommendedStt}
              readiness={sttId ? readiness[sttId] : undefined}
              detail={active?.speech?.message ?? "Turns voice into text."}
              pending={phase === "running" && recommendedStt?.state === "installed" && !speechReady}
              onRetry={() => recommendedStt && startSetup(recommendedStt.id)}
            />
            <RecommendedCard
              title="Language model"
              model={recommendedLlm}
              readiness={llmId ? readiness[llmId] : undefined}
              detail={active?.language?.message ?? "Cleans up text and powers chat."}
              pending={phase === "running" && recommendedLlm?.state === "installed" && !languageReady}
              onRetry={() => recommendedLlm && startSetup(recommendedLlm.id)}
            />
          </div>
        ) : null}

        {running && totalBytes > 0 ? (
          <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-2">
            <div
              className="h-full rounded-pill bg-accent transition-[width] duration-300"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${pct}%` }}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            data-eval="download-recommended-models"
            variant="secondary"
            size="sm"
            disabled={running}
            onClick={onPrimary}
          >
            {running ? (
              <Loader2 className="animate-spin" />
            ) : phase === "error" ? (
              <RotateCcw />
            ) : (
              <Download />
            )}
            {running
              ? `Setting up… ${pct}%`
              : phase === "error"
                ? "Retry setup"
                : allReady
                  ? "Recheck local models"
                  : "Download recommended setup"}
          </Button>
          <span
            role="status"
            aria-live="polite"
            className={cn("text-xs", phase === "error" ? "text-danger" : "text-tertiary-foreground")}
          >
            {phase === "error"
              ? (error ?? "Setup failed. Try again.")
              : running
                ? `Downloading your private models… ${fmt(doneBytes)} / ${fmt(totalBytes)}`
                : allReady
                  ? "Ready for private dictation."
                  : "Downloads continue in the background if you close Settings."}
          </span>
        </div>
      </div>
    </section>
  );
}

function SetupFact({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-2">
      <span className="text-tertiary-foreground [&>svg]:size-4">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-tertiary-foreground">{label}</span>
        <span className="block truncate text-sm font-medium text-foreground">{value}</span>
      </span>
    </div>
  );
}

function RecommendedCard({
  title,
  model,
  readiness,
  detail,
  pending = false,
  onRetry,
}: {
  title: string;
  model?: ModelStatus;
  readiness?: ModelReadiness;
  detail: string;
  pending?: boolean;
  onRetry: () => void;
}) {
  const state = model?.state;
  const rstate = readiness?.state;
  const downloading = state === "downloading" || state === "queued" || state === "paused";
  const verifying = state === "verifying";
  const failed = state === "error" || rstate === "failed";
  const ready = rstate === "ready";
  // Only show the "Setting up" spinner while we are actively preparing the runtime, not when an
  // installed model is simply idle-and-not-yet-prepared (that reads as "Needs setup").
  const settingUp = pending && state === "installed" && !ready && !failed;
  const busy = downloading || verifying || settingUp;
  const pct = pctOf(model);

  const statusLabel = ready
    ? "Ready"
    : failed
      ? "Failed"
      : downloading
        ? `Downloading ${pct}%`
        : verifying
          ? "Verifying"
          : settingUp
            ? "Setting up"
            : "Needs setup";

  return (
    <div className={cn("rounded-md border bg-surface-2 p-3", failed ? "border-danger/50" : "border-border")}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">{title}</span>
        <span
          className={cn(
            "inline-flex items-center gap-1 text-xs",
            ready ? "text-accent" : failed ? "text-danger" : busy ? "text-accent" : "text-warning",
          )}
        >
          {ready ? (
            <CheckCircle2 className="size-3" />
          ) : failed ? (
            <TriangleAlert className="size-3" />
          ) : busy ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <TriangleAlert className="size-3" />
          )}
          {statusLabel}
        </span>
      </div>
      <p className="truncate text-sm font-semibold text-foreground">{shortModelName(model)}</p>

      {downloading ? (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface">
            <div
              className="h-full rounded-pill bg-accent transition-[width] duration-300"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {fmt(model?.bytesDone)} / {fmt(model?.bytesTotal)}
          </p>
        </div>
      ) : failed ? (
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-xs text-danger">
            {model?.error?.message ?? readiness?.reason ?? "Download failed."}
          </p>
          <Button variant="ghost" size="sm" className="h-7 shrink-0 gap-1 px-2 text-xs" onClick={onRetry}>
            <RotateCcw className="size-3" />
            Retry
          </Button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}
