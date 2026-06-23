# Khonjel — Threat Model (living document)

**Method:** STRIDE per trust boundary. Reviewed when a new boundary is added (e.g., an integration) and each minor release. Controls marked ✅ are implemented; ⏳ are planned in [docs/security-privacy-hardening-plan.md](../security-privacy-hardening-plan.md).

## Trust boundaries

1. **Renderer ↔ Main** (the preload bridge)
2. **Main ↔ OS** (child processes, clipboard, keystrokes, global shortcuts, login item)
3. **Main ↔ Network** (provider HTTP, model/binary downloads)
4. **Main ↔ Local services** (llama-server on loopback)
5. **Main ↔ Future integrations** (Google Calendar, MCP, CLI bridge, Public API)

---

## 1. Renderer ↔ Main

| STRIDE | Threat | Control |
|---|---|---|
| Spoofing | A non-app frame invokes IPC | ✅ Sender-origin guard on `khonjel:invoke` + all `ipcMain.on` (`isTrustedSender`) |
| Tampering | Malformed/oversized IPC payload | ✅ Per-channel zod validation; ✅ `capture-chunk` type + size cap; ✅ contract-version check |
| Repudiation | Untraceable security action | ⏳ Local audit log (WS-K) |
| Info disclosure | XSS reads bridge / exfiltrates | ✅ CSP `script-src 'self'`; ✅ navigation lock; ✅ sandbox + contextIsolation |
| DoS | Flood the high-rate channel | ✅ Per-chunk size cap; ⏳ rate limiting (WS-B3) |
| Elevation | Renderer gains Node | ✅ `nodeIntegration:false`, `sandbox:true`; secrets never exposed to renderer |

## 2. Main ↔ OS

| STRIDE | Threat | Control |
|---|---|---|
| Tampering | Command injection via injected text | ✅ `execFile`/`spawn` with array argv (no shell); ✅ SendKeys + PowerShell escaping |
| Info disclosure | Clipboard left holding dictated text | ✅ Clipboard saved/restored after paste injection |
| Elevation | Dictation auto-executes in a shell | ✅ Trailing-newline stripped for shell targets |
| DoS | Audio left muted on crash | ✅ Fail-safe unmute on shutdown |
| Repudiation/Consent | Silent autostart | ✅ Auto-launch defaults off |

## 3. Main ↔ Network

| STRIDE | Threat | Control |
|---|---|---|
| Info disclosure | API key/audio over cleartext | ✅ TLS required for non-loopback endpoints (save + request edge) |
| Tampering | Malicious/oversized response | ✅ Response size cap; ✅ request timeout |
| DoS | Hung endpoint stalls app | ✅ `AbortSignal.timeout` on all provider fetch |
| Spoofing/SSRF | Requests to metadata/link-local IPs | ⏳ Host allowlist / metadata-IP block (WS-E3) |
| Info disclosure | Secret leaks into logs/errors | ✅ Errors carry status/body, not headers/keys |

## 4. Main ↔ Local services

| STRIDE | Threat | Control |
|---|---|---|
| Spoofing | Another local process uses the model server | ✅ Per-session bearer token (`--api-key` + `Authorization`) |
| Elevation | Server exposed off-host | ✅ Loopback-only bind, refuses non-loopback host |
| DoS | Resource exhaustion | ✅ Context-size cap; ⏳ concurrency caps (WS-I3) |

## 5. Main ↔ Future integrations (pre-ship gate)

Each integration must satisfy [new-integration-checklist.md](new-integration-checklist.md) before GA: an entry here, an auth model (OAuth-PKCE / token / mutual), minimal scopes, a revoke path, anti-DNS-rebinding `Origin`/`Host` checks for any local HTTP, and evals. Off by default.

---

## Supply-chain (cross-cutting)

| Threat | Control |
|---|---|
| Malicious model file (native parser bug) | ⏳ Pin sha256 per model (mechanism ✅, values to populate — `npm run verify:pins`); ⏳ sandboxed parsers (WS-F7) |
| Tampered/unsigned app binary | ⏳ Code signing (WS-G1) |
| Unpatched Electron/Chromium | ⏳ Upgrade cadence policy ([electron-policy.md](electron-policy.md)) |
| Compromised dependency | ⏳ `npm audit`/osv + SBOM in CI (WS-L2) |
