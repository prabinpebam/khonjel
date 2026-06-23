# Electron / Chromium Upgrade Policy

Unpatched Electron/Chromium is the single largest long-term security risk for any Electron app. This policy keeps Khonjel current.

## Principles
- Track the **latest stable Electron major**.
- Treat any Electron release that bundles a **Chromium security fix** as a security update.
- Ship security updates promptly via the signed update channel (WS-G) once it exists; until then, cut a new signed release.

## Cadence (SLA)
| Severity of bundled fix | Action |
|---|---|
| Critical (actively exploited / RCE) | Patch and ship as an emergency release ASAP; consider minimum-version force-update |
| High | Patch in the next release; do not let it slip a full cycle |
| Medium/Low | Roll up into the regular update cadence |

## Process
1. Watch Electron releases (`electron/electron` releases + the "Electron security" advisories) and Chromium stable channel notes.
2. When a security-bearing release lands, open a tracked upgrade PR.
3. Run the full gate: `npm run verify` + the security evals (`security-hardening`, `electron-seam`) + the electron eval suite.
4. Verify the app boots, dictation works, and CSP/navigation evals still pass.
5. Release (signed) and, for critical fixes, bump the minimum supported version.

## Dependencies
- Keep `package-lock.json` committed; install with `npm ci` in CI.
- Enable Renovate/Dependabot with grouped PRs; auto-merge green patch updates.
- Run `npm audit`/`osv-scanner` in CI (WS-L2); never ship with an unaddressed high/critical advisory.
- Remove unused native modules to shrink the rebuild/attack surface.

## Current baseline
- Electron `^42` (see [app/package.json](../../app/package.json)).
