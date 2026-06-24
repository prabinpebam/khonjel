/**
 * Functional backend probe IO (composition glue). Spawns the freshly provisioned GPU engine and
 * proves it actually runs on THIS machine before activation: llama-server must start and serve a
 * token; whisper-cli must run a tiny clip without crashing. Any failure resolves ok:false so the
 * manager rolls back to the CPU floor (the floor never disappears). The probe DECISION logic is PURE
 * and tested in probe.ts; this is the fs/child-process edge (mirrors inference/runtime.ts), so it
 * carries no unit tests.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { startLlamaServer, type LlamaServerHandle } from "../inference/llama-server";
import { createLlamaEngine } from "../inference/llama";
import { probeLlm, probeStt, type LlmProbeIo, type ProbeResult, type SttProbeIo } from "./probe";
import { plannedGpuLayers } from "./active-backend";
import type { AccelerationEngine, Backend, GpuProfile } from "../../../src/services/ports";

export interface ProbeBackendInput {
  engine: AccelerationEngine;
  backend: Backend;
  /** Install dir of the provisioned backend (`<runtimeDir>/<engine>/<backend>-<version>`). */
  dir: string;
  modelsDir: string;
  isWindows: boolean;
  profile: GpuProfile;
}

function firstMatch(dir: string, re: RegExp): string | undefined {
  try {
    const hit = readdirSync(dir).find((f) => re.test(f));
    return hit ? join(dir, hit) : undefined;
  } catch {
    return undefined;
  }
}

function sizeOf(p: string): number {
  try {
    return statSync(p).size;
  } catch {
    return 0;
  }
}

export async function probeBackend(input: ProbeBackendInput): Promise<ProbeResult> {
  return input.engine === "llama" ? probeLlamaBackend(input) : probeWhisperBackend(input);
}

async function probeLlamaBackend(input: ProbeBackendInput): Promise<ProbeResult> {
  const exe = input.isWindows ? "llama-server.exe" : "llama-server";
  const binPath = join(input.dir, exe);
  const modelPath = firstMatch(input.modelsDir, /\.gguf$/i);
  if (!existsSync(binPath) || !modelPath) {
    return { ok: false, backend: input.backend, failCode: "missing-files", message: "No language model is installed to test with." };
  }
  const ngl = plannedGpuLayers({ profile: input.profile, modelBytes: sizeOf(modelPath) });
  const apiKey = randomUUID();
  const port = 8100 + Math.floor(Math.random() * 800);
  let handle: LlamaServerHandle | undefined;
  const io: LlmProbeIo = {
    start: async () => {
      try {
        handle = await startLlamaServer({ binPath, modelPath, gpuLayers: ngl, apiKey, port }, 60_000);
        return { ok: true };
      } catch {
        return { ok: false };
      }
    },
    oneToken: async () => {
      if (!handle) return { tokenReturned: false };
      try {
        const out = await createLlamaEngine({ endpoint: handle.endpoint, apiKey }).refine("Hello");
        return { tokenReturned: typeof out === "string" && out.length > 0 };
      } catch {
        return { tokenReturned: false };
      }
    },
    // Lenient: a GPU build that launched with -ngl and served a token is trusted to be offloading.
    // The hard failures (missing CUDA/Vulkan DLLs, old driver, a crash) make start() fail above.
    offloadedLayers: async () => ngl,
    stderr: () => "",
    stop: () => handle?.stop(),
  };
  return probeLlm(input.backend, ngl > 0, io);
}

async function probeWhisperBackend(input: ProbeBackendInput): Promise<ProbeResult> {
  const names = input.isWindows ? ["whisper-cli.exe", "main.exe"] : ["whisper-cli", "main"];
  const binPath = [input.dir, join(input.dir, "Release")]
    .flatMap((d) => names.map((n) => join(d, n)))
    .find((p) => existsSync(p));
  const modelPath = firstMatch(input.modelsDir, /^ggml-.*\.bin$/i);
  if (!binPath || !modelPath) {
    return { ok: false, backend: input.backend, failCode: "missing-files", message: "No voice model is installed to test with." };
  }
  const wav = writeSilenceWav();
  const io: SttProbeIo = {
    run: async () => {
      try {
        execFileSync(binPath, ["-m", modelPath, "-f", wav, "-nt", "-np"], {
          encoding: "utf8",
          windowsHide: true,
          timeout: 60_000,
        });
        // A clean exit means the GPU build loaded its model + GPU libraries and ran on this machine.
        return { exitCode: 0, output: "ok" };
      } catch {
        return { exitCode: 1, output: "" };
      } finally {
        try {
          rmSync(wav, { force: true });
        } catch {
          // best-effort temp cleanup
        }
      }
    },
    stderr: () => "",
  };
  return probeStt(input.backend, io);
}

/** A ~0.3s 16 kHz mono 16-bit silent WAV: enough for whisper-cli to load its model + GPU libraries. */
function writeSilenceWav(): string {
  const sampleRate = 16_000;
  const dataBytes = Math.floor(sampleRate * 0.3) * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buf.writeUInt16LE(2, 32); // block align
  buf.writeUInt16LE(16, 34); // bits per sample
  buf.write("data", 36);
  buf.writeUInt32LE(dataBytes, 40);
  const file = join(tmpdir(), `khonjel-probe-${randomUUID()}.wav`);
  writeFileSync(file, buf);
  return file;
}
