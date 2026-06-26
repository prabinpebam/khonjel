import { useEffect, useReducer, useRef, useState, type ReactNode } from "react";
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
import { useSettingsStore } from "@stores/settings";
import type { ModelReadiness, ModelStatus } from "@services/ports";
import { Button } from "@components/ui/button";
import { Progress } from "@components/ui/progress";
import { cn } from "@lib/utils";
import { isTargetSettled } from "./local-setup-logic";

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
  const runtimeEvents = useModelsStore((s) => s.runtimeEvents);
  // The models the user is actually using (selected/in-use), so the card reflects the live engine
  // choice rather than always the recommended one.
  const selectedStt = useSettingsStore((s) => s.values["stt.dictation.model"]);
  const selectedLlm = useSettingsStore((s) => s.values["llm.chat.model"]);

  // "idle" = nothing in flight; "running" = a setup we kicked off is progressing; "error" = it failed.
  const [phase, setPhase] = useState<"idle" | "running" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Two-phase prepare tracking: `kicked` = prepare started (once each), `done` = it resolved. A
  // target only counts as "settled" once prepare is DONE, so the card keeps showing "Setting up"
  // while the engine runtime downloads (prepare can take a while) instead of settling early.
  const prepareKicked = useRef<Set<string>>(new Set());
  const prepareDone = useRef<Set<string>>(new Set());
  const [tick, bumpTick] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    init(services);
  }, [init, services]);

  // Prefer the user's SELECTED local model; fall back to the recommended one for first-run setup
  // (nothing local selected yet). This keeps the card showing the engine that's in use - e.g.
  // Parakeet - instead of always Whisper, and stops a non-selected engine from looking unset.
  const sttId = (selectedStt && statuses[selectedStt] ? selectedStt : undefined) ?? compatibility?.recommended.stt;
  const llmId = (selectedLlm && statuses[selectedLlm] ? selectedLlm : undefined) ?? compatibility?.recommended.llm;

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
      if (st?.state === "installed" && readiness[id]?.state !== "ready" && !prepareKicked.current.has(id)) {
        prepareKicked.current.add(id);
        void services.models
          .prepare(id)
          .catch(() => {})
          .finally(() => {
            prepareDone.current.add(id);
            bumpTick();
          });
      }
    }

    // Stop when every target is settled: fully ready, OR prepare has finished and the engine still
    // can't be readied. Using "prepare done" (not just "kicked") keeps the card on "Setting up" while
    // the engine runtime actually downloads, instead of settling at "Setting up… 100%".
    if (
      ids.every((id) => isTargetSettled(statuses[id], readiness[id]?.state, prepareDone.current.has(id)))
    ) {
      setPhase("idle");
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, statuses, readiness, sttId, llmId, tick]);

  if (!compatibility) return null;

  const sttModel = sttId ? statuses[sttId] : undefined;
  const llmModel = llmId ? statuses[llmId] : undefined;
  const targets = [sttModel, llmModel].filter((m): m is ModelStatus => Boolean(m));
  // "Ready" = the engine can actually run this model: the model is installed AND its runtime binary
  // is present (engineReady), OR the readiness report already says ready. Using engineReady - not
  // the selected/active-gated readiness state - means switching the selected engine doesn't make an
  // already-installed, runnable engine look like it "needs setup".
  const usable = (m?: ModelStatus, r?: ModelReadiness): boolean =>
    r?.state === "ready" || (m?.state === "installed" && m.engineReady === true);
  const speechReady = usable(sttModel, sttId ? readiness[sttId] : undefined);
  const languageReady = usable(llmModel, llmId ? readiness[llmId] : undefined);
  const allReady = speechReady && languageReady;

  const anyBusy = targets.some((m) => BUSY_STATES.has(m.state));
  const running = phase === "running" || anyBusy;

  // Downloaded, but the on-device engine runtime isn't ready yet (e.g. not installed on this PC).
  const targetIds = [sttId, llmId].filter((x): x is string => Boolean(x));
  const enginesMissing =
    !running &&
    phase !== "error" &&
    targetIds.length > 0 &&
    targetIds.every((id) => statuses[id]?.state === "installed") &&
    !allReady;

  const totalBytes = targets.reduce((sum, m) => sum + (m.bytesTotal ?? 0), 0);
  const doneBytes = targets.reduce(
    (sum, m) => sum + (m.state === "installed" ? (m.bytesTotal ?? m.installedBytes ?? 0) : (m.bytesDone ?? 0)),
    0,
  );
  const pct = totalBytes > 0 ? Math.min(100, Math.round((doneBytes / totalBytes) * 100)) : 0;

  // Engine (runtime) phase: models are downloaded; the engine binary is being fetched by prepare().
  const modelsDownloading = targets.some((m) => BUSY_STATES.has(m.state));
  const engineEvent = targetIds.map((id) => runtimeEvents[id]).find((e) => e?.state === "starting");
  const engineFailed = targetIds.map((id) => runtimeEvents[id]).find((e) => e?.state === "failed");
  // Surface a failed setup (download error OR engine-install failure) as a retryable error.
  const failedMessage =
    phase === "error"
      ? (error ?? "Setup failed. Try again.")
      : !running && !allReady && engineFailed
        ? engineFailed.message
        : null;

  const startSetup = (only?: string) => {
    setError(null);
    if (only) {
      prepareKicked.current.delete(only);
      prepareDone.current.delete(only);
    } else {
      prepareKicked.current.clear();
      prepareDone.current.clear();
    }
    const ids = (only ? [only] : [sttId, llmId]).filter((x): x is string => Boolean(x));
    if (ids.length === 0) return;
    setPhase("running");
    const snap = useModelsStore.getState();
    for (const id of ids) {
      if (snap.readiness[id]?.state === "ready") continue;
      const st = snap.statuses[id];
      if (st?.state === "installed") {
        prepareKicked.current.add(id);
        void services.models
          .prepare(id)
          .catch(() => {})
          .finally(() => {
            prepareDone.current.add(id);
            bumpTick();
          });
      } else if (!st || !BUSY_STATES.has(st.state)) {
        void services.models.download(id).catch(fail);
      }
    }
  };

  const onPrimary = () => {
    if (running) return;
    if (allReady) {
      // Already set up: just re-scan (e.g. picks up a runtime installed outside the app).
      void refresh();
      return;
    }
    // Not fully ready (a model and/or its engine still needs setting up): do the whole setup.
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
              model={sttModel}
              readiness={sttId ? readiness[sttId] : undefined}
              detail={active?.speech?.message ?? "Turns voice into text."}
              pending={phase === "running" && sttModel?.state === "installed" && !speechReady}
              onRetry={() => sttModel && startSetup(sttModel.id)}
            />
            <RecommendedCard
              title="Language model"
              model={llmModel}
              readiness={llmId ? readiness[llmId] : undefined}
              detail={active?.language?.message ?? "Cleans up text and powers chat."}
              pending={phase === "running" && llmModel?.state === "installed" && !languageReady}
              onRetry={() => llmModel && startSetup(llmModel.id)}
            />
          </div>
        ) : null}

        {running && totalBytes > 0 ? (
          <Progress value={pct} tone="accent" className="h-1.5" barClassName="duration-300" />
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
            ) : failedMessage || allReady ? (
              <RotateCcw />
            ) : (
              <Download />
            )}
            {running
              ? modelsDownloading
                ? `Setting up… ${pct}%`
                : "Setting up the engine…"
              : failedMessage
                ? "Retry setup"
                : allReady
                  ? "Recheck local models"
                  : enginesMissing
                    ? "Finish setup"
                    : "Download recommended setup"}
          </Button>
          <span
            role="status"
            aria-live="polite"
            className={cn(
              "text-xs",
              failedMessage ? "text-danger" : enginesMissing ? "text-warning" : "text-tertiary-foreground",
            )}
          >
            {failedMessage
              ? failedMessage
              : running
                ? modelsDownloading
                  ? `Downloading your private models… ${fmt(doneBytes)} / ${fmt(totalBytes)}`
                  : (engineEvent?.message ?? "Setting up the on-device engine…")
                : allReady
                  ? "Ready for private dictation."
                  : enginesMissing
                    ? "Almost done — click Finish setup to get the on-device engine."
                    : "Khonjel will download everything needed to dictate privately on this device."}
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
  const ready = rstate === "ready" || (state === "installed" && model?.engineReady === true);
  // Only show the "Setting up" spinner while we are actively preparing the runtime, not when an
  // installed model is simply idle-and-not-yet-prepared (that reads as "Needs setup").
  const settingUp = pending && state === "installed" && !ready && !failed;
  const runtimeMissing = state === "installed" && model?.engineReady !== true && !ready && !settingUp;
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
            : runtimeMissing
              ? "Engine needed"
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
          <Progress value={pct} tone="accent" className="h-1.5 bg-surface" barClassName="duration-300" />
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
