# Khonjel — System Architecture

> The technical architecture, aligned to the **OpenWhispr** implementation Khonjel is
> built on (same tech stack). Optimised for **local-first** operation, a **sacred hot
> path**, and a **single inference abstraction** across many providers.
> Concrete stack: [`04-technology-stack.md`](04-technology-stack.md). Source mapping:
> [`../99-reference-analysis/03-openwhispr-repo-analysis.md`](../99-reference-analysis/03-openwhispr-repo-analysis.md).

---

## 1. Architectural principles
1. **Local-first.** The dictate→cleanup→paste loop runs entirely on-device (whisper.cpp
   / Parakeet for STT, llama.cpp for LLM); no network call is on the critical path.
2. **Hot path is sacred.** Hotkey→listening→paste is in-memory and never blocked by
   indexing, downloads, discovery, sync, or analytics.
3. **One inference abstraction.** The **Vercel AI SDK** + a mode router exposes a uniform
   interface; mode adapters (Local / Self-Hosted / Providers / Enterprise / Khonjel
   Cloud) implement it. Features never special-case a provider.
4. **Multi-window isolation.** UI windows (Dictation Panel, Control Panel, overlays) and
   model execution are separable so a slow/failed model can't freeze capture.
5. **Privacy by construction.** Default storage is local (better-sqlite3 + Qdrant);
   secrets in the OS keychain; **no telemetry**; egress is opt-in and auditable.

---

## 2. High-level components (Electron app)

```
┌───────────────────────────────────────────────────────────────────┐
│ Main process (main.js) + preload (context bridge)                 │
│  ├─ HotkeyService        4 global shortcuts (dictation/voice-agent/│
│  │                        meeting/chat) + per-OS key listeners      │
│  ├─ CaptureService       mic + system audio, Silero VAD, AEC        │
│  ├─ Pipeline             STT → Dictionary → Cleanup → (Style) → paste│
│  ├─ InferenceRouter      Vercel AI SDK + mode adapters:             │
│  │    ├─ LocalAdapter        whisper.cpp / sherpa-onnx (Parakeet) / │
│  │    │                      llama.cpp (GPU-aware)                   │
│  │    ├─ SelfHostedAdapter   OpenAI-compatible HTTP (Ollama/LMS/vLLM)│
│  │    ├─ ProvidersAdapter    OpenAI/Anthropic/Gemini/Groq/Deepgram/  │
│  │    │                      xAI (@ai-sdk/*)                         │
│  │    ├─ EnterpriseAdapter   Bedrock/Azure OpenAI/Vertex             │
│  │    └─ KhonjelCloudAdapter optional/self-hostable                 │
│  ├─ ModelManager         download/catalog/cache (background)        │
│  ├─ DiarizationService   diarization-models + voice fingerprint     │
│  ├─ MeetingDetector      Zoom/Teams/FaceTime detection + calendar   │
│  ├─ SearchService        Qdrant + MiniLM embeddings (local)         │
│  ├─ Store (better-sqlite3+kysely)  settings/history/notes/dict      │
│  ├─ Keychain (@napi-rs/keyring)    API keys/tokens                  │
│  ├─ Auth/Sync (optional)  better-auth · SyncService · NotesService  │
│  ├─ ApiServer / McpServer / CliBridge   (free, ungated)             │
│  └─ Updater (electron-updater) / Logger                             │
├───────────────────────────────────────────────────────────────────┤
│ Renderer windows (React 19 / Vite / shadcn-ui), routed by params   │
│  ├─ Dictation Panel       always-on capture (Khonjel Bar)           │
│  ├─ Control Panel          Home/Chat/Notes/Upload/Dictionary/Integr.│
│  ├─ Agent Overlay          ?agent=true                              │
│  ├─ Overlays               meeting-notif / transcription-preview /  │
│  │                          update-notif                            │
│  └─ Settings (modal)        configuration                           │
├───────────────────────────────────────────────────────────────────┤
│ OS integration (per-OS native helpers)                             │
│  ├─ TextInjector         auto-paste at cursor (fast-paste/ydotool)  │
│  ├─ ActiveAppContext     foreground app (for history/Style)         │
│  ├─ SystemAudio          PipeWire (linux) / audio-tap (mac)         │
│  └─ Calendar/IDE         Google Calendar OAuth · MCP/CLI bridges    │
└───────────────────────────────────────────────────────────────────┘
```

> Stack is **fixed** (not stack-agnostic): **Electron 41 + React 19 + TS + Tailwind v4 +
> shadcn/ui**, local engines **whisper.cpp / sherpa-onnx / llama.cpp**, **Qdrant +
> MiniLM** search, **better-sqlite3 + kysely** storage. See
> [`04-technology-stack.md`](04-technology-stack.md).

---

## 3. The capture pipeline (hot path)

```
hotkey ─▶ CaptureService.start()           [<100ms to "listening" UI]
        ├─ stream audio (selected mic), optional music-mute
        ├─ stop (tap/hold release / Esc)
        ▼
   ModelGateway.transcribe(audio, sttConfig)         ← STT archetype
        ▼ rawTranscript
   Dictionary.apply()    (substitutions + recognition hints)
        ▼
   if agentNameDetected → VoiceAgent.route()          (instruction mode)
   else if cleanupEnabled → ModelGateway.complete(cleanupConfig, prompt)
        ▼ cleanedText
   Style.apply(activeAppContext)                       ← optional
   Snippets.expand()
        ▼ finalText
   TextInjector.insertAtCursor(finalText)
        ▼
   Store.appendHistory()  (only if dataRetention=on)   ← off the hot path
```

- **Latency budget:** listening feedback <100ms; STT/LLM time depends on model; UI shows
  honest progress. Cancel (`Esc`) aborts cleanly.
- **Offline:** Local STT + Local LLM → no network. Cloud archetypes add a network leg.
- **Backpressure:** if a model is mid-download, capture queues with a visible note and
  never blocks the UI.

---

## 4. ModelGateway & adapters

**Uniform interface (conceptual):**
```
transcribe(audio, sttConfig) -> { text, segments?, speakers? }
complete(messages, llmConfig, options) -> stream<token> | text
listModels(endpointConfig) -> Model[]          // self-hosted/cloud discovery
```

| Adapter | Transport | Discovery | Auth |
|---|---|---|---|
| Local | in-proc / sidecar | local catalog | — |
| Self-Hosted | HTTP (OpenAI-compatible) | `GET {endpoint}/models` | optional Bearer |
| Cloud | provider SDK/HTTP | provider model list | API key (per provider) |
| Enterprise | Bedrock/Azure/Vertex SDK | account deployments | account creds |
| Managed | Khonjel Cloud API | service catalog | account token |

- **Per-slot config:** six independent slots — `STT.dictation`, `STT.note`,
  `LLM.cleanup`, `LLM.agent`, `LLM.format`, `LLM.chat` — each its own archetype/model.
- **`Disable thinking output`** handled in the LLM request (strip/skip reasoning).
- **Error surfacing:** adapters return structured errors; UI shows raw provider error
  for discovery (e.g. 404 body) per the reference behaviour.

---

## 5. Local model management
- **Catalog:** families (Qwen/Mistral/Llama/OpenAI-OSS/Gemma) × variants (size,
  quantization, recommended-for-hardware).
- **Download:** background, resumable, checksum-verified; progress surfaced in the
  engine card + sidebar status; cancellable.
- **Cache:** on-disk model cache with visible path; `Open` + `Clear Cache`
  (Settings ▸ System ▸ Data Management). Eviction by LRU/size policy (configurable).
- **Hardware awareness:** detect RAM/VRAM to recommend variants and warn on too-large
  downloads.
- **Runtimes:** pluggable local ASR + LLM runtimes; Self-Hosted simply targets the
  user's own runtime over HTTP.

---

## 6. OS integration
- **Global hotkeys** registered at the OS level (3 + transform binds); conflict
  detection.
- **Text injection** into the focused control of the active app (paste/synthetic
  input), respecting secure fields.
- **Active-app context** for Style mapping; **ContextReader** (opt-in) reads limited
  on-screen text for accuracy (Context awareness).
- **Always-on Bar** + overlays as separate top-level windows; **launch at login**,
  **dock/tray** presence, sounds, notifications.
- **IDE bridge (P2)** for Vibe coding (variable recognition, file tagging).

---

## 7. Data & persistence (summary)
- Local store for settings, history, notes, dictionary, snippets, styles, transforms,
  voice profiles, insights aggregates, model catalog/cache.
- Encryption at rest for sensitive items (API keys in OS keychain/credential store).
- Full detail + retention semantics in
  [`02-privacy-data-security.md`](02-privacy-data-security.md).

---

## 8. Updates, logging, diagnostics
- **Updater:** version check + apply (Settings ▸ System ▸ Updates).
- **Debug logging:** opt-in; transparent "what gets logged" list; logs stay local
  unless the user exports them.
- **Crash/diagnostics:** local-first; nothing auto-uploaded unless analytics opted in.

---

## 9. Architecture acceptance checklist
- [ ] dictate→cleanup→insert runs fully offline on Local engines, <100ms to listening.
- [ ] No network/discovery/download/sync/analytics on the capture hot path.
- [ ] One `ModelGateway` with five archetype adapters; six independent config slots.
- [ ] Self-hosted discovery via `/models`; raw errors surfaced.
- [ ] Background, resumable, verified model downloads with visible cache + clear.
- [ ] UI/capture/model execution isolated so a slow model can't freeze the Bar.
