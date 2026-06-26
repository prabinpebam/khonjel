import { useCallback } from "react";

interface UseAutoFocusOptions {
  /** Also select existing text (for inline rename/edit fields). */
  select?: boolean;
}

/**
 * Returns a stable callback ref that focuses its node the moment it mounts -- the behaviour the
 * inline rename / edit fields want when they appear on demand. Being stable (memoised), it fires
 * only on mount/unmount, never on every render, so it is safe on controlled inputs too.
 */
export function useAutoFocus<T extends HTMLElement = HTMLElement>({ select = false }: UseAutoFocusOptions = {}) {
  return useCallback(
    (el: T | null) => {
      if (!el) return;
      el.focus();
      if (select && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
        el.select();
      }
    },
    [select],
  );
}
