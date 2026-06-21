# 04 — Backend tech stack (decision record)

> The canonical dependency list is [`../04-technology-stack.md`](../04-technology-stack.md).
> This doc is the **backend-specific decision record**: the alternatives we weighed, *why*
> each backend choice wins under Khonjel's constraints, and the **new** main-process-only
> dependencies the benchmarks justify. Constraint: *OpenWhispr-derived, cross-platform,
> local-first, no subscription, TypeScript end-to-end.*

---

## 1. Decisions at a glance

| Layer | Choice | Top alternative | Why the choice wins |
|---|---|---|---|
| Desktop shell | **Electron 41** | Tauri 2 (Rust/WebView) | OpenWhispr base is Electron; richest cross-OS audio/hotkey/inject breadth; reuse our React renderer 1:1; Tauri would force a rewrite of the proven native helpers |
| Main-process language | **TypeScript** | JS (OpenWhispr) / Rust | Type-safe IPC contract end-to-end; shares domain types with renderer; fixes OpenWhispr's loose JS main |
| IPC seam | **Typed contract in `shared/` + `ipcMain.handle` + `MessagePort`** | ad-hoc `window.electronAPI.*` | one allow-listed source of truth; streaming off the busy default channel |
| Local STT | **whisper.cpp + sherpa-onnx (Parakeet)** via sidecar | cloud-only; Vosk | offline hot path; Parakeet = fast multilingual; matches both benchmarks |
| Local LLM | **llama.cpp / llama-server** via sidecar | Ollama-only; MLX (FreeFlow) | portable across OS (MLX is Apple-only); self-hosted users can still point at Ollama |
| Inference orchestration | **Vercel AI SDK (`ai`)** | hand-rolled per provider | one streaming+tool interface; OpenWhispr already proves it; bounded tool steps |
| Provider HTTP | **`proxyFetch` from main** | fetch in renderer | keys never enter the page; no CORS; auditable egress |
| Storage | **better-sqlite3 + kysely** | Prisma; lowdb/JSON | synchronous, fast, embeddable; typed queries; main-process source of truth |
| Secrets | **`safeStorage` + `@napi-rs/keyring`** | plaintext config; localStorage | OS keychain; fixes OpenWhispr's localStorage settings leak risk |
| Semantic search | **Qdrant + MiniLM (onnxruntime)** | sqlite-vss; pgvector | fully local; proven in the reference; offline |
| Packaging | **electron-builder 26** | electron-forge | already configured; mac/win/linux targets; code-sign + auto-update |
| Updates | **electron-updater** | manual | in-app check/download/install |

> **Net:** keep the proven Electron stack; upgrade the *main process* to TypeScript with a
> typed seam, sidecar isolation, and main-owned settings/secrets.

## 2. The one real fork: Electron vs Tauri

We considered Tauri 2 seriously (smaller binary, lower memory, Rust safety). **Rejected for
Khonjel** because:
- The product is an **OpenWhispr rebrand** — its battle-tested native helpers (key listeners,
  fast-paste, mic/system-audio taps, AEC) are written against Electron/Node; porting to Rust
  is a multi-month rewrite with regression risk on the *exact* features that make the app work.
- Our **renderer is already React/Vite** and runs unchanged under Electron.
- Electron's `utilityProcess` + child-process sidecars give us the **process isolation** we
  need without leaving the Node ecosystem.

We **revisit Tauri only** if memory footprint becomes a top-3 user complaint *after* launch.

## 3. The second fork: local LLM runtime

| Option | Verdict |
|---|---|
| **llama.cpp / llama-server** (bundled) | **Chosen** — cross-OS, GGUF ecosystem, GPU-aware, no extra install |
| Ollama (require user install) | **Supported as Self-Hosted** (OpenAI-compatible HTTP), not bundled |
| MLX + LoRA (FreeFlow) | **Rejected as default** — Apple-Silicon-only; revisit as an *optional macOS accelerator* + a future fine-tuned cleanup adapter |

> FreeFlow's *insight* (a tiny, task-specialized polish model beats a big general one) is
> adopted at the **model-selection** level — default local cleanup targets small instruct
> models (Qwen 0.6–4B class) — without adopting its Apple-only runtime.

## 4. New backend-only dependencies (delta vs the renderer stack)

These are **not** in the renderer `package.json`; they belong to `electron/` (main):

| Need | Package | Notes |
|---|---|---|
| Typed SQLite | `better-sqlite3`, `kysely` | synchronous; migrations in `store/migrations/` |
| Secrets | `@napi-rs/keyring` (+ Electron `safeStorage`) | OS keychain |
| Inference | `ai` + `@ai-sdk/*` provider packages | only the providers we ship |
| STT runtimes | `sherpa-onnx`, `onnxruntime-node`; bundled `whisper.cpp` binary | sidecar-managed |
| Audio | `ffmpeg-static`; native AEC helper | meetings/uploads |
| Search | SQLite **FTS5** (built-in) for MVP; `@qdrant/js-client-rest` + MiniLM **optional** | full-text now; semantic only if scope demands it |
| Validation | `zod` | validate IPC payloads at the main boundary (security) |
| Updates | `electron-updater` | already implied by electron-builder |
| Build (main TS) | `tsup`/`esbuild` (**net-new** step) | compile `electron/**/*.ts` → `.cjs` |

> **Build note:** today `electron/main.cjs`/`preload.cjs` are **hand-authored CommonJS** — there
> is no TypeScript build for the main process yet. Adding one (esbuild/tsup compiling
> `electron/**/*.ts` → `.cjs`) is **net-new** work; it sits alongside, and does not change, the
> renderer's Vite build.

## 5. Versions & engines
- **Node 24+**, **Electron 41**, **TypeScript 6**, matching the renderer toolchain.
- Native modules rebuilt for Electron via `electron-builder install-app-deps`.
- All new deps installed with `--legacy-peer-deps` (repo-wide eslint peer constraint).

## 6. Acceptance
- [ ] Main process compiles from TypeScript; shares `shared/` types with the renderer.
- [ ] No Tauri/Rust rewrite of native helpers; Electron native helpers reused.
- [ ] llama.cpp + whisper.cpp/Parakeet bundled and run as sidecars; Ollama works as Self-Hosted.
- [ ] All new deps live under `electron/`, installed with `--legacy-peer-deps`, native modules rebuilt.
- [ ] IPC payloads validated with zod at the main boundary.
