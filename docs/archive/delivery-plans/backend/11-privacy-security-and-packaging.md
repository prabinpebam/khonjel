# 11 — Privacy, security & packaging

> Backend-implementation specifics for keeping Khonjel private and shippable. Policy-level
> detail is in [`../02-privacy-data-security.md`](../02-privacy-data-security.md); this doc is
> the **how**: secret storage, proxied egress, the Electron security baseline, retention
> enforcement, code signing, auto-update, and packaging.

---

## 1. Secret storage
- **API keys / OAuth tokens** live in the OS keychain via `@napi-rs/keyring` (+ Electron
  `safeStorage` for at-rest encryption of any local blob). **Never** in SQLite, JSON, logs,
  env files, or the renderer.
- `secrets:set(providerId, key)` writes to the keychain and returns nothing; `secrets:has`
  returns only a boolean. Keys are read **in main, at call time**, by `ProviderContext.getApiKey`.
- The renderer can know *whether* a key exists (to render UI state) but can never read it.

## 2. Egress rules (auditable, opt-in)
- **Default = no egress.** Local STT + local LLM keep the entire hot path offline.
- **All provider HTTP is performed in main** by `proxyFetch.ts` — the renderer cannot make
  provider calls (no keys, no CORS exposure). Egress only ever goes to the **exact endpoint of
  the slot's chosen provider**.
- **No telemetry / no analytics by default.** Any diagnostics are opt-in and stay local unless
  the user exports them.
- An **egress allow-list** derived from configured **connection profiles**
  ([10 §3a](10-providers-and-models.md)) + integrations is the only set of hosts main will
  contact; anything else is refused and logged (opt-in log). For Azure OpenAI this is the user's
  resource host from the profile's `baseEndpoint` (e.g. `*.cognitiveservices.azure.com` or
  `*.openai.azure.com`) — derived from config, never a hardcoded host.

## 3. Electron security baseline
```ts
new BrowserWindow({ webPreferences: {
  contextIsolation: true,         // mandatory
  nodeIntegration: false,         // renderer has no Node
  sandbox: true,
  preload,                        // only the allow-listed bridge
}});
```
- **Channel allow-list** in preload; unknown channels rejected (no wildcard bridge).
- **zod-validate every IPC payload** at the main boundary; reject malformed input as
  `IpcError("validation")`.
- **CSP** on renderer HTML; no remote code; `webSecurity` on. External links open in the OS
  browser via `shell.openExternal`, never in-app.
- **No `eval`, no remote module loading.** Sidecars are bundled binaries with verified checksums.
- **Single-instance lock**; second launch focuses the existing window.

## 4. Retention enforcement (in main)
- The privacy retention setting governs: store raw text? store audio? history TTL.
- A periodic main job purges expired `transcriptions` rows + `audio/` files **off the hot
  path**. Deleting an item also removes its Qdrant vector and audio.
- **Clear data** truncates chosen tables + audio; **Export** writes JSON(+audio) to `exports/`.
- "What gets stored/logged" is shown verbatim in Settings ▸ Privacy so the behavior is transparent.

## 5. Code signing & notarization
- **Windows:** Authenticode sign the installer + app (EV or OV cert); timestamped.
- **macOS:** Developer ID sign + **notarize** + staple; hardened runtime; entitlements limited
  to mic + (opt-in) accessibility/automation for text injection.
- **Linux:** AppImage/deb/rpm; provide checksums + (optionally) a signed repo.
- Signing secrets come from CI secrets, never the repo.

## 6. Auto-update
- **electron-updater** checks a release feed; download + verify signature + apply on quit.
- Update notification surfaces via the `update:available` event/overlay; user controls timing.
- **Channel** support (stable/beta); updates are opt-out-able; no silent forced updates.

## 7. Packaging (electron-builder 26)
- Targets: **mac** (dmg, arm64/x64), **win** (nsis exe), **linux** (AppImage/deb/rpm/tar) —
  the current `app` builder config is the baseline.
- **Native modules** (`better-sqlite3`, `@napi-rs/keyring`, `sherpa-onnx`, `onnxruntime-node`)
  rebuilt for Electron via `electron-builder install-app-deps`.
- **Bundled binaries/models** under `resources/bin/` (whisper.cpp, llama-server, AEC helper,
  per-OS native helpers); large default models downloaded on first run, not shipped, to keep
  installers lean.
- Main process TypeScript compiled (esbuild/tsup) to `main.cjs`/`preload.cjs` — a **net-new**
  build step (today those files are hand-authored CommonJS).
- `--legacy-peer-deps` for all installs (repo eslint peer constraint).

## 8. Optional account/sync (compile-out by default)
- Auth (better-auth) + Sync compile **out** unless an `AUTH_URL` build value is set → the
  shipped default is fully local, no account, no network identity.
- When enabled, tokens go to the keychain; sync egress is opt-in and limited to the sync host.

## 9. Threat-model checklist
- [ ] Keys/tokens only in OS keychain; never in DB/logs/renderer; renderer sees booleans only.
- [ ] All provider/network egress performed in main, restricted to a configured allow-list.
- [ ] `contextIsolation`+`sandbox` on, `nodeIntegration` off; preload exposes only allow-listed channels.
- [ ] Every IPC payload zod-validated; external links via `shell.openExternal`; CSP enforced.
- [ ] Retention purge runs off the hot path; clear/export honor the privacy setting.
- [ ] Installers signed/notarized; native modules rebuilt; updates signature-verified.
- [ ] Default build is fully local (auth/sync/telemetry off); no forced updates.
