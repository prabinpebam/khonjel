/**
 * proxyFetch — all provider HTTP runs here, in the MAIN process, so API keys never reach the
 * renderer (backend/10 SS3). Thin I/O edge (global fetch + FormData/Blob from Node/Electron),
 * injected into the provider router so the routing logic stays unit-tested. JSON for chat,
 * multipart/form-data for transcription (the form encoder sets Content-Type + boundary).
 */
import type { ProviderRequest } from "./request";

export interface ProxyFetch {
  json: (req: ProviderRequest) => Promise<unknown>;
  transcription: (
    req: ProviderRequest,
    audio: Uint8Array,
    filename: string,
    fields: Record<string, string>,
  ) => Promise<unknown>;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

export const proxyFetch: ProxyFetch = {
  json: async (req) => {
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body ?? {}),
    });
    return readBody(res);
  },
  transcription: async (req, audio, filename, fields) => {
    const form = new FormData();
    // Copy into a plain ArrayBuffer so the Blob part type is unambiguous (Buffer is ArrayBufferLike).
    const ab = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
    form.append("file", new Blob([ab], { type: "audio/wav" }), filename);
    for (const [key, value] of Object.entries(fields)) {
      if (value != null && value !== "") form.append(key, value);
    }
    // Do NOT set Content-Type here; the FormData encoder adds it with the boundary.
    const res = await fetch(req.url, { method: "POST", headers: req.headers, body: form });
    return readBody(res);
  },
};
