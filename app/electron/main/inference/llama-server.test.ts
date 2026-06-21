// @vitest-environment node
import { describe, it, expect } from "vitest";
import { buildServerArgs } from "./llama-server";

describe("buildServerArgs", () => {
  it("includes the model path, host, and port", () => {
    const args = buildServerArgs({ binPath: "x", modelPath: "/m/model.gguf" });
    expect(args[args.indexOf("-m") + 1]).toBe("/m/model.gguf");
    expect(args).toContain("--host");
    expect(args).toContain("--port");
  });

  it("adds context size and gpu layers when provided", () => {
    const args = buildServerArgs({ binPath: "x", modelPath: "m", ctxSize: 4096, gpuLayers: 20 });
    expect(args.join(" ")).toContain("-c 4096");
    expect(args.join(" ")).toContain("-ngl 20");
  });

  it("omits optional flags when not provided", () => {
    const args = buildServerArgs({ binPath: "x", modelPath: "m" });
    expect(args).not.toContain("-c");
    expect(args).not.toContain("-ngl");
  });
});
