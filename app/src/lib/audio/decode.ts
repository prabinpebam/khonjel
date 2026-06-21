/**
 * Decode an uploaded audio file (any container/codec the Chromium renderer can decode) into the
 * base64 16kHz mono WAV the transcription IPC expects. Runtime-only (AudioContext.decodeAudioData);
 * the WAV math it relies on is unit-tested in wav.ts.
 */
import { encodeWavBase64 } from "./wav";

/** Average every channel into a single mono track. */
function downmixToMono(buffer: AudioBuffer): Float32Array {
  const { numberOfChannels, length } = buffer;
  if (numberOfChannels === 1) return buffer.getChannelData(0);
  const out = new Float32Array(length);
  for (let ch = 0; ch < numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) out[i] = (out[i] ?? 0) + data[i]! / numberOfChannels;
  }
  return out;
}

export interface DecodedAudio {
  base64: string;
  durationSec: number;
}

export async function decodeFileToWavBase64(file: File): Promise<DecodedAudio> {
  const bytes = await file.arrayBuffer();
  const AudioCtor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtor();
  try {
    const buffer = await ctx.decodeAudioData(bytes);
    return {
      base64: encodeWavBase64(downmixToMono(buffer), buffer.sampleRate),
      durationSec: buffer.duration,
    };
  } finally {
    void ctx.close();
  }
}
