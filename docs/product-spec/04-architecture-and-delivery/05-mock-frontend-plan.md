# Khonjel — Mock Frontend Implementation Plan

> **Goal:** build a **complete, inspectable frontend with zero backend** so the product
> direction, features, screens, and options can be reviewed before any real engine/IPC
> work begins. Everything is **mocked** behind a clean seam.
>
> **Key idea — not throwaway.** We build the **real renderer** (same stack as the spec)
> with a **mock service layer** behind port/adapter interfaces. When the backend is
> ready, we swap mock adapters for real ones (Electron IPC, AI SDK, SQLite) — the UI
> code stays. The mock *is* the frontend.
>
> Companion docs: [`04-technology-stack.md`](04-technology-stack.md),
> [`01-system-architecture.md`](01-system-architecture.md),
> [`../03-ux-ui/06-ui-design-spec.md`](../03-ux-ui/06-ui-design-spec.md),
> [`../02-information-architecture/01-sitemap-and-ia.md`](../02-information-architecture/01-sitemap-and-ia.md).

---

## 1. Strategy & key decisions

| Decision | Choice | Why |
|---|---|---|
| **Throwaway vs real** | **Real renderer + mock backend** | The renderer stack is fixed by the spec; mock only the backend. No rework. |
| **Browser-first vs Electron-first** | **Browser-first**, Electron-ready | Fastest to inspect (`npm run dev` → localhost); no native build to review UX. Electron shell is a thin add-on later. |
| **Multi-window** | **Simulated in one viewport** + param-routed previews | Browser can't open native windows; we render Dictation Panel / Agent Overlay / overlays as floating elements and expose each via a route for later Electron drop-in. |
| **Backend** | **None.** All async faked | Canned transcription, fake model catalogs, simulated downloads/streaming, in-memory + localStorage data. |
| **State** | **Zustand + persist (localStorage)** | Feels real across reloads; mirrors the real `src/stores/`. |
| **Data** | **Seeded fixtures** + reset/seed dev controls | Every screen has realistic content to inspect. |
| **Inspection** | **"Mock Studio" dev toolbar** | Toggle theme, surface/window, capture states, overlays, empty/loading/error, locale. |

> **The seam:** UI → **service ports** (TypeScript interfaces) → **mock adapters** (now)
> / **real adapters** (later). A mock `window.electronAPI` shim satisfies any code that
> expects the preload bridge.

---

## 2. Tech stack (mirrors the real renderer)

| Layer | Choice | Notes |
|---|---|---|
| Language | **TypeScript 6** (strict) | |
| Build/dev | **Vite 8** + `@vitejs/plugin-react` | `npm run dev` for inspection |
| UI | **React 19** | function components + hooks |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | tokens from the UI Design Spec |
| Components | **shadcn/ui** (Radix) + **lucide-react** | dialog, popover, select, tabs, dropdown, progress, accordion, switch, tooltip |
| Class utils | class-variance-authority, clsx, tailwind-merge, tw-animate-css | |
| State | **Zustand 5** + `persist` | one store per domain |
| Notes editor | **TipTap 3** (+ tiptap-markdown) | works fully client-side |
| Chat markdown | **react-markdown** | for the Chat view |
| Lists | **@tanstack/react-virtual** | virtualized history/notes |
| i18n | **i18next** + react-i18next | English seed; scaffold only |
| Charts | **custom SVG/CSS** (no chart lib) | faithful gauge / bars / heatmap per UI spec |
| Routing | **param/hash router** (mirrors `AppRouter`) | `?panel`, `?agent`, `?meeting-notification`, … |
| Audio (optional) | **Web Audio API** (`getUserMedia`) | real waveform animation on the bar; transcription still faked |
| Tooling | ESLint 10 + Prettier + typescript-eslint | matches the real repo |
| Electron (optional, later) | **Electron 41** thin shell | drop-in; not needed to inspect |

> This is exactly the OpenWhispr renderer stack from
> [`04-technology-stack.md`](04-technology-stack.md), minus the native/AI/db layers
> (which are mocked).

---

## 3. Architecture

### 3.1 Layered view
```
┌───────────────────────────────────────────────────────────┐
│  RENDERER (real)                                          │
│   Surfaces: ControlPanel · DictationPanel · AgentOverlay  │
│             · overlays · Settings modal                    │
│   Views/Components (shadcn + WF design tokens)             │
│   Zustand stores (history, notes, dictionary, settings…)  │
├───────────────────────────────────────────────────────────┤
│  SERVICE PORTS (interfaces)  ← the swap seam              │
│   TranscriptionService · InferenceService/Chat ·          │
│   ModelCatalogService · MeetingService ·                  │
│   IntegrationsService · HotkeyService · ProfileService    │
├───────────────────────────────────────────────────────────┤
│  MOCK ADAPTERS (now)            REAL ADAPTERS (later)      │
│   canned text, fake catalogs,   Electron IPC, AI SDK,     │
│   simulated delays/streaming    whisper.cpp/llama.cpp,    │
│   localStorage, electronAPI     better-sqlite3, Qdrant     │
│   shim                                                     │
└───────────────────────────────────────────────────────────┘
```

### 3.2 Service ports (define now, mock now, real later)

| Port | Mock behaviour |
|---|---|
| `TranscriptionService` | `startDictation()/stop()` → fake waveform + **typewriter** canned transcript; `transcribeFile()` → progress then canned text |
| `InferenceService` / `ChatService` | `complete()/stream()` → canned **streamed** markdown; cleanup = deterministic transform of input |
| `ModelCatalogService` | `listLocalModels()` (families+sizes), `download()` → simulated **progress**, `listProviders()` (wide list), `listModels(provider)`, `discover(baseUrl)` → fake `/models` (+ error case) |
| `MeetingService` | `simulateDetect()` → fires the **meeting-notification** overlay; fake diarized transcript |
| `IntegrationsService` | fake Google Calendar connect, fake API keys, MCP/CLI status |
| `HotkeyService` | in-browser keybindings to **simulate global hotkeys** (dictation/agent/meeting/chat/⌘K) |
| `ProfileService` | **local profile** (name/avatar/prefs) in localStorage; no auth |
| `SettingsService` | read/write all settings to a persisted store |

### 3.3 Stores (Zustand, persisted)
`historyStore · notesStore · folderStore · dictionaryStore · snippetsStore ·
transformsStore · styleStore · profileStore · settingsStore · modelStore ·
providerStore · meetingStore · integrationsStore · uiStore (surface/route/devtools) ·
insightsSelector (derived from history)`.

### 3.4 Multi-window simulation
- **Control Panel** = the main app (sidebar + content).
- **Dictation Panel / Khonjel Bar** = draggable floating element (position per Floating
  Icon setting) overlaid in the viewport.
- **Agent Overlay / meeting-notification / transcription-preview / update-notification**
  = floating overlays toggled by state or the dev toolbar.
- **Param routes** mirror the real `AppRouter`: `?panel=true` (control), `?agent=true`
  (agent), `?meeting-notification=true`, `?transcription-preview=true`,
  `?update-notification=true` → render that surface standalone (ready for Electron).
- **`window.electronAPI` shim** provides `getPlatform`, `hideWindow`, `registerHotkey`,
  `gcalStartOAuth`, `listGpus`, model APIs, etc. — all mocked.

### 3.5 "Mock Studio" dev toolbar (inspection)
A collapsible dev panel (dev-only) to:
- Switch **theme** (Light / Dark / Auto) and **locale**.
- Jump to any **surface/window** and any **screen**.
- Force **capture states** (idle / listening / transcribing / cleaning / inserting / error).
- Trigger **overlays** (meeting detected, update available, transcription preview).
- Toggle **empty / loading / error** state for each screen.
- **Seed / reset** mock data; fast-forward a model **download**.

---

## 4. Project structure (mock = real frontend)

Proposed location: **`/app`** at repo root (sibling to `docs/`).

```
app/
  index.html  vite.config.ts  tsconfig.json  package.json  components.json
  src/
    main.tsx
    AppRouter.tsx                 // param routing → surfaces
    surfaces/
      ControlPanel.tsx            // main window
      DictationPanel.tsx          // Khonjel Bar (floating)
      AgentOverlay.tsx
      overlays/ (MeetingNotification, TranscriptionPreview, UpdateNotification)
    shell/ (TitleBar, Sidebar, ContentPanel, CommandPalette)
    views/
      Home/ Insights/ Chat/ Notes/ Upload/ Dictionary/ Transforms/ Integrations/ Onboarding/
    settings/
      SettingsModal.tsx + sections/ (General, Hotkeys, SpeechToText, LanguageModels,
        PrivacyData, System, Account, Workspace) + PromptStudio
    components/
      ui/                         // shadcn primitives
      EngineModeSelector, ProviderChips, ModelPicker, LocalModelManager,
      StatCard, Gauge, BarChart, Heatmap, PromoBanner, HotkeyInput, SettingRow,
      EngineStatusCard, EmptyState, Waveform, ...
    stores/                       // Zustand stores (persisted)
    services/
      ports/                      // TypeScript interfaces
      mock/                       // mock adapters
      electronApiShim.ts
    mock/
      fixtures/ (history, notes, dictionary, snippets, providers, models, insights, meetings)
      devtools/ (MockStudio)
    lib/ (cn, delay, stream, theme, hotkeys)
    styles/ (tokens.css, index.css)   // Wispr Flow design tokens
    i18n/ (index.ts, locales/en.json)
    types/
```

> Folder layout intentionally mirrors the real OpenWhispr `src/` so the eventual
> backend swap and Electron shell are mechanical.

---

## 5. Build phases (each ends in something inspectable)

### Phase 0 — Scaffold
Vite + TS + Tailwind v4 + shadcn init; **design tokens** from the UI Design Spec;
theme provider (Light/Dark/Auto); base layout; **Mock Studio** skeleton; `electronAPI`
shim. **Inspect:** empty shell + theme switch.

### Phase 1 — App shell (the WF look)
Window chrome; **sidebar** with brand, command-search field, white-pill nav (Home ·
Insights · Chat · Notes · Upload · Dictionary · Transforms · Integrations), engine
status card, footer; floating **content panel** (card-on-greige). **Inspect:** the
shell feels like Wispr Flow; nav switches empty views.

### Phase 2 — Core screens + fixtures
**Home** (history timeline grouped by day + stats rail + Voice Profile); **Dictionary**
(+ Snippets tab) with the **library template** (title + Add new + underline tabs + serif
**promo banner** + divided list + entry editor); **Settings modal** shell + **General**
+ **Hotkeys** (HotkeyInput, 4 hotkeys). **Inspect:** real-feeling content, library
pattern, settings chrome.

### Phase 3 — The model system (key inspect target)
**Speech-to-Text** + **Language Models** settings: **inference-mode selector**
(Local/Self-Hosted/Providers/Enterprise/Khonjel Cloud); **wide provider chips**
(OpenAI, Anthropic, Gemini, Groq, Mistral, DeepSeek, xAI, Cohere, Deepgram, AssemblyAI,
ElevenLabs, Together, Fireworks, OpenRouter, Perplexity, HF, Custom…); **model picker**;
**local model manager** with **simulated download progress**; **self-hosted `/models`
discovery** (success + raw-error mock); **Prompt Studio** (View/Customize/Test);
GPU/VAD controls. **Inspect:** the universal-model-support story end-to-end.

### Phase 4 — Capture surfaces
**Dictation Panel / Khonjel Bar**: idle → listening (waveform, optional real mic) →
transcribing → **typewriter insert** → done; cancel; positions; auto-hide. **Agent
Overlay**; **transcription preview**; **meeting-notification** overlay (auto-detect
sim). **Inspect:** the core voice loop and overlays via the dev toolbar.

### Phase 5 — Productivity screens
**Notes** (TipTap editor + folders + fake **semantic search** + AI-action buttons);
**Upload** (drag-drop fake file → progress → transcript → save as Note); **Chat** (fake
**streamed** markdown, reasoning-mode indicator); **Insights** (gauge + bars + **streak
heatmap** computed from seeded history); **Transforms** (cards + editor + view-changes
preview); **Style** (under LM ▸ Cleanup). **Inspect:** all productivity value.

### Phase 6 — Onboarding, integrations, command palette, notifications
First-run **onboarding** (pick local model → set hotkey → test); **Integrations** (fake
GCal connect, API keys, MCP/CLI — all free); **⌘K command palette**; notification
toasts. **Inspect:** first-run + connective tissue.

### Phase 7 — Polish
Empty/loading/error for every screen; **a11y** pass (keyboard, roles, focus, reduced
motion); **dark theme** parity; motion; i18n scaffold; per-screen acceptance checks
from the spec.

### Phase 8 — (optional) Electron shell + real-backend swap
Thin Electron 41 wrapper rendering surfaces as **real windows** (param routes already
match); document the adapter swap (mock → IPC/AI-SDK/SQLite/Qdrant). No UI rework.

---

## 6. Mock data & behaviour rules
- **Seed on first run**, persist to localStorage, expose **Reset / Seed demo** controls.
- **Transcription:** pool of sample utterances → typewriter; **cleanup** = deterministic
  filler-removal/grammar transform of the input (so it visibly "works").
- **Chat:** canned markdown answers, streamed token-by-token with a thinking shimmer.
- **Models:** realistic family/size catalogs; **download** simulated over ~3–8s with
  progress + cancel; **`/models`** returns a fake list, plus a one-click **error mock**.
- **Insights:** computed **locally** from seeded history (mirrors the real local-compute
  design — just on fake data).
- **No network calls.** Any fetch is intercepted/mocked; offline works identically.

---

## 7. Definition of done (mock)
- [ ] Every screen in the spec's screen inventory is reachable and inspectable.
- [ ] Every state (empty/loading/error, capture states, overlays) is toggleable via Mock Studio.
- [ ] The **Wispr Flow visual system** is faithfully applied (tokens, card-on-greige, serif promos, teal data-viz).
- [ ] **Universal model support** UI is fully demonstrable (wide providers + local manager + self-hosted discovery + Prompt Studio).
- [ ] **All-local** posture is visible (local profile, no account required, local storage, no telemetry).
- [ ] Runs in a browser with `npm run dev`; **zero backend / zero network**.
- [ ] Code is structured behind service ports so real adapters swap in without UI changes.

---

## 8. Open choices to confirm
1. **App folder name/location** — proposed `/app` at repo root. OK?
2. **Real mic waveform** (Web Audio) vs purely faked — nice-to-have; default faked, add real later.
3. **Storybook** for component-level review — optional add-on (P2); default is the running app + Mock Studio.
4. **Router** — tiny param router (mirrors `AppRouter`) vs React Router. Default: param router for fidelity.
