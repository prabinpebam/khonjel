import os from "node:os";
import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { statfsSync } from "node:fs";
import type { HardwareGpu, HardwareProfile } from "../../../src/services/ports";

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

function vendorOf(name: string): HardwareGpu["vendor"] {
  const lower = name.toLowerCase();
  if (lower.includes("nvidia") || lower.includes("geforce") || lower.includes("rtx") || lower.includes("gtx")) return "nvidia";
  if (lower.includes("amd") || lower.includes("radeon")) return "amd";
  if (lower.includes("intel") || lower.includes("iris") || lower.includes("uhd")) return "intel";
  if (lower.includes("apple")) return "apple";
  return "unknown";
}

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

export function parseWindowsGpuCsv(csv: string): HardwareGpu[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
  const nameIndex = header.indexOf("name");
  const ramIndex = header.indexOf("adapterram");
  const driverIndex = header.indexOf("driverversion");
  if (nameIndex < 0) return [];
  return lines.slice(1).flatMap((line) => {
    const cells = splitCsvLine(line);
    const name = cells[nameIndex]?.trim();
    if (!name) return [];
    const rawRam = ramIndex >= 0 ? Number(cells[ramIndex]) : Number.NaN;
    const vramBytes = Number.isFinite(rawRam) && rawRam > 0 ? rawRam : undefined;
    const driverVersion = driverIndex >= 0 ? cells[driverIndex]?.trim() || undefined : undefined;
    return [{ name, vendor: vendorOf(name), vramBytes, driverVersion }];
  });
}

function detectWindowsGpus(): HardwareGpu[] {
  try {
    const out = execFileSync(
      "powershell",
      [
        "-NoProfile",
        "-NonInteractive",
        "-Command",
        "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Csv -NoTypeInformation",
      ],
      { encoding: "utf8", windowsHide: true, timeout: 3000 },
    );
    return parseWindowsGpuCsv(out);
  } catch {
    return [];
  }
}

export function detectHardwareProfile(modelsDir: string): HardwareProfile {
  const cpus = os.cpus();
  const warnings: string[] = [];
  const disk = freeBytes(modelsDir);
  if (disk == null) warnings.push("Free disk space could not be detected.");
  const gpus = process.platform === "win32" ? detectWindowsGpus() : [];
  if (process.platform === "win32" && gpus.length === 0) warnings.push("GPU could not be detected.");
  return {
    os: process.platform === "darwin" ? "darwin" : process.platform === "linux" ? "linux" : "win32",
    arch: os.arch(),
    cpuName: cpus[0]?.model,
    logicalCores: cpus.length || undefined,
    totalRamBytes: os.totalmem(),
    availableRamBytes: os.freemem(),
    freeDiskBytes: disk,
    gpus,
    power: "unknown",
    detectionWarnings: warnings,
  };
}