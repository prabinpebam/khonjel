/**
 * Mic recorder for dictation. Captures the selected microphone via the Web Audio API and yields a
 * base64 16kHz-mono WAV (what the transcription IPC expects). Runtime-only (navigator/AudioContext);
 * the WAV math it relies on is unit-tested in wav.ts. Works in the browser and in Electron's
 * Chromium renderer.
 */
import { encodeWavBase64, downsampleTo16k, floatTo16BitPCM, bytesToBase64 } from "./wav";
import { AutoGain, applyGainLimited } from "./agc";

export interface Recorder {
  /** Stop capture and resolve a base64 16kHz mono WAV of everything recorded (empty in streaming mode). */
  stop: () => Promise<string>;
  /** Stop capture and discard (no transcription). */
  cancel: () => void;
}

export interface RecordingOptions {
  /** Specific input device id. Empty/"default" captures the system default microphone. */
  deviceId?: string;
  /** Called ~per audio block with a normalized 0..1 level (post auto-gain) for a live meter/waveform. */
  onLevel?: (level: number) => void;
  /**
   * Auto gain control (default on): normalize the captured level so quiet and loud speakers both land
   * at a healthy volume, with a soft limiter that prevents the recorded audio from clipping. When off,
   * fall back to the browser's built-in AGC and leave the samples untouched.
   */
  autoGain?: boolean;
  /**
   * Streaming mode (12 §2A): called ~4x/s with a base64 batch of 16 kHz mono 16-bit PCM frames. When
   * set, the recorder does NOT accumulate the whole session (bounded memory) and `stop()` returns "".
   */
  onChunk?: (base64Pcm16: string) => void;
}

/**
 * Resolve which input device to capture. An explicit (non-default) `micDevice` wins; otherwise, when
 * `preferBuiltIn` is set, pick the first built-in-looking input; else the system default (undefined).
 * Device labels are only populated once mic permission is granted, so this degrades to the default.
 */
export async function resolveMicDeviceId(
  micDevice: string,
  preferBuiltIn: boolean,
): Promise<string | undefined> {
  if (micDevice && micDevice !== "default") return micDevice;
  if (preferBuiltIn && navigator.mediaDevices?.enumerateDevices) {
    try {
      const inputs = (await navigator.mediaDevices.enumerateDevices()).filter(
        (d) => d.kind === "audioinput",
      );
      const builtin = inputs.find((d) => /built.?in|internal|macbook/i.test(d.label));
      if (builtin) return builtin.deviceId;
    } catch {
      // permission not granted yet -> fall back to the system default
    }
  }
  return undefined;
}

/** Race a promise against a timeout so a silent getUserMedia hang surfaces as a clear error. */
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Open the microphone, resiliently. Two failure modes that otherwise leave the bar stuck on
 * "Click to dictate" are handled here: (1) a silent getUserMedia hang (e.g. Windows microphone
 * access is blocked) is capped by a timeout so the caller shows an actionable error; (2) a
 * previously-selected device that is now unplugged/busy/renamed falls back to the system default
 * rather than failing dictation outright.
 */
async function acquireMicStream(base: MediaTrackConstraints, deviceId?: string): Promise<MediaStream> {
  const message =
    "Microphone didn't start. Check that microphone access is allowed (Windows Settings > Privacy > Microphone) and that no other app is using it.";
  const open = (constraints: MediaTrackConstraints) =>
    withTimeout(navigator.mediaDevices.getUserMedia({ audio: constraints }), 12_000, message);
  if (!deviceId) return open(base);
  try {
    return await open({ ...base, deviceId: { exact: deviceId } });
  } catch (err) {
    // The chosen mic is unavailable: fall back to the default so a stale selection can't break dictation.
    console.warn("[dictation] selected microphone unavailable; falling back to the default device.", err);
    return open(base);
  }
}

export async function startRecording(opts: RecordingOptions = {}): Promise<Recorder> {
  // Our software AGC owns the gain; let the browser's AGC step aside so they do not fight. When our
  // AGC is disabled, fall back to the browser's built-in auto gain.
  const softwareAgc = opts.autoGain !== false;
  const audio: MediaTrackConstraints = {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: !softwareAgc,
  };
  const wantsSpecificDevice = Boolean(opts.deviceId && opts.deviceId !== "default");
  const stream = await acquireMicStream(audio, wantsSpecificDevice ? opts.deviceId : undefined);
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtor();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const streaming = typeof opts.onChunk === "function";
  const chunks: Float32Array[] = []; // legacy (non-streaming) accumulation only
  let pcmBatch: Int16Array[] = []; // streaming: batched 16k PCM awaiting flush
  let batchLen = 0;
  const BATCH_SAMPLES = 4000; // ~250 ms at 16 kHz
  // Auto gain runs continuously so the meter is always normalized (no visual clipping); whether the
  // gain is applied to the recorded samples depends on `softwareAgc`.
  const agc = new AutoGain();

  const flushBatch = () => {
    if (batchLen === 0 || !opts.onChunk) return;
    const merged = new Int16Array(batchLen);
    let offset = 0;
    for (const c of pcmBatch) {
      merged.set(c, offset);
      offset += c.length;
    }
    pcmBatch = [];
    batchLen = 0;
    opts.onChunk(bytesToBase64(new Uint8Array(merged.buffer, 0, merged.byteLength)));
  };

  processor.onaudioprocess = (event) => {
    const block = event.inputBuffer.getChannelData(0);
    // Advance the auto-gain and surface a normalized 0..1 level for the waveform.
    const { gain, level } = agc.process(block);
    if (opts.onLevel) opts.onLevel(level);
    // A fresh, gain-normalized (and soft-limited, so non-clipping) copy of the block for downstream.
    // The limiter caps peaks below 1.0 even on a sudden shout, so the recording never hard-clips.
    const samples = softwareAgc ? applyGainLimited(block, gain) : new Float32Array(block);
    if (streaming) {
      // Downsample + quantize each block immediately and stream it; never hold the whole session.
      const i16 = floatTo16BitPCM(downsampleTo16k(samples, ctx.sampleRate));
      pcmBatch.push(i16);
      batchLen += i16.length;
      if (batchLen >= BATCH_SAMPLES) flushBatch();
    } else {
      // `samples` is already a copy, safe to retain (the input buffer is reused across callbacks).
      chunks.push(samples);
    }
  };
  source.connect(processor);
  // ScriptProcessor only fires while connected to the graph; we never write its output, so the
  // destination receives silence (no mic echo).
  processor.connect(ctx.destination);

  const teardown = () => {
    processor.onaudioprocess = null;
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((track) => track.stop());
    void ctx.close();
  };

  return {
    stop: async () => {
      if (streaming) {
        flushBatch();
        teardown();
        return "";
      }
      const rate = ctx.sampleRate;
      teardown();
      const total = chunks.reduce((n, c) => n + c.length, 0);
      const pcm = new Float32Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        pcm.set(chunk, offset);
        offset += chunk.length;
      }
      return encodeWavBase64(pcm, rate);
    },
    cancel: teardown,
  };
}
