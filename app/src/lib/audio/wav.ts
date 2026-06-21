/**
 * WAV encoding helpers for dictation capture. PURE + unit-tested (jsdom): the mic capture in
 * recorder.ts produces Float32 PCM at the AudioContext sample rate; these turn it into the 16kHz
 * mono 16-bit WAV that whisper.cpp expects, then base64 for the IPC transcription request.
 */

/** Average-window downsample to 16kHz (whisper's expected rate). No-op when already 16kHz. */
export function downsampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  const outRate = 16000;
  if (inputRate === outRate) return input;
  if (inputRate < outRate) return input; // never upsample; whisper handles >=16k content fine
  const ratio = inputRate / outRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j]!;
      count++;
    }
    out[i] = count > 0 ? sum / count : 0;
  }
  return out;
}

/** Clamp [-1,1] floats to signed 16-bit PCM. */
export function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]!));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/** Build a canonical 44-byte-header PCM WAV (mono) around 16-bit samples. */
export function encodeWav(samples: Int16Array, sampleRate = 16000): Uint8Array {
  const dataBytes = samples.length * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate (mono, 16-bit)
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    view.setInt16(offset, samples[i]!, true);
  }
  return new Uint8Array(buffer);
}

/** Base64-encode bytes in chunks (avoids arg-count limits on large buffers). */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Float32 PCM at `inputRate` -> base64 16kHz mono WAV, ready for the transcription IPC request. */
export function encodeWavBase64(pcm: Float32Array, inputRate: number): string {
  return bytesToBase64(encodeWav(floatTo16BitPCM(downsampleTo16k(pcm, inputRate))));
}
