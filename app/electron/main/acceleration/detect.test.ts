// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  parseWindowsDisplayCsv,
  parseNvidiaSmi,
  parseNvidiaCudaVersion,
  parseRegistryVram,
  parseSystemProfiler,
  parseLspci,
  selectPrimaryGpu,
  unifiedMemoryBudgetBytes,
  detectGpuProfile,
  type DetectEnv,
  type DetectIo,
} from "./detect";
import type { GpuDevice } from "../../../src/services/ports";

const MIB = 1024 * 1024;

describe("parseWindowsDisplayCsv", () => {
  it("reads vendor id from PNPDeviceID, not just the name", () => {
    const csv =
      '"Name","PNPDeviceID","DriverVersion","AdapterRAM"\n' +
      '"NVIDIA GeForce RTX 4090","PCI\\VEN_10DE&DEV_2684&SUBSYS_167E10DE","32.0.15.7652","4293918720"\n';
    const gpus = parseWindowsDisplayCsv(csv);
    expect(gpus[0]).toMatchObject({ vendor: "nvidia", vendorId: "10DE", name: "NVIDIA GeForce RTX 4090" });
    expect(gpus[0]?.source).toContain("os");
  });

  it("classifies AMD and Intel by PCI vendor id even with generic names", () => {
    const csv =
      '"Name","PNPDeviceID","DriverVersion","AdapterRAM"\n' +
      '"Radeon RX 7900 XTX","PCI\\VEN_1002&DEV_744C","31.0.0","4293918720"\n' +
      '"Intel(R) UHD Graphics 770","PCI\\VEN_8086&DEV_4680","31.0.101","1073741824"\n';
    const gpus = parseWindowsDisplayCsv(csv);
    expect(gpus[0]).toMatchObject({ vendor: "amd", vendorId: "1002" });
    expect(gpus[1]).toMatchObject({ vendor: "intel", isIntegrated: true });
  });

  it("ignores the unreliable 4GB-capped AdapterRAM (never trusted as accurate VRAM)", () => {
    const csv =
      '"Name","PNPDeviceID","DriverVersion","AdapterRAM"\n' +
      '"NVIDIA GeForce RTX 4090","PCI\\VEN_10DE&DEV_2684","32.0.15","4293918720"\n';
    const gpus = parseWindowsDisplayCsv(csv);
    // 4293918720 is the 4GB cap; it must NOT be reported as accurate VRAM.
    expect(gpus[0]?.vramBytes).toBeUndefined();
  });

  it("returns [] for empty or malformed input", () => {
    expect(parseWindowsDisplayCsv("")).toEqual([]);
    expect(parseWindowsDisplayCsv("garbage\n")).toEqual([]);
  });
});

describe("parseNvidiaSmi", () => {
  it("parses name, memory (MiB), driver and compute capability", () => {
    const out = "NVIDIA GeForce RTX 4090, 24564, 581.15, 8.9\n";
    expect(parseNvidiaSmi(out)[0]).toMatchObject({
      name: "NVIDIA GeForce RTX 4090",
      vramBytes: 24564 * MIB,
      driverVersion: "581.15",
      computeCapability: "8.9",
    });
  });

  it("returns [] for empty output", () => {
    expect(parseNvidiaSmi("")).toEqual([]);
  });
});

describe("parseNvidiaCudaVersion", () => {
  it("extracts the max CUDA version from the nvidia-smi header", () => {
    const header = "| NVIDIA-SMI 581.15  Driver Version: 581.15  CUDA Version: 13.0 |";
    expect(parseNvidiaCudaVersion(header)).toBe("13.0");
  });
  it("returns undefined when absent", () => {
    expect(parseNvidiaCudaVersion("no cuda here")).toBeUndefined();
  });
});

describe("parseRegistryVram", () => {
  it("reads the 64-bit qwMemorySize per device", () => {
    const csv =
      '"MatchingDeviceId","HardwareInformation.qwMemorySize","DriverVersion"\n' +
      '"PCI\\VEN_10DE&DEV_2684","25757220864","32.0.15.7652"\n';
    expect(parseRegistryVram(csv)[0]).toMatchObject({ vendorId: "10DE", vramBytes: 25757220864 });
  });
});

describe("selectPrimaryGpu", () => {
  const dev = (over: Partial<GpuDevice>): GpuDevice => ({
    index: 0,
    name: "x",
    vendor: "unknown",
    source: ["os"],
    ...over,
  });

  it("prefers a discrete GPU over an integrated one", () => {
    const primary = selectPrimaryGpu([
      dev({ index: 0, vendor: "intel", isIntegrated: true, vramBytes: undefined }),
      dev({ index: 1, vendor: "nvidia", vramBytes: 24 * 1024 * MIB }),
    ]);
    expect(primary?.vendor).toBe("nvidia");
  });

  it("among discrete, prefers the most accurate VRAM", () => {
    const primary = selectPrimaryGpu([
      dev({ index: 0, vendor: "amd", vramBytes: 8 * 1024 * MIB }),
      dev({ index: 1, vendor: "nvidia", vramBytes: 24 * 1024 * MIB }),
    ]);
    expect(primary?.vendor).toBe("nvidia");
  });

  it("returns undefined for no devices", () => {
    expect(selectPrimaryGpu([])).toBeUndefined();
  });
});

describe("unifiedMemoryBudgetBytes", () => {
  it("reserves headroom from total system RAM", () => {
    const total = 32 * 1024 * MIB;
    const budget = unifiedMemoryBudgetBytes(total);
    expect(budget).toBeGreaterThan(0);
    expect(budget).toBeLessThan(total);
  });
});

describe("detectGpuProfile (orchestrator, IO injected)", () => {
  const baseEnv: DetectEnv = {
    platform: "win32",
    arch: "x64",
    totalRamBytes: 64 * 1024 * MIB,
    now: () => "2026-06-23T00:00:00.000Z",
  };

  it("merges OS + registry + nvidia-smi, overriding the 4GB cap with accurate VRAM", () => {
    const io: DetectIo = {
      windowsDisplayCsv: () =>
        '"Name","PNPDeviceID","DriverVersion","AdapterRAM"\n' +
        '"NVIDIA GeForce RTX 4090","PCI\\VEN_10DE&DEV_2684","32.0.15.7652","4293918720"\n',
      windowsRegistryVram: () =>
        '"MatchingDeviceId","HardwareInformation.qwMemorySize","DriverVersion"\n' +
        '"PCI\\VEN_10DE&DEV_2684","25757220864","32.0.15.7652"\n',
      nvidiaSmi: () => "NVIDIA GeForce RTX 4090, 24564, 581.15, 8.9\n",
      nvidiaSmiVersion: () => "CUDA Version: 13.0",
    };
    const profile = detectGpuProfile(baseEnv, io);
    expect(profile.primary?.vendor).toBe("nvidia");
    // nvidia-smi is the most accurate source for NVIDIA VRAM.
    expect(profile.primary?.vramBytes).toBe(24564 * MIB);
    expect(profile.primary?.driverVersion).toBe("581.15");
    expect(profile.primary?.computeCapability).toBe("8.9");
    expect(profile.primary?.maxCudaVersion).toBe("13.0");
    expect(profile.primary?.source).toEqual(expect.arrayContaining(["os", "nvidia-smi"]));
    expect(profile.detectedAt).toBe("2026-06-23T00:00:00.000Z");
  });

  it("uses registry VRAM for AMD when nvidia-smi is absent", () => {
    const io: DetectIo = {
      windowsDisplayCsv: () =>
        '"Name","PNPDeviceID","DriverVersion","AdapterRAM"\n' +
        '"AMD Radeon RX 7900 XTX","PCI\\VEN_1002&DEV_744C","31.0.0","4293918720"\n',
      windowsRegistryVram: () =>
        '"MatchingDeviceId","HardwareInformation.qwMemorySize","DriverVersion"\n' +
        '"PCI\\VEN_1002&DEV_744C","25757220864","31.0.0"\n',
    };
    const profile = detectGpuProfile(baseEnv, io);
    expect(profile.primary?.vendor).toBe("amd");
    expect(profile.primary?.vramBytes).toBe(25757220864);
    expect(profile.primary?.computeCapability).toBeUndefined();
  });

  it("treats Apple Silicon as unified memory", () => {
    const io: DetectIo = {
      macSystemProfiler: () =>
        JSON.stringify({
          SPDisplaysDataType: [{ sppci_model: "Apple M3 Max", spdisplays_vendor: "Apple" }],
        }),
    };
    const profile = detectGpuProfile(
      { ...baseEnv, platform: "darwin", arch: "arm64", totalRamBytes: 48 * 1024 * MIB },
      io,
    );
    expect(profile.primary?.vendor).toBe("apple");
    expect(profile.primary?.unifiedMemory).toBe(true);
    expect(profile.primary?.vramBytes).toBe(unifiedMemoryBudgetBytes(48 * 1024 * MIB));
  });

  it("never throws when a probe fails; degrades to warnings + no devices", () => {
    const io: DetectIo = {
      windowsDisplayCsv: () => {
        throw new Error("powershell blocked by policy");
      },
    };
    const profile = detectGpuProfile(baseEnv, io);
    expect(profile.devices).toEqual([]);
    expect(profile.primary).toBeUndefined();
    expect(profile.warnings.length).toBeGreaterThan(0);
  });

  it("warns when VRAM cannot be read accurately", () => {
    const io: DetectIo = {
      windowsDisplayCsv: () =>
        '"Name","PNPDeviceID","DriverVersion","AdapterRAM"\n' +
        '"NVIDIA GeForce RTX 4090","PCI\\VEN_10DE&DEV_2684","32.0.15","4293918720"\n',
      // no registry, no nvidia-smi -> VRAM unknown
    };
    const profile = detectGpuProfile(baseEnv, io);
    expect(profile.primary?.vramBytes).toBeUndefined();
    expect(profile.warnings.join(" ")).toMatch(/vram|memory/i);
  });
});

describe("parseSystemProfiler / parseLspci", () => {
  it("parses an Apple GPU from system_profiler json", () => {
    const json = JSON.stringify({
      SPDisplaysDataType: [{ sppci_model: "Apple M3 Max", spdisplays_vendor: "Apple" }],
    });
    expect(parseSystemProfiler(json)[0]).toMatchObject({ vendor: "apple", name: "Apple M3 Max" });
  });

  it("parses an NVIDIA GPU from lspci", () => {
    const out =
      "01:00.0 VGA compatible controller [0300]: NVIDIA Corporation AD102 [GeForce RTX 4090] [10de:2684]\n";
    expect(parseLspci(out)[0]).toMatchObject({ vendor: "nvidia", vendorId: "10DE" });
  });
});
