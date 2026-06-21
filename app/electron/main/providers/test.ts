/**
 * Connection test — a minimal 1-token chat ping used by `connections:test` / the "Test connection"
 * button. PURE except the injected `fetchJson` (proxyFetch in main), so it is BE1-tested. Never
 * throws: returns a structured `{ ok, message }`.
 */
import { buildChatRequest } from "./request";
import type { ConnectionProfile } from "../../../src/services/ports";
import type { ProxyFetch } from "./proxyFetch";

export interface ConnectionTestResult {
  ok: boolean;
  message?: string;
}

export async function testConnection(
  conn: ConnectionProfile | undefined,
  secret: string,
  target: string,
  fetchJson: ProxyFetch["json"],
): Promise<ConnectionTestResult> {
  if (!conn) return { ok: false, message: "Connection not found." };
  if (!target) return { ok: false, message: "Enter a model / deployment to test." };
  try {
    const req = buildChatRequest(conn, target, secret, {
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 1,
    });
    await fetchJson(req);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: String(err).slice(0, 300) };
  }
}
