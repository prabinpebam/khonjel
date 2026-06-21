# 02 — Benchmarks comparison & decision

> Side-by-side of the two references, the pros/cons of each *approach*, and the explicit
> Khonjel decision (adopt / reject / adapt). Detail per item lives in
> [00 OpenWhispr](00-benchmark-openwhispr.md) and [01 FreeFlow](01-benchmark-freeflow.md).

---

## 1. Head-to-head

| Dimension | OpenWhispr | FreeFlow | Khonjel decision |
|---|---|---|---|
| **Platform** | Electron, cross-platform | macOS-only (Swift) | **Electron, cross-platform** (Win/macOS/Linux) — from OpenWhispr |
| **Language** | TS (renderer) + JS (main) | Swift | **TypeScript end-to-end** (fix OpenWhispr's JS main) |
| **Scope** | Multi-purpose (dictation, agent, notes, meetings, chat) | Single-purpose dictation | **Multi-purpose** — from OpenWhispr (our frontend already has 8 surfaces) |
| **STT — cloud** | Many providers (OpenAI/Groq/xAI/Mistral/Corti/AssemblyAI/Deepgram) | OpenAI Realtime (stream) + batch | **Provider matrix** from OpenWhispr **+ Realtime streaming** pattern from FreeFlow |
| **STT — local** | whisper.cpp + Parakeet (child process) | Parakeet CoreML + SpeechAnalyzer | **whisper.cpp + Parakeet** via sidecar (portable) |
| **LLM — local** | llama.cpp (`qwen2.5-7b…`) | MLX Qwen3 0.6B + LoRA, Apple FM | **llama.cpp/llama-server** (portable); small instruct models |
| **LLM — modes** | local / providers / self-hosted / enterprise / cloud | OpenAI only | **All five modes** — from OpenWhispr; cloud **ungated/free** |
| **Text pipeline** | Straight to LLM cleanup | **regex → isClean skip → LLM → fallback** | **FreeFlow's 3-stage pipeline** wins; bolt onto OpenWhispr's provider layer |
| **Streaming latency** | Standard | Warm WSS backup + parallel batch fallback (sub-second median, self-reported) | **Adopt FreeFlow's latency engineering** |
| **Prompts** | i18n + `{{agentName}}` + dictionary suffix + Prompt Studio + per-kind | Per-language Swift constants, strict output discipline | **OpenWhispr's prompt *system*** + **FreeFlow's output discipline** |
| **Instruction detection** | `detectAgentName(text, agentName)` splits cleanup vs command | n/a | **Adopt** — drives Voice Agent mode |
| **Text injection** | Paste/keystroke | **Per-app strategy table** + transcript buffer | **Adopt FreeFlow's per-app table + recovery buffer** |
| **Settings store** | Zustand → `localStorage` (renderer) | UserDefaults | **Main-process source of truth** (SQLite/JSON), mirrored to renderer |
| **Seam** | Implicit (`window.electronAPI.*`, dynamic imports) | Swift protocols | **Formal typed ports** (`@services`) — already built in the mock |
| **Main process** | One giant `ipcHandlers.js` | n/a | **Per-domain handler modules** |
| **Keys / egress** | Keychain + `proxyFetch` from main | Keychain, direct to OpenAI | **Keychain + main-process proxy**; egress only to the chosen provider |
| **Server dependency** | Optional managed cloud (Pro gate) | None | **None by default**; optional free "Khonjel Cloud" later |
| **Monetization** | Subscription / Pro gates | Free/OSS | **No gates** — everything local-first & free |

## 2. Pros / cons of each *approach*

### Approach A — "Electron multi-purpose hub" (OpenWhispr)
**Pros:** cross-platform; one codebase serves all 8 surfaces; huge provider/model matrix;
mature prompt + settings systems; web UI tech (matches our React frontend 1:1); rich IPC.
**Cons:** Electron memory/footprint; renderer-held orchestration blurs the seam; JS main is
loosely typed; monolithic IPC; no deterministic pre-clean; settings live in the renderer.

### Approach B — "Native single-purpose pipeline" (FreeFlow)
**Pros:** tiny footprint; sub-second latency; superb pipeline + on-device models; clean
privacy; protocol-oriented and testable; output discipline.
**Cons:** macOS-only and Swift (non-portable); single feature; one cloud provider;
English-only local; minimal persistence; can't host our multi-surface product.

## 3. Decision

> **Khonjel = Approach A's *architecture* + Approach B's *pipeline & latency discipline*.**

Concretely:
1. **Keep the Electron, cross-platform, multi-purpose hub** (OpenWhispr shape) because the
   frontend is already a React/Electron control panel with 8 surfaces + settings.
2. **Formalize the seam**: one typed `@services` ports interface (already in the mock) →
   one adapter set in main. No renderer-held orchestration of Node concerns.
3. **TypeScript everywhere**, including the main process.
4. **Port FreeFlow's text pipeline** (deterministic substitution → `isClean` skip → LLM →
   fallback) and its **latency engineering** (warm connections, parallel fallback) into the
   provider layer.
5. **Adopt the prompt *system*** (i18n, `{{agentName}}`, dictionary suffix, per-kind override,
   Prompt Studio) with FreeFlow's **strict output discipline**.
6. **Adopt instruction detection** (`detectAgentName`) for Voice Agent mode.
7. **Adopt the per-app injection table + transcript recovery buffer.**
8. **Move durable settings to the main process** (SQLite), mirror to the renderer store.
9. **Keys in keychain; all provider HTTP proxied from main**; egress only to the chosen endpoint.
10. **No paid gates.** Local is the default; cloud is optional and free.

Everything downstream ([03](03-khonjel-backend-architecture.md)–[11](11-privacy-security-and-packaging.md)) implements this decision.
