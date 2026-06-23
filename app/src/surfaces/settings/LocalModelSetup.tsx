import { useEffect, type ReactNode } from "react";
import { CheckCircle2, Cpu, Download, HardDrive, Info, MonitorUp, ShieldCheck, TriangleAlert } from "lucide-react";
import { useServices } from "@services";
import { useModelsStore } from "@stores/models";
import type { ModelStatus } from "@services/ports";
import { Button } from "@components/ui/button";
import { cn } from "@lib/utils";

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

  useEffect(() => {
    init(services);
  }, [init, services]);

  if (!compatibility) return null;

  const recommendedStt = compatibility.recommended.stt ? statuses[compatibility.recommended.stt] : undefined;
  const recommendedLlm = compatibility.recommended.llm ? statuses[compatibility.recommended.llm] : undefined;
  const speechReady = Object.values(readiness).some((r) => r.kind === "stt" && r.state === "ready");
  const languageReady = Object.values(readiness).some((r) => r.kind === "llm" && r.state === "ready");
  const allReady = speechReady && languageReady;
  const downloadRecommended = async () => {
    for (const model of [recommendedStt, recommendedLlm]) {
      if (model && model.state !== "installed") await services.models.download(model.id);
      if (model) await services.models.prepare(model.id);
    }
    await refresh();
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
              ready={speechReady}
              detail={active?.speech?.message ?? "Turns voice into text."}
            />
            <RecommendedCard
              title="Language model"
              model={recommendedLlm}
              ready={languageReady}
              detail={active?.language?.message ?? "Cleans up text and powers chat."}
            />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <Button data-eval="download-recommended-models" variant="secondary" size="sm" onClick={() => void downloadRecommended()}>
            <Download />
            {allReady ? "Recheck local models" : "Download recommended setup"}
          </Button>
          <span className="text-xs text-tertiary-foreground">
            {allReady
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
  ready,
  detail,
}: {
  title: string;
  model?: ModelStatus;
  ready: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-tertiary-foreground">{title}</span>
        <span className={cn("inline-flex items-center gap-1 text-xs", ready ? "text-accent" : "text-warning")}> 
          {ready ? <CheckCircle2 className="size-3" /> : <TriangleAlert className="size-3" />}
          {ready ? "Ready" : "Needs setup"}
        </span>
      </div>
      <p className="truncate text-sm font-semibold text-foreground">{shortModelName(model)}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}
