# Incident Response Runbook

A lightweight runbook for security incidents in Khonjel (a local-first desktop app, so most incidents are integrity/supply-chain or a vulnerability disclosure rather than a server breach).

## Roles
- **Incident lead:** the Security Champion (or the on-call maintainer).
- **Comms:** drafts user-facing notices.

## Severity
| Level | Examples |
|---|---|
| **Critical** | RCE in the app, malicious model/binary shipped, signing key compromise, secret-exfiltration path |
| **High** | XSS reaching the IPC bridge, TLS bypass, cleartext-secret persistence |
| **Medium** | DoS, info leak of non-secret data |
| **Low** | Hardening gaps without a practical exploit |

## Response steps
1. **Triage & confirm.** Reproduce; assign severity; open a private tracking issue.
2. **Contain.**
   - Malicious release/dependency → pull the release; revoke the affected signing cert if needed.
   - Compromised model pin/source → remove the source; require the corrected sha256 (`npm run verify:pins`).
   - Critical client-side bug → prepare a fix and a **minimum-version force-update** (WS-G3) so users are moved off the vulnerable build.
3. **Eradicate & fix.** Land the patch with a regression eval (this repo is eval-driven — every fix ships with a test).
4. **Release.** Cut a signed release; verify with `npm run verify` + the security/electron evals; bump minimum version for critical issues.
5. **Notify.** Publish a security advisory + in-app/release-notes notice. Credit the reporter per [SECURITY.md](../../SECURITY.md) if applicable.
6. **Post-mortem.** Blameless write-up: root cause, timeline, what control failed, what control/eval is added so it cannot recur. Update [threat-model.md](threat-model.md) and the [hardening plan](../security-privacy-hardening-plan.md).

## Useful facts
- Wiping user data: deleting `settings.json`, `content.json`, `connections.json`, `secrets.json` under `userData` resets the app (also exposed as Settings → System → "Reset all Khonjel data").
- Secrets live in the OS keychain; rotating a leaked provider key is done in the provider's console + re-entering it in Connections.
- No server component holds user data — there is no central breach surface; the blast radius of most incidents is the client build.
