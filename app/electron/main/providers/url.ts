/**
 * Endpoint URL policy (PURE, BE1-tested). Provider traffic carries the API key in a header and the
 * user's audio/text in the body, so a non-loopback endpoint MUST use TLS — otherwise those secrets
 * travel in cleartext. `http://` is permitted only for loopback (local self-hosted models).
 * Used at the network edge (proxyFetch) and when a connection is saved (connections.upsert).
 */

/** Hosts that are local to the machine (cleartext is acceptable here). */
export function isLoopbackHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost");
}

/** PURE: is this endpoint allowed to be used/saved? https anywhere, http only for loopback. */
export function isEndpointAllowed(endpoint: string): boolean {
  let u: URL;
  try {
    u = new URL(endpoint);
  } catch {
    return false;
  }
  if (u.protocol === "https:") return true;
  if (u.protocol === "http:") return isLoopbackHost(u.hostname);
  return false;
}

/** Throw if an endpoint is not allowed (used at the network edge as a fail-closed guard). */
export function assertSecureEndpoint(endpoint: string): void {
  if (!isEndpointAllowed(endpoint)) {
    throw new Error("Endpoint must use https:// (http:// is allowed only for localhost).");
  }
}
