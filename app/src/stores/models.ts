import { create } from "zustand";
import type { ModelStatus, Services } from "@services/ports";

/**
 * Live local-model state for the picker (07 §5). Seeded from `models.status()` and kept current by
 * the `models.onProgress` stream (the ipc adapter bridges main-process ticks; the mock drives them).
 * One shared store so the STT list, the LLM list, and the storage line all react to the same events.
 */
interface ModelsState {
  statuses: Record<string, ModelStatus>;
  services: Services | null;
  /** Idempotent: fetch the initial statuses and subscribe to progress once. */
  init: (services: Services) => void;
  refresh: () => Promise<void>;
}

let unsubscribe: (() => void) | null = null;

export const useModelsStore = create<ModelsState>((set, get) => ({
  statuses: {},
  services: null,
  init: (services) => {
    if (get().services) return;
    set({ services });
    void get().refresh();
    unsubscribe?.();
    unsubscribe = services.models.onProgress((progress) => {
      set((state) => {
        const prev = state.statuses[progress.id];
        if (!prev) return state;
        return {
          statuses: {
            ...state.statuses,
            [progress.id]: {
              ...prev,
              state: progress.state,
              bytesDone: progress.bytesDone,
              bytesTotal: progress.bytesTotal ?? prev.bytesTotal,
              error: progress.error,
            },
          },
        };
      });
      // Terminal transitions change installedBytes / inUse — re-pull the full snapshot.
      if (progress.state === "installed" || progress.state === "not-installed" || progress.state === "error") {
        void get().refresh();
      }
    });
  },
  refresh: async () => {
    const services = get().services;
    if (!services) return;
    const list = await services.models.status();
    set({ statuses: Object.fromEntries(list.map((s) => [s.id, s])) });
  },
}));
