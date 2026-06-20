# Khonjel — Frontend Implementation Plan (mock-data, no backend)

> **Goal:** build the **complete, final Khonjel frontend** — the production UI — driven
> entirely by **mock data with zero backend**, so the product can be reviewed and shipped
> as a UI first. This is **not a throwaway prototype**: it is the real renderer.
>
> ### Two hard contracts (non-negotiable)
> 1. **No backend — at all.** No server, no Electron IPC implementation, no database, no
>    network calls. The *only* implementations that exist are **mock adapters** in
>    `src/services/adapters/mock/` using in-memory state + `localStorage`. (A mock
>    `window.electronAPI` shim stands in for the preload bridge.)
> 2. **Final UI — not throwaway.** Views/components depend **only on service ports**
>    (TypeScript interfaces), never on any adapter directly. When a real backend is built
>    *later* (separate effort), it is added as `adapters/real/` and selected by config —
>    **zero changes to UI code**. The seam is enforced by lint boundaries.
>
> Companion docs: [`04-technology-stack.md`](04-technology-stack.md),
> [`01-system-architecture.md`](01-system-architecture.md),
> [`../03-ux-ui/06-ui-design-spec.md`](../03-ux-ui/06-ui-design-spec.md),
> [`../02-information-architecture/01-sitemap-and-ia.md`](../02-information-architecture/01-sitemap-and-ia.md).
>
> **Mandatory for all `/app` UI work:** the strict
> [Design System discipline](../03-ux-ui/design-system/01-intent.md) (P1–P13) —
> token-driven values, CVA variants (no forks), reuse-before-creation, Storybook as the
> inventory. This is how the design system survives many agent sessions without drift.

---

## 1. Strategy & key decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| **Throwaway vs final** | **Final renderer + mock data** | This UI ships. Only data/services are mocked. No rework. |
| **Backend** | **None, ever (this phase)** | All async faked; in-memory + localStorage only. No server/IPC/DB/network. |
| **Browser-first vs Electron-first** | **Browser-first**, Electron-ready | Fastest to inspect (`npm run dev` → localhost). Electron shell is a thin add-on later. |
| **Multi-window** | **Simulated in one viewport** + param-routed previews | Browser can't open native windows; render Dictation Panel / Agent Overlay / overlays as floating elements; each also reachable via a route for later Electron drop-in. |
| **Architecture** | **Feature-based modules + ports/adapters seam** | Scales to many screens; clean swap to a real backend later. |
| **State** | **Zustand + persist (localStorage)** | Feels real across reloads; mirrors the real `src/stores/`. |
| **Data** | **Seeded fixtures** + reset/seed dev controls | Every screen has realistic content to inspect. |
| **Inspection** | **"Mock Studio" dev toolbar** | Toggle theme, surface/window, capture states, overlays, empty/loading/error, locale. |

> **The seam:** UI → **service ports** (interfaces) → **mock adapters** (the only impl
> now) → **real adapters** (future). Lint rules forbid UI from importing adapters
> directly; everything flows through a `ServicesProvider` (dependency injection).

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
| Tooling | ESLint 10 + Prettier + typescript-eslint | + import-boundary rules to protect the seam |
| Testing | **Vitest** + **React Testing Library** | co-located unit/interaction tests |
| Component workbench (P1) | **Storybook 9** | inspect/QA the component library in isolation |
| E2E (P1) | **Playwright** | smoke flows across screens/surfaces |
| Git hygiene (P1) | Husky + lint-staged | format/lint on commit |
| Electron (later) | **Electron 41** thin shell | drop-in; not needed to inspect |

> This is exactly the OpenWhispr renderer stack from
> [`04-technology-stack.md`](04-technology-stack.md), minus the native/AI/db layers
> (which are mocked). **No backend dependencies are installed** (no `better-sqlite3`,
> `whisper.cpp`, `llama.cpp`, `@ai-sdk/*`, `better-auth`, etc.) — those arrive only with
> the future `adapters/real/`.

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

## 4. Project structure (robust, feature-based, built for scale)

**Location:** **`/app`** at repo root (sibling to `docs/`). Organized **by feature**
(not by file type) so it scales to dozens of screens without a sprawling `components/`
folder. Each feature is a self-contained module with a small public API (`index.ts`).

```
app/
├─ public/                          # static assets served as-is
├─ index.html
├─ package.json
├─ tsconfig.json  tsconfig.node.json
├─ vite.config.ts                   # @vitejs/plugin-react + @tailwindcss/vite + path aliases
├─ components.json                  # shadcn/ui config
├─ eslint.config.js  .prettierrc    # incl. import-boundary rules (the seam)
├─ .env.example                     # only client flags (e.g. VITE_DATA_SOURCE=mock)
├─ .storybook/                      # (P1) component workbench
├─ e2e/                             # (P1) Playwright specs
└─ src/
   ├─ main.tsx                      # mount only
   ├─ App.tsx                       # providers + router
   ├─ vite-env.d.ts
   │
   ├─ app/                          # app-level wiring (no feature logic)
   │  ├─ providers/                 # Theme, I18n, Services(DI), StoreHydration, Tooltip/Toaster, ErrorBoundary
   │  ├─ router/                    # AppRouter + route table + surface resolver (param routing)
   │  └─ devtools/                  # Mock Studio (dev-only, tree-shaken in prod)
   │
   ├─ surfaces/                     # top-level "windows" (each a thin composition)
   │  ├─ control-panel/             # main window: TitleBar + Sidebar + ContentPanel
   │  ├─ dictation-panel/           # Khonjel Bar (floating)
   │  ├─ agent-overlay/
   │  └─ overlays/                  # meeting-notification, transcription-preview, update-notification
   │
   ├─ features/                     # ★ the bulk — one module per domain
   │  ├─ home/                      # history timeline + stats rail + voice profile
   │  ├─ insights/                  # gauge, bars, heatmap (Usage/Voice)
   │  ├─ chat/                      # AI agent (streamed markdown)
   │  ├─ notes/                     # TipTap editor, folders, semantic search, AI actions
   │  ├─ upload/                    # file → transcribe
   │  ├─ dictionary/                # dictionary + snippets
   │  ├─ transforms/                # hotkey rewrites
   │  ├─ integrations/              # GCal / API / MCP / CLI
   │  ├─ onboarding/                # first-run (local model + hotkey)
   │  ├─ command-palette/           # ⌘K
   │  ├─ capture/                   # dictation orchestration (mock pipeline + bar states)
   │  ├─ models/                    # inference modes, provider registry UI, model manager, prompt studio
   │  └─ settings/                  # modal + sections (general, hotkeys, speech-to-text, language-models,
   │     │                          #   privacy-data, system, account, workspace)
   │     └─ (per feature) components/  hooks/  store.ts  types.ts  fixtures.ts  index.ts  __tests__/
   │
   ├─ components/
   │  ├─ ui/                        # shadcn primitives (button, dialog, tabs, select, switch, popover, progress…)
   │  └─ common/                    # app-shared, cross-feature: StatCard, Gauge, BarChart, Heatmap,
   │                                #   PromoBanner, SettingRow/SettingsPanel, EngineStatusCard, KeycapChip,
   │                                #   Waveform, EmptyState, PageHeader, UnderlineTabs, ProviderChip…
   │
   ├─ services/                     # ★ THE SEAM (dependency-injected)
   │  ├─ ports/                     # interfaces ONLY: Transcription, Inference/Chat, ModelCatalog,
   │  │                             #   Meeting, Integrations, Hotkey, Profile, Settings, Storage
   │  ├─ adapters/
   │  │  └─ mock/                   # the ONLY implementations now (in-memory + localStorage + simulators)
   │  │     └─ (real/ added later — not in this phase)
   │  ├─ ServicesProvider.tsx       # builds the service container, provides via context
   │  └─ index.ts                   # useServices() hook + container type
   │
   ├─ stores/                       # cross-cutting Zustand (per-feature slices live in features/*/store.ts)
   │  ├─ middleware/                # persist config, devtools
   │  └─ hydration.ts               # seed-on-first-run + reset
   │
   ├─ mock/                         # NO backend — fixtures + simulators only
   │  ├─ fixtures/                  # history, notes, dictionary, snippets, providers, models, insights, meetings
   │  ├─ simulators/                # transcription (typewriter), streaming, download progress, /models discovery
   │  ├─ seed.ts                    # deterministic seed
   │  └─ electron-api-shim.ts       # mock window.electronAPI
   │
   ├─ config/                       # constants & DATA-as-config
   │  ├─ provider-registry.ts       # the wide STT/LLM provider+model registry (declarative)
   │  ├─ routes.ts  feature-flags.ts  nav.ts
   ├─ hooks/                        # shared hooks (useTheme, useHotkey, useMediaQuery, useDebounce)
   ├─ lib/                          # pure, dependency-free utils (cn, delay, stream, format, id, dates)
   ├─ i18n/                         # i18next setup + locales/en.json (keys scaffolded)
   ├─ styles/                       # tokens.css (WF design tokens), globals.css
   ├─ types/                        # global/shared types (domain models)
   └─ assets/                       # logos, illustrations, promo images, brand
```

### 4.1 Conventions (enforced)
- **Folders** kebab-case; **components** PascalCase; **hooks/utils** camelCase.
- Every `features/*` exposes a **public API** via `index.ts`; other modules import only that.
- **Co-located tests** in `__tests__/` next to the code they cover.
- **Barrel files** only at module boundaries (avoid deep barrels that hurt tree-shaking).

### 4.2 Path aliases (`tsconfig` + `vite`)
`@/* → src/*` · `@app/*` · `@surfaces/*` · `@features/*` · `@components/*` ·
`@services/*` · `@stores/*` · `@mock/*` · `@config/*` · `@hooks/*` · `@lib/*` ·
`@styles/*` · `@types`.

### 4.3 Import boundaries (ESLint — protect the seam & scale)
- **UI/features may not import `services/adapters/**`** — only `@services` (ports +
  `useServices()`). This guarantees the **final-UI / swappable-backend** contract.
- **`features/*` may not import another feature's internals** — only its `index.ts`.
- **`lib/` is dependency-free** (no React, no stores, no services).
- **`mock/` and `config/provider-registry` are data**, importable by adapters/devtools,
  not by feature UI directly (UI gets data through services).

> Layout mirrors the real OpenWhispr `src/` intent, so adding `adapters/real/` + a thin
> Electron shell later is mechanical and touches **no feature code**.

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
shell feels like Khonjel; nav switches empty views.

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

## 7. Definition of done
- [ ] Every screen in the spec's screen inventory is reachable and inspectable.
- [ ] Every state (empty/loading/error, capture states, overlays) is toggleable via Mock Studio.
- [ ] The **Khonjel design language** is faithfully applied (tokens, card-on-greige, serif promos, teal data-viz).
- [ ] **Universal model support** UI is fully demonstrable (wide providers + local manager + self-hosted discovery + Prompt Studio).
- [ ] **All-local** posture is visible (local profile, no account required, local storage, no telemetry).
- [ ] Runs in a browser with `npm run dev`; **zero backend / zero network**.
- [ ] UI imports **only** service ports; lint boundary forbids importing `adapters/**` — real adapters swap in with no UI changes.
- [ ] Feature-based structure + aliases + tests in place (scales cleanly).
- [ ] **Validated against spec via the eval loop** — see [Test & Validation Strategy](06-test-and-validation-strategy.md): `npm run verify` (static + design-system lint + unit/a11y + visual regression + spec coverage) passes, and each screen clears the agent visual review against the UI Design Spec + the design reference.

---

## 8. Locked defaults (decided)

| # | Choice | Decision |
|---|---|---|
| 1 | App folder | **`/app`** at repo root (sibling to `docs/`). |
| 2 | Mic waveform | **Faked** by default; real Web-Audio waveform optional later (no transcription either way). |
| 3 | Storybook | **Yes, but P1** — not required for Phase 0; structure reserves `.storybook/`. |
| 4 | Router | **Tiny param router** mirroring the real `AppRouter` (window fidelity). |
| 5 | Backend | **None.** No server/IPC/DB/network; mock adapters + localStorage only. |
| 6 | Real adapters | **Out of scope** for this effort; added later as `adapters/real/`. |

---

## 9. Readiness verdict

**Ready to implement.** The stack is fixed, the architecture and the swap-seam are
defined, the scalable feature-based folder structure and import boundaries are set, the
mock-data rules and inspection tooling are specified, and the build is phased so each
step is reviewable.

**Phase 0 kickoff (first concrete steps):**
1. `npm create vite@latest app -- --template react-ts`; add Tailwind v4 (`@tailwindcss/vite`), shadcn init, path aliases, ESLint/Prettier + import-boundary rules.
2. Drop in **design tokens** (`styles/tokens.css`) from the UI Design Spec; ThemeProvider (Light/Dark/Auto).
3. Create `services/ports/*` + `services/adapters/mock/*` + `ServicesProvider` + `useServices()`; `electron-api-shim`.
4. Scaffold `surfaces/control-panel` shell (TitleBar + Sidebar + ContentPanel) + `app/router` + `app/devtools/MockStudio`.
5. Seed `mock/fixtures` + `stores/hydration`.
→ **Deliverable:** the app shell renders in the browser with the Khonjel look, theme
switch, nav, and Mock Studio — ready to build features into.
