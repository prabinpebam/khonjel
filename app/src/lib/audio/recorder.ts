/**
 * Mic recorder for dictation. Captures the selected microphone via the Web Audio API and yields a
 * base64 16kHz-mono WAV (what the transcription IPC expects). Runtime-only (navigator/AudioContext);
 * the WAV math it relies on is unit-tested in wav.ts. Works in the browser and in Electron's
 * Chromium renderer.
 */
import { encodeWavBase64 } from "./wav";

export interface Recorder {
  /** Stop capture and resolve a base64 16kHz mono WAV of everything recorded. */
  stop: () => Promise<string>;
  /** Stop capture and discard (no transcription). */
  cancel: () => void;
}

export interface RecordingOptions {
  /** Specific input device id. Empty/"default" captures the system default microphone. */
  deviceId?: string;
  /** Called ~per audio block with the current RMS level (0..1) for a live meter/waveform. */
  onLevel?: (level: number) => void;
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
  const chunks: Float32Array[] = [];

  processor.onaudioprocess = (event) => {
    const block = event.inputBuffer.getChannelData(0);
    // Copy: the underlying buffer is reused across callbacks.
    chunks.push(new Float32Array(block));
    if (opts.onLevel) {
      let sum = 0;
      for (let i = 0; i < block.length; i++) {
        const v = block[i] ?? 0;
        sum += v * v;
      }
      opts.onLevel(Math.sqrt(sum / block.length));
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
