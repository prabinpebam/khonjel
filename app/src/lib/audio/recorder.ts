/**
 * Mic recorder for dictation. Captures the default microphone via the Web Audio API and yields a
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

export async function startRecording(): Promise<Recorder> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
  });
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtor();
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];

  processor.onaudioprocess = (event) => {
    // Copy: the underlying buffer is reused across callbacks.
    chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)));
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
