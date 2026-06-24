import { useEffect } from "react";
import { useServices } from "@services";
import { useSettingsStore, migrateModelIds } from "@stores/settings";

/**
 * SettingsSync — electron-only adoption of the main-owned SettingsService.
 *
 * Mounted in App.tsx ONLY when the Electron bridge (`window.khonjel`) is present, so the browser
 * and dev web build are completely unaffected (the Zustand store keeps using localStorage there).
 * Under Electron it makes the main process the durable source of truth:
 *  - on mount it hydrates the store from main (main wins) or, on first run, seeds main from the
 *    store's current defaults;
 *  - thereafter it write-throughs every store change to main.
 */
export function SettingsSync() {
  const services = useServices();

  useEffect(() => {
    let cancelled = false;

    void services.settings.get().then((snapshot) => {
      if (cancelled) return;
      const store = useSettingsStore.getState();
      const hasPersisted =
        Object.keys(snapshot.toggles).length > 0 || Object.keys(snapshot.values).length > 0;

      if (hasPersisted) {
        // Main is the source of truth, but heal any retired model ids it still holds (older
        // settings.json) so the pickers + model badges resolve a real catalog entry. The
        // write-through subscription below then persists the corrected values back to main.
        useSettingsStore.setState({
          toggles: { ...store.toggles, ...snapshot.toggles },
          values: migrateModelIds({ ...store.values, ...snapshot.values }),
        });
      } else {
        void services.settings.patch({ toggles: store.toggles, values: store.values });
      }
    });

    // Write-through every store change to main, but DEBOUNCED: each settings.patch is a synchronous
    // full read + (encrypt) + write of settings.json in main, so persisting on every keystroke/toggle
    // floods IPC and the disk. Batch rapid changes into one write; flush the last change on unmount.
    let timer: ReturnType<typeof setTimeout> | null = null;
    let pending: { toggles: Record<string, boolean>; values: Record<string, string> } | null = null;
    const flush = () => {
      if (pending) {
        void services.settings.patch(pending);
        pending = null;
      }
    };
    const unsubscribe = useSettingsStore.subscribe((state) => {
      pending = { toggles: state.toggles, values: state.values };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, 300);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (timer) clearTimeout(timer);
      flush();
    };
  }, [services]);

  return null;
}
