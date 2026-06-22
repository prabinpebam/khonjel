# 08 — IPC & ports contracts

> The exact seam: the **`@services` ports** the renderer consumes, the **IPC channels** that
> back them, and the **request/response types**. The renderer ports already exist
> ([app/src/services/ports/index.ts](../../../../app/src/services/ports/index.ts)); this doc
> specifies the **action ports** the backend adds and the channel for every method. Maps 1:1
> to [07 matrix](07-feature-coverage-matrix.md).

---

## 1. Conventions

- **Two transports:** request/response via `ipcMain.handle` (`invoke`), and streaming via a
  per-stream `MessagePort` (tokens, partials, progress) plus low-rate `ipcMain` events.
- **Naming:** `domain:verb` for invoke, `domain:noun`(evt) for events. One namespace per port.
- **Validation:** every handler validates its payload with `zod` at the boundary, then returns
  a typed result or a **structured error** `{ code, message, detail? }` (never throws across IPC).
- **Cancellation:** any long op accepts a `sessionId`; a `domain:cancel` channel aborts it.
- **Source of truth:** channel names + payload types live in `electron/shared/ipc-contract.ts`,
  imported by preload (allow-list), the renderer `ipc` adapter, and the handlers.

```ts
// preload.ts — only allow-listed channels cross the bridge
contextBridge.exposeInMainWorld("khonjel", {
  invoke: (c: Channel, ...a: unknown[]) => ipcRenderer.invoke(c, ...a),
  subscribe: (c: EventChannel, cb: (p: unknown) => void) => { /* MessagePort / on */ },
});
```

- **Versioning:** `ipc-contract.ts` carries a `CONTRACT_VERSION`; preload sends it on every
  call and main rejects a mismatch with `IpcError("validation")`. Channels are only ever
  *added* within a major version; removals/renames bump the major and ship a renderer shim.

## 1.1 Streaming transport (MessagePort lifecycle)

Low-rate signals (one-shot results, `hotkey:fired`, `settings:changed`) use plain `ipcMain`
events. **High-rate streams** (transcription partials, inference tokens, download progress)
use a dedicated `MessagePort` per stream so they never flood the default channel:

1. Renderer calls an `invoke` that starts the stream (e.g. `inference:chat`) and gets a `streamId`.
2. Main creates a `MessageChannelMain`, keeps `port1`, and transfers `port2` to the renderer
   via `webContents.postMessage(channel, { streamId }, [port2])`.
3. Renderer's `subscribe(streamId, cb)` listens on its port; main posts
   `{ type: 'token'|'partial'|'progress', data }` frames, then a terminal `{ type:'end' }` or
   `{ type:'error', error }`.
4. **Teardown:** either side `close()`s its port on `end`/`error`/`cancel`; main aborts the
   underlying `AbortController`. A closed renderer port (window reload) is detected and aborts
   the op.
5. **Backpressure:** main may batch or drop interim `partial`/`level` frames if the port queue
   grows; `token` frames are never dropped.

## 2. Existing ports (today)

| Port | Method | Channel | Returns | Status |
|---|---|---|---|---|
| `ProfileService` | `get()` | `profile:get` | `Profile` | **Implemented** |
| `SystemService` | `getAppVersion()` | `system:getAppVersion` | `string` | **Implemented** |
| `SystemService` | `getPlatform()` | `system:getPlatform` | `Platform` | **Implemented** |
| `ContentService` | `history/insights/chat/folders/notes/uploads/dictionary/snippets/transforms/integrations/sttModels/llmModels` | `content:<name>` | per [types.ts](../../../../app/src/services/ports/types.ts) | Mock |

> `ContentService` becomes **async** when real (returns `Promise<T>`). Call sites are revisited
> at that point (already noted in the port's doc comment).

## 3. New action ports (backend adds)

### 3.1 `TranscriptionService` — capture
```ts
interface StartCaptureOpts { mode: CaptureMode; sttSlot: "dictation"|"note"; language?: string; muteMedia?: boolean }
interface CaptureSession { id: string }
interface TranscriptionService {
  start(o: StartCaptureOpts): Promise<CaptureSession>;     // transcription:start
  cancel(sessionId: string): Promise<void>;                // transcription:cancel
  // events: capture:listening, capture:level, transcription:partial, transcription:final
}
```

### 3.2 `InferenceService` — all LLM work
```ts
type InferKind = "cleanup"|"agent"|"noteFormat"|"meetingNotes"|"chat"|"transform";
interface CompleteRequest { kind: InferKind; input: string; llmSlot: string; sessionId?: string;
  context?: AppContext; stream?: boolean }
interface InferenceService {
  cleanup(input: string, ctx: PipelineContext): Promise<string>;  // inference:cleanup
  agent(req: CompleteRequest): Promise<AgentResult>;              // inference:agent  (+inference:token)
  chat(req: CompleteRequest): Promise<void>;                     // inference:chat   (+inference:token)
  noteFormat(input: string): Promise<string>;                    // inference:noteFormat
  run(transformId: string, input: string): Promise<string>;      // transforms:run
  ping(slot: string): Promise<{ ok: boolean; detail?: string }>; // inference:ping (test connection)
  cancel(sessionId: string): Promise<void>;                      // inference:cancel
}
```

### 3.3 `InjectorService` / `AppContextService` — OS text
```ts
interface InjectorService {
  insertAtCursor(text: string): Promise<void>;   // os:inject (per-app strategy table)
  repasteLast(): Promise<void>;                   // os:repaste (transcript buffer)
  copyToClipboard(text: string): Promise<void>;   // os:clipboard
}
interface AppContextService { current(): Promise<AppContext> } // os:appContext
```

> Audio format (16 kHz/mono/PCM), device handling, the per-app injection strategy table, secure-
> field refusal, and the transcript recovery buffer are specified in
> [12 audio capture & OS integration](12-audio-capture-and-os-integration.md).

### 3.4 `SettingsService` — main-owned settings + secrets

> **Shape matches the real store.** The renderer store
> ([app/src/stores/settings.ts](../../../../app/src/stores/settings.ts)) models settings as
> **two flat maps keyed by dotted strings** — `toggles: Record<string,boolean>` and
> `values: Record<string,string>` (e.g. `"stt.dictation.mode"`). The contract mirrors that
> exactly; it is **not** a nested object.

```ts
type SettingsSnapshot = { toggles: Record<string, boolean>; values: Record<string, string> };
type SettingsPatch    = { toggles?: Record<string, boolean>; values?: Record<string, string> };

interface SettingsService {
  get(): Promise<SettingsSnapshot>;                           // settings:get
  patch(p: SettingsPatch): Promise<SettingsSnapshot>;         // settings:patch (+settings:changed evt)
  setSecret(connectionId: string, key: string): Promise<void>;// secrets:set (→ keychain, never returned)
  hasSecret(connectionId: string): Promise<boolean>;          // secrets:has
  // provider connection profiles — cloud/self-hosted incl. Azure OpenAI (see 10 §3a)
  listConnections(): Promise<ConnectionProfile[]>;            // connections:list
  upsertConnection(p: ConnectionProfile): Promise<void>;      // connections:upsert (+settings:changed)
  removeConnection(id: string): Promise<void>;               // connections:remove
  testConnection(id: string, slot?: SlotId): Promise<{ ok: boolean; detail?: string }>; // connections:test
}
```

> `ConnectionProfile` (endpoint, kind, `apiVersion`, auth mode) and `SlotId` are defined in
> [10 §3a](10-providers-and-models.md). The profile is **non-secret** (stored in
> `provider_connections`); the key/token is set separately via `setSecret` → keychain. This is
> what lets the Settings UI add an **Azure OpenAI** endpoint/deployment/api-version with no
> hardcoded values.

### 3.5 `HotkeyService`
```ts
interface HotkeyService {
  list(): Promise<HotkeyBinding[]>;                 // hotkeys:list
  rebind(id: string, accel: string): Promise<{ ok: boolean; conflict?: string }>; // hotkeys:rebind
  // event: hotkey:fired { id }
}
```

### 3.6 `ModelCatalogService`
```ts
interface ModelCatalogService {
  list(kind: "stt"|"llm"): Promise<ModelInfo[]>;         // models:list
  download(modelId: string): Promise<{ handle: string }>; // models:download (+models:progress evt)
  cancelDownload(handle: string): Promise<void>;          // models:cancel
  discover(endpoint: string): Promise<ModelInfo[]>;       // models:discover (self-hosted /v1/models)
  hardware(): Promise<HardwareProfile>;                   // models:hardware
  cachePath(): Promise<string>; clearCache(): Promise<void>; // models:cachePath / :clearCache
}
```

> **Full lifecycle (download/verify/remove/storage) + UX** — see
> [03-ux-ui/07 Local model management](../../03-ux-ui/07-local-model-management.md), which extends
> this interface with `status/verify/remove/storage`, the integrity (size + `sha256`) contract, and
> the inline four-state UX (resume/queue/cleanup are internal automatic mechanics).

### 3.7 Content-mutation ports
```ts
interface NotesService { create; update; remove; move }        // notes:create/update/remove/move (+notes:changed)
interface DictionaryService { upsert; remove }                  // dictionary:upsert/remove
interface SnippetService { upsert; remove }                     // snippets:upsert/remove
interface TransformService { create; update; remove; run }      // transforms:create/update/remove/run
interface UploadService { add; run; cancel }                    // upload:add/run/cancel (+upload:progress)
```

### 3.8 Higher-tier ports (later phases)
```ts
interface MeetingService { /* meeting:start/stop, meeting:detected(evt), meeting:notes */ }
interface IntegrationsService { connect; disconnect; calendar; ide } // integrations:*
interface SearchService { query(scope, q): Promise<SearchHit[]> }    // search:notes
interface AuthService { signIn; signOut; state }                     // auth:* (optional, compile-out)
interface SyncService { status; push; pull }                         // sync:* (optional)
```

## 4. The full `Services` container (target)

```ts
interface Services {
  // existing
  profile: ProfileService; system: SystemService; content: ContentService;
  // capture + intelligence
  transcription: TranscriptionService; inference: InferenceService; injector: InjectorService;
  appContext: AppContextService;
  // config
  settings: SettingsService; hotkeys: HotkeyService; models: ModelCatalogService;
  // content mutation
  notes: NotesService; dictionary: DictionaryService; snippets: SnippetService;
  transforms: TransformService; uploads: UploadService;
  // higher tier
  meeting: MeetingService; integrations: IntegrationsService; search: SearchService;
  // optional (compile-out by default)
  auth?: AuthService; sync?: SyncService;
}
```

> The container grows **one port per phase** ([06 §5](06-feature-coverage-framework.md)).
> `useServices()` returns `mock` or `ipc` implementing this exact interface.

## 5. Error model (shared)
```ts
type IpcError = { code:
  | "unauthorized" | "provider_error" | "model_unavailable" | "offline"
  | "validation" | "cancelled" | "not_found" | "conflict" | "internal";
  message: string; detail?: unknown };
```
The renderer renders `provider_error.detail` verbatim for self-hosted/provider discovery (so
users see the raw 404/401 body), matching the reference behavior.

## 6. Acceptance
- [ ] Every channel in this doc exists in `shared/ipc-contract.ts` and is allow-listed in preload.
- [ ] Each port method has exactly one invoke channel (+ event channels for streams).
- [ ] Handlers validate with zod and return typed results or `IpcError` (no thrown exceptions across IPC).
- [ ] `mock` and `ipc` adapters satisfy the identical `Services` TypeScript interface.
