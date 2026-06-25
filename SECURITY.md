# Security Policy

Khonjel is a local-first, privacy-first desktop app. We take security and privacy seriously and welcome responsible disclosure.

## Reporting a vulnerability

- **Do not** open a public issue for security reports.
- Email the maintainers at **security@khonjel.app** (replace with the real address) with:
  - a description of the issue and its impact,
  - steps to reproduce (proof-of-concept if possible),
  - affected version/commit and platform.
- You will receive an acknowledgement, and we will work with you on a fix and coordinated disclosure.

**Safe harbor:** good-faith research that respects user privacy, avoids data destruction, and does not degrade service is welcome; we will not pursue action for such research.

## Scope

In scope: the Electron app (main process, preload bridge, renderer), the IPC seam, secret storage, the provider network edge, OS injection, model download/verification, and build/release configuration.

Out of scope: vulnerabilities in third-party cloud providers the user connects (the user is the data controller for those), and issues requiring a pre-compromised machine (an attacker already running code as the user).

## Supported versions

We track the latest stable Electron major and ship Chromium/Electron **security** updates promptly (see [docs/security/electron-policy.md](docs/security/electron-policy.md)). Only the latest released version is supported.

## Our security posture

- Process isolation: `contextIsolation`, `nodeIntegration: false`, `sandbox: true` on every window.
- Strict Content-Security-Policy and navigation lock in the packaged renderer.
- IPC is a single version-checked, zod-validated, sender-guarded channel.
- **No app account; identity is the OS login.** Khonjel has no user/account concept: the signed-in operating-system user *is* the identity. All durable data is encrypted at rest to that account (Windows DPAPI via `safeStorage`), so another OS user on the same device cannot read it.
- Encrypted at rest to the logged-in user: settings, provider connections, secrets (API keys), and all user content (transcripts/notes/chat/dictionary). API keys are never exposed to the renderer; when OS encryption is unavailable we refuse to persist plaintext secrets.
- Provider traffic requires TLS (https) for non-loopback endpoints.
- No telemetry, analytics, crash reporting, or auto-update beacon.

See [docs/archive/security-privacy-audit.md](docs/archive/security-privacy-audit.md) and [docs/archive/security-privacy-hardening-plan.md](docs/archive/security-privacy-hardening-plan.md) for the full audit and roadmap.
