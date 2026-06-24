import { create } from "zustand";
import type {
  ActiveModelReport,
  ModelCompatibilityReport,
  ModelReadiness,
  ModelRuntimeEvent,
  ModelStatus,
  Services,
} from "@services/ports";

/**
 * Live local-model state for the picker (07 §5). Seeded from `models.status()` and kept current by
 * the `models.onProgress` stream (the ipc adapter bridges main-process ticks; the mock drives them).
 * One shared store so the STT list, the LLM list, and the storage line all react to the same events.
 */
interface ModelsState {
  statuses: Record<string, ModelStatus>;
  compatibility: ModelCompatibilityReport | null;
  readiness: Record<string, ModelReadiness>;
  active: ActiveModelReport | null;
  /** Latest engine-runtime event per model (download/load progress + ready/failed), for the UI. */
  runtimeEvents: Record<string, ModelRuntimeEvent>;
  services: Services | null;
  /** Idempotent: fetch the initial statuses and subscribe to progress once. */
  init: (services: Services) => void;
  refresh: () => Promise<void>;
}

let unsubscribe: (() => void) | null = null;

export const useModelsStore = create<ModelsState>((set, get) => ({
  statuses: {},
  compatibility: null,
  readiness: {},
  active: null,
  runtimeEvents: {},
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
    services.models.onRuntime((event) => {
      // Keep the latest runtime event per model so the setup card can show "downloading engine N%"
      // and failure reasons. Only re-pull the full snapshot on a terminal transition (not per tick).
      set((state) => ({ runtimeEvents: { ...state.runtimeEvents, [event.modelId]: event } }));
      if (event.state === "ready" || event.state === "failed" || event.state === "fallback") {
        void get().refresh();
      }
    });
  },
  refresh: async () => {
    const services = get().services;
    if (!services) return;
    const [list, compatibility, readiness, active] = await Promise.all([
      services.models.status(),
      services.models.compatibility(),
      services.models.readiness(),
      services.models.active(),
    ]);
    set({
      statuses: Object.fromEntries(list.map((s) => [s.id, s])),
      compatibility,
      readiness: Object.fromEntries(readiness.map((r) => [r.modelId, r])),
      active,
    });
  },
}));
