/**
 * GPU detection (gpu-acceleration 01). Layered, never-throwing hardware detection that produces a
 * `GpuProfile`. PURE parsers + a dependency-injected orchestrator so the whole thing is BE1-testable
 * without a GPU: the real main process injects IO that runs PowerShell / nvidia-smi / system_profiler
 * / lspci; tests inject canned command output.
 *
 * Detection tiers (01 §1):
 *   1. OS enumeration        -> device list (name, vendor, ids)            [always]
 *   2. Vendor/registry probe -> accurate VRAM, driver, compute capability [best-effort]
 * Tier 3 (functional probe) lives in probe.ts (it needs a provisioned backend).
 */
import type { GpuDevice, GpuProfile, GpuVendor } from "../../../src/services/ports";

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

// ------------------------------------------------------------------ //
// Vendor helpers
// ------------------------------------------------------------------ //

const VENDOR_BY_ID: Record<string, GpuVendor> = {
  "10DE": "nvidia",
  "1002": "amd",
  "1022": "amd",
  "8086": "intel",
  "106B": "apple",
};

function vendorFromName(name: string): GpuVendor {
  const lower = name.toLowerCase();
  if (lower.includes("nvidia") || lower.includes("geforce") || lower.includes("rtx") || lower.includes("gtx") || lower.includes("quadro") || lower.includes("tesla")) return "nvidia";
  if (lower.includes("amd") || lower.includes("radeon") || lower.includes("instinct")) return "amd";
  if (lower.includes("intel") || lower.includes("iris") || lower.includes("uhd") || lower.includes("arc")) return "intel";
  if (lower.includes("apple")) return "apple";
  return "unknown";
}

function venIdFrom(pnpOrDeviceId: string): string | undefined {
  const match = /VEN_([0-9A-Fa-f]{4})/.exec(pnpOrDeviceId) ?? /\b([0-9a-fA-F]{4}):[0-9a-fA-F]{4}\b/.exec(pnpOrDeviceId);
  return match?.[1]?.toUpperCase();
}

function isIntegratedGuess(vendor: GpuVendor, name: string): boolean {
  const lower = name.toLowerCase();
  if (vendor === "intel") return lower.includes("uhd") || lower.includes("iris") || lower.includes("hd graphics");
  if (vendor === "apple") return true;
  return false;
}

// ------------------------------------------------------------------ //
// CSV helper (quoted)
// ------------------------------------------------------------------ //

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else current += char;
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

function parseCsv(csv: string): { header: string[]; rows: string[][] } | undefined {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return undefined;
  const header = splitCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
  const rows = lines.slice(1).map(splitCsvLine);
  return { header, rows };
}

// ------------------------------------------------------------------ //
// Tier 1/2 parsers (PURE)
// ------------------------------------------------------------------ //

/** Windows `Win32_VideoController` CSV -> devices. AdapterRAM is the 4GB-capped value and is NEVER
 *  reported as accurate VRAM (registry / nvidia-smi supply that later). */
export function parseWindowsDisplayCsv(csv: string): GpuDevice[] {
  const parsed = parseCsv(csv);
  if (!parsed) return [];
  const nameIdx = parsed.header.indexOf("name");
  const pnpIdx = parsed.header.indexOf("pnpdeviceid");
  const driverIdx = parsed.header.indexOf("driverversion");
  if (nameIdx < 0) return [];
  return parsed.rows.flatMap((cells, index) => {
    const name = cells[nameIdx]?.trim();
    if (!name) return [];
    const pnp = pnpIdx >= 0 ? cells[pnpIdx] ?? "" : "";
    const vendorId = venIdFrom(pnp);
    const vendor = (vendorId && VENDOR_BY_ID[vendorId]) || vendorFromName(name);
    const driverVersion = driverIdx >= 0 ? cells[driverIdx]?.trim() || undefined : undefined;
    const device: GpuDevice = {
      index,
      name,
      vendor,
      vendorId,
      driverVersion,
      isIntegrated: isIntegratedGuess(vendor, name) || undefined,
      source: ["os"],
    };
    return [device];
  });
}

export interface NvidiaSmiRecord {
  name: string;
  vramBytes?: number;
  driverVersion?: string;
  computeCapability?: string;
}

/** `nvidia-smi --query-gpu=name,memory.total,driver_version,compute_cap --format=csv,noheader,nounits`. */
export function parseNvidiaSmi(text: string): NvidiaSmiRecord[] {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const memMib = Number(cells[1]);
      return {
        name: cells[0] ?? "",
        vramBytes: Number.isFinite(memMib) && memMib > 0 ? memMib * MIB : undefined,
        driverVersion: cells[2] || undefined,
        computeCapability: cells[3] || undefined,
      };
    })
    .filter((r) => r.name);
}

/** The max CUDA version the driver supports, from the `nvidia-smi` header line. */
export function parseNvidiaCudaVersion(text: string): string | undefined {
  const match = /CUDA Version:\s*([0-9]+(?:\.[0-9]+)?)/i.exec(text);
  return match ? match[1] : undefined;
}

export interface RegistryVramRecord {
  vendorId?: string;
  deviceId: string;
  vramBytes?: number;
  driverVersion?: string;
}

/** Display-class registry CSV with the 64-bit `HardwareInformation.qwMemorySize` (the accurate VRAM
 *  for AMD/Intel on Windows and an NVIDIA cross-check). */
export function parseRegistryVram(csv: string): RegistryVramRecord[] {
  const parsed = parseCsv(csv);
  if (!parsed) return [];
  const idIdx = parsed.header.indexOf("matchingdeviceid");
  const memIdx = parsed.header.findIndex((h) => h.includes("qwmemorysize"));
  const driverIdx = parsed.header.indexOf("driverversion");
  return parsed.rows.flatMap((cells) => {
    const deviceId = idIdx >= 0 ? cells[idIdx] ?? "" : "";
    const mem = memIdx >= 0 ? Number(cells[memIdx]) : Number.NaN;
    return [
      {
        vendorId: venIdFrom(deviceId),
        deviceId,
        vramBytes: Number.isFinite(mem) && mem > 0 ? mem : undefined,
        driverVersion: driverIdx >= 0 ? cells[driverIdx]?.trim() || undefined : undefined,
      },
    ];
  });
}

/** macOS `system_profiler -json SPDisplaysDataType`. */
export function parseSystemProfiler(json: string): GpuDevice[] {
  try {
    const data = JSON.parse(json) as { SPDisplaysDataType?: Array<Record<string, string>> };
    const list = data.SPDisplaysDataType ?? [];
    return list.map((entry, index) => {
      const name = entry.sppci_model ?? entry._name ?? "GPU";
      const vendorRaw = `${entry.spdisplays_vendor ?? ""} ${name}`;
      const vendor = vendorFromName(vendorRaw);
      return { index, name, vendor, source: ["system_profiler"] } as GpuDevice;
    });
  } catch {
    return [];
  }
}

/** Linux `lspci -nnk` lines for VGA/3D/Display controllers. */
export function parseLspci(text: string): GpuDevice[] {
  const lines = text.split(/\r?\n/).filter((l) => /vga|3d controller|display controller/i.test(l));
  return lines.map((line, index) => {
    const idMatch = /\[([0-9a-fA-F]{4}):[0-9a-fA-F]{4}\]/.exec(line);
    const vendorId = idMatch?.[1]?.toUpperCase();
    const bracketed = [...line.matchAll(/\[([^\]]+)\]/g)]
      .map((m) => m[1])
      .filter((p): p is string => p != null && !/^[0-9a-fA-F]{4}:[0-9a-fA-F]{4}$/.test(p));
    const name = (bracketed.length ? bracketed[bracketed.length - 1] : line.split(":").slice(2).join(":").trim()) || "GPU";
    const vendor = (vendorId && VENDOR_BY_ID[vendorId]) || vendorFromName(line);
    return { index, name, vendor, vendorId, source: ["lspci"] } as GpuDevice;
  });
}

// ------------------------------------------------------------------ //
// Selection + memory policy (PURE)
// ------------------------------------------------------------------ //

/** Choose the device we plan to use: discrete over integrated, then most accurate VRAM. */
export function selectPrimaryGpu(devices: GpuDevice[]): GpuDevice | undefined {
  if (devices.length === 0) return undefined;
  const score = (d: GpuDevice) => (d.isIntegrated ? 0 : 1_000_000_000_000) + (d.vramBytes ?? 0);
  return [...devices].sort((a, b) => score(b) - score(a))[0];
}

/** Usable GPU memory on a unified-memory machine (Apple Silicon): a fraction of system RAM. */
export function unifiedMemoryBudgetBytes(totalRamBytes: number): number {
  return Math.max(0, Math.min(Math.floor(0.7 * totalRamBytes), totalRamBytes - 4 * GIB));
}

// ------------------------------------------------------------------ //
// Orchestrator (IO injected; never throws)
// ------------------------------------------------------------------ //

export interface DetectEnv {
  platform: "win32" | "darwin" | "linux";
  arch: string;
  totalRamBytes: number;
  now: () => string;
}

export interface DetectIo {
  windowsDisplayCsv?: () => string | undefined;
  windowsRegistryVram?: () => string | undefined;
  nvidiaSmi?: () => string | undefined;
  nvidiaSmiVersion?: () => string | undefined;
  macSystemProfiler?: () => string | undefined;
  linuxLspci?: () => string | undefined;
}

function safe(fn: (() => string | undefined) | undefined): string | undefined {
  if (!fn) return undefined;
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function addSource(device: GpuDevice, source: GpuDevice["source"][number]): void {
  if (!device.source.includes(source)) device.source.push(source);
}

export function detectGpuProfile(env: DetectEnv, io: DetectIo): GpuProfile {
  const warnings: string[] = [];
  let devices: GpuDevice[];

  if (env.platform === "win32") {
    devices = parseWindowsDisplayCsv(safe(io.windowsDisplayCsv) ?? "");

    // Tier 2a: accurate VRAM from the display-class registry (qwMemorySize), matched by vendor id.
    const regRecords = parseRegistryVram(safe(io.windowsRegistryVram) ?? "");
    const usedReg = new Set<number>();
    for (const device of devices) {
      const idx = regRecords.findIndex((r, i) => !usedReg.has(i) && r.vendorId != null && r.vendorId === device.vendorId);
      if (idx >= 0) {
        usedReg.add(idx);
        const rec = regRecords[idx];
        if (rec?.vramBytes != null) device.vramBytes = rec.vramBytes;
        addSource(device, "registry");
      }
    }

    // Tier 2b: NVIDIA truth from nvidia-smi (most accurate for NVIDIA).
    applyNvidiaSmi(devices, io);
  } else if (env.platform === "darwin") {
    devices = parseSystemProfiler(safe(io.macSystemProfiler) ?? "");
    if (devices.length === 0 && env.arch === "arm64") {
      devices = [{ index: 0, name: "Apple Silicon GPU", vendor: "apple", source: ["os"] }];
    }
    for (const device of devices) {
      if (device.vendor === "apple" || env.arch === "arm64") {
        device.vendor = "apple";
        device.unifiedMemory = true;
        device.isIntegrated = true;
        device.vramBytes = unifiedMemoryBudgetBytes(env.totalRamBytes);
      }
    }
  } else {
    devices = parseLspci(safe(io.linuxLspci) ?? "");
    applyNvidiaSmi(devices, io);
  }

  if (devices.length === 0) {
    warnings.push("No compatible GPU detected. Khonjel will run on the CPU.");
  } else if (devices.some((d) => d.vramBytes == null)) {
    warnings.push("GPU memory could not be read accurately; a safe amount will be used.");
  }

  return {
    os: env.platform,
    arch: env.arch,
    devices,
    primary: selectPrimaryGpu(devices),
    detectedAt: env.now(),
    warnings,
  };
}

function applyNvidiaSmi(devices: GpuDevice[], io: DetectIo): void {
  const nvidia = devices.filter((d) => d.vendor === "nvidia");
  if (nvidia.length === 0) return;
  const records = parseNvidiaSmi(safe(io.nvidiaSmi) ?? "");
  if (records.length === 0) return;
  const maxCuda = parseNvidiaCudaVersion(safe(io.nvidiaSmiVersion) ?? "");
  nvidia.forEach((device, i) => {
    const rec = records[i] ?? records[0];
    if (!rec) return;
    if (rec.vramBytes != null) device.vramBytes = rec.vramBytes;
    if (rec.driverVersion) device.driverVersion = rec.driverVersion;
    if (rec.computeCapability) device.computeCapability = rec.computeCapability;
    if (maxCuda) device.maxCudaVersion = maxCuda;
    addSource(device, "nvidia-smi");
  });
}
