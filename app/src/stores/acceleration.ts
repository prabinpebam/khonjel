import { create } from "zustand";
import type {
  AccelerationEngine,
  AccelerationMode,
  AccelerationPlan,
  AccelerationProgress,
  AccelerationState,
  AccelerationTestReport,
  Services,
} from "@services/ports";

/**
 * Live GPU-acceleration state for the settings card (gpu-acceleration 04 §7). Seeded from
 * `acceleration.state()` + `plan()` and kept current by the `onState` / `onProgress` relays (the ipc
 * adapter bridges main-process events; the mock drives them synchronously for the browser preview).
 */
interface AccelerationStore {
  state: AccelerationState | null;
  plan: AccelerationPlan | null;
  progress: AccelerationProgress | null;
  lastTest: AccelerationTestReport | null;
  busy: boolean;
  services: Services | null;
  init: (services: Services) => void;
  refresh: () => Promise<void>;
  setMode: (mode: AccelerationMode) => Promise<void>;
  enable: (engine?: AccelerationEngine) => Promise<void>;
  disable: (engine?: AccelerationEngine) => Promise<void>;
  /** Turn acceleration on/off for BOTH local engines (chat + dictation) in one action. */
  enableAll: () => Promise<void>;
  disableAll: () => Promise<void>;
  rescan: () => Promise<void>;
  runTest: () => Promise<void>;
  removeGpu: (engine?: AccelerationEngine) => Promise<void>;
  reset: () => Promise<void>;
}

let unsubState: (() => void) | null = null;
let unsubProgress: (() => void) | null = null;

const TERMINAL = new Set(["active", "quarantined", "failed", "none"]);

export const useAccelerationStore = create<AccelerationStore>((set, get) => ({
  state: null,
  plan: null,
  progress: null,
  lastTest: null,
  busy: false,
  services: null,

  init: (services) => {
    if (get().services) return;
    set({ services });
    void get().refresh();
    unsubState?.();
    unsubState = services.acceleration.onState((state) => set({ state }));
    unsubProgress?.();
    unsubProgress = services.acceleration.onProgress((progress) => {
      set({ progress });
      if (TERMINAL.has(progress.state)) set({ busy: false });
    });
  },

  refresh: async () => {
    const services = get().services;
    if (!services) return;
    const [state, plan] = await Promise.all([services.acceleration.state(), services.acceleration.plan()]);
    set({ state, plan });
  },

  setMode: async (mode) => {
    const services = get().services;
    if (!services) return;
    await services.acceleration.setMode(mode);
    await get().refresh();
  },

  enable: async (engine = "llama") => {
    const services = get().services;
    if (!services) return;
    set({ busy: true, progress: null });
    await services.acceleration.enable(engine);
    await get().refresh();
    set({ busy: false });
  },

  disable: async (engine = "llama") => {
    const services = get().services;
    if (!services) return;
    await services.acceleration.disable(engine);
    await get().refresh();
  },

  enableAll: async () => {
    const services = get().services;
    if (!services) return;
    // One button, both local engines (best-effort): chat/cleanup (broad GPU support) first, then
    // dictation (NVIDIA-only). A backend that isn't supported quietly stays on the CPU floor.
    set({ busy: true, progress: null });
    await services.acceleration.enable("llama");
    set({ busy: true }); // re-assert across the second leg (the first leg's terminal event clears it)
    await services.acceleration.enable("whisper");
    await get().refresh();
    set({ busy: false });
  },

  disableAll: async () => {
    const services = get().services;
    if (!services) return;
    await services.acceleration.disable("llama");
    await services.acceleration.disable("whisper");
    await get().refresh();
  },

  rescan: async () => {
    const services = get().services;
    if (!services) return;
    await services.acceleration.rescan();
    await get().refresh();
  },

  runTest: async () => {
    const services = get().services;
    if (!services) return;
    set({ busy: true });
    const report = await services.acceleration.runTest();
    set({ lastTest: report, busy: false });
  },

  removeGpu: async (engine = "llama") => {
    const services = get().services;
    if (!services) return;
    await services.acceleration.removeGpuBackends(engine);
    await get().refresh();
  },

  reset: async () => {
    const services = get().services;
    if (!services) return;
    await services.acceleration.reset();
    set({ lastTest: null, progress: null });
    await get().refresh();
  },
}));
