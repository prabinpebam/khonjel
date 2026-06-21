/**
 * Whisper runtime resolver (composition glue): finds the whisper-cli binary + a ggml model and
 * builds a real Transcriber backed by `execFile`. Returns undefined when STT is not set up, so the
 * transcription service reports `model_unavailable` instead of crashing.
 *
 * Resolution (env overrides win):
 *   - binary: KHONJEL_WHISPER_BIN | <userData>/runtime/whisper/ | <appDir>/vendor/whisper/
 *   - model:  KHONJEL_WHISPER_MODEL | first ggml-*.bin in <userData>/models or <appDir>/models
 * Composition glue (fs/child-process); the wrapper LOGIC it composes is BE1-tested in whisper.ts.
 */
import { execFile } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createWhisperTranscriber, type Transcriber } from "./whisper";

export interface WhisperRuntimeConfig {
  userDataDir: string;
  appDir: string;
  isWindows: boolean;
  env: Record<string, string | undefined>;
}

function firstGgmlBin(dirs: string[]): string | undefined {
  for (const dir of dirs) {
    try {
      const hit = readdirSync(dir).find((f) => /^ggml-.*\.bin$/i.test(f));
      if (hit) return join(dir, hit);
    } catch {
      // missing dir
    }
  }
  return undefined;
}

function execFileRun(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

export function resolveTranscriber(cfg: WhisperRuntimeConfig): Transcriber | undefined {
  const names = cfg.isWindows ? ["whisper-cli.exe", "main.exe"] : ["whisper-cli", "main"];
  // The whisper.cpp Windows zip nests its binaries under Release/; support both layouts.
  const dirs = [
    join(cfg.userDataDir, "runtime", "whisper"),
    join(cfg.userDataDir, "runtime", "whisper", "Release"),
    join(cfg.appDir, "vendor", "whisper"),
    join(cfg.appDir, "vendor", "whisper", "Release"),
  ];
  const binCandidates = [
    cfg.env.KHONJEL_WHISPER_BIN,
    ...dirs.flatMap((dir) => names.map((n) => join(dir, n))),
  ].filter((p): p is string => Boolean(p));
  const binPath = binCandidates.find((p) => existsSync(p));
  if (!binPath) return undefined;

  const modelPath =
    cfg.env.KHONJEL_WHISPER_MODEL ??
    firstGgmlBin([join(cfg.userDataDir, "models"), join(cfg.appDir, "models")]);
  if (!modelPath || !existsSync(modelPath)) return undefined;

  return createWhisperTranscriber({ binPath, modelPath, run: execFileRun });
}
