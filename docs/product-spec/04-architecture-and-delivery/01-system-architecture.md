# Khonjel — System Architecture

> The technical shape implied by the product spec. Optimised for **local-first**
> operation, a **sacred hot path**, and a **single model abstraction** across many
> providers. This is a reference architecture, not a final implementation.

---

## 1. Architectural principles
1. **Local-first.** The dictate→cleanup→insert loop runs entirely on-device with open
   models; no network call is on the critical path.
2. **Hot path is sacred.** User interaction (hotkey→listening→insert) is in-memory and
   never blocked by indexing, downloads, discovery, sync, or analytics. (Per the
   benchmarking lesson: heavy work is moved *off* the interaction path, not just sped up.)
3. **One model abstraction.** A `ModelGateway` exposes a uniform interface; archetype
   adapters (Local/Self-Hosted/Cloud/Enterprise/Managed) implement it. Features never
   special-case a provider.
4. **Process isolation.** UI, capture, and model execution are separable so a slow/failed
   model can't freeze the UI or the Bar.
5. **Privacy by construction.** Default storage is local; egress is opt-in and auditable.

---

## 2. High-level components (desktop app)

```
┌───────────────────────────────────────────────────────────────────┐
│ Main Process (app core)                                           │
│  ├─ HotkeyService        global shortcuts (dictation/meeting/agent)│
│  ├─ CaptureService       mic/audio I/O, VAD, music-mute            │
│  ├─ Pipeline             STT → Dictionary → Cleanup → Style → out  │
│  ├─ ModelGateway         uniform STT/LLM interface                 │
│  │    ├─ LocalAdapter        on-device runtime (ASR + LLM)         │
│  │    ├─ SelfHostedAdapter   OpenAI-compatible HTTP (Ollama/LMS/…) │
│  │    ├─ CloudAdapter        OpenAI/Anthropic/Gemini/Groq/Custom   │
│  │    ├─ EnterpriseAdapter   Bedrock/Azure OpenAI/Vertex           │
│  │    └─ ManagedAdapter      Khonjel Cloud (optional)              │
│  ├─ ModelManager         download/catalog/cache (background)       │
│  ├─ Store                 settings, history, notes, libraries      │
│  ├─ InsightsEngine        local aggregation                        │
│  └─ Updater / Logger      updates, debug logging                   │
├───────────────────────────────────────────────────────────────────┤
│ Surfaces (renderer windows)                                       │
│  ├─ Main Window          shell + screens                           │
│  ├─ Khonjel Bar          always-on capture pill                    │
│  ├─ Overlays             agent / meeting / transform-preview       │
│  └─ Settings (modal)     configuration                             │
├───────────────────────────────────────────────────────────────────┤
│ Integrations                                                       │
│  ├─ TextInjector         insert at cursor in active app            │
│  ├─ ActiveAppContext     foreground app id → Style mapping         │
│  ├─ ContextReader        optional on-screen text (opt-in)          │
│  └─ IDEBridge            Vibe coding (VS Code/Cursor/Windsurf) P2   │
└───────────────────────────────────────────────────────────────────┘
```

> Suggested stack (illustrative): an Electron/Tauri-class desktop shell for the UI and
> OS integration; a native/sidecar runtime for local ASR (e.g. whisper.cpp /
> faster-whisper) and local LLM (e.g. llama.cpp / Ollama). The spec is stack-agnostic;
> what matters is the component boundaries and the hot path.

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
