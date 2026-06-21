import type { ReactNode } from "react";
import { ServicesContext, type Services } from "@services";
// ServicesProvider is the ONE place allowed to bind a concrete adapter (ESLint allowlists it).
import { mockServices } from "@services/adapters/mock";
import { createIpcServices } from "@services/adapters/ipc";

declare global {
  interface Window {
    /** Electron preload IPC bridge (absent in the browser/dev, so the app runs on mock adapters). */
    khonjel?: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
      contractVersion?: number;
    };
  }
}

/**
 * Picks the real `ipc` adapter when the Electron preload bridge is present, and the mock
 * adapters otherwise. The renderer never changes — only the bound adapter does (the seam).
 */
function resolveServices(): Services {
  const bridge = typeof window !== "undefined" ? window.khonjel : undefined;
  if (bridge && typeof bridge.invoke === "function") {
    return createIpcServices((channel, ...args) => bridge.invoke(channel, ...args));
  }
  return mockServices;
}

const services = resolveServices();

/** Binds concrete adapters to the seam: real Electron/IPC when available, else mock. */
export function ServicesProvider({ children }: { children: ReactNode }) {
  return <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>;
}
