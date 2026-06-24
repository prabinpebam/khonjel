// @vitest-environment node
import { describe, it, expect } from "vitest";
import { join } from "node:path";
import {
  resolveParakeetTranscriber,
  resolveParakeetProvider,
  type ParakeetRuntimeDeps,
} from "./parakeet-runtime";
import type { ParakeetModelDir } from "./parakeet";
import type { Transcriber } from "./whisper";

const CLI: Transcriber = { transcribe: async () => "cli" };
const SERVER = { transcribe: async () => "server", stop: () => undefined };

const CFG = { userDataDir: "/u", appDir: "/a", isWindows: false, env: {} as Record<string, string | undefined> };

const PARTS = ["encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt"];

// Build every path with join() so the constants match what the resolver computes on any OS.
const VENDOR = join("/a", "vendor", "parakeet");
const CLI_BIN = join(VENDOR, "sherpa-onnx-offline");
const CLI_BIN_EXE = join(VENDOR, "sherpa-onnx-offline.exe");
const SERVER_BIN = join(VENDOR, "sherpa-onnx-offline-websocket-server");
const MODELS = join("/a", "models");
const MDL = join(MODELS, "mdl");

function makeDeps(
  existing: Set<string>,
  dirFiles: Record<string, string[]> = {},
): {
  deps: ParakeetRuntimeDeps;
  cli: { binPath: string; model: ParakeetModelDir }[];
  server: { serverBinPath: string; model: ParakeetModelDir }[];
} {
  const cli: { binPath: string; model: ParakeetModelDir }[] = [];
  const server: { serverBinPath: string; model: ParakeetModelDir }[] = [];
  return {
    cli,
    server,
    deps: {
      exists: (p) => existing.has(p),
      listDir: (d) => dirFiles[d] ?? [],
      makeCli: (o) => {
        cli.push(o);
        return CLI;
      },
      makeServer: (o) => {
        server.push(o);
        return SERVER;
      },
    },
  };
}

describe("resolveParakeetTranscriber", () => {
  it("uses the warm server when opted in (KHONJEL_PARAKEET_SERVER=1) and present", async () => {
    const env = { KHONJEL_PARAKEET_SERVER: "1" };
    const { deps, server, cli } = makeDeps(new Set([CLI_BIN, SERVER_BIN]), {
      [MODELS]: ["mdl"],
      [MDL]: PARTS,
    });
    const t = resolveParakeetTranscriber({ ...CFG, env }, deps);
    expect(await t?.transcribe("/x.wav")).toBe("server");
    expect(server).toHaveLength(1);
    expect(cli).toHaveLength(0);
    expect(server[0]?.model.encoder).toBe(join(MDL, "encoder.int8.onnx"));
  });

  it("defaults to the one-shot CLI even when the server binary is present (warm server is opt-in)", async () => {
    const { deps, server, cli } = makeDeps(new Set([CLI_BIN, SERVER_BIN]), {
      [MODELS]: ["mdl"],
      [MDL]: PARTS,
    });
    const t = resolveParakeetTranscriber(CFG, deps);
    expect(await t?.transcribe("/x.wav")).toBe("cli");
    expect(cli).toHaveLength(1);
    expect(server).toHaveLength(0);
  });

  it("falls back to the one-shot CLI when only the offline binary is present", async () => {
    const { deps, server, cli } = makeDeps(new Set([CLI_BIN]), { [MODELS]: ["mdl"], [MDL]: PARTS });
    const t = resolveParakeetTranscriber(CFG, deps);
    expect(await t?.transcribe("/x.wav")).toBe("cli");
    expect(cli).toHaveLength(1);
    expect(server).toHaveLength(0);
  });

  it("returns undefined when the model is incomplete (a part is missing)", () => {
    const { deps } = makeDeps(new Set([CLI_BIN]), {
      [MODELS]: ["mdl"],
      [MDL]: ["encoder.int8.onnx", "tokens.txt"], // decoder + joiner missing
    });
    expect(resolveParakeetTranscriber(CFG, deps)).toBeUndefined();
  });

  it("returns undefined when no binary is present", () => {
    const { deps } = makeDeps(new Set(), { [MODELS]: ["mdl"], [MDL]: PARTS });
    expect(resolveParakeetTranscriber(CFG, deps)).toBeUndefined();
  });

  it("honors KHONJEL_SHERPA_BIN as the binary directory (env wins over vendor)", async () => {
    const env = { KHONJEL_SHERPA_BIN: "/custom" };
    const customCli = join("/custom", "sherpa-onnx-offline");
    const { deps, cli } = makeDeps(new Set([customCli, CLI_BIN]), { [MODELS]: ["mdl"], [MDL]: PARTS });
    const t = resolveParakeetTranscriber({ ...CFG, env }, deps);
    expect(await t?.transcribe("/x.wav")).toBe("cli");
    expect(cli[0]?.binPath).toBe(customCli);
  });

  it("honors KHONJEL_PARAKEET_MODEL_DIR as an explicit model directory", () => {
    const env = { KHONJEL_PARAKEET_MODEL_DIR: "/mymodel" };
    const { deps, cli } = makeDeps(new Set([CLI_BIN]), {
      "/mymodel": PARTS,
    });
    resolveParakeetTranscriber({ ...CFG, env }, deps);
    expect(cli[0]?.model.tokens).toBe(join("/mymodel", "tokens.txt"));
  });

  it("appends .exe to the binary names on Windows", async () => {
    const { deps, cli } = makeDeps(new Set([CLI_BIN_EXE]), { [MODELS]: ["mdl"], [MDL]: PARTS });
    const t = resolveParakeetTranscriber({ ...CFG, isWindows: true }, deps);
    expect(await t?.transcribe("/x.wav")).toBe("cli");
    expect(cli[0]?.binPath).toBe(CLI_BIN_EXE);
  });
});

describe("resolveParakeetProvider", () => {
  const providerDeps = (dirFiles: Record<string, string[]>, hasGpu: boolean) => ({
    listDir: (d: string) => dirFiles[d] ?? [],
    hasNvidiaGpu: () => hasGpu,
  });

  it("honors the KHONJEL_PARAKEET_PROVIDER override (cuda) regardless of hardware", () => {
    const env = { KHONJEL_PARAKEET_PROVIDER: "cuda" };
    expect(resolveParakeetProvider({ ...CFG, env }, providerDeps({}, false))).toBe("cuda");
  });

  it("honors the override (cpu) even when CUDA libs + an NVIDIA GPU are present", () => {
    const env = { KHONJEL_PARAKEET_PROVIDER: "cpu" };
    const deps = providerDeps({ [VENDOR]: ["onnxruntime_providers_cuda.dll"] }, true);
    expect(resolveParakeetProvider({ ...CFG, env }, deps)).toBe("cpu");
  });

  it("selects cuda when an NVIDIA GPU + a CUDA provider library sit beside the binary", () => {
    const deps = providerDeps({ [VENDOR]: ["sherpa-onnx-offline", "onnxruntime_providers_cuda.dll"] }, true);
    expect(resolveParakeetProvider(CFG, deps)).toBe("cuda");
  });

  it("falls back to cpu (the floor) when no CUDA library is present", () => {
    const deps = providerDeps({ [VENDOR]: ["sherpa-onnx-offline"] }, true);
    expect(resolveParakeetProvider(CFG, deps)).toBe("cpu");
  });

  it("falls back to cpu when there is no NVIDIA GPU, even with CUDA libs present", () => {
    const deps = providerDeps({ [VENDOR]: ["onnxruntime_providers_cuda.dll"] }, false);
    expect(resolveParakeetProvider(CFG, deps)).toBe("cpu");
  });
});
