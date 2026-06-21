/**
 * Connection test — pings the SAME endpoint the slot will actually use: a 1-token chat completion
 * for LLM slots, or a tiny silent-audio transcription for STT slots (a chat ping 404s on a
 * transcription-only deployment like gpt-4o-transcribe). Injected proxyFetch keeps it BE1-tested.
 * Never throws: returns a structured `{ ok, message }`.
 */
import { buildChatRequest, buildTranscriptionRequest } from "./request";
import type { ConnectionProfile } from "../../../src/services/ports";
import type { ProxyFetch } from "./proxyFetch";

export interface ConnectionTestResult {
  ok: boolean;
  message?: string;
}

export type TestOperation = "chat" | "transcription";

/** A ~1s 16kHz mono silent WAV, just enough to exercise a transcription endpoint. */
function silentWav(samples = 16000, sampleRate = 16000): Uint8Array {
  const dataBytes = samples * 2;
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, "data");
  view.setUint32(40, dataBytes, true);
  // Samples stay zero (silence).
  return new Uint8Array(buffer);
}

/** Turn a raw provider error (often JSON) into a short, actionable message. */
export function explainProviderError(raw: string, target: string): string {
  let code = "";
  let detail = "";
  const jsonStart = raw.indexOf("{");
  if (jsonStart >= 0) {
    try {
      const parsed = JSON.parse(raw.slice(jsonStart)) as { error?: { code?: string; message?: string } };
      code = parsed.error?.code ?? "";
      detail = parsed.error?.message ?? "";
    } catch {
      // not JSON; fall through to pattern matching
    }
  }
  if (/DeploymentNotFound/i.test(raw) || /deployment for this resource does not exist/i.test(raw)) {
    return `Deployment "${target}" was not found on this resource. In the Azure portal open your resource -> Deployments and use the exact Deployment name (it can differ from the model name); also confirm the base endpoint points at that resource.`;
  }
  if (/\b401\b|Unauthorized|invalid api key|access denied|PermissionDenied/i.test(raw)) {
    return "Authentication failed (401). Check the API key and the authentication mode (Bearer vs api-key header).";
  }
  if (/api-version/i.test(raw)) {
    return detail || "Unsupported api-version. Use a valid Azure API version, e.g. 2025-03-01-preview.";
  }
  if (detail) return `${code ? `${code}: ` : ""}${detail}`.slice(0, 300);
  return raw.slice(0, 300);
}

export async function testConnection(
  conn: ConnectionProfile | undefined,
  secret: string,
  target: string,
  operation: TestOperation,
  fetch: ProxyFetch,
): Promise<ConnectionTestResult> {
  if (!conn) return { ok: false, message: "Connection not found." };
  if (!target) return { ok: false, message: "Enter a model / deployment to test." };
  if (conn.kind === "azure-openai" && !conn.apiVersion?.trim()) {
    return { ok: false, message: "Azure needs an API version (set it on the connection)." };
  }
  try {
    if (operation === "transcription") {
      const req = buildTranscriptionRequest(conn, target, secret);
      await fetch.transcription(req, silentWav(), "test.wav", {
        model: target,
        response_format: "json",
      });
    } else {
      const req = buildChatRequest(conn, target, secret, {
        messages: [{ role: "user", content: "ping" }],
        maxTokens: 1,
      });
      await fetch.json(req);
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, message: explainProviderError(String(err), target) };
  }
}
