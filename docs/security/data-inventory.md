# Khonjel — Data Inventory & Privacy Map

What the app stores, where, how it is protected, how long it is kept, and whether it can leave the device. Reviewed each release. Reflects the implemented hardening (encrypted content at rest, fail-closed secrets, 0600 file perms, retention).

All persistent files live under Electron's `userData` directory (per-OS app data folder).

| Datum | Location | At rest | Retention | Can leave the device? |
|---|---|---|---|---|
| Provider API keys | `secrets.json` | OS keychain via `safeStorage` (DPAPI/Keychain/libsecret). If OS encryption is unavailable: **not persisted** — held in memory for the session only. | Until the connection is deleted | Only as an `Authorization`/`api-key` header to the **user-bound** provider endpoint (TLS-required) |
| Transcript history (`finalText`) | `content.json` | Encrypted with `safeStorage` when available (tagged `enc:`); legacy plaintext migrated on next write | User-configurable retention (`privacy.historyRetentionDays`, 0 = keep); auto-purged on add | Only if a **cloud STT/LLM slot is bound** by the user |
| Notes / chat | `content.json` | Encrypted at rest (as above) | Until deleted | Only via a user-bound cloud LLM |
| Dictionary / snippets / transforms | `content.json` | Encrypted at rest (as above) | Until deleted | No (used locally to shape prompts) |
| Connections (endpoints, model ids) | `connections.json` | Plaintext (no secrets here; 0600 perms) | Until deleted | No (used to build requests) |
| Settings | `settings.json` | Plaintext (non-sensitive; 0600 perms) | Until deleted | No |
| Downloaded models | `models/` + `models/index.json` | Plaintext model files; integrity-verified on download | Until deleted | No (downloaded only) |
| **Audio** | _not persisted_ | n/a — per-window temp WAVs are deleted after transcription | None | Per-window to a **bound cloud STT** slot only |

## File permissions
All of the above JSON files are written user-only (`0600` on POSIX; on Windows, DPAPI protects secrets and the user profile ACL protects the folder).

## Network egress
- **Default: none.** On-device whisper.cpp + llama.cpp handle STT/LLM with no network.
- Cloud calls happen **only** when the user explicitly binds a connection to a slot, and only over **https** (http is rejected for non-loopback endpoints).
- The local llama-server is loopback-only and token-gated.
- **No telemetry, analytics, crash reporting, or auto-update beacon.**

## User control (DSAR)
- **Delete everything:** Settings → System → "Reset all Khonjel data" removes `settings.json`, `content.json`, `connections.json`, `secrets.json` (and the keychain entries) and restarts.
- **Delete models:** Settings → System → "Delete models".
- **Export (planned, WS-D5):** a portable archive of the user's data.

## Notes
- When OS encryption is unavailable, content at rest falls back to plaintext (no worse than before) but **secrets are never written in plaintext** — they stay in memory for the session.
- Retention only purges on write today; a boot-time/periodic purge is a planned enhancement (WS-D3).
