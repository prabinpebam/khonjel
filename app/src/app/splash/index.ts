/**
 * Launch splash controller. The splash markup + styles live statically in index.html so it paints on
 * the very first frame (before this bundle is parsed). This module just fades the splash out once the
 * app shell is interactive, honoring a short minimum on-screen time so it never merely flashes.
 * No-ops gracefully if the splash element is absent (e.g. the floating-bar window).
 */

const shownAt = Date.now();
let dismissed = false;

/** Fade out + remove the splash once the app is interactive (after a short minimum visible time). */
export function dismissSplash(minVisibleMs = 450): void {
  if (dismissed) return;
  const splash = document.getElementById("splash");
  if (!splash) return;
  dismissed = true;
  const wait = Math.max(0, minVisibleMs - (Date.now() - shownAt));
  window.setTimeout(() => {
    splash.classList.add("splash--hidden");
    window.setTimeout(() => splash.remove(), 500);
  }, wait);
}

/** Remove the splash immediately (used by surfaces that should never show it, e.g. the floating bar). */
export function removeSplash(): void {
  dismissed = true;
  document.getElementById("splash")?.remove();
}
