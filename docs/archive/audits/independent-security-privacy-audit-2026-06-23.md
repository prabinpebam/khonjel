# Independent Security and Privacy Audit - 2026-06-23

Audited revision: `86c305f`

Scope: Khonjel desktop app source under `app/`, including the Electron main process, preload bridge, renderer services/hooks, provider/network code, local storage, model download path, audio capture path, text injection path, build/package configuration, and relevant automated tests. This report was prepared from code/config/test inspection and fresh command output only; prior audit materials were not used.

## Executive Summary

Khonjel has a stronger-than-average Electron security posture for an early local-first app. The main renderer windows run with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`; the renderer talks to main through a single versioned IPC invoke seam backed by zod request validation; top-level navigation is locked to app origins; production builds inject a restrictive CSP; provider secrets stay in main and are encrypted with Electron `safeStorage`; provider endpoints are HTTPS-only except loopback; and the new streaming capture path bounds memory by segmenting audio rather than retaining a full long-form recording.

The highest priority gaps are supply-chain and build-integrity issues, not obvious raw remote-code-execution bugs:

- Local model manifests are not pinned with sha256 hashes. `npm run verify:pins` reports `0/8` local model manifests pinned.
- The checked-in runtime bundle `app/electron/main.cjs` is stale relative to the hardened TypeScript source. The package/start scripts rebuild it, but the repository's actual Electron entrypoint can drift from reviewed source.
- The generic IPC invoke path validates shape, but not maximum sizes or per-collection item schemas, leaving room for renderer-origin denial of service or durable-store poisoning if the renderer is compromised.
- A failed selection capture can fall back to previous clipboard contents, creating a privacy leak for hotkey transforms.

No production dependency advisories were reported by `npm audit --omit=dev` at the audited revision.

## Quick Risk Register

| ID | Severity | Area | Finding | Primary Fix |
| --- | --- | --- | --- | --- |
| F1 | High | Supply chain | Local model downloads have no sha256 pins (`0/8`). | Populate hashes and make `STRICT=1 npm run verify:pins` a release gate. |
| F2 | High | Build integrity | `electron/main.cjs` is stale compared with `electron/main/main.ts`. | Stop tracking generated bundles or enforce a clean post-build diff in CI. |
| F3 | Medium | IPC robustness | Generic IPC schemas lack payload size limits and per-collection schemas. | Add max lengths/counts/byte caps and validate collection elements. |
| F4 | Medium | Clipboard privacy | `captureSelection()` may return stale clipboard text if Ctrl+C fails. | Return empty on unchanged clipboard and restore the clipboard. |
| F5 | Medium | At-rest privacy | User content encryption can fall back to plaintext; settings/connections are plaintext. | Fail closed or show explicit degraded-mode warning for packaged builds. |
| F6 | Medium | Renderer compromise impact | Preload exposes powerful capabilities to any trusted app renderer frame. | Add capability segmentation, user-gesture checks, and rate limits for sensitive channels. |
| F7 | Medium | Permissions | Microphone permission handler grants `media` by permission name only. | Check requesting frame/origin before granting media. |
| F8 | Medium | Remote processing privacy | Cloud-routed chat/STT/transforms can send text/audio/selection off-device without per-action friction. | Add explicit runtime indicators and confirmations for cloud-routed sensitive actions. |
| F9 | Low | Error handling | Provider errors may surface a slice of remote response body to the renderer. | Sanitize provider error detail before returning it. |
| F10 | Low | Local inference override | `KHONJEL_LLAMA_ENDPOINT` bypasses loopback/secure endpoint policy. | Enforce loopback or HTTPS, or log a prominent debug warning. |
| F11 | Low | Packaging | `electron/**/*` includes TS/test source in packaged app. | Package only `electron/main.cjs`, `electron/preload.cjs`, `dist`, package metadata, and icon. |

## Positive Controls Observed

### Electron Window Isolation

- Main and floating windows use `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` in `app/electron/main/main.ts`.
- New-window creation is denied by `setWindowOpenHandler`; HTTPS links are forwarded externally rather than rendered in-app.
- Top-level navigation and redirects are blocked unless they stay on `file://` or the dev server origin.
- Production Vite builds inject a CSP meta tag with `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors 'none'` in `app/vite.config.ts`.
- A real Electron eval, `app/eval/scenarios/security-hardening.eval.electron.mjs`, verifies inline script blocking and navigation lock in the built renderer.

### IPC Design

- Renderer-to-main request/response traffic uses one generic `khonjel:invoke` channel.
- The preload sends a `CONTRACT_VERSION`; main rejects mismatches.
- `createDispatch()` rejects unknown channels and validates request tuples with zod schemas from `app/electron/shared/ipc-schemas.ts`.
- Main checks sender origin with `isTrustedSender()` before handling `khonjel:invoke`.
- One-way `ipcMain.on` channels are wrapped with `ipcOn()`, which applies the same trusted-sender check.
- The high-rate capture chunk channel validates basic type and caps each chunk at 4,000,000 base64 characters.

### Secrets and Provider Traffic

- Provider API keys are set/write-only from renderer perspective: `secrets:set`, `secrets:has`, and `secrets:remove`; there is no `secrets:get` IPC channel.
- `safeStorageCipher` uses Electron `safeStorage` and refuses to persist plaintext when OS encryption is unavailable.
- `createSecretStore()` keeps secrets in memory only when encryption fails and purges older persisted values for that id.
- Provider HTTP runs in the main process through `proxyFetch`, so API keys are not placed in renderer memory for normal provider calls.
- `isEndpointAllowed()` and `assertSecureEndpoint()` require HTTPS for remote provider endpoints and allow cleartext HTTP only for loopback hosts.
- Provider calls have a 60-second timeout and a 16 MB response cap.

### Local Data Handling

- Main stores settings/content/connections in app `userData`, not in the renderer bundle.
- `content.json` is wired through `encryptedSettingsIO()` in the current composition root.
- Dictation history stores final text and metadata but not raw audio (`hasAudio: false` for live dictation).
- Temp WAV files for non-streaming STT are deleted in a `finally` block after transcription.
- Streaming capture avoids retaining the full session in memory; closed audio windows are transcribed and dropped.
- `privacy.historyRetentionDays` is enforced when adding history entries.
- The renderer honors the `saveHistory` privacy toggle before adding dictation history.

### Text Injection Safety

- Shell/terminal targets use the `type` strategy rather than paste by default.
- Shell apps strip trailing newlines before injection, reducing accidental command execution risk.
- Paste injection snapshots and restores the user's clipboard after pasting.
- SendKeys special characters are escaped in `app/electron/main/injection/sendkeys.ts`.

### Verification Snapshot

- `npm audit --omit=dev --json`: 0 production vulnerabilities.
- `npm run verify:pins`: 0/8 local model manifests pinned with sha256.
- Checked-in `app/electron/main.cjs` contains stale security-relevant behavior not matching `app/electron/main/main.ts`.

## Detailed Findings

### F1 - High - Local Model Downloads Are Not Pinned

Evidence:

- `app/electron/main/models/downloader.ts` supports sha256 verification when a manifest provides `sha256`.
- `app/electron/main/models/catalog.ts` has local model manifests but no `sha256` fields.
- `npm run verify:pins` reports:
  - `model pins: 0/8 manifests pinned with sha256`
  - Missing pins include all Whisper and GGUF local models.

Risk:

The in-app downloader currently relies primarily on TLS and the remote model host. A poisoned mirror, compromised upstream, CDN issue, or environment source override could deliver a malicious or tampered model. Model files are not executable in the same way as code, but they are parsed by native inference engines and can influence app behavior, privacy, and memory-safety exposure in external runtimes.

Recommendation:

- Download each intended model artifact once in a controlled release environment and compute sha256.
- Populate `sha256` and `bytes` for every manifest entry.
- Make `STRICT=1 node scripts/verify-model-pins.mjs` mandatory in CI/release packaging.
- Reject `KHONJEL_MODEL_SOURCES` overrides unless the same pinned hash is satisfied.

### F2 - High - Checked-In Runtime Bundle Is Stale Relative to Hardened Source

Evidence:

- `app/package.json` uses `electron/main.cjs` as the Electron `main` entrypoint.
- The audited TypeScript source in `app/electron/main/main.ts` restricts external links to `https://`.
- The checked-in/generated `app/electron/main.cjs` still contains `url.startsWith("http")` before `shell.openExternal(url)`, which is broader and appears to predate the current hardening.
- `Select-String` did not find newer searched hardening markers such as `isTrustedSender`, `khonjel:capture-chunk`, or `assertSecureEndpoint` in the checked-in `main.cjs` during the audit sweep, indicating significant drift.

Risk:

The normal `npm run electron`, `npm run package`, and `npm run build:electron` flows rebuild the CJS bundle, but any direct `electron .`, manual packaging, or missed build step will execute stale code. Because the stale file is the declared app entrypoint, review of TypeScript alone is not sufficient to know what will run.

Recommendation:

- Prefer not to track generated `electron/main.cjs` and `electron/preload.cjs`; build them into a generated output directory used by package/start scripts.
- If tracking generated bundles remains necessary, add a CI gate: `npm run build:electron && git diff --exit-code app/electron/main.cjs app/electron/preload.cjs`.
- Make direct `electron .` unsafe by convention impossible: point `main` at a build output that is always regenerated by scripts, or add a startup build hash assertion.
- Package only built runtime artifacts, not both source and stale generated artifacts.

### F3 - Medium - Generic IPC Schemas Lack Payload Size Limits and Per-Collection Item Validation

Evidence:

- `app/electron/shared/ipc-schemas.ts` uses unrestricted `z.string()` for several sensitive/heavy payloads, including `transcription:transcribe`, `system:injectText`, `inference:chat`, and content fields.
- `content:replace` validates only `[ContentCollectionSchema, z.array(z.unknown())]`.
- The special high-rate capture channel does have a 4,000,000-character per-chunk cap, showing the risk is recognized for streaming audio.

Risk:

A buggy or compromised trusted renderer frame can send huge strings or arrays through valid IPC channels, consuming memory, disk, and CPU in the main process, or poisoning durable content with malformed collection items. This is mostly a local denial-of-service and data-integrity risk, but it also increases blast radius after any renderer compromise.

Recommendation:

- Add explicit max lengths for text, chat messages, injected text, base64 audio, connection ids, endpoint strings, and prompts.
- Add max array counts for history/chat/notes/uploads/dictionary/snippets/transforms.
- Replace `z.array(z.unknown())` for `content:replace` with per-collection schemas.
- Enforce a maximum serialized JSON document size before writing `content.json`.

### F4 - Medium - Selection Capture Can Leak Stale Clipboard Contents

Evidence:

- `app/electron/main/injection/win32.ts` snapshots the clipboard, sends Ctrl+C, polls for a changed clipboard value, and returns the changed value when present.
- If the clipboard does not change, it returns `clipboard.readText()` anyway.
- `app/src/app/system/GlobalDictation.tsx` sends the returned selection through `inference.chat()` for hotkey transforms, which may route to a cloud provider depending on settings.

Risk:

If Ctrl+C fails, the focused app blocks copying, the selection is empty, or clipboard contents are unchanged, the transform path can process the user's previous clipboard contents instead of the intended selection. If the LLM slot is cloud-routed, stale clipboard text can be sent off-device unintentionally.

Recommendation:

- Return an empty string when the clipboard does not change after Ctrl+C.
- Restore the previous clipboard value after selection capture.
- Consider adding a short visible error/state when no selection is captured.
- Add a regression test for unchanged clipboard returning empty.

### F5 - Medium - At-Rest Encryption Can Degrade to Plaintext for User Content

Evidence:

- `content.json` is passed through `encryptedSettingsIO()`.
- `encryptedSettingsIO()` writes plaintext if `cipher.encrypt()` throws.
- The secret store fails closed and keeps secrets in memory when encryption is unavailable, but content/settings do not fail closed.
- Settings and connection profiles are stored through `fileSettingsIO()` without content encryption. They do not contain API keys, but they can reveal provider endpoints, model choices, preferences, and privacy settings.

Risk:

On systems where `safeStorage` encryption is unavailable or fails, transcripts, notes, chat history, dictionary entries, and uploads can be written as plaintext. This is a privacy regression relative to the local-first/privacy-first expectation.

Recommendation:

- In packaged builds, fail closed for `content.json` when encryption is unavailable, or require explicit user opt-in to degraded plaintext mode.
- Surface a visible privacy status indicator when user content is not encrypted at rest.
- Consider encrypting connection profiles and sensitive settings values as well, even though API keys are separately protected.
- Add an Electron eval that simulates encryption unavailable and asserts the user is warned or persistence is disabled.

### F6 - Medium - Renderer Compromise Has Broad IPC Impact

Evidence:

- The preload exposes `window.khonjel.invoke(channel, ...args)` to the trusted renderer.
- Any script executing in the trusted renderer origin can call all invoke channels: content replacement, settings patching, secret setting/removal, model actions, capture start/stop, text injection, and selection capture.
- CSP, React escaping, navigation lock, sandboxing, and trusted-sender checks substantially reduce the chance of arbitrary script execution, but they do not reduce the privilege of a compromised trusted renderer.

Risk:

If renderer code execution is achieved through a dependency issue, malicious static SVG import, compromised build artifact, or future unsafe rendering path, the attacker can mutate data, capture selected text, inject text into other apps, alter provider routes, or drive model downloads through the existing app bridge.

Recommendation:

- Replace the generic renderer-exposed `invoke` with a narrow API object exposing only typed methods, or enforce an allow-list at preload level as well as main.
- Require user gestures or explicit confirmations for destructive/system channels (`reset-data`, `clear-cache`, model remove, selection capture, text injection, secrets remove).
- Add channel-level rate limits and payload budgets.
- Add telemetry-free local audit events for sensitive operations so users can see what happened.

### F7 - Medium - Microphone Permission Handler Does Not Verify Request Origin

Evidence:

- `session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === "media"))` grants any `media` request in the default session.
- `setPermissionCheckHandler` uses the same permission-only check.
- Navigation locks and window-open denial make remote frames unlikely, but the permission handler itself does not check the requesting `webContents` URL or frame.

Risk:

If a future feature creates another window, embeds content, changes navigation rules, or has a race/bug before navigation is blocked, any frame in the default session requesting `media` would receive microphone permission.

Recommendation:

- In both permission handlers, verify the requesting frame/webContents URL with the same trusted-origin policy used by IPC.
- Deny media for unknown, destroyed, or non-app frames.
- Add a real Electron eval that attempts media from a disallowed origin and expects denial.

### F8 - Medium - Remote Processing Privacy Needs Stronger Runtime Disclosure

Evidence:

- `useDictation()` routes STT through the provider router when the `stt.dictation` slot is cloud-bound.
- `inference.chat()` and `inference.cleanup()` can route text to configured provider connections.
- Hotkey transforms copy foreground app selection and pass it to `inference.chat()`.
- Provider endpoints and API keys are well controlled technically, but the user's sensitive data can intentionally leave the device when a slot is remote.

Risk:

Users may understand that a connection is configured, but not notice when a specific dictation, note action, chat turn, or transform is being sent off-device. Selection transforms are especially sensitive because the source app is outside Khonjel and may contain confidential content.

Recommendation:

- Show a live `Local` vs `Cloud/Provider` indicator on dictation, chat, notes, and transform surfaces.
- For cloud-routed selection transforms, require first-run confirmation explaining that selected text will be sent to the configured provider.
- Add a per-slot privacy summary: data sent, provider endpoint, retention caveat, and whether audio or text is sent.
- Consider an optional `never send selected text to cloud` policy toggle.

### F9 - Low - Provider Error Detail Can Surface Remote Response Body

Evidence:

- `proxyFetch.readBody()` throws `HTTP status: ${text.slice(0, 400)}` for non-OK responses.
- The provider router wraps errors into `ipcError("provider_error", ..., String(err))`, returning detail to renderer callers.

Risk:

Some provider error bodies echo request fields or include diagnostic data. A 400-character response slice may expose sensitive prompt/audio metadata in renderer UI, tests, or logs depending on how callers display errors.

Recommendation:

- Return only status code and a sanitized provider label to renderer.
- Keep full details in a local debug log only when explicit debug logging is enabled.
- Strip headers, request bodies, and provider response snippets by default.

### F10 - Low - `KHONJEL_LLAMA_ENDPOINT` Bypasses Local Endpoint Policy

Evidence:

- `createInferenceRuntime()` accepts `KHONJEL_LLAMA_ENDPOINT` and creates a llama engine for that endpoint directly.
- Spawned llama-server is restricted to loopback and protected by a per-session bearer token.
- The environment override path does not apply `isEndpointAllowed()` or a loopback check.

Risk:

This is an explicit developer/operator override, not a normal user setting. Still, if set accidentally or inherited from a hostile environment, cleanup/chat text can be sent to an arbitrary endpoint while the app logs `inference engine: endpoint`.

Recommendation:

- Require `KHONJEL_LLAMA_ENDPOINT` to be loopback or HTTPS.
- Log a prominent warning when it is non-loopback.
- Consider requiring `KHONJEL_LLAMA_ALLOW_REMOTE=1` for remote endpoints.

### F11 - Low - Packaged App Includes Electron Source/Test Files

Evidence:

- `app/package.json` packages `electron/**/*`.
- Runtime needs `electron/main.cjs` and `electron/preload.cjs`, not TypeScript source or tests.

Risk:

The source appears public, so this is not a major confidentiality problem. It still increases package contents, exposes implementation details unnecessarily in the installed artifact, and can confuse runtime/build analysis because source and generated code ship together.

Recommendation:

- Change package `files` to include only:
  - `dist/**/*`
  - `electron/main.cjs`
  - `electron/preload.cjs`
  - `package.json`
  - `build/icon.png`
- Keep TypeScript source and tests out of release artifacts.

## Data Flow and Privacy Notes

### Microphone and Audio

- Renderer captures microphone audio with `getUserMedia`.
- Streaming mode sends base64 PCM16 chunks to main over `khonjel:capture-chunk`.
- Main segments audio and transcribes closed windows, emitting transcript events back to every app window.
- If STT is cloud-bound, audio windows are posted to the configured provider; otherwise they use local Whisper if available.
- The current live dictation path does not retain raw audio after transcription.

### Dictation, Notes, Chat, and History

- Final dictation text can be saved to history depending on `saveHistory`.
- Notes, chat, history, dictionary, snippets, transforms, uploads, and integrations are persisted in `content.json`.
- `content.json` is encrypted when `safeStorage` is available.
- History retention is enforced only on `addHistory`; existing old entries may remain until a new history item is added unless other cleanup paths are added.

### Provider Connections and Secrets

- Connection profiles store endpoint/kind/model metadata in `connections.json`.
- API keys/tokens are stored in `secrets.json` encrypted by `safeStorage` when available.
- Provider requests are made in main and enforce HTTPS except loopback.
- Renderer can set/remove secrets but cannot read them back through IPC.

### OS Clipboard and Foreground App

- Dictation injection may write text to clipboard, paste, and restore the prior clipboard.
- Transform hotkeys copy foreground selection through Ctrl+C and process that text through inference.
- Clipboard contents are therefore a privacy-sensitive boundary and should avoid stale fallback behavior.

## Suggested Remediation Order

1. Fix build integrity drift (F2) so reviewed TypeScript and runtime CJS cannot diverge.
2. Fix stale clipboard fallback in `captureSelection()` (F4), because it can leak unrelated clipboard data.
3. Populate model sha256 pins and enforce strict pin verification in CI/release (F1).
4. Add IPC payload budgets and per-collection schemas (F3).
5. Tighten media permission origin checks (F7).
6. Decide product behavior for encryption-unavailable hosts (F5).
7. Add clear runtime disclosure for cloud-routed dictation/chat/transforms (F8).
8. Reduce package contents and sanitize provider errors (F9, F11).
9. Gate remote `KHONJEL_LLAMA_ENDPOINT` overrides (F10).

## Verification Commands Used

```powershell
cd e:\Projects\Work\khonjel
git rev-parse --short HEAD

cd e:\Projects\Work\khonjel\app
npm audit --omit=dev --json
npm run verify:pins
Select-String -Path electron\main.cjs -Pattern 'openExternal\(url\)|url\.startsWith\("http"\)|khonjel:capture-chunk|isTrustedSender|assertSecureEndpoint'
```

Observed results:

- Audited revision: `86c305f`.
- Production dependency audit: 0 vulnerabilities.
- Model pins: 0/8 pinned.
- Checked-in `electron/main.cjs` contains stale `url.startsWith("http")` external-link behavior and did not show the searched newer hardening markers.

## Final Assessment

Khonjel is moving in the right direction: the core Electron containment model, IPC contract discipline, provider secret handling, and endpoint policy are solid foundations. The main risks now are ensuring the built runtime always matches hardened source, closing supply-chain gaps for large native-consumed model files, bounding trusted-renderer IPC payloads, and making privacy-sensitive remote processing visible at the exact moment it happens.

Once F1-F4 are addressed, the app would be in a much stronger position for a beta-quality privacy/security posture.
# Independent Security and Privacy Audit - 2026-06-23

Audited revision: `86c305f`

Scope: Khonjel desktop app source under `app/`, including the Electron main process, preload bridge, renderer services/hooks, provider/network code, local storage, model download path, audio capture path, text injection path, build/package configuration, and relevant automated tests. This report was prepared from code/config/test inspection and fresh command output only; prior audit materials were not used.

## Executive Summary

Khonjel has a stronger-than-average Electron security posture for an early local-first app. The main renderer windows run with `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`; the renderer talks to main through a single versioned IPC invoke seam backed by zod request validation; top-level navigation is locked to app origins; production builds inject a restrictive CSP; provider secrets stay in main and are encrypted with Electron `safeStorage`; provider endpoints are HTTPS-only except loopback; and the new streaming capture path bounds memory by segmenting audio rather than retaining a full long-form recording.

The highest priority gaps are supply-chain and build-integrity issues, not obvious raw remote-code-execution bugs:

- Local model manifests are not pinned with sha256 hashes. `npm run verify:pins` reports `0/8` local model manifests pinned.
- The checked-in runtime bundle `app/electron/main.cjs` is stale relative to the hardened TypeScript source. The package/start scripts rebuild it, but the repository's actual Electron entrypoint can drift from reviewed source.
- The generic IPC invoke path validates shape, but not maximum sizes or per-collection item schemas, leaving room for renderer-origin denial of service or durable-store poisoning if the renderer is compromised.
- A failed selection capture can fall back to previous clipboard contents, creating a privacy leak for hotkey transforms.

No production dependency advisories were reported by `npm audit --omit=dev` at the audited revision.

## Quick Risk Register

| ID | Severity | Area | Finding | Primary Fix |
| --- | --- | --- | --- | --- |
| F1 | High | Supply chain | Local model downloads have no sha256 pins (`0/8`). | Populate hashes and make `STRICT=1 npm run verify:pins` a release gate. |
| F2 | High | Build integrity | `electron/main.cjs` is stale compared with `electron/main/main.ts`. | Stop tracking generated bundles or enforce a clean post-build diff in CI. |
| F3 | Medium | IPC robustness | Generic IPC schemas lack payload size limits and per-collection schemas. | Add max lengths/counts/byte caps and validate collection elements. |
| F4 | Medium | Clipboard privacy | `captureSelection()` may return stale clipboard text if Ctrl+C fails. | Return empty on unchanged clipboard and restore the clipboard. |
| F5 | Medium | At-rest privacy | User content encryption can fall back to plaintext; settings/connections are plaintext. | Fail closed or show explicit degraded-mode warning for packaged builds. |
| F6 | Medium | Renderer compromise impact | Preload exposes powerful capabilities to any trusted app renderer frame. | Add capability segmentation, user-gesture checks, and rate limits for sensitive channels. |
| F7 | Medium | Permissions | Microphone permission handler grants `media` by permission name only. | Check requesting frame/origin before granting media. |
| F8 | Medium | Remote processing privacy | Cloud-routed chat/STT/transforms can send text/audio/selection off-device without per-action friction. | Add explicit runtime indicators and confirmations for cloud-routed sensitive actions. |
| F9 | Low | Error handling | Provider errors may surface a slice of remote response body to the renderer. | Sanitize provider error detail before returning it. |
| F10 | Low | Local inference override | `KHONJEL_LLAMA_ENDPOINT` bypasses loopback/secure endpoint policy. | Enforce loopback or HTTPS, or log a prominent debug warning. |
| F11 | Low | Packaging | `electron/**/*` includes TS/test source in packaged app. | Package only `electron/main.cjs`, `electron/preload.cjs`, `dist`, package metadata, and icon. |

## Positive Controls Observed

### Electron Window Isolation

- Main and floating windows use `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` in `app/electron/main/main.ts`.
- New-window creation is denied by `setWindowOpenHandler`; HTTPS links are forwarded externally rather than rendered in-app.
- Top-level navigation and redirects are blocked unless they stay on `file://` or the dev server origin.
- Production Vite builds inject a CSP meta tag with `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `base-uri 'none'`, and `frame-ancestors 'none'` in `app/vite.config.ts`.
- A real Electron eval, `app/eval/scenarios/security-hardening.eval.electron.mjs`, verifies inline script blocking and navigation lock in the built renderer.

### IPC Design

- Renderer-to-main request/response traffic uses one generic `khonjel:invoke` channel.
- The preload sends a `CONTRACT_VERSION`; main rejects mismatches.
- `createDispatch()` rejects unknown channels and validates request tuples with zod schemas from `app/electron/shared/ipc-schemas.ts`.
- Main checks sender origin with `isTrustedSender()` before handling `khonjel:invoke`.
- One-way `ipcMain.on` channels are wrapped with `ipcOn()`, which applies the same trusted-sender check.
- The high-rate capture chunk channel validates basic type and caps each chunk at 4,000,000 base64 characters.

### Secrets and Provider Traffic

- Provider API keys are set/write-only from renderer perspective: `secrets:set`, `secrets:has`, and `secrets:remove`; there is no `secrets:get` IPC channel.
- `safeStorageCipher` uses Electron `safeStorage` and refuses to persist plaintext when OS encryption is unavailable.
- `createSecretStore()` keeps secrets in memory only when encryption fails and purges older persisted values for that id.
- Provider HTTP runs in the main process through `proxyFetch`, so API keys are not placed in renderer memory for normal provider calls.
- `isEndpointAllowed()` and `assertSecureEndpoint()` require HTTPS for remote provider endpoints and allow cleartext HTTP only for loopback hosts.
- Provider calls have a 60-second timeout and a 16 MB response cap.

### Local Data Handling

- Main stores settings/content/connections in app `userData`, not in the renderer bundle.
- `content.json` is wired through `encryptedSettingsIO()` in the current composition root.
- Dictation history stores final text and metadata but not raw audio (`hasAudio: false` for live dictation).
- Temp WAV files for non-streaming STT are deleted in a `finally` block after transcription.
- Streaming capture avoids retaining the full session in memory; closed audio windows are transcribed and dropped.
- `privacy.historyRetentionDays` is enforced when adding history entries.
- The renderer honors the `saveHistory` privacy toggle before adding dictation history.

### Text Injection Safety

- Shell/terminal targets use the `type` strategy rather than paste by default.
- Shell apps strip trailing newlines before injection, reducing accidental command execution risk.
- Paste injection snapshots and restores the user's clipboard after pasting.
- SendKeys special characters are escaped in `app/electron/main/injection/sendkeys.ts`.

### Verification Snapshot

- `npm audit --omit=dev --json`: 0 production vulnerabilities.
- `npm run verify:pins`: 0/8 local model manifests pinned with sha256.
- Checked-in `app/electron/main.cjs` contains stale security-relevant behavior not matching `app/electron/main/main.ts`.

## Detailed Findings

### F1 - High - Local Model Downloads Are Not Pinned

Evidence:

- `app/electron/main/models/downloader.ts` supports sha256 verification when a manifest provides `sha256`.
- `app/electron/main/models/catalog.ts` has local model manifests but no `sha256` fields.
- `npm run verify:pins` reports:
  - `model pins: 0/8 manifests pinned with sha256`
  - Missing pins include all Whisper and GGUF local models.

Risk:

The in-app downloader currently relies primarily on TLS and the remote model host. A poisoned mirror, compromised upstream, CDN issue, or environment source override could deliver a malicious or tampered model. Model files are not executable in the same way as code, but they are parsed by native inference engines and can influence app behavior, privacy, and memory-safety exposure in external runtimes.

Recommendation:

- Download each intended model artifact once in a controlled release environment and compute sha256.
- Populate `sha256` and `bytes` for every manifest entry.
- Make `STRICT=1 node scripts/verify-model-pins.mjs` mandatory in CI/release packaging.
- Reject `KHONJEL_MODEL_SOURCES` overrides unless the same pinned hash is satisfied.

### F2 - High - Checked-In Runtime Bundle Is Stale Relative to Hardened Source

Evidence:

- `app/package.json` uses `electron/main.cjs` as the Electron `main` entrypoint.
- The audited TypeScript source in `app/electron/main/main.ts` restricts external links to `https://`.
- The checked-in/generated `app/electron/main.cjs` still contains `url.startsWith("http")` before `shell.openExternal(url)`, which is broader and appears to predate the current hardening.
- `Select-String` did not find newer searched hardening markers such as `isTrustedSender`, `khonjel:capture-chunk`, or `assertSecureEndpoint` in the checked-in `main.cjs` during the audit sweep, indicating significant drift.

Risk:

The normal `npm run electron`, `npm run package`, and `npm run build:electron` flows rebuild the CJS bundle, but any direct `electron .`, manual packaging, or missed build step will execute stale code. Because the stale file is the declared app entrypoint, review of TypeScript alone is not sufficient to know what will run.

Recommendation:

- Prefer not to track generated `electron/main.cjs` and `electron/preload.cjs`; build them into a generated output directory used by package/start scripts.
- If tracking generated bundles remains necessary, add a CI gate: `npm run build:electron && git diff --exit-code app/electron/main.cjs app/electron/preload.cjs`.
- Make direct `electron .` unsafe by convention impossible: point `main` at a build output that is always regenerated by scripts, or add a startup build hash assertion.
- Package only built runtime artifacts, not both source and stale generated artifacts.

### F3 - Medium - Generic IPC Schemas Lack Payload Size Limits and Per-Collection Item Validation

Evidence:

- `app/electron/shared/ipc-schemas.ts` uses unrestricted `z.string()` for several sensitive/heavy payloads, including `transcription:transcribe`, `system:injectText`, `inference:chat`, and content fields.
- `content:replace` validates only `[ContentCollectionSchema, z.array(z.unknown())]`.
- The special high-rate capture channel does have a 4,000,000-character per-chunk cap, showing the risk is recognized for streaming audio.

Risk:

A buggy or compromised trusted renderer frame can send huge strings or arrays through valid IPC channels, consuming memory, disk, and CPU in the main process, or poisoning durable content with malformed collection items. This is mostly a local denial-of-service and data-integrity risk, but it also increases blast radius after any renderer compromise.

Recommendation:

- Add explicit max lengths for text, chat messages, injected text, base64 audio, connection ids, endpoint strings, and prompts.
- Add max array counts for history/chat/notes/uploads/dictionary/snippets/transforms.
- Replace `z.array(z.unknown())` for `content:replace` with per-collection schemas.
- Enforce a maximum serialized JSON document size before writing `content.json`.

### F4 - Medium - Selection Capture Can Leak Stale Clipboard Contents

Evidence:

- `app/electron/main/injection/win32.ts` snapshots the clipboard, sends Ctrl+C, polls for a changed clipboard value, and returns the changed value when present.
- If the clipboard does not change, it returns `clipboard.readText()` anyway.
- `app/src/app/system/GlobalDictation.tsx` sends the returned selection through `inference.chat()` for hotkey transforms, which may route to a cloud provider depending on settings.

Risk:

If Ctrl+C fails, the focused app blocks copying, the selection is empty, or clipboard contents are unchanged, the transform path can process the user's previous clipboard contents instead of the intended selection. If the LLM slot is cloud-routed, stale clipboard text can be sent off-device unintentionally.

Recommendation:

- Return an empty string when the clipboard does not change after Ctrl+C.
- Restore the previous clipboard value after selection capture.
- Consider adding a short visible error/state when no selection is captured.
- Add a regression test for unchanged clipboard returning empty.

### F5 - Medium - At-Rest Encryption Can Degrade to Plaintext for User Content

Evidence:

- `content.json` is passed through `encryptedSettingsIO()`.
- `encryptedSettingsIO()` writes plaintext if `cipher.encrypt()` throws.
- The secret store fails closed and keeps secrets in memory when encryption is unavailable, but content/settings do not fail closed.
- Settings and connection profiles are stored through `fileSettingsIO()` without content encryption. They do not contain API keys, but they can reveal provider endpoints, model choices, preferences, and privacy settings.

Risk:

On systems where `safeStorage` encryption is unavailable or fails, transcripts, notes, chat history, dictionary entries, and uploads can be written as plaintext. This is a privacy regression relative to the local-first/privacy-first expectation.

Recommendation:

- In packaged builds, fail closed for `content.json` when encryption is unavailable, or require explicit user opt-in to degraded plaintext mode.
- Surface a visible privacy status indicator when user content is not encrypted at rest.
- Consider encrypting connection profiles and sensitive settings values as well, even though API keys are separately protected.
- Add an Electron eval that simulates encryption unavailable and asserts the user is warned or persistence is disabled.

### F6 - Medium - Renderer Compromise Has Broad IPC Impact

Evidence:

- The preload exposes `window.khonjel.invoke(channel, ...args)` to the trusted renderer.
- Any script executing in the trusted renderer origin can call all invoke channels: content replacement, settings patching, secret setting/removal, model actions, capture start/stop, text injection, and selection capture.
- CSP, React escaping, navigation lock, sandboxing, and trusted-sender checks substantially reduce the chance of arbitrary script execution, but they do not reduce the privilege of a compromised trusted renderer.

Risk:

If renderer code execution is achieved through a dependency issue, malicious static SVG import, compromised build artifact, or future unsafe rendering path, the attacker can mutate data, capture selected text, inject text into other apps, alter provider routes, or drive model downloads through the existing app bridge.

Recommendation:

- Replace the generic renderer-exposed `invoke` with a narrow API object exposing only typed methods, or enforce an allow-list at preload level as well as main.
- Require user gestures or explicit confirmations for destructive/system channels (`reset-data`, `clear-cache`, model remove, selection capture, text injection, secrets remove).
- Add channel-level rate limits and payload budgets.
- Add telemetry-free local audit events for sensitive operations so users can see what happened.

### F7 - Medium - Microphone Permission Handler Does Not Verify Request Origin

Evidence:

- `session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === "media"))` grants any `media` request in the default session.
- `setPermissionCheckHandler` uses the same permission-only check.
- Navigation locks and window-open denial make remote frames unlikely, but the permission handler itself does not check the requesting `webContents` URL or frame.

Risk:

If a future feature creates another window, embeds content, changes navigation rules, or has a race/bug before navigation is blocked, any frame in the default session requesting `media` would receive microphone permission.

Recommendation:

- In both permission handlers, verify the requesting frame/webContents URL with the same trusted-origin policy used by IPC.
- Deny media for unknown, destroyed, or non-app frames.
- Add a real Electron eval that attempts media from a disallowed origin and expects denial.

### F8 - Medium - Remote Processing Privacy Needs Stronger Runtime Disclosure

Evidence:

- `useDictation()` routes STT through the provider router when the `stt.dictation` slot is cloud-bound.
- `inference.chat()` and `inference.cleanup()` can route text to configured provider connections.
- Hotkey transforms copy foreground app selection and pass it to `inference.chat()`.
- Provider endpoints and API keys are well controlled technically, but the user's sensitive data can intentionally leave the device when a slot is remote.

Risk:

Users may understand that a connection is configured, but not notice when a specific dictation, note action, chat turn, or transform is being sent off-device. Selection transforms are especially sensitive because the source app is outside Khonjel and may contain confidential content.

Recommendation:

- Show a live `Local` vs `Cloud/Provider` indicator on dictation, chat, notes, and transform surfaces.
- For cloud-routed selection transforms, require first-run confirmation explaining that selected text will be sent to the configured provider.
- Add a per-slot privacy summary: data sent, provider endpoint, retention caveat, and whether audio or text is sent.
- Consider an optional `never send selected text to cloud` policy toggle.

### F9 - Low - Provider Error Detail Can Surface Remote Response Body

Evidence:

- `proxyFetch.readBody()` throws `HTTP status: ${text.slice(0, 400)}` for non-OK responses.
- The provider router wraps errors into `ipcError("provider_error", ..., String(err))`, returning detail to renderer callers.

Risk:

Some provider error bodies echo request fields or include diagnostic data. A 400-character response slice may expose sensitive prompt/audio metadata in renderer UI, tests, or logs depending on how callers display errors.

Recommendation:

- Return only status code and a sanitized provider label to renderer.
- Keep full details in a local debug log only when explicit debug logging is enabled.
- Strip headers, request bodies, and provider response snippets by default.

### F10 - Low - `KHONJEL_LLAMA_ENDPOINT` Bypasses Local Endpoint Policy

Evidence:

- `createInferenceRuntime()` accepts `KHONJEL_LLAMA_ENDPOINT` and creates a llama engine for that endpoint directly.
- Spawned llama-server is restricted to loopback and protected by a per-session bearer token.
- The environment override path does not apply `isEndpointAllowed()` or a loopback check.

Risk:

This is an explicit developer/operator override, not a normal user setting. Still, if set accidentally or inherited from a hostile environment, cleanup/chat text can be sent to an arbitrary endpoint while the app logs `inference engine: endpoint`.

Recommendation:

- Require `KHONJEL_LLAMA_ENDPOINT` to be loopback or HTTPS.
- Log a prominent warning when it is non-loopback.
- Consider requiring `KHONJEL_LLAMA_ALLOW_REMOTE=1` for remote endpoints.

### F11 - Low - Packaged App Includes Electron Source/Test Files

Evidence:

- `app/package.json` packages `electron/**/*`.
- Runtime needs `electron/main.cjs` and `electron/preload.cjs`, not TypeScript source or tests.

Risk:

The source appears public, so this is not a major confidentiality problem. It still increases package contents, exposes implementation details unnecessarily in the installed artifact, and can confuse runtime/build analysis because source and generated code ship together.

Recommendation:

- Change package `files` to include only:
  - `dist/**/*`
  - `electron/main.cjs`
  - `electron/preload.cjs`
  - `package.json`
  - `build/icon.png`
- Keep TypeScript source and tests out of release artifacts.

## Data Flow and Privacy Notes

### Microphone and Audio

- Renderer captures microphone audio with `getUserMedia`.
- Streaming mode sends base64 PCM16 chunks to main over `khonjel:capture-chunk`.
- Main segments audio and transcribes closed windows, emitting transcript events back to every app window.
- If STT is cloud-bound, audio windows are posted to the configured provider; otherwise they use local Whisper if available.
- The current live dictation path does not retain raw audio after transcription.

### Dictation, Notes, Chat, and History

- Final dictation text can be saved to history depending on `saveHistory`.
- Notes, chat, history, dictionary, snippets, transforms, uploads, and integrations are persisted in `content.json`.
- `content.json` is encrypted when `safeStorage` is available.
- History retention is enforced only on `addHistory`; existing old entries may remain until a new history item is added unless other cleanup paths are added.

### Provider Connections and Secrets

- Connection profiles store endpoint/kind/model metadata in `connections.json`.
- API keys/tokens are stored in `secrets.json` encrypted by `safeStorage` when available.
- Provider requests are made in main and enforce HTTPS except loopback.
- Renderer can set/remove secrets but cannot read them back through IPC.

### OS Clipboard and Foreground App

- Dictation injection may write text to clipboard, paste, and restore the prior clipboard.
- Transform hotkeys copy foreground selection through Ctrl+C and process that text through inference.
- Clipboard contents are therefore a privacy-sensitive boundary and should avoid stale fallback behavior.

## Suggested Remediation Order

1. Fix build integrity drift (F2) so reviewed TypeScript and runtime CJS cannot diverge.
2. Fix stale clipboard fallback in `captureSelection()` (F4), because it can leak unrelated clipboard data.
3. Populate model sha256 pins and enforce strict pin verification in CI/release (F1).
4. Add IPC payload budgets and per-collection schemas (F3).
5. Tighten media permission origin checks (F7).
6. Decide product behavior for encryption-unavailable hosts (F5).
7. Add clear runtime disclosure for cloud-routed dictation/chat/transforms (F8).
8. Reduce package contents and sanitize provider errors (F9, F11).
9. Gate remote `KHONJEL_LLAMA_ENDPOINT` overrides (F10).

## Verification Commands Used

```powershell
cd e:\Projects\Work\khonjel
git rev-parse --short HEAD

cd e:\Projects\Work\khonjel\app
npm audit --omit=dev --json
npm run verify:pins
Select-String -Path electron\main.cjs -Pattern 'openExternal\(url\)|url\.startsWith\("http"\)|khonjel:capture-chunk|isTrustedSender|assertSecureEndpoint'
```

Observed results:

- Audited revision: `86c305f`.
- Production dependency audit: 0 vulnerabilities.
- Model pins: 0/8 pinned.
- Checked-in `electron/main.cjs` contains stale `url.startsWith("http")` external-link behavior and did not show the searched newer hardening markers.

## Final Assessment

Khonjel is moving in the right direction: the core Electron containment model, IPC contract discipline, provider secret handling, and endpoint policy are solid foundations. The main risks now are ensuring the built runtime always matches hardened source, closing supply-chain gaps for large native-consumed model files, bounding trusted-renderer IPC payloads, and making privacy-sensitive remote processing visible at the exact moment it happens.

Once F1-F4 are addressed, the app would be in a much stronger position for a beta-quality privacy/security posture.
