import os from "node:os";
import { dirname } from "node:path";
import { statfsSync } from "node:fs";
import type { HardwareProfile } from "../../../src/services/ports";

function freeBytes(path: string): number | undefined {
  for (const candidate of [path, dirname(path)]) {
    try {
      const stats = statfsSync(candidate);
      return Number(stats.bavail) * Number(stats.bsize);
    } catch {
      // try the parent, then give up
    }
  }
  return undefined;
}

export function detectHardwareProfile(modelsDir: string): HardwareProfile {
  const cpus = os.cpus();
  const warnings: string[] = [];
  const disk = freeBytes(modelsDir);
  if (disk == null) warnings.push("Free disk space could not be detected.");
  return {
    os: process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : "win32",
    arch: os.arch(),
    cpuName: cpus[0]?.model,
    logicalCores: cpus.length || undefined,
    totalRamBytes: os.totalmem(),
    availableRamBytes: os.freemem(),
    freeDiskBytes: disk,
    gpus: [],
    power: "unknown",
    detectionWarnings: warnings,
  };
}