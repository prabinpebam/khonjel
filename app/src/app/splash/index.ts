/**
 * Launch splash controller. The splash markup + styles live statically in index.html so it paints on
 * the very first frame (before this bundle is parsed). This module rotates the quirky status line and
 * fades the splash out once the app shell is interactive, honoring a minimum on-screen time so it
 * never just flashes. No-ops gracefully if the splash element is absent (e.g. the floating-bar window).
 */
import { randomSplashMessage } from "./messages";

let rotateTimer: number | undefined;
let startedAt = 0;
let dismissed = false;

/** Begin rotating the status line. Replaces the static first message with fresh mixed ones. */
export function startSplash(): void {
  const status = document.getElementById("splash-status");
  if (!status) return;
  startedAt = Date.now();
  const tick = () => {
    status.style.opacity = "0";
    window.setTimeout(() => {
      status.textContent = randomSplashMessage();
      status.style.opacity = "1";
    }, 180);
  };
  tick();
  rotateTimer = window.setInterval(tick, 1700);
}

/** Fade out + remove the splash once the app is interactive (after a minimum visible time). */
export function dismissSplash(minVisibleMs = 650): void {
  if (dismissed) return;
  const splash = document.getElementById("splash");
  if (!splash) return;
  dismissed = true;
  const wait = Math.max(0, minVisibleMs - (Date.now() - startedAt));
  window.setTimeout(() => {
    if (rotateTimer) window.clearInterval(rotateTimer);
    splash.classList.add("splash--hidden");
    window.setTimeout(() => splash.remove(), 500);
  }, wait);
}

/** Remove the splash immediately (used by surfaces that should never show it, e.g. the floating bar). */
export function removeSplash(): void {
  dismissed = true;
  document.getElementById("splash")?.remove();
}
