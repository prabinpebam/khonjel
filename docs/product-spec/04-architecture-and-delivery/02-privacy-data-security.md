# Khonjel — Privacy, Data & Security

> Khonjel's trust model. Privacy is a **product feature**, not a policy footnote:
> local-by-default, off-by-default egress, visible retention, and honest controls.
> Merges OpenWhispr's "everything off by default" with Wispr Flow's data controls.

---

## 1. Privacy posture (defaults)

| Setting | Default | Effect |
|---|---|---|
| Engine archetype | **Local** | On-device STT + LLM; no egress |
| Local data storage | **Store locally** | History/notes stay on device |
| Data Retention | **On (local)** | Transcripts/audio saved to local history |
| Audio Retention | **30 days** | Audio auto-deleted after the window |
| Privacy Mode | **On (no training)** | No data used to train/improve any model |
| Cloud backup | **Off** | Nothing backed up to any cloud |
| Cloud Sync | **Off** | No cross-device sync |
| Usage analytics | **Off** | No metrics sent |
| Context awareness | **Off** (opt-in) | App text not read unless enabled |
| HIPAA BAA | **Off** (opt-in) | Compliance mode available |

> The first-run default is a fully local, no-account, no-egress configuration. Every
> control that moves data off the device is opt-in and explained at the point of choice.

---

## 2. Data inventory & storage

| Data | Contains | Location (default) | Retention |
|---|---|---|---|
| Settings | Preferences, engine configs | Local store | Until changed/reset |
| API keys / creds | Provider keys, endpoint tokens | **OS keychain/credential store** (encrypted) | Until removed |
| History entries | Transcripts, formatting, metadata | Local store | Until deleted; none if Data Retention off |
| Audio recordings | Captured audio | Local files | `Audio Retention` window |
| Notes | Saved transcripts/recordings | Local store | Until deleted; optional sync (P2) |
| Dictionary/Snippets/Styles/Transforms | User content | Local store (team scope syncs, P2) | Until deleted |
| Insights aggregates | Counts/derived stats | Local store | Recomputed from history |
| Model cache | Downloaded models | Model cache dir | Until cleared |
| Debug logs | Diagnostic logs | Local files | Until cleared/rotated |

- **Encryption at rest** for credentials (keychain) and sensitive store data.
- **No transcription content** is ever included in analytics, even when analytics is on
  (only timing/error metrics) — carried from the reference promise.

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
