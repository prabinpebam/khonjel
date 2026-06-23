import { useEffect } from "react";
import { Cpu, Zap, Gauge, RotateCw, Power, Loader2, CheckCircle2, TriangleAlert } from "lucide-react";
import { useServices } from "@services";
import { useAccelerationStore } from "@stores/acceleration";
import type { AccelerationMode } from "@services/ports";
import { Button } from "@components/ui/button";
import { cn } from "@lib/utils";

function fmtBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(gb >= 10 ? 0 : 1)} GB`;
  return `${Math.round(bytes / (1024 * 1024))} MB`;
}

type ViewState = "detecting" | "no-gpu" | "gpu-off" | "setting-up" | "on" | "rolled-back";

/**
 * The GPU acceleration card (gpu-acceleration 05). One compact card, a one-line honest status, and
 * at most one primary action. Drives the full detect -> turn on -> test flow against the real
 * acceleration service; falls back to the CPU calmly and never claims GPU without proof.
 */
export function AccelerationCard() {
  const services = useServices();
  const init = useAccelerationStore((s) => s.init);
  const state = useAccelerationStore((s) => s.state);
  const plan = useAccelerationStore((s) => s.plan);
  const progress = useAccelerationStore((s) => s.progress);
  const lastTest = useAccelerationStore((s) => s.lastTest);
  const busy = useAccelerationStore((s) => s.busy);
  const enable = useAccelerationStore((s) => s.enable);
  const disable = useAccelerationStore((s) => s.disable);
  const rescan = useAccelerationStore((s) => s.rescan);
  const runTest = useAccelerationStore((s) => s.runTest);

  useEffect(() => {
    init(services);
  }, [init, services]);

  const hasGpu = plan != null && plan.recommendedLevel !== "cpu-only" && plan.recommendedLevel !== "unknown";
  const recentFail = progress?.state === "failed" || progress?.state === "quarantined";
  const gpuName = state?.summary?.includes("graphics") ? "your graphics card" : plan?.summary ?? "your graphics card";

  const view: ViewState = !state
    ? "detecting"
    : busy
      ? "setting-up"
      : recentFail && !state.gpuActive
        ? "rolled-back"
        : state.gpuActive
          ? "on"
          : hasGpu
            ? "gpu-off"
            : "no-gpu";

  const speedup = lastTest?.speedup ? `${Math.round(lastTest.speedup)}x` : plan?.estimatedSpeedup;

  return (
    <section
      data-eval="acceleration-card"
      data-eval-accel-state={view}
      className="rounded-md border border-border bg-surface p-4"
      aria-label="GPU acceleration"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          {view === "on" ? <Zap className="size-4 text-accent" /> : <Cpu className="size-4 text-muted-foreground" />}
          <h3 className="text-sm font-semibold text-foreground">GPU acceleration</h3>
        </div>

        <p data-eval="acceleration-summary" className="text-sm text-muted-foreground" aria-live="polite">
          {view === "detecting" && "Checking your graphics card..."}
          {view === "no-gpu" && "Running on the CPU. No compatible graphics card was found. The app still works great."}
          {view === "gpu-off" && (
            <>
              Your graphics card could be {speedup ? <strong>{speedup} faster</strong> : "much faster"}.
              {plan?.requiresDownload && plan.downloadBytes ? ` About a ${fmtBytes(plan.downloadBytes)} download.` : ""}
            </>
          )}
          {view === "setting-up" && (progress?.message ?? "Setting up GPU acceleration...")}
          {view === "on" && (
            <>
              Running on {gpuName}
              {speedup ? <> &mdash; about <strong>{speedup} faster</strong></> : null}.
            </>
          )}
          {view === "rolled-back" && (progress?.message ?? "Kept things on the CPU so nothing broke.")}
        </p>

        {view === "setting-up" && (
          <ol data-eval="accel-progress" className="flex flex-col gap-1 text-xs text-muted-foreground" aria-live="polite">
            <ProgressStep done state={progress?.state} at={["downloading", "probing", "active"]} label="Found your graphics card" />
            <ProgressStep
              active={progress?.state === "downloading"}
              done={progress?.state === "probing" || progress?.state === "active"}
              label={
                progress?.state === "downloading" && progress.bytesTotal
                  ? `Downloading GPU support (${fmtBytes(progress.bytesDone)} of ${fmtBytes(progress.bytesTotal)})`
                  : "Downloading GPU support"
              }
            />
            <ProgressStep active={progress?.state === "probing"} done={progress?.state === "active"} label="Testing it on your machine" />
          </ol>
        )}

        {view === "on" && lastTest && <SpeedCheck cpu={lastTest.cpu?.tokensPerSec} gpu={lastTest.gpu?.tokensPerSec} speedup={speedup} />}

        <div className="flex flex-wrap items-center gap-2">
          {view === "gpu-off" && (
            <Button data-eval="accel-cta" size="sm" onClick={() => void enable("llama")}>
              Turn on GPU acceleration
            </Button>
          )}
          {view === "setting-up" && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Keep working &mdash; this runs in the background.
            </span>
          )}
          {view === "on" && (
            <>
              <Button data-eval="accel-test" size="sm" variant="outline" onClick={() => void runTest()}>
                <Gauge className="size-3.5" /> Test again
              </Button>
              <Button data-eval="accel-turn-off" size="sm" variant="ghost" onClick={() => void disable("llama")}>
                <Power className="size-3.5" /> Turn off
              </Button>
            </>
          )}
          {(view === "no-gpu" || view === "rolled-back") && (
            <Button data-eval="accel-rescan" size="sm" variant="outline" onClick={() => void rescan()}>
              <RotateCw className="size-3.5" /> {view === "rolled-back" ? "Try again" : "Re-scan hardware"}
            </Button>
          )}
        </div>

        <AdvancedSection />
      </div>
    </section>
  );
}

function ProgressStep({ label, done, active, state, at }: { label: string; done?: boolean; active?: boolean; state?: string; at?: string[] }) {
  const isDone = done || (state != null && at != null && at.includes(state));
  return (
    <li className="flex items-center gap-1.5">
      {isDone ? (
        <CheckCircle2 className="size-3.5 text-accent" />
      ) : active ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <span className="size-3.5 rounded-full border border-border" aria-hidden />
      )}
      <span className={cn(isDone && "text-foreground")}>{label}</span>
    </li>
  );
}

function SpeedCheck({ cpu, gpu, speedup }: { cpu?: number; gpu?: number; speedup?: string }) {
  const max = Math.max(cpu ?? 0, gpu ?? 0, 1);
  const bar = (value?: number) => `${Math.round(((value ?? 0) / max) * 100)}%`;
  return (
    <div data-eval="accel-test-report" className="rounded border border-border bg-background p-3 text-xs">
      <p className="mb-2 font-medium text-foreground">Writing speed (words per second)</p>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="w-8 text-muted-foreground">CPU</span>
          <span className="h-2 rounded bg-muted-foreground/40" style={{ width: bar(cpu) }} aria-hidden />
          <span className="text-foreground">{Math.round(cpu ?? 0)}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-8 text-muted-foreground">GPU</span>
          <span className="h-2 rounded bg-accent" style={{ width: bar(gpu) }} aria-hidden />
          <span className="text-foreground">{Math.round(gpu ?? 0)}</span>
          {speedup ? <span className="ml-1 text-accent">{speedup} faster</span> : null}
        </div>
      </div>
    </div>
  );
}

const MODE_OPTIONS: { value: AccelerationMode; label: string }[] = [
  { value: "auto", label: "Automatic" },
  { value: "on", label: "Always on" },
  { value: "off", label: "Off" },
];

function AdvancedSection() {
  const state = useAccelerationStore((s) => s.state);
  const setMode = useAccelerationStore((s) => s.setMode);
  const removeGpu = useAccelerationStore((s) => s.removeGpu);
  const reset = useAccelerationStore((s) => s.reset);
  const mode = state?.mode ?? "auto";

  return (
    <details data-eval="accel-advanced" className="text-xs">
      <summary className="cursor-pointer text-muted-foreground">Advanced</summary>
      <div className="mt-2 flex flex-col gap-3 rounded border border-border bg-background p-3">
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1 text-muted-foreground">Mode</legend>
          <div className="flex flex-wrap gap-3">
            {MODE_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-1.5 text-foreground">
                <input
                  type="radio"
                  name="accel-mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => void setMode(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => void removeGpu("llama")}>
            Remove GPU support
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void reset()}>
            <TriangleAlert className="size-3.5" /> Reset acceleration
          </Button>
        </div>
        <p className="text-muted-foreground">Remove deletes GPU files and returns to the CPU. Reset clears all acceleration state and re-detects.</p>
      </div>
    </details>
  );
}
