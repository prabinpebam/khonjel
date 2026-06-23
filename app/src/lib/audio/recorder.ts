/**
 * Mic recorder for dictation. Captures the selected microphone via the Web Audio API and yields a
 * base64 16kHz-mono WAV (what the transcription IPC expects). Runtime-only (navigator/AudioContext);
 * the WAV math it relies on is unit-tested in wav.ts. Works in the browser and in Electron's
 * Chromium renderer.
 */
import { encodeWavBase64, downsampleTo16k, floatTo16BitPCM, bytesToBase64 } from "./wav";

export interface Recorder {
  /** Stop capture and resolve a base64 16kHz mono WAV of everything recorded (empty in streaming mode). */
  stop: () => Promise<string>;
  /** Stop capture and discard (no transcription). */
  cancel: () => void;
}

export interface RecordingOptions {
  /** Specific input device id. Empty/"default" captures the system default microphone. */
  deviceId?: string;
  /** Called ~per audio block with the current RMS level (0..1) for a live meter/waveform. */
  onLevel?: (level: number) => void;
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

export async function startRecording(opts: RecordingOptions = {}): Promise<Recorder> {
  const audio: MediaTrackConstraints = {
    channelCount: 1,
    echoCancellation: true,
    noiseSuppression: true,
  };
  if (opts.deviceId && opts.deviceId !== "default") audio.deviceId = { exact: opts.deviceId };
  const stream = await navigator.mediaDevices.getUserMedia({ audio });
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
    if (opts.onLevel) {
      let sum = 0;
      for (let i = 0; i < block.length; i++) {
        const v = block[i] ?? 0;
        sum += v * v;
      }
      opts.onLevel(Math.sqrt(sum / block.length));
    }
    if (streaming) {
      // Downsample + quantize each block immediately and stream it; never hold the whole session.
      const i16 = floatTo16BitPCM(downsampleTo16k(new Float32Array(block), ctx.sampleRate));
      pcmBatch.push(i16);
      batchLen += i16.length;
      if (batchLen >= BATCH_SAMPLES) flushBatch();
    } else {
      // Copy: the underlying buffer is reused across callbacks.
      chunks.push(new Float32Array(block));
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
