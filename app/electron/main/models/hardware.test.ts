// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseWindowsGpuCsv } from "./hardware";

describe("parseWindowsGpuCsv", () => {
  it("parses NVIDIA GPU name, vendor, VRAM and driver version", () => {
    const gpus = parseWindowsGpuCsv('Name,AdapterRAM,DriverVersion\n"NVIDIA GeForce RTX 4090",25757220864,32.0.15.7652\n');
    expect(gpus).toEqual([
      {
        name: "NVIDIA GeForce RTX 4090",
        vendor: "nvidia",
        vramBytes: 25757220864,
        driverVersion: "32.0.15.7652",
      },
    ]);
  });

  it("handles empty or malformed GPU output gracefully", () => {
    expect(parseWindowsGpuCsv("")).toEqual([]);
    expect(parseWindowsGpuCsv("not,csv\n")).toEqual([]);
  });
});
