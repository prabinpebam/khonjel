# Khonjel — Technology Stack

> Khonjel adopts the **OpenWhispr technology stack verbatim** (the product is built on
> OpenWhispr's open-source, MIT-licensed foundation). This document is the canonical
> dependency and architecture-by-technology reference. Source of truth:
> [`../99-reference-analysis/03-openwhispr-repo-analysis.md`](../99-reference-analysis/03-openwhispr-repo-analysis.md).

---

## 1. Stack at a glance

> **React 19 · TypeScript · Tailwind CSS v4 · Electron 41 · better-sqlite3 ·
> whisper.cpp · sherpa-onnx · shadcn/ui** — plus llama.cpp, Qdrant, Vercel AI SDK,
> Zustand, TipTap, and i18next.

| Domain | Technology | Notes |
|---|---|---|
| Desktop shell | **Electron 41** | Multi-window; `main.js` (main process) + `preload.js` (context bridge) |
| Runtime | **Node.js 24+** | Engines baseline |
| Renderer UI | **React 19** + **TypeScript** | Function components, hooks, React Compiler-clean |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | Utility-first; design tokens via CSS vars |
| Components | **shadcn/ui** on **Radix UI** primitives | accordion, dialog, dropdown-menu, label, popover, progress, select, slot, tabs |
| Icons | **lucide-react** | Single icon set across the app |
| Class utils | class-variance-authority, clsx, tailwind-merge, tw-animate-css | Variant + animation helpers |
| Bundler | **Vite 8** (`@vitejs/plugin-react`) | `src/` renderer build |
| Packaging | **electron-builder 26** | mac (dmg, arm64/x64), win (exe), linux (AppImage/deb/rpm/tar) |
| Updates | **electron-updater** | In-app check/download/install |
| State | **Zustand 5** | Stores in `src/stores/` |
| Local DB | **better-sqlite3 12** + **kysely** | Synchronous SQLite + typed query builder |
| Secrets | **@napi-rs/keyring** | API keys/tokens in OS keychain/credential store |
| i18n | **i18next** + react-i18next | 10 UI languages |
| Rich text | **TipTap 3** (+ tiptap-markdown, react-markdown) | Notes editor |
| Lists | @tanstack/react-virtual | Virtualized history/notes |
| Validation | **zod 4** | Schema validation |

---

## 2. AI & model runtimes

### 2.1 Orchestration
- **Vercel AI SDK 6** (`ai`) as the unified LLM interface.
- Provider adapters: `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`,
  `@ai-sdk/google-vertex`, `@ai-sdk/groq`, `@ai-sdk/amazon-bedrock`, `@ai-sdk/azure`;
  `@aws-sdk/credential-providers` for Bedrock.

### 2.2 Speech-to-text (local)
- **whisper.cpp** — Whisper-family transcription (C++); downloaded per platform.
- **sherpa-onnx** + **onnxruntime-node** — **NVIDIA Parakeet** fast multilingual ASR.
- **Silero VAD** (whisper-vad-model) — voice-activity detection, tunable per mode.

### 2.3 Speech-to-text (cloud, BYOK)
- OpenAI, Groq, Deepgram (streaming), xAI, and other providers via base-URL config.

### 2.4 Language models (local)
- **llama.cpp / llama-server** — local LLM inference for cleanup/agent/chat/formatting.

### 2.5 Semantic search
- **Qdrant** (`@qdrant/js-client-rest`) vector DB + **MiniLM** embedding model
  (onnxruntime) — powers local Notes semantic search (runs offline).

### 2.6 Meetings & diarization
- **diarization-models** + native **meeting-aec-helper** (acoustic echo cancellation +
  VAD) for meeting capture and speaker labelling; **ffmpeg-static** for audio.

---

## 3. Native helpers (per-OS, compiled in `scripts/`)

| Capability | Windows | macOS | Linux |
|---|---|---|---|
| Global key listener | windows-key-listener | (Electron globalShortcut / globe-listener) | linux-key-listener |
| Fast paste / inject | windows-fast-paste, nircmd | macos-fast-paste | linux-fast-paste, **ydotool** (Wayland) |
| Mic listener | windows-mic-listener | macos-mic-listener | — |
| System audio | — | macos-audio-tap | linux-system-audio (**PipeWire**) |
| Misc | — | — | dbus-next |

Cross-platform: **globe-listener**, **text-monitor**, **media-remote**.

> The OS-specific bits (hotkeys, text injection, secure store, system audio, paths)
> live behind an **OS integration layer** so feature code stays platform-agnostic. See
> [`01-system-architecture.md`](01-system-architecture.md).

---

## 4. Auth & sync (optional, off by default)

- **better-auth** with Microsoft / Apple sign-in. Gated by an `AUTH_URL` build value —
  **when unset, account features are compiled out** and the app is fully local.
- Optional cloud backup/sync (`SyncService`, `NotesService`) for cross-device notes.
- **Khonjel posture:** local-first; auth/sync are **optional** and only needed for
  opt-in cross-device sync or (optional) workspaces. **No subscription, no telemetry.**

---

## 5. Tooling & quality
- **ESLint 10** + typescript-eslint + eslint-plugin-react-hooks; **Prettier**.
- `typecheck` (tsc), `lint`, `format`, `quality-check`, `i18n:check` scripts.
- Native module rebuild via `electron-builder install-app-deps`.
- Nix flake for one-command Linux install (`flake.nix`).

---

## 6. Repository shape (mirror for Khonjel)

```
main.js  preload.js  electron-builder.json  package.json
scripts/                 native compile + model download scripts
resources/bin/           bundled native binaries + models
native/meeting-aec-helper/
src/
  main.jsx  AppRouter.jsx  App.jsx  index.html  index.css  i18n.ts  vite.config.mjs
  components/             ControlPanel, panels, overlays, settings/, notes/, chat/, agent/, ui/
  stores/                Zustand stores
  services/              SyncService, NotesService, …
  hooks/  helpers/  lib/  config/  constants/  models/  types/  utils/  workers/  locales/
```

---

## 7. Stack decisions for Khonjel (resolved)

| Earlier open question | Resolution (this stack) |
|---|---|
| Desktop runtime | **Electron 41** (matches OpenWhispr; best OS-integration breadth) |
| Local LLM engine | **Bundle llama.cpp/llama-server**; Self-Hosted can reuse Ollama/LM Studio/vLLM |
| Local STT | **whisper.cpp + Parakeet (sherpa-onnx)**, Silero VAD, GPU-aware |
| Components | **shadcn/ui + Radix + Tailwind v4 + lucide-react** |
| Semantic search | **Qdrant + MiniLM**, fully local |
| Storage | **better-sqlite3 + kysely**; secrets in OS keychain |
| Monetization | **None** — no subscription, no telemetry; local is free and unmetered |

---

## 8. Acceptance
- [ ] Khonjel builds on Electron 41 + React 19 + TS + Tailwind v4 + shadcn/ui.
- [ ] Local STT (Whisper + Parakeet) and local LLM (llama.cpp) bundled and working offline.
- [ ] Vercel AI SDK provider adapters wired for OpenAI/Anthropic/Gemini/Vertex/Groq/Bedrock/Azure.
- [ ] Qdrant + MiniLM local semantic search operational.
- [ ] Auth/sync compile-out path verified (fully local, no account, no telemetry).
- [ ] Per-OS native helpers integrated behind the OS integration layer.
