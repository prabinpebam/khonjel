/**
 * Node composition for the acceleration service (gpu-acceleration 01-04). This is the IO edge: it
 * runs the real detection commands (PowerShell CIM + registry, nvidia-smi, system_profiler, lspci)
 * and persists the `GpuProfile` cache to `<runtimeDir>/gpu-profile.json`. Kept out of `service.ts`
 * (which stays pure + BE1-testable); `main.ts` calls `createNodeAccelerationService`.
 */
import { execFileSync } from "node:child_process";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { detectGpuProfile, type DetectEnv, type DetectIo } from "./detect";
import { createAccelerationService, defaultAvailableBackends, type AccelerationApi } from "./service";
import type { GpuProfile } from "../../../src/services/ports";

function run(cmd: string, args: string[], timeoutMs = 3500): string | undefined {
  try {
    return execFileSync(cmd, args, { encoding: "utf8", windowsHide: true, timeout: timeoutMs });
  } catch {
    return undefined;
  }
}

// Enumerate display-class adapters that expose the 64-bit qwMemorySize (the accurate VRAM the
// 32-bit Win32_VideoController.AdapterRAM cannot represent above 4 GB).
const REGISTRY_PS =
  "Get-ChildItem 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}' " +
  "| ForEach-Object { $p = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue; " +
  "if ($p.'HardwareInformation.qwMemorySize') { [pscustomobject]@{ " +
  "MatchingDeviceId=$p.MatchingDeviceId; 'HardwareInformation.qwMemorySize'=$p.'HardwareInformation.qwMemorySize'; " +
  "DriverVersion=$p.DriverVersion } } } | ConvertTo-Csv -NoTypeInformation";

function nodeDetectIo(): DetectIo {
  return {
    windowsDisplayCsv: () =>
      run("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_VideoController | Select-Object Name,PNPDeviceID,DriverVersion,AdapterRAM | ConvertTo-Csv -NoTypeInformation",
      ]),
    windowsRegistryVram: () => run("powershell", ["-NoProfile", "-NonInteractive", "-Command", REGISTRY_PS]),
    nvidiaSmi: () =>
      run("nvidia-smi", ["--query-gpu=name,memory.total,driver_version,compute_cap", "--format=csv,noheader,nounits"]),
    nvidiaSmiVersion: () => run("nvidia-smi", []),
    macSystemProfiler: () => run("system_profiler", ["-json", "SPDisplaysDataType"]),
    linuxLspci: () => run("sh", ["-c", "lspci -nnk | grep -iE 'vga|3d controller|display controller'"]),
  };
}

function platformOf(): GpuProfile["os"] {
  return process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : "win32";
}

function freshEnough(cached: GpuProfile): boolean {
  const age = Date.now() - Date.parse(cached.detectedAt);
  return Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000;
}

/** Build the real, node-backed acceleration service. `runtimeDir` is `<userData>/runtime`. */
export function createNodeAccelerationService(runtimeDir: string): AccelerationApi {
  const profilePath = path.join(runtimeDir, "gpu-profile.json");
  const env: DetectEnv = {
    platform: platformOf(),
    arch: os.arch(),
    totalRamBytes: os.totalmem(),
    now: () => new Date().toISOString(),
  };
  return createAccelerationService({
    detectProfile: () => detectGpuProfile(env, nodeDetectIo()),
    loadCachedProfile: () => {
      try {
        return JSON.parse(fs.readFileSync(profilePath, "utf8")) as GpuProfile;
      } catch {
        return undefined;
      }
    },
    saveProfile: (profile) => {
      try {
        fs.mkdirSync(runtimeDir, { recursive: true });
        fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));
      } catch {
        // detection still works without a cache; ignore write failures.
      }
    },
    availableBackends: (profile) => defaultAvailableBackends(profile.os, profile.arch),
    isCacheFresh: freshEnough,
  });
}
