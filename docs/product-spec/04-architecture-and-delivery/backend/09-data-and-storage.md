# 09 — Data & storage

> The persistence layer: **SQLite schema** (better-sqlite3 + kysely), on-disk layout, model
> cache, keychain, and migrations. Tables map 1:1 to the domain entities in
> [app/src/services/ports/types.ts](../../../../app/src/services/ports/types.ts) so the `ipc`
> adapter can return the exact shapes the views already render.

---

## 1. Storage principles
- **Main process owns all durable state.** The renderer holds only ephemeral UI state
  (Zustand, not persisted) + a mirror of settings. Fixes OpenWhispr's localStorage-as-truth.
- **Local-first.** Everything lives under the per-user app data dir; no cloud unless the user
  opts into sync.
- **Secrets are never in SQLite.** API keys/tokens go to the OS keychain ([11](11-privacy-security-and-packaging.md)).
- **Retention-aware.** History/audio writes are gated by the privacy retention setting.

## 2. On-disk layout

```
<userData>/                         (app.getPath('userData'))
  khonjel.db                        SQLite (settings, history, notes, dictionary, …)
  khonjel.db-wal / -shm             WAL mode
  audio/                            optional retained capture audio (gated)
    <transcriptionId>.opus
  models/                           local model cache (STT + LLM)
    stt/whisper-*/  stt/parakeet-*/
    llm/<family>-<quant>.gguf
  search/                           (optional) Qdrant collection + MiniLM model for semantic search
  logs/                             opt-in diagnostics
  exports/                          user data exports
```

`models/` path is shown in Settings ▸ System with **Open** + **Clear cache**.

## 3. Schema (kysely table definitions, abbreviated)

```sql
-- settings: single-row JSON document holding the renderer's two flat maps
CREATE TABLE settings (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  doc           TEXT NOT NULL,              -- JSON { toggles: {..}, values: {..} } (zod-validated)
  schema_ver    INTEGER NOT NULL,
  updated_at    TEXT NOT NULL
);

-- transcriptions (Home/Insights history) ⇄ HistoryEntry
CREATE TABLE transcriptions (
  id            TEXT PRIMARY KEY,
  created_at    TEXT NOT NULL,
  final_text    TEXT NOT NULL,
  raw_text      TEXT,                       -- pre-cleanup (kept only if retention=full)
  app           TEXT NOT NULL,              -- active app at capture (for app-usage insights)
  app_category  TEXT,                       -- mapped category for breakdown
  language      TEXT NOT NULL,
  word_count    INTEGER NOT NULL,
  duration_sec  REAL NOT NULL,
  mode          TEXT NOT NULL,              -- 'dictation'|'note-recording'|'upload'
  has_audio     INTEGER NOT NULL,           -- 0/1
  cleanup_applied INTEGER NOT NULL,         -- 0/1 (false when isClean skipped)
  dictionary_fixes INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX ix_tx_created ON transcriptions(created_at);
CREATE INDEX ix_tx_app ON transcriptions(app_category);

-- folders / notes ⇄ Folder, Note
CREATE TABLE folders (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE notes (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, preview TEXT NOT NULL,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  from_recording INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE INDEX ix_notes_folder ON notes(folder_id);
CREATE INDEX ix_notes_updated ON notes(updated_at);

-- chat ⇄ ChatMessage
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY, role TEXT NOT NULL, content TEXT NOT NULL, created_at TEXT NOT NULL,
  conversation_id TEXT NOT NULL DEFAULT 'default'
);

-- uploads ⇄ UploadJob
CREATE TABLE uploads (
  id TEXT PRIMARY KEY, filename TEXT NOT NULL, format TEXT NOT NULL,
  duration_sec REAL NOT NULL, state TEXT NOT NULL, progress REAL NOT NULL DEFAULT 0,
  result TEXT, error TEXT, created_at TEXT NOT NULL
);

-- dictionary ⇄ DictionaryEntry  (terms + substitutions, personal/team)
CREATE TABLE dictionary (
  id TEXT PRIMARY KEY, type TEXT NOT NULL,         -- 'term'|'substitution'
  term TEXT, trigger TEXT, replacement TEXT,
  scope TEXT NOT NULL DEFAULT 'personal',          -- 'personal'|'team'
  source TEXT NOT NULL DEFAULT 'manual',           -- 'manual'|'auto-learn'
  created_at TEXT NOT NULL
);

-- snippets ⇄ Snippet
CREATE TABLE snippets (
  id TEXT PRIMARY KEY, trigger TEXT NOT NULL, expansion TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'personal', created_at TEXT NOT NULL
);

-- transforms ⇄ Transform
CREATE TABLE transforms (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
  hotkey TEXT, builtin INTEGER NOT NULL DEFAULT 0, enabled INTEGER NOT NULL DEFAULT 1,
  prompt_kind TEXT,                                -- links to a prompt in 05
  custom_prompt TEXT, created_at TEXT NOT NULL
);

-- integrations ⇄ Integration  (tokens NOT here — keychain)
CREATE TABLE integrations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL,
  icon TEXT NOT NULL, status TEXT NOT NULL, detail TEXT, connected_at TEXT
);

-- provider_connections  (cloud/self-hosted endpoint profiles; secrets in keychain, NOT here)
CREATE TABLE provider_connections (
  id            TEXT PRIMARY KEY,            -- user label, referenced by slot bindings
  kind          TEXT NOT NULL,               -- 'azure-openai'|'openai'|'openai-compatible'|'anthropic'|…
  base_endpoint TEXT NOT NULL,               -- base URL, no path
  api_version   TEXT,                         -- azure-openai: required query param; else NULL
  auth_mode     TEXT NOT NULL,               -- 'api-key-header'|'bearer-token'|'aad'
  header_name   TEXT,                          -- e.g. 'api-key'
  created_at    TEXT NOT NULL
);

-- model_cache  (catalog + downloaded state)
CREATE TABLE model_cache (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL,         -- 'stt'|'llm'
  family TEXT, size_label TEXT, quant TEXT, path TEXT, bytes INTEGER,
  recommended INTEGER NOT NULL DEFAULT 0, downloaded_at TEXT
);

-- prompt_overrides  (Prompt Studio customs, per kind)
CREATE TABLE prompt_overrides (
  kind TEXT PRIMARY KEY, custom_text TEXT NOT NULL, updated_at TEXT NOT NULL
);
```

> **Aggregates** (Insights `InsightsAggregate`) are **computed on read** from `transcriptions`
> (WPM, percentile, app-usage, streak, heatmap) — not stored — so they're always consistent.
> Cache the heavy ones in memory in main if profiling shows cost.

## 4. Settings document
- One row (`settings.doc`) holds the renderer's **two flat maps** —
  `{ toggles: Record<string,boolean>, values: Record<string,string> }` keyed by dotted strings
  (e.g. `"stt.dictation.mode"`, `"llm.cleanup.mode"`) exactly as
  [app/src/stores/settings.ts](../../../../app/src/stores/settings.ts) defines them — **validated
  with zod** on every read/write. This is deliberately **not** a nested object, so the main store
  and the renderer store share one shape. Hot keys can be promoted to columns later if profiling
  demands; JSON keeps migrations cheap now.
- On `settings:patch`, main shallow-merges the provided `toggles`/`values` entries, validates,
  writes, then emits `settings:changed` so the renderer mirror updates.
- **Provider connections** (cloud/self-hosted endpoints, incl. **Azure OpenAI**) are stored in
  the `provider_connections` table; a slot binds to one via the existing dotted keys
  (`<slot>.provider` → connection `id`, `<slot>.model` → deployment name for Azure or model id
  elsewhere). The connection **secret** lives in the keychain keyed by the connection `id` —
  never in `settings` or `provider_connections`. Schema/URL detail: [10 §3a](10-providers-and-models.md).

## 5. Migrations
- **kysely migrations** in `electron/store/migrations/NNNN_*.ts`, run on boot before any
  handler serves traffic. `settings.schema_ver` + a `meta` table track the applied version.
- **Forward-only**; each migration is idempotent and wrapped in a transaction. A failed
  migration aborts boot with a clear error rather than serving a half-migrated DB.
- **Seed parity:** the initial migration seeds the same built-in transforms/integrations the
  mock seed provides, so first-run real data matches the designed UX.

## 6. Retention & deletion
- **Retention setting** controls: keep raw text? keep audio? history TTL (e.g. off / 30d /
  forever). A periodic main-process job purges expired rows/audio **off the hot path**.
- **Clear data** (`system:clearData`) truncates chosen tables + deletes `audio/`; **Export**
  (`system:export`) writes JSON (+ audio if retained) to `exports/`.
- Deleting a note/transcription also removes its audio file and, **if semantic search is
  enabled**, its Qdrant vector.

## 7. Acceptance
- [ ] Every domain type in `ports/types.ts` has a backing table with matching fields.
- [ ] Main process is the sole writer; renderer reads via `content:*` and mirrors settings only.
- [ ] WAL mode on; migrations run before handlers; forward-only and transactional.
- [ ] Insights computed from `transcriptions`; no aggregate drift.
- [ ] Secrets never stored in SQLite; retention/clear/export behave per the privacy setting.
