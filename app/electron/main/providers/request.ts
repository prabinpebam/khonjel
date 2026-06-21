/**
 * Provider request construction — builds the URL, auth headers, and chat body for a connection
 * profile. PURE (no fetch, no node) so it is exhaustively unit-tested (BE1). The actual HTTP runs
 * via proxyFetch in main; this captures the per-provider shape, especially **Azure OpenAI**:
 *   - the URL path uses a user-named DEPLOYMENT, not the model id;
 *   - `api-version` is a required query parameter;
 *   - newer deployments require `max_completion_tokens` (not `max_tokens`).
 * Nothing about a specific resource/deployment/version is hardcoded. See backend/10 §3a.
 */
import type { ConnectionProfile } from "../../../src/services/ports";

export interface ChatParams {
  messages: Array<{ role: string; content: string }>;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface ProviderRequest {
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

function trimBase(endpoint: string): string {
  return endpoint.replace(/\/+$/, "");
}

export function buildAuthHeaders(profile: ConnectionProfile, secret: string): Record<string, string> {
  if (profile.authMode === "api-key-header") {
    return { [profile.headerName ?? "api-key"]: secret };
  }
  // bearer-token | aad
  return { Authorization: `Bearer ${secret}` };
}

function azureUrl(profile: ConnectionProfile, deployment: string, op: string): string {
  const base = trimBase(profile.baseEndpoint);
  const version = encodeURIComponent(profile.apiVersion ?? "");
  return `${base}/openai/deployments/${encodeURIComponent(deployment)}/${op}?api-version=${version}`;
}

/** Chat completions request. `target` is the Azure deployment, or the model id for others. */
export function buildChatRequest(
  profile: ConnectionProfile,
  target: string,
  secret: string,
  params: ChatParams,
): ProviderRequest {
  const headers = { "Content-Type": "application/json", ...buildAuthHeaders(profile, secret) };
  const isAzure = profile.kind === "azure-openai";
  const body: Record<string, unknown> = { messages: params.messages, model: target };
  if (params.maxTokens != null) {
    // Azure/newer models require max_completion_tokens and reject max_tokens.
    if (isAzure) body.max_completion_tokens = params.maxTokens;
    else body.max_tokens = params.maxTokens;
  }
  if (params.temperature != null) body.temperature = params.temperature;
  if (params.topP != null) body.top_p = params.topP;

  const url = isAzure
    ? azureUrl(profile, target, "chat/completions")
    : `${trimBase(profile.baseEndpoint)}/v1/chat/completions`;
  return { url, headers, body };
}

/** Transcription request URL + headers (the audio body is multipart, attached by the caller). */
export function buildTranscriptionRequest(
  profile: ConnectionProfile,
  target: string,
  secret: string,
): ProviderRequest {
  const headers = buildAuthHeaders(profile, secret);
  const url =
    profile.kind === "azure-openai"
      ? azureUrl(profile, target, "audio/transcriptions")
      : `${trimBase(profile.baseEndpoint)}/v1/audio/transcriptions`;
  return { url, headers };
}
