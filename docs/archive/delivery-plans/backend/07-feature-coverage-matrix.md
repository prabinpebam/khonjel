# 07 — Feature → backend coverage matrix

> The exhaustive map: **every frontend surface → capability → port(s) → IPC channel(s) →
> storage → provider/sidecar → privacy → status.** Built with the method in
> [06](06-feature-coverage-framework.md). **Done = every row `Implemented` + acceptance ticked.**
> Status legend: `Mock` (seed data today) · `Planned` · `Implemented`. Today every row is
> `Mock` except Phase-0 (`profile`, `system`).

Ports referenced here are specified in [08](08-ipc-and-ports-contracts.md). Storage tables in
[09](09-data-and-storage.md). Slots/providers in [10](10-providers-and-models.md). Egress
rules in [11](11-privacy-security-and-packaging.md).

---

## A. Capture surfaces (Khonjel Bar + overlays)

> Audio format, capture, hotkeys, and text injection for this whole section are specified in
> [12 audio capture & OS integration](12-audio-capture-and-os-integration.md).

| Capability | Port method(s) | IPC channel(s) | Storage | Provider/sidecar | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| Start/stop dictation | `TranscriptionService.start/cancel` | `transcription:start`,`:cancel`,`:partial`(evt) | — | STT.dictation slot | local default | 1 | Mock |
| Dictated-punctuation + cleanup pipeline | `InferenceService.cleanup` (via pipeline) | internal (pipeline) | — | LLM.cleanup slot | local default | 1 | Mock |
| Instruction mode → Voice Agent | `InferenceService.agent` | `inference:agent`,`inference:token`(evt) | notes (tools) | LLM.agent slot | local/provider | 5 | Mock |
| Insert text at cursor | `InjectorService.insertAtCursor` | `os:inject` | — | — | local | 1 | Mock |
| Append to history | `ContentService.history` (write) | `history:append` | `transcriptions` | — | gated by retention | 1 | Mock |
| Re-paste last / recovery | `InjectorService.repasteLast` | `os:repaste` | transcript buffer | — | local | 1 | Mock |
| Listening/level feedback | `TranscriptionService` events | `capture:listening`,`capture:level`(evt) | — | mic sidecar | local | 1 | Mock |
| Meeting detected notif | `MeetingService.onDetected` | `meeting:detected`(evt) | — | meeting detector | local | 6 | Mock |
| Update available notif | `SystemService.onUpdate` | `update:available`(evt) | — | electron-updater | local | 2 | Mock |

## B. Home

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| Recent history list | `ContentService.history()` | `content:history` | `transcriptions` | — | local | 4 | Mock |
| Quick stats (today) | `ContentService.insights()` | `content:insights` | `transcriptions` (agg) | — | local | 4 | Mock |
| Replay/copy an entry | `ContentService.history()` + clipboard | `history:get`,`os:clipboard` | `transcriptions` | — | local | 4 | Mock |
| Resume capture | `TranscriptionService.start` | `transcription:start` | — | STT slot | local | 1 | Mock |

## C. Insights

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| WPM + percentile | `ContentService.insights()` | `content:insights` | `transcriptions` (agg) | — | local | 4 | Mock |
| Words corrected / dictionary fixes | `ContentService.insights()` | `content:insights` | `transcriptions`,`dictionary` | — | local | 4 | Mock |
| App-usage breakdown | `ContentService.insights()` | `content:insights` | `transcriptions` | — | local | 4 | Mock |
| Streak + heatmap | `ContentService.insights()` | `content:insights` | `transcriptions` (agg) | — | local | 4 | Mock |

> Insights are **aggregates computed in main** from `transcriptions`; never a network call.

## D. Chat

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| Load conversation | `ContentService.chat()` | `content:chat` | `chat_messages` | — | local | 5 | Mock |
| Send message (stream) | `InferenceService.chat` | `inference:chat`,`inference:token`(evt) | `chat_messages` | LLM.chat slot | local/provider | 5 | Mock |
| Cancel generation | `InferenceService.cancel` | `inference:cancel` | — | — | local | 5 | Mock |
| Voice input → chat | `TranscriptionService.start` | `transcription:start` | — | STT slot | local | 5 | Mock |

## E. Notes

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| List folders | `ContentService.folders()` | `content:folders` | `folders` | — | local | 4 | Mock |
| List/open notes | `ContentService.notes()` | `content:notes`,`notes:get` | `notes` | — | local | 4 | Mock |
| Create note | `NotesService.create` | `notes:create`,`notes:changed`(evt) | `notes` | — | local | 4 | Mock |
| Edit/save note | `NotesService.update` | `notes:update` | `notes` | — | local | 4 | Mock |
| Delete/move note | `NotesService.remove/move` | `notes:remove`,`notes:move` | `notes`,`folders` | — | local | 4 | Mock |
| Record → note | `TranscriptionService.start`+`InferenceService.noteFormat` | `transcription:start`,`inference:noteFormat` | `notes` | STT.note,LLM.note | local | 5 | Mock |
| Search notes | `SearchService.query` | `search:notes` | `notes` **FTS5** (MVP) · Qdrant (optional) | MiniLM (only if semantic) | local | 7 | Mock |

## F. Upload

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| List/add upload jobs | `ContentService.uploads()`,`UploadService.add` | `content:uploads`,`upload:add` | `uploads` | — | local | 4 | Mock |
| Transcribe file | `UploadService.run` | `upload:run`,`upload:progress`(evt) | `uploads` | STT.note slot | local/provider | 4 | Mock |
| Cleanup transcript | `InferenceService.cleanup` | `inference:cleanup` | `uploads` | LLM.cleanup | local | 4 | Mock |
| Export/copy result | clipboard / file write | `os:clipboard`,`file:save` | — | — | local | 4 | Mock |

## G. Dictionary

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| List terms/substitutions | `ContentService.dictionary()` | `content:dictionary` | `dictionary` | — | local | 4 | Mock |
| Add/edit/delete term | `DictionaryService.upsert/remove` | `dictionary:upsert`,`:remove` | `dictionary` | — | local | 4 | Mock |
| List snippets | `ContentService.snippets()` | `content:snippets` | `snippets` | — | local | 4 | Mock |
| Add/edit/delete snippet | `SnippetService.upsert/remove` | `snippets:upsert`,`:remove` | `snippets` | — | local | 4 | Mock |
| Personal/Team scope | `DictionaryService` (scope arg) | (param) | `dictionary` | — | local/sync | 8 | Mock |

> Dictionary terms feed **both** STT keyterms and the cleanup dictionary suffix
> ([05 §1.1](05-prompt-library.md)). Snippets expand in the pipeline post-cleanup.

## H. Transforms

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| List transforms | `ContentService.transforms()` | `content:transforms` | `transforms` | — | local | 4 | Mock |
| Enable/disable + hotkey | `TransformService.update` | `transforms:update` | `transforms` | — | local | 2 | Mock |
| Run transform on selection | `TransformService.run` | `transforms:run`,`inference:token`(evt) | — | LLM (kind) | local/provider | 5 | Mock |
| Create custom transform | `TransformService.create` | `transforms:create` | `transforms` | — | local | 5 | Mock |

## I. Integrations

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| List integrations + status | `ContentService.integrations()` | `content:integrations` | `integrations` | — | local | 4 | Mock |
| Connect/disconnect (OAuth) | `IntegrationsService.connect/disconnect` | `integrations:connect`,`:disconnect` | `integrations`,keychain | OAuth provider | opt-in egress | 7 | Mock |
| Calendar events (agent tool) | `IntegrationsService.calendar` | `integrations:calendar` | — | Google Calendar | opt-in egress | 7 | Mock |
| IDE bridge (P2) | `IntegrationsService.ide` | `integrations:ide` | — | MCP/CLI | local | 7 | Mock |

## J. Settings — General / Hotkeys

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| Read all settings | `SettingsService.get` | `settings:get` | `settings` | — | local | 2 | Mock |
| Patch a setting | `SettingsService.patch` | `settings:patch`,`settings:changed`(evt) | `settings` | — | local | 2 | Mock |
| Theme / language / startup | `SettingsService.patch` | `settings:patch` | `settings` | — | local | 2 | Mock |
| View/record hotkeys | `HotkeyService.list/rebind` | `hotkeys:list`,`hotkeys:rebind` | `settings` | — | local | 2 | Mock |
| Conflict detection | `HotkeyService.rebind` (validates) | `hotkeys:rebind` | — | — | local | 2 | Mock |

## K. Settings — Speech-to-Text / Language Models

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| List STT models | `ModelCatalogService.list("stt")` | `models:list` | `model_cache` | catalog | local | 3 | Mock |
| List LLM models | `ModelCatalogService.list("llm")` | `models:list` | `model_cache` | catalog | local | 3 | Mock |
| Download/cancel model | `ModelCatalogService.download/cancel` | `models:download`,`:progress`(evt),`:cancel` | `model_cache` | download | local | 3 | Mock |
| Hardware probe + recommend | `ModelCatalogService.hardware` | `models:hardware` | — | OS probe | local | 3 | Mock |
| Set slot model+mode | `SettingsService.patch` (slot) | `settings:patch` | `settings` | — | local | 2 | Mock |
| Configure provider connection (Azure/OpenAI/self-hosted: endpoint, deployment, api-version, auth) | `SettingsService.upsertConnection` | `connections:upsert`,`:list`,`:remove` | `provider_connections` | — | local | 2 | Mock |
| Add provider API key / token | `SettingsService.setSecret` | `secrets:set` | keychain | — | local | 2 | Mock |
| Self-hosted discovery | `ModelCatalogService.discover(endpoint)` | `models:discover` | — | `GET /v1/models` | opt-in egress | 3 | Mock |
| Test connection | `InferenceService.ping` | `inference:ping` | — | chosen provider | opt-in egress | 2 | Mock |

## L. Settings — Privacy / System / Account / Workspace

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| Data retention toggle | `SettingsService.patch` | `settings:patch` | `settings` | — | local | 2 | Mock |
| Clear history/cache | `SystemService.clearData` | `system:clearData` | all tables / cache | — | local | 2 | Mock |
| Export data | `SystemService.exportData` | `system:export` | all tables | — | local | 4 | Mock |
| App version / updates | `SystemService.getAppVersion/checkUpdate` | `system:getAppVersion`,`update:check` | — | electron-updater | local | 0/2 | **Impl (version)** |
| Model cache path / clear | `ModelCatalogService.cache` | `models:cachePath`,`models:clearCache` | `model_cache` | — | local | 3 | Mock |
| Diagnostics/logs (opt-in) | `SystemService.logs` | `system:logs` | log files | — | local | 2 | Mock |
| Sign in / out (optional) | `AuthService.signIn/out` | `auth:signIn`,`auth:signOut` | keychain | better-auth | opt-in egress | 8 | Mock |
| Profile | `ProfileService.get` | `profile:get` | `settings` | — | local | 0 | **Impl** |
| Workspace / team sync (optional) | `SyncService.*` | `sync:*` | sync backend | sync API | opt-in egress | 8 | Mock |

## M. Cross-cutting surfaces

| Capability | Port method(s) | IPC channel(s) | Storage | Provider | Privacy | Phase | Status |
|---|---|---|---|---|---|---|---|
| Command palette actions | (routes to the above ports) | (various) | — | — | local | per-action | Mock |
| Global hotkeys fire | `HotkeyService.onFired` | `hotkey:fired`(evt) | — | OS | local | 1 | Mock |
| App context (active app) | `AppContextService.current` | `os:appContext` | — | OS | local | 1 | Mock |

---

## Coverage summary

| Port (from [08](08-ipc-and-ports-contracts.md)) | Capabilities | First phase | Tests ([06 §3a](06-feature-coverage-framework.md)) | Status |
|---|---|---|---|---|
| ProfileService | 1 | 0 | BE1+BE2+BE3 | **Implemented** (real ipc seam) |
| SystemService | 6 | 0/2 | BE1+BE2+BE3+BE4 | Partial (version+platform, verified under Electron) |
| ContentService | 12 read methods | 4 | BE1+BE3 | Mock |
| TranscriptionService | capture/cancel/events | 1 | BE1+BE2+BE4 | Mock |
| InjectorService | inject/repaste/clipboard | 1 | BE2+BE4 | Mock |
| InferenceService | cleanup (pipeline) · agent/chat/note/run/ping (P5) | 1–5 | BE1+BE2+BE3 | Partial (cleanup wired; stub LLM engine) |
| SettingsService | get/patch (secrets → Phase 2) | 0/2 | BE1+BE2+BE3+BE4 | **Implemented** (durable JSON, verified under Electron) |
| HotkeyService | list/rebind/events | 2 | BE2+BE4 | Mock |
| ModelCatalogService | list/download/hardware/discover/cache | 3 | BE1+BE2 | Mock |
| NotesService / DictionaryService / SnippetService / TransformService / UploadService | content CRUD + run | 4–5 | BE1+BE2+BE3 | Mock |
| MeetingService | detect/capture/notes | 6 | BE1+BE4 | Mock |
| IntegrationsService / SearchService | connect/calendar/ide/search | 7 | BE2 (+BE1 search) | Mock |
| AuthService / SyncService (optional) | account/workspace | 8 | BE2 | Mock |

> **Backend "done" = every cell above reads `Implemented`, each capability's acceptance check
> (in 08–12) passes, and its required BE test levels ([06 §3a](06-feature-coverage-framework.md))
> are green — with the dictation hot path verified fully offline.**

> **Phase 0 COMPLETE (seam proof).** The typed IPC contract (per-call `CONTRACT_VERSION`
> enforcement), pure dispatch, renderer `ipc` adapter (mock↔ipc switch), TypeScript Electron
> main/preload (esbuild), the SQLite migration runner (forward-only/idempotent/WAL, for Phase 4
> relational data), and the **`SettingsService`** (durable **native-free JSON** store + renderer
> `SettingsSync` adoption) are all wired and verified. **`profile`/`system`/`settings` run over
> real IPC under Electron**, gated by an **Electron eval** (`npm run eval:electron`) that launches
> the actual app twice and proves the live seam + **settings persistence across restart**. BE1/BE2/BE3
> in `app/src/services/ipc/*.test.ts` + `app/electron/**/*.test.ts` (**39 unit tests**); BE4 via the
> Electron + browser eval. **Zero frontend regression** throughout (`npm run verify` + `npm run eval`
> clean; bundle stable). Note: `secrets→keychain` lands in Phase 2 (connections); SQLite is reserved
> for Phase 4 relational data. Next: **Phase 1 — the dictation hot path**. See [14](14-implementation-plan.md).

> **Phase 1 (hot path) — in progress.** The **pure text pipeline** is built and BE1-tested
> (dictionary -> dictated-punctuation -> instruction-mode split -> `isClean` skip -> LLM refine
> + fallback -> snippets; [app/electron/main/pipeline/](../../../../app/electron/main/pipeline/), 20
> tests). **`InferenceService.cleanup`** runs the real pipeline behind the seam with an **injected
> LLM engine** (a deterministic **stub** today; llama.cpp / a provider plugs into the same interface
> later) — BE1/BE2/BE3 (**65 unit tests** total). **Audio capture/STT, text injection, and history
> persistence are native/runtime edges** (contracts in [08](08-ipc-and-ports-contracts.md)/[12](12-audio-capture-and-os-integration.md));
> the real binaries integrate at runtime/packaging. Zero frontend regression throughout.
