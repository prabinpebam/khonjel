/**
 * Node composition for the acceleration service (gpu-acceleration 01-04). This is the IO edge: it
 * runs the real detection commands (PowerShell CIM + registry, nvidia-smi, system_profiler, lspci)
 * and persists the `GpuProfile` cache to `<runtimeDir>/gpu-profile.json`. Kept out of `service.ts`
 * (which stays pure + BE1-testable); `main.ts` calls `createNodeAccelerationService`.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { detectGpuProfile, type DetectEnv, type DetectIo } from "./detect";
import { createAccelerationService, defaultAvailableBackends, type AccelerationApi } from "./service";
import { createAccelerationManager, type AccelerationManager } from "./manager";
import { emptyIndex, type EngineBackends } from "./backends";
import { BACKEND_ALLOWED_HOSTS, BACKEND_MANIFEST, findArtifact } from "./manifest";
import { installArtifact, ProvisionError, type ProvisionIo } from "./provision";
import { nodeRuntimeInstallIO } from "../models/runtime";
import { probeBackend } from "./probe-io";
import { runAccelerationBenchmark } from "./benchmark-io";
import type { AccelerationEngine, AccelerationMode, GpuProfile } from "../../../src/services/ports";

/** Defence in depth: never fetch a backend part from a non-HTTPS or non-allow-listed origin. */
function assertAllowedHost(url: string): void {
  let host: string | undefined;
  try {
    host = new URL(url).host;
  } catch {
    host = undefined;
  }
  if (!url.startsWith("https://") || !host || !BACKEND_ALLOWED_HOSTS.includes(host)) {
    throw new ProvisionError("download_failed", "Refused to fetch GPU support from an untrusted source.");
  }
}

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

function freeBytesOf(p: string): number {
  for (const candidate of [p, path.dirname(p)]) {
    try {
      const stats = fs.statfsSync(candidate);
      return Number(stats.bavail) * Number(stats.bsize);
    } catch {
      // try the parent
    }
  }
  return 0;
}

/**
 * The full acceleration manager (profile/rescan/plan + state/setMode/enable/disable/retry/runTest/
 * removeGpu/reset + events). Provisioning is pin-gated: until the manifest carries pinned hashes,
 * `enable` fails gracefully with a clear message and the app stays on the CPU.
 */
export function createNodeAccelerationManager(opts: {
  runtimeDir: string;
  getMode: () => AccelerationMode;
  persistMode: (mode: AccelerationMode) => void;
}): AccelerationManager {
  const { runtimeDir } = opts;
  const base = createNodeAccelerationService(runtimeDir);
  const backendsPath = path.join(runtimeDir, "backends.json");

  function loadAll(): Record<string, EngineBackends> {
    try {
      return JSON.parse(fs.readFileSync(backendsPath, "utf8")) as Record<string, EngineBackends>;
    } catch {
      return {};
    }
  }
  function saveAll(all: Record<string, EngineBackends>): void {
    try {
      fs.mkdirSync(runtimeDir, { recursive: true });
      fs.writeFileSync(backendsPath, JSON.stringify(all, null, 2));
    } catch {
      // persistence is best-effort
    }
  }

  const installIo = nodeRuntimeInstallIO(process.platform === "win32");
  const provisionIo: ProvisionIo = {
    freeDiskBytes: () => freeBytesOf(runtimeDir),
    download: async (url, destPath, sha256, onProgress) => {
      assertAllowedHost(url);
      await installIo.downloadFile(url, destPath, (done) => onProgress?.(done));
      // Pinned parts are hash-verified (defence in depth). Unpinned parts rely on HTTPS + an
      // allow-listed host + the post-extract expectFiles assertion (the CPU installer's floor).
      if (sha256 && sha256.length === 64) {
        const actual = createHash("sha256").update(fs.readFileSync(destPath)).digest("hex");
        if (actual.toLowerCase() !== sha256.toLowerCase()) {
          try {
            fs.rmSync(destPath, { force: true });
          } catch {
            // best-effort cleanup of the bad file
          }
          throw new ProvisionError("download_failed", "The GPU files couldn't be verified.");
        }
      }
    },
    extractZip: async (zipPath, destDir) => installIo.extractZip(zipPath, destDir),
    fileExists: (p) => fs.existsSync(p),
    ensureDir: (p) => fs.mkdirSync(p, { recursive: true }),
    atomicActivate: (staging, finalDir) => {
      try {
        fs.rmSync(finalDir, { recursive: true, force: true });
      } catch {
        // no prior install to replace
      }
      fs.renameSync(staging, finalDir);
    },
    removeDir: (p) => {
      try {
        fs.rmSync(p, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
    now: () => new Date().toISOString(),
  };

  return createAccelerationManager({
    profile: base.profile,
    rescan: base.rescan,
    plan: base.plan,
    getMode: opts.getMode,
    persistMode: opts.persistMode,
    loadBackends: (engine) => loadAll()[engine] ?? emptyIndex(engine),
    saveBackends: (engine, index) => {
      const all = loadAll();
      all[engine] = index;
      saveAll(all);
    },
    provision: async (engine: AccelerationEngine, backend, onProgress) => {
      const profile = await base.profile();
      const artifact = findArtifact(BACKEND_MANIFEST, { engine, backend, os: profile.os, arch: profile.arch });
      if (!artifact) throw new ProvisionError("not_pinned", "GPU support isn't available for this system yet.");
      const io: ProvisionIo = { ...provisionIo, onProgress: (e) => onProgress(e.bytesDone, e.bytesTotal) };
      // allowUnpinned: ship now at the CPU-installer integrity floor; real sha256 pins land at release.
      const result = await installArtifact(artifact, path.join(runtimeDir, engine), io, { allowUnpinned: true });
      return { dir: result.dir, version: artifact.version };
    },
    probe: async (engine, backend, dir) =>
      probeBackend({
        engine,
        backend,
        dir,
        modelsDir: path.join(path.dirname(runtimeDir), "models"),
        isWindows: process.platform === "win32",
        profile: await base.profile(),
      }),
    removeDirs: (dirs) => {
      for (const dir of dirs) provisionIo.removeDir(dir);
    },
    resetRuntime: () => {
      try {
        fs.rmSync(runtimeDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    },
    isOnline: () => true,
    runBenchmark: () =>
      runAccelerationBenchmark({
        runtimeDir,
        modelsDir: path.join(path.dirname(runtimeDir), "models"),
        isWindows: process.platform === "win32",
        loadBackends: (engine) => loadAll()[engine] ?? emptyIndex(engine),
      }),
  });
}
