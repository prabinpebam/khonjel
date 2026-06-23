import { useEffect, useRef, type MutableRefObject } from "react";
import { cn } from "@lib/utils";

/**
 * MicWaveform — the shared live input-level animation used by every dictation surface (the floating
 * bar, Chat, Notes). The recorder pushes a normalized 0..1 level (post auto-gain, so it never clips)
 * into `levelRef`; a rAF loop scrolls a rolling history so the bars animate smoothly even though
 * levels arrive only once per audio block. Centralized so every surface looks identical.
 */
export function MicWaveform({
  levelRef,
  active,
  barCount = 28,
  className = "h-7 w-40",
}: {
  levelRef: MutableRefObject<number>;
  active: boolean;
  barCount?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const history = new Array<number>(barCount).fill(0);
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

      // The level is already normalized to [0, 1] by the recorder's auto-gain, so it is used
      // directly: a full-scale signal fills the bar height exactly, never beyond (no visual clip).
      history.push(active ? Math.min(1, Math.max(0, levelRef.current)) : 0);
      history.shift();

      ctx.fillStyle = getComputedStyle(canvas).color;
      const gap = 2;
      const barW = (w - gap * (barCount - 1)) / barCount;
      for (let i = 0; i < barCount; i++) {
        const level = history[i] ?? 0;
        const barH = Math.max(2, level * h);
        ctx.fillRect(i * (barW + gap), (h - barH) / 2, barW, barH);
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [active, levelRef, barCount]);

  return <canvas ref={canvasRef} className={cn("text-accent", className)} />;
}
