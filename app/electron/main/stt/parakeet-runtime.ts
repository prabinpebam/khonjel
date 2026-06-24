/**
 * Parakeet runtime resolver (composition glue): finds the sherpa-onnx binary + the model directory
 * and builds a real `Transcriber`, preferring the persistent warm server and falling back to the
 * one-shot CLI. Returns undefined when Parakeet is not set up, so the transcription service reports
 * `model_unavailable` instead of crashing (mirrors stt/runtime.ts for whisper).
 *
 * Resolution (env overrides win):
 *   - binary: KHONJEL_SHERPA_BIN | <userData>/runtime/parakeet[/bin] | <appDir>/vendor/parakeet[/bin]
 *   - model:  KHONJEL_PARAKEET_MODEL_DIR | a dir under <userData>/models or <appDir>/models holding
 *             encoder.*.onnx + decoder.*.onnx + joiner.*.onnx + tokens.txt
 *   - runtime: prefer `sherpa-onnx-offline-websocket-server` (warm, model resident); else the
 *             one-shot `sherpa-onnx-offline`; missing binary/model -> undefined.
 *
 * The resolution + server-vs-CLI preference are PURE (injected `exists`/`listDir`/factories,
 * BE1-tested). The real fs + the spawn/websocket transport are wired by `nodeParakeetRuntimeDeps`
 * (composition glue), with the one-shot CLI always supplied as the warm server's fallback so a
 * transcript is produced even if the websocket protocol needs tuning against a specific build.
 */
import { execFile, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer, connect } from "node:net";
import { dirname, join } from "node:path";
import { createParakeetTranscriber, type ParakeetModelDir } from "./parakeet";
import { createParakeetServerTranscriber, type StoppableTranscriber } from "./parakeet-server";
import type { Transcriber } from "./whisper";

export interface ParakeetRuntimeConfig {
  userDataDir: string;
  appDir: string;
  isWindows: boolean;
  env: Record<string, string | undefined>;
  /** Provider passed to sherpa (`--provider`); "cuda" only when a GPU backend is active + probed. */
  provider?: "cpu" | "cuda";
}

export interface ParakeetRuntimeDeps {
  exists: (path: string) => boolean;
  listDir: (dir: string) => string[];
  makeCli: (o: { binPath: string; model: ParakeetModelDir }) => Transcriber;
  makeServer: (o: { serverBinPath: string; model: ParakeetModelDir }) => StoppableTranscriber;
}

function binDirs(cfg: ParakeetRuntimeConfig): string[] {
  return [
    cfg.env.KHONJEL_SHERPA_BIN,
    join(cfg.userDataDir, "runtime", "parakeet"),
    join(cfg.userDataDir, "runtime", "parakeet", "bin"),
    join(cfg.appDir, "vendor", "parakeet"),
    join(cfg.appDir, "vendor", "parakeet", "bin"),
  ].filter((p): p is string => Boolean(p));
}

function findBin(cfg: ParakeetRuntimeConfig, deps: ParakeetRuntimeDeps, baseName: string): string | undefined {
  const name = cfg.isWindows ? `${baseName}.exe` : baseName;
  for (const dir of binDirs(cfg)) {
    const candidate = join(dir, name);
    if (deps.exists(candidate)) return candidate;
  }
  return undefined;
}

/** The four model parts in `dir`, or undefined when any is missing. */
function resolveModelParts(dir: string, deps: ParakeetRuntimeDeps): ParakeetModelDir | undefined {
  const files = deps.listDir(dir);
  const find = (re: RegExp): string | undefined => files.find((f) => re.test(f));
  const encoder = find(/^encoder.*\.onnx$/i);
  const decoder = find(/^decoder.*\.onnx$/i);
  const joiner = find(/^joiner.*\.onnx$/i);
  const tokens = find(/^tokens\.txt$/i);
  if (!encoder || !decoder || !joiner || !tokens) return undefined;
  return {
    encoder: join(dir, encoder),
    decoder: join(dir, decoder),
    joiner: join(dir, joiner),
    tokens: join(dir, tokens),
  };
}

function findModel(cfg: ParakeetRuntimeConfig, deps: ParakeetRuntimeDeps): ParakeetModelDir | undefined {
  const override = cfg.env.KHONJEL_PARAKEET_MODEL_DIR;
  if (override) return resolveModelParts(override, deps);
  for (const root of [join(cfg.userDataDir, "models"), join(cfg.appDir, "models")]) {
    for (const name of deps.listDir(root)) {
      const parts = resolveModelParts(join(root, name), deps);
      if (parts) return parts;
    }
  }
  return undefined;
}

export function resolveParakeetTranscriber(
  cfg: ParakeetRuntimeConfig,
  deps: ParakeetRuntimeDeps,
): Transcriber | undefined {
  const model = findModel(cfg, deps);
  if (!model) return undefined;
  const serverBin = findBin(cfg, deps, "sherpa-onnx-offline-websocket-server");
  if (serverBin) return deps.makeServer({ serverBinPath: serverBin, model });
  const cliBin = findBin(cfg, deps, "sherpa-onnx-offline");
  if (cliBin) return deps.makeCli({ binPath: cliBin, model });
  return undefined;
}

export interface ParakeetProviderDeps {
  listDir: (dir: string) => string[];
  hasNvidiaGpu: () => boolean;
}

/**
 * Pick the sherpa `--provider`. CUDA only when an NVIDIA GPU is present AND a CUDA provider / cuDNN
 * library sits beside the binary (the CUDA sherpa build); CPU is always the floor (real-time int8).
 * The KHONJEL_PARAKEET_PROVIDER env var overrides. PURE (injected `listDir` + GPU presence) so the
 * gate is BE1-tested; the GPU acceleration manager can drive this later via the same env override.
 */
export function resolveParakeetProvider(
  cfg: ParakeetRuntimeConfig,
  deps: ParakeetProviderDeps,
): "cpu" | "cuda" {
  const override = cfg.env.KHONJEL_PARAKEET_PROVIDER;
  if (override === "cuda" || override === "cpu") return override;
  if (!deps.hasNvidiaGpu()) return "cpu";
  const cudaLib = /onnxruntime.*cuda|cudnn|cublas/i;
  for (const dir of binDirs(cfg)) {
    if (deps.listDir(dir).some((f) => cudaLib.test(f))) return "cuda";
  }
  return "cpu";
}

// ---- Node composition glue (not BE1-tested; the wrapper LOGIC it composes is) ----

function execFileRun(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 64 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Reserve a free loopback port for the warm server. */
function pickFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = addr && typeof addr === "object" ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

function canConnect(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = connect(port, "127.0.0.1");
    const finish = (ok: boolean): void => {
      sock.destroy();
      resolve(ok);
    };
    sock.once("connect", () => finish(true));
    sock.once("error", () => finish(false));
  });
}

async function startServerProcess(binPath: string, args: string[], port: number): Promise<{ port: number; stop: () => void }> {
  const child = spawn(binPath, args, { stdio: "ignore", windowsHide: true });
  let exited = false;
  child.on("exit", () => {
    exited = true;
  });
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (exited) throw new Error("sherpa websocket server exited before becoming ready");
    if (await canConnect(port)) return { port, stop: () => child.kill() };
    await sleep(300);
  }
  child.kill();
  throw new Error("sherpa websocket server did not become ready");
}

/** Minimal WAV (canonical 16 kHz mono PCM16, as Khonjel emits) -> normalized Float32 samples. */
function wavPcm16ToFloat32(path: string): Float32Array {
  const buf = readFileSync(path);
  let offset = 12; // skip "RIFF"<size>"WAVE"
  let dataOffset = 44;
  let dataLen = Math.max(0, buf.length - 44);
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "data") {
      dataOffset = offset + 8;
      dataLen = size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  const count = Math.floor(dataLen / 2);
  const out = new Float32Array(count);
  for (let i = 0; i < count; i += 1) out[i] = buf.readInt16LE(dataOffset + i * 2) / 32768;
  return out;
}

interface MinimalWebSocket {
  binaryType: string;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: string | ArrayBuffer }) => void) | null;
  onerror: (() => void) | null;
  send: (data: ArrayBufferView | ArrayBuffer) => void;
  close: () => void;
}

/**
 * Send 16 kHz mono PCM to the sherpa offline websocket server and resolve its JSON result line.
 * Best-effort framing (int32 sample count + float32 LE samples); the exact protocol is sherpa-build
 * specific, so any failure here is caught by the one-shot CLI fallback wired in `makeServer`.
 */
function sendOverWebSocket(port: number, wavPath: string): Promise<string> {
  const ctor = (globalThis as unknown as { WebSocket?: new (url: string) => MinimalWebSocket }).WebSocket;
  if (!ctor) return Promise.reject(new Error("WebSocket is unavailable in this runtime"));
  return new Promise((resolve, reject) => {
    const samples = wavPcm16ToFloat32(wavPath);
    const ws = new ctor(`ws://127.0.0.1:${port}/`);
    ws.binaryType = "arraybuffer";
    let settled = false;
    const close = (): void => {
      try {
        ws.close();
      } catch {
        /* best-effort close */
      }
    };
    ws.onopen = () => {
      const header = Buffer.alloc(4);
      header.writeInt32LE(samples.length, 0);
      ws.send(header);
      ws.send(Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength));
    };
    ws.onmessage = (ev) => {
      if (settled) return;
      settled = true;
      const text = typeof ev.data === "string" ? ev.data : Buffer.from(ev.data).toString("utf8");
      close();
      resolve(text);
    };
    ws.onerror = () => {
      if (settled) return;
      settled = true;
      close();
      reject(new Error("sherpa websocket error"));
    };
    setTimeout(() => {
      if (settled) return;
      settled = true;
      close();
      reject(new Error("sherpa websocket timeout"));
    }, 30_000);
  });
}

/** Real fs + spawn/websocket transport for the resolver. */
export function nodeParakeetRuntimeDeps(cfg: ParakeetRuntimeConfig): ParakeetRuntimeDeps {
  return {
    exists: (p) => existsSync(p),
    listDir: (d) => {
      try {
        return readdirSync(d);
      } catch {
        return [];
      }
    },
    makeCli: ({ binPath, model }) =>
      createParakeetTranscriber({ binPath, model, run: execFileRun, provider: cfg.provider }),
    makeServer: ({ serverBinPath, model }) => {
      const cliName = cfg.isWindows ? "sherpa-onnx-offline.exe" : "sherpa-onnx-offline";
      const cliBin = join(dirname(serverBinPath), cliName);
      const fallback = existsSync(cliBin)
        ? createParakeetTranscriber({ binPath: cliBin, model, run: execFileRun, provider: cfg.provider })
        : undefined;
      return createParakeetServerTranscriber({
        binPath: serverBinPath,
        model,
        provider: cfg.provider,
        deps: { pickPort: pickFreePort, start: startServerProcess, send: sendOverWebSocket },
        fallback,
      });
    },
  };
}

/** Convenience: resolve a real Parakeet transcriber from config (the composition root uses this). */
export function resolveNodeParakeetTranscriber(cfg: ParakeetRuntimeConfig): Transcriber | undefined {
  return resolveParakeetTranscriber(cfg, nodeParakeetRuntimeDeps(cfg));
}

/** Convenience: pick the sherpa provider from real fs + a detected NVIDIA-GPU flag. */
export function resolveNodeParakeetProvider(cfg: ParakeetRuntimeConfig, hasNvidiaGpu: boolean): "cpu" | "cuda" {
  return resolveParakeetProvider(cfg, {
    listDir: (d) => {
      try {
        return readdirSync(d);
      } catch {
        return [];
      }
    },
    hasNvidiaGpu: () => hasNvidiaGpu,
  });
}
