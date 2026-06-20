import { createContext, useContext } from "react";
import type { Services } from "./ports";

export type { Services } from "./ports";
export * from "./ports";

/**
 * The single seam UI talks to. Provided by `ServicesProvider` (which is the only
 * place allowed to import a concrete adapter).
 */
export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) {
    throw new Error("useServices() must be used within a <ServicesProvider>.");
  }
  return services;
}
