/** Simulated async latency for mock adapters (no real backend). */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
