/**
 * proxyFetch — all provider HTTP runs here, in the MAIN process, so API keys never reach the
 * renderer (backend/10 SS3). Thin I/O edge (global fetch + FormData/Blob from Node/Electron),
 * injected into the provider router so the routing logic stays unit-tested. JSON for chat,
 * multipart/form-data for transcription (the form encoder sets Content-Type + boundary).
 */
import type { ProviderRequest } from "./request";
import { assertSecureEndpoint } from "./url";

export interface ProxyFetch {
  json: (req: ProviderRequest) => Promise<unknown>;
  transcription: (
    req: ProviderRequest,
    audio: Uint8Array,
    filename: string,
    fields: Record<string, string>,
  ) => Promise<unknown>;
  /** Streaming (SSE) chat, for token-by-token cloud replies. Optional so test fakes can omit it. */
  stream?: (req: ProviderRequest, signal?: AbortSignal) => Promise<ProviderStreamResponse>;
}

/** A streaming provider response: status + the raw SSE body as an async-iterable of bytes. */
export interface ProviderStreamResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  body: AsyncIterable<Uint8Array> | null;
}

/** A hung or hostile endpoint must not stall the app forever. */
const REQUEST_TIMEOUT_MS = 60_000;
/** Cap a provider response so a malicious/oversized body cannot exhaust memory. */
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

async function readBody(res: Response): Promise<unknown> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_RESPONSE_BYTES) {
    throw new Error(`Provider response too large (${declared} bytes).`);
  }
  const text = await res.text();
  if (text.length > MAX_RESPONSE_BYTES) {
    throw new Error("Provider response exceeded the size limit.");
  }
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${text.slice(0, 400)}`);
  }
  return text ? JSON.parse(text) : {};
}

export const proxyFetch: ProxyFetch = {
  json: async (req) => {
    assertSecureEndpoint(req.url); // fail-closed: never send the API key over cleartext
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body ?? {}),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return readBody(res);
  },
  transcription: async (req, audio, filename, fields) => {
    assertSecureEndpoint(req.url);
    const form = new FormData();
    // Copy into a plain ArrayBuffer so the Blob part type is unambiguous (Buffer is ArrayBufferLike).
    const ab = audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength) as ArrayBuffer;
    form.append("file", new Blob([ab], { type: "audio/wav" }), filename);
    for (const [key, value] of Object.entries(fields)) {
      if (value != null && value !== "") form.append(key, value);
    }
    // Do NOT set Content-Type here; the FormData encoder adds it with the boundary.
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return readBody(res);
  },
  stream: async (req, signal) => {
    assertSecureEndpoint(req.url); // fail-closed: never send the API key over cleartext
    // A streamed reply legitimately runs longer than the one-shot timeout; the caller's AbortSignal
    // (the user's Stop) is the cancellation path. Fall back to the timeout only when none is given.
    const res = await fetch(req.url, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify(req.body ?? {}),
      signal: signal ?? AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    return {
      ok: res.ok,
      status: res.status,
      text: () => res.text(),
      body: res.body as AsyncIterable<Uint8Array> | null,
    };
  },
};
