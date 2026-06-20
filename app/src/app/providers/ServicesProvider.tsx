import type { ReactNode } from "react";
import { ServicesContext } from "@services";
// ServicesProvider is the ONE place allowed to bind a concrete adapter (ESLint allowlists it).
import { mockServices } from "@services/adapters/mock";

/** Binds concrete adapters to the seam. Today: mock. Later: real Electron/IPC. */
export function ServicesProvider({ children }: { children: ReactNode }) {
  return <ServicesContext.Provider value={mockServices}>{children}</ServicesContext.Provider>;
}
