# New-Integration Security Checklist (gate)

The integrations catalog ships Google Calendar, a Public API, an MCP server, and a CLI bridge — all currently **disconnected**. Each is a new trust boundary. No integration ships (moves from "disconnected" to GA) until **every** box below is checked. This is a required review gate (WS-J).

## Required for every integration
- [ ] Added to [threat-model.md](threat-model.md) with STRIDE entries for its boundary.
- [ ] **Auth model** defined and implemented:
  - OAuth → Authorization Code + **PKCE** in the **system browser** (never an embedded webview).
  - Local HTTP (CLI bridge / MCP) → per-install **token** + `Origin`/`Host` validation to defeat DNS-rebinding.
  - Public API → **scoped** keys (per capability), rotation + revocation.
- [ ] **Least privilege / minimal scopes**; the user sees and consents to exactly what data is exposed.
- [ ] **Secrets** (tokens/refresh tokens/keys) stored via `safeStorage`; never logged; never sent to the renderer.
- [ ] **Disconnect path** revokes tokens/keys server-side (where supported) and wipes local state.
- [ ] **Transport** is TLS for remote calls; local servers bind loopback only.
- [ ] **Rate limiting** and resource caps on any exposed surface.
- [ ] **Audit log** (local) of security-relevant actions (tool calls, key use) — no secrets/PII (WS-K).
- [ ] **Off by default**; explicit user action to enable.
- [ ] **Evals**: happy path, auth-failure, revoke, and at least one abuse case.
- [ ] Updated [data-inventory.md](data-inventory.md) with any new datum (location, encryption, retention, egress).

## Integration-specific notes
- **Google Calendar:** request read-only minimal scopes for meeting detection; show granted scopes; revoke on disconnect.
- **MCP server:** deny-by-default tool exposure; per-tool consent; sandbox tool execution; audit every tool call.
- **CLI bridge:** loopback + token + `Origin`/`Host` checks; document its threat model; rate-limit.
- **Public API:** scoped keys with a rotation/revocation UI; clear consent for the data each key can read.
