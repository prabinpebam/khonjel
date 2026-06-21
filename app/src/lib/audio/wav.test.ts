import { describe, it, expect } from "vitest";
import { downsampleTo16k, floatTo16BitPCM, encodeWav, bytesToBase64, encodeWavBase64 } from "./wav";

describe("downsampleTo16k", () => {
  it("returns the input unchanged when already 16kHz", () => {
    const input = new Float32Array([0.1, 0.2, 0.3]);
    expect(downsampleTo16k(input, 16000)).toBe(input);
  });

  it("halves the length when downsampling 32kHz -> 16kHz", () => {
    const input = new Float32Array(32);
    const out = downsampleTo16k(input, 32000);
    expect(out.length).toBe(16);
  });
});

describe("floatTo16BitPCM", () => {
  it("clamps and scales floats to int16 range", () => {
    const out = floatTo16BitPCM(new Float32Array([0, 1, -1, 2]));
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(32767);
    expect(out[2]).toBe(-32768);
    expect(out[3]).toBe(32767); // clamped
  });
});

describe("encodeWav", () => {
  it("writes a 44-byte RIFF/WAVE header with the sample data", () => {
    const wav = encodeWav(new Int16Array([1, -1]), 16000);
    expect(wav.length).toBe(44 + 4);
    expect(String.fromCharCode(wav[0]!, wav[1]!, wav[2]!, wav[3]!)).toBe("RIFF");
    expect(String.fromCharCode(wav[8]!, wav[9]!, wav[10]!, wav[11]!)).toBe("WAVE");
    // sample rate at offset 24 (little-endian)
    const view = new DataView(wav.buffer);
    expect(view.getUint32(24, true)).toBe(16000);
    expect(view.getUint16(22, true)).toBe(1); // mono
  });
});

describe("bytesToBase64 + encodeWavBase64", () => {
  it("round-trips bytes through base64", () => {
    const b64 = bytesToBase64(new Uint8Array([72, 105]));
    expect(atob(b64)).toBe("Hi");
  });

  it("produces a base64 WAV string from float PCM", () => {
    const b64 = encodeWavBase64(new Float32Array([0, 0.5, -0.5, 0]), 16000);
    expect(typeof b64).toBe("string");
    expect(atob(b64).startsWith("RIFF")).toBe(true);
  });
});
