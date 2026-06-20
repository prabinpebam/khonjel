# Khonjel — Privacy, Data & Security

> Khonjel's trust model. Privacy is a **product feature**, not a policy footnote:
> local-by-default, off-by-default egress, visible retention, and honest controls.
> Inherits OpenWhispr's **"no data collection, no telemetry, fully local"** posture;
> adds Wispr Flow's data controls as opt-in extras. **No subscription/account is
> required**, and accounts/sync can be compiled out entirely.

---

## 1. Privacy posture (defaults)

> **Everything is on-device.** Your **profile/identity** and **all your data** (history,
> notes, dictionary, snippets, settings, models, search index) are stored **locally**.
> No account, no cloud, no telemetry by default. The full provider matrix (see
> [`../01-product/03-ai-engines-and-providers.md`](../01-product/03-ai-engines-and-providers.md))
> is supported, but choosing a cloud model is the *only* thing that sends data off-device
> — and it's always an explicit choice.

| Setting | Default | Effect |
|---|---|---|
| Inference mode | **Local** | On-device STT (Whisper/Parakeet) + LLM (llama.cpp); no egress |
| **User profile / identity** | **Local only** | Name/avatar/preferences live on-device; **no account required** |
| **Storage** | **Local** (better-sqlite3 + Qdrant + files) | History/notes/dictionary/settings/models/vectors stay on device |
| Secrets | **OS keychain** (`@napi-rs/keyring`) | API keys never in plaintext/logs |
| **Telemetry / usage analytics** | **Off / none** | No metrics collected by default |
| Account / cloud auth | **Optional / skippable** | Only for opt-in sync; can be compiled out (`AUTH_URL`) |
| Data Retention | **On (local)** | Transcripts/audio saved to local history |
| Audio Retention | **30 days** (0–90 selectable) | Audio auto-deleted after the window |
| Cloud backup / sync | **Off** | No cross-device sync unless opted in |
| Semantic search index | **Local** (Qdrant + MiniLM) | Computed on-device |
| Permissions (mic/AX/system-audio) | **Prompted, explicit** | Granted by the user, shown with status |
| Privacy Mode "no training" / HIPAA BAA / context awareness | **Off** (opt-in) | Additive compliance extras |

> The first-run default is a **fully local, no-account, no-egress, no-telemetry**
> configuration. **Account details and storage stay on the device** unless the user
> explicitly turns on optional cloud sync. There is **no subscription or billing data of
> any kind.**

---

## 2. Data inventory & storage

| Data | Contains | Location (default) | Retention |
|---|---|---|---|
| **User profile / identity** | Name, avatar, preferences | **Local store (on-device)** | Until changed; **never required** |
| Settings | Preferences, engine/provider configs | Local store | Until changed/reset |
| API keys / creds | Provider keys, endpoint tokens | **OS keychain/credential store** (encrypted) | Until removed |
| History entries | Transcripts, formatting, metadata | Local store | Until deleted; none if Data Retention off |
| Audio recordings | Captured audio | Local files | `Audio Retention` window |
| Notes (+ vectors) | Saved transcripts/recordings; semantic index | Local store + **Qdrant (local)** | Until deleted; optional sync (P2) |
| Dictionary/Snippets/Styles/Transforms | User content | Local store (team scope syncs, P2) | Until deleted |
| Insights aggregates | Counts/derived stats | Local store | Recomputed from history |
| Model cache | Downloaded STT/LLM models | Model cache dir | Until cleared |
| Debug logs | Diagnostic logs | Local files | Until cleared/rotated |

- **All rows default to on-device.** Only optional, explicitly-enabled cloud sync moves
  any of this off the machine.
- **Encryption at rest** for credentials (keychain) and sensitive store data.
- **No telemetry; no transcription content leaves the device** by default.

---

## 3. Retention controls (UI ↔ behaviour)
- **Audio Retention** dropdown + **Storage Usage** meter + **Clear All Audio** (Ref: OW S14).
- **Data Retention** toggle: off ⇒ text is inserted but **not persisted** to history
  (Insights then show only aggregate counts).
- **Model cache:** Open + **Clear Cache** (Ref: OW S8).
- **Reset app data:** wipes settings, history, notes, audio, downloaded models, cache —
  guarded confirm (Ref: OW S9 / WF W13).

---

## 4. Egress map (what can leave, only if enabled)

| Egress | Trigger | Destination | Guard |
|---|---|---|---|
| STT/LLM request | Cloud/Enterprise/Managed engine selected | Chosen provider | Explicit engine choice |
| Cloud backup | Toggle on | Khonjel Cloud | Off by default |
| Cloud Sync | Toggle on | Khonjel Cloud | Off by default |
| Usage analytics | Toggle on | Khonjel | Off by default; no content |
| Context text | Context awareness on | Selected LLM | Off by default; limited scope |
| Note share link | User shares a note | Recipients | Per-note scope (P2) |

- With **Local** engines and all toggles off, **zero** network egress occurs.
- The sidebar engine-status card always reflects whether the active engine is local or
  remote, so users can see at a glance if data could leave.

---

## 5. Security requirements

### 5.1 Prompt-injection defense
- The default cleanup prompt treats transcribed speech as **data, not instructions**
  (Ref: OW S7). Only the explicit wake word / agent overlay enters instruction mode.
- Snippet/Transform prompts are user-authored and clearly scoped; transformed text is
  shown via the **view-changes** preview before applying where configured.

### 5.2 Credentials & endpoints
- API keys/tokens stored in the OS secure store; never logged; masked in UI.
- Self-Hosted endpoints validated; HTTPS recommended; Bearer token optional and
  separate from any provider key (Ref: OW S5).
- Enterprise creds follow each provider's auth (IAM/AAD/service account); least privilege.

### 5.3 Application security (OWASP-aware)
- Validate/parse all external responses (e.g. `/models` discovery) defensively; never
  execute returned content.
- Sanitize text before injection; respect secure/password fields (don't capture or
  inject into them inappropriately).
- Auto-update integrity (signed updates); dependency hygiene; no secrets in logs.
- Renderer windows sandboxed; IPC allow-listed; no arbitrary remote code.

### 5.4 Compliance (P2)
- **HIPAA BAA** opt-in (Ref: WF W18); when enabled, enforce local/compliant storage and
  restrict egress accordingly.
- **Data Controls** documentation surface; export/delete-my-data flows.

---

## 6. Transparency
- **Debug logging** shows exactly *what gets logged* before enabling (Ref: OW S8).
- **Analytics** copy states precisely what is and isn't sent.
- **Privacy & Data** page leads with "Everything is off by default."
- Egress and retention are inspectable; storage meters are real.

---

## 7. Privacy/security acceptance checklist
- [ ] Default config = local, no account, zero egress.
- [ ] Everything that leaves the device is off by default and explained at point of choice.
- [ ] Data Retention off ⇒ no history persisted; Insights degrade to counts only.
- [ ] Audio retention window enforced; storage meter + Clear All Audio work.
- [ ] Credentials in OS secure store; never logged; masked.
- [ ] Cleanup prompt enforces speech-as-data; only wake word/agent enters instruction mode.
- [ ] `/models` and provider responses parsed defensively; injected text sanitized.
- [ ] Reset/Clear actions guarded and scoped exactly as described.
