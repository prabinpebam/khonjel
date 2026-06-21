<div align="center">

# Khonjel

**A local-first, privacy-first desktop voice productivity app.**

Speak anywhere, and Khonjel transcribes, cleans up, and places the text right where you're working — running fully on **on-device, open-source models**, with optional cloud, self-hosted, and enterprise APIs.

[![Electron](https://img.shields.io/badge/Electron-42-47848F?logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

> **Khonjel** is Manipuri for *"Voice."* It works offline by default — your audio and transcripts never leave your machine unless *you* connect a cloud provider.

---

## Highlights

- **Floating dictation bar** — press a global hotkey anywhere, speak, and the cleaned-up text is pasted at your cursor. Capture → transcribe → clean up → inject, all on device.
- **On-device engines** — speech-to-text via [whisper.cpp](https://github.com/ggml-org/whisper.cpp), language cleanup + chat via [llama.cpp](https://github.com/ggml-org/llama.cpp). No account, no telemetry.
- **Bring your own cloud (optional)** — Azure OpenAI and OpenAI-compatible providers, with API keys stored in your OS keychain (never in plaintext).
- **Productivity surfaces** — Home (history + stats), Chat, Notes with AI actions, Upload (transcribe audio files), a personal Dictionary, hotkey-bound Transforms, and Insights.
- **Typed IPC seam** — the same React UI runs on in-memory mock adapters in the browser and on the real Electron backend, with one allow-listed, schema-validated bridge between them.

## How dictation works

```text
 ┌── press hotkey ──┐         on device                       at your cursor
 │                  ▼                                                 ▲
 You speak ──▶ Floating bar ──▶ whisper.cpp (STT) ──▶ llama.cpp (cleanup) ──▶ paste
```

The floating bar is an always-on-top, **non-focusable** window, so it never steals focus from the
app you're typing into — the cleaned text lands exactly where your cursor was.

## Quick start

> Requires **Node.js 20+** and **Windows** (text injection + window control use the Win32 layer today). All commands run from the [`app/`](app) folder.

```bash
cd app
npm install --legacy-peer-deps

# 1) Download the local engines once (standalone binaries + small models)
npm run fetch:whisper   # whisper.cpp + a ggml STT model
npm run fetch:llama     # llama.cpp server + a small GGUF LLM (~1 GB)

# 2) Build and launch the desktop app
npm run electron
```

Prefer to explore the UI without a backend? Run the renderer in the browser against mock adapters:

```bash
npm run dev            # http://localhost:5173 — fully interactive, fake data
```

If the local engines aren't downloaded, the app still runs: dictation cleanup falls back to a
deterministic stub, and transcription reports `model_unavailable` until a model is present.

## Using a cloud provider (optional)

Khonjel is fully usable offline. To route a task to the cloud instead:

1. **Settings → Connections** → add a provider (e.g. Azure OpenAI or any OpenAI-compatible endpoint). The API key is stored in the OS keychain via Electron `safeStorage`.
2. **Settings → Speech-to-Text** / **Language Models** → choose **Enterprise** mode and bind the connection + deployment.

Local and cloud share one model picker per task — change it once and it's reflected everywhere.

## Architecture

The renderer imports only service **ports** (`@services`). A single composition root binds those
ports to either mock adapters (browser) or the real IPC adapter (Electron), so the shipping UI never
changes when the backend does.

```mermaid
flowchart LR
  UI["React renderer (ports only)"]
  Mock["Mock adapters (browser)"]
  IPC["IPC adapter"]
  Bridge["preload bridge (allow-list)"]
  Dispatch["main dispatch (zod-validated)"]
  Svc["Services: STT, Inference, Content, Connections, Secrets, System"]
  Engines["whisper.cpp, llama.cpp + cloud APIs"]

  UI -->|browser| Mock
  UI -->|electron| IPC --> Bridge --> Dispatch --> Svc --> Engines
```

- **Native engines as child processes** — whisper.cpp / llama.cpp run as standalone executables the
  main process spawns and talks to over HTTP/stdio. This sidesteps the Electron/Node native-ABI
  problem entirely (no native node modules to rebuild).
- **One bridge, validated** — every call crosses a single `khonjel:invoke` channel that checks a
  contract version and validates the channel + payload with zod before dispatch.
- **Settings as data** — flat, dotted-key settings persist to a JSON file in `userData` and mirror
  into the renderer store, so the UI binds generically and the backend reads per-slot.

## Project structure

```text
app/
  electron/
    main/            # main process: services, inference/STT runtimes, injection, hotkeys
    shared/          # pure IPC seam: contract + zod schemas + dispatch
    store/           # durable JSON stores + migrations
  src/
    surfaces/        # control panel, settings, command palette, floating bar
    features/        # home, chat, notes, upload, dictionary, transforms, insights
    services/        # ports + mock/ipc adapters (the seam)
    stores/ hooks/ lib/ components/   # Zustand stores, hooks, utils, design-system UI
  eval/              # eval-driven-development scenarios (browser + electron)
  scripts/           # build, model fetchers, icon generation
docs/                # product spec + engineering frameworks
```

## Development

```bash
npm run verify:quick   # typecheck + eslint + design-system lint + unit tests (inner loop)
npm run verify         # verify:quick + production build
npm run test           # Vitest unit tests
npm run eval           # browser EDD (Playwright vs Vite)
npm run eval:electron  # eval-driven validation against the real Electron app
npm run package        # build a portable Windows .exe (electron-builder)
```

Khonjel is built **test-first and eval-driven**: pure logic is unit-tested, and user-visible
behavior is gated by Playwright scenarios — including ones that launch the **real Electron app** and
drive it end to end (the floating bar, model selection, and system settings each have one).

## Privacy

- **Offline by default.** Audio is captured, transcribed, and cleaned up locally; nothing is uploaded.
- **No telemetry.** There is no analytics or tracking.
- **Keys stay in the keychain.** Cloud API keys are encrypted via the OS keychain, never written in plaintext, and never exposed to the renderer.

## Tech stack

Electron 42 · React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS v4 · Zustand · zod ·
Vitest · Playwright · whisper.cpp · llama.cpp.

## Credits

Khonjel is a local-first, de-monetized app modeled on the open-source
[OpenWhispr](https://github.com/OpenWhispr/openwhispr) (MIT) — same core stack and on-device
philosophy — with additional productivity polish. Local inference is powered by the excellent
[whisper.cpp](https://github.com/ggml-org/whisper.cpp) and [llama.cpp](https://github.com/ggml-org/llama.cpp) projects.
