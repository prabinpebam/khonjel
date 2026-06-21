/**
 * Provider router — resolves a slot's binding (mode + connection + target) and, when it points at a
 * cloud/self-hosted connection, runs the request via proxyFetch using the Azure-aware builders in
 * ./request.ts. Returns `undefined` when the slot is local/unbound so the caller falls back to the
 * local engine. Slot resolution + response parsing are PURE (BE1-tested); the HTTP edge is injected.
 * See backend/10 SS3a-SS4.
 */
import { ipcError } from "../../shared/ipc-contract";
import type { ConnectionProfile, SettingsSnapshot } from "../../../src/services/ports";
import type { EngineMessage } from "../services/inference";
import { buildChatRequest, buildTranscriptionRequest } from "./request";
import type { ProxyFetch } from "./proxyFetch";

export type SlotMode = "local" | "self-hosted" | "providers" | "enterprise" | "cloud";

export interface SlotResolution {
  mode: SlotMode;
  connectionId?: string;
  target?: string;
}

export interface ChatCallParams {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

const ROUTED_MODES = new Set<SlotMode>(["self-hosted", "providers", "enterprise"]);

/** PURE: read a slot's binding from the flat settings values. */
export function resolveSlot(values: Record<string, string>, prefix: string): SlotResolution {
  return {
    mode: (values[`${prefix}.mode`] ?? "local") as SlotMode,
    connectionId: values[`${prefix}.connectionId`],
    target: values[`${prefix}.target`],
  };
}

/** PURE: does this slot route to a bound (cloud/self-hosted) connection? */
export function isRoutedSlot(slot: SlotResolution): boolean {
  return ROUTED_MODES.has(slot.mode) && Boolean(slot.connectionId);
}

/** PURE: assistant text from an OpenAI/Azure chat completion response. */
export function parseChatReply(json: unknown): string {
  const content = (json as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message
    ?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("provider returned no chat content");
  }
  return content.trim();
}

/** PURE: transcript text from an OpenAI/Azure transcription response. */
export function parseTranscriptReply(json: unknown): string {
  const text = (json as { text?: unknown }).text;
  if (typeof text !== "string") {
    throw new Error("provider returned no transcript text");
  }
  return text.trim();
}

export interface ProviderRouterDeps {
  getSettings: () => SettingsSnapshot;
  getConnection: (id: string) => ConnectionProfile | undefined;
  getSecret: (id: string) => string | undefined;
  fetch: ProxyFetch;
}

export interface ProviderRouter {
  /** Cloud chat reply, or undefined when the slot is local/unbound (caller falls back to local). */
  completeForSlot: (
    prefix: string,
    messages: EngineMessage[],
    params?: ChatCallParams,
  ) => Promise<string | undefined>;
  /** Cloud transcript, or undefined when the slot is local/unbound. */
  transcribeForSlot: (
    prefix: string,
    audio: Uint8Array,
    opts?: { language?: string },
  ) => Promise<string | undefined>;
}

export function createProviderRouter(deps: ProviderRouterDeps): ProviderRouter {
  function resolveBinding(
    prefix: string,
  ): { conn: ConnectionProfile; secret: string; target: string } | undefined {
    const slot = resolveSlot(deps.getSettings().values, prefix);
    if (!isRoutedSlot(slot) || !slot.connectionId) return undefined;
    const conn = deps.getConnection(slot.connectionId);
    if (!conn) return undefined;
    return { conn, secret: deps.getSecret(slot.connectionId) ?? "", target: slot.target ?? "" };
  }

  return {
    completeForSlot: async (prefix, messages, params) => {
      const binding = resolveBinding(prefix);
      if (!binding) return undefined;
      try {
        const req = buildChatRequest(binding.conn, binding.target, binding.secret, {
          messages,
          maxTokens: params?.maxTokens,
          temperature: params?.temperature,
          topP: params?.topP,
        });
        return parseChatReply(await deps.fetch.json(req));
      } catch (err) {
        throw ipcError("provider_error", `Chat request to ${binding.conn.id} failed`, String(err));
      }
    },
    transcribeForSlot: async (prefix, audio, opts) => {
      const binding = resolveBinding(prefix);
      if (!binding) return undefined;
      try {
        const req = buildTranscriptionRequest(binding.conn, binding.target, binding.secret);
        const fields: Record<string, string> = { model: binding.target, response_format: "json" };
        if (opts?.language && opts.language !== "auto") fields.language = opts.language;
        return parseTranscriptReply(await deps.fetch.transcription(req, audio, "audio.wav", fields));
      } catch (err) {
        throw ipcError("provider_error", `Transcription request to ${binding.conn.id} failed`, String(err));
      }
    },
  };
}
