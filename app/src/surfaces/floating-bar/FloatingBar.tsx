import { useEffect, useRef, type MutableRefObject } from "react";
import { Loader2, Mic, Square } from "lucide-react";
import { useServices } from "@services";
import { useDictation } from "@hooks/useDictation";
import { cn } from "@lib/utils";

const BAR_COUNT = 28;

/**
 * Live input-level meter. The recorder pushes RMS levels into `levelRef`; a rAF loop scrolls a
 * rolling history so the bars animate smoothly even though levels arrive only every audio block.
 */
function Waveform({ levelRef, active }: { levelRef: MutableRefObject<number>; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<number[]>(new Array<number>(BAR_COUNT).fill(0));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;

    const draw = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const history = historyRef.current;
      history.push(active ? Math.min(1, levelRef.current * 6) : 0);
      history.shift();

      ctx.fillStyle = getComputedStyle(canvas).color;
      const gap = 2;
      const barW = (w - gap * (BAR_COUNT - 1)) / BAR_COUNT;
      for (let i = 0; i < BAR_COUNT; i++) {
        const level = history[i] ?? 0;
        const barH = Math.max(2, level * h);
        ctx.fillRect(i * (barW + gap), (h - barH) / 2, barW, barH);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, levelRef]);

  return <canvas ref={canvasRef} className="h-7 w-40 text-accent" />;
}

/**
 * The floating dictation bar (Khonjel Bar) — the app's core capture surface. Runs in its own
 * always-on-top, non-focusable window so it never steals focus from the app you are typing into.
 * Records the mic, transcribes + cleans up on device, and injects the final text at the cursor.
 */
export function FloatingBar() {
  const { system } = useServices();
  const levelRef = useRef(0);
  const dictation = useDictation(
    (text) => {
      // Inject into whatever app had focus (no-op under the browser mock).
      void system.injectText(text);
    },
    { onLevel: (n) => (levelRef.current = n) },
  );

  // Keep the latest dictation API in a ref so the hotkey subscription is set up once.
  const apiRef = useRef(dictation);
  apiRef.current = dictation;

  // Main relays the dictation hotkey as a session toggle: "dictation:start" begins a capture and
  // "dictation:stop" ends it. Ending while recording transcribes + injects; ending in any other
  // state (a failed or still-starting capture) just dismisses — so the bar is always escapable.
  useEffect(() => {
    const bridge = typeof window !== "undefined" ? window.khonjel : undefined;
    if (!bridge?.onHotkey) return;
    return bridge.onHotkey((action) => {
      const api = apiRef.current;
      if (action === "dictation:start") {
        api.start();
      } else if (action === "dictation:stop" || action === "dictation") {
        if (api.status === "recording") {
          api.stop();
        } else {
          api.cancel();
          window.electronAPI?.floatingIdle?.();
        }
      }
    });
  }, []);

  // When a capture ends — success (idle) OR failure (error) — let main auto-hide the bar. Hiding on
  // error too is what keeps a missing model or mic failure from leaving the bar stuck on screen.
  const wasActiveRef = useRef(false);
  useEffect(() => {
    if (dictation.status === "recording" || dictation.status === "transcribing") {
      wasActiveRef.current = true;
    } else if (
      (dictation.status === "idle" || dictation.status === "error") &&
      wasActiveRef.current
    ) {
      wasActiveRef.current = false;
      window.electronAPI?.floatingIdle?.();
    }
  }, [dictation.status]);

  const recording = dictation.status === "recording";
  const transcribing = dictation.status === "transcribing";
  const errored = dictation.status === "error";
  const label = errored
    ? (dictation.error ?? "Something went wrong")
    : transcribing
      ? "Transcribing"
      : recording
        ? "Listening"
        : "Click to dictate";

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-transparent">
      <div className="app-drag flex items-center gap-3 rounded-pill border border-border bg-surface/95 px-4 py-2 shadow-modal backdrop-blur">
        <button
          type="button"
          aria-label={recording ? "Stop dictation" : "Start dictation"}
          disabled={transcribing}
          onClick={dictation.toggle}
          className={cn(
            "app-no-drag grid size-9 shrink-0 place-items-center rounded-pill text-primary-foreground transition-colors",
            recording ? "bg-danger" : "bg-accent",
            transcribing && "opacity-60",
          )}
        >
          {transcribing ? (
            <Loader2 className="size-4 animate-spin" />
          ) : recording ? (
            <Square className="size-4" />
          ) : (
            <Mic className="size-4" />
          )}
        </button>
        <Waveform levelRef={levelRef} active={recording} />
        <span
          className={cn(
            "min-w-20 max-w-44 truncate text-sm font-medium",
            errored ? "text-danger" : "text-foreground",
          )}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
