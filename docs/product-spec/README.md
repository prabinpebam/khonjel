# Khonjel — Product Specification

> ▶ **Building/resuming? Read [`00-execution-playbook.md`](00-execution-playbook.md) first**
> — the single source of truth for *how* we code and execute this project (the doc to
> revisit whenever you lose context).
>
> **Khonjel** (Manipuri for *"Voice"*) is a **local-first, privacy-first voice
> productivity app** for the desktop. Speak, and Khonjel transcribes, cleans up,
> formats, and places text wherever you're working — and can act on your voice as an
> agent. It works fully on **open-source and on-device models**, and also supports a
> **wide range of cloud, self-hosted, and enterprise APIs**.

This folder is the complete, world-class product specification. Khonjel is **built on
the open-source [OpenWhispr](https://github.com/OpenWhispr/openwhispr) app (MIT)** —
**the same technology stack**, replicating its full UI, navigation, and feature set —
with the **subscription/billing layer removed** and the productivity polish of a second
reference layered on:

- **Engine base** (source repo + screenshots) — the **authoritative technical base**:
  multi-window desktop app, local engines (Whisper/Parakeet/llama.cpp), 5 inference
  modes, Prompt Studio, Notes with semantic search, meetings, integrations,
  privacy-by-default, **no telemetry**.
- **Productivity reference** — additive productivity polish (history timeline,
  insights, style, transforms, the warm light theme).

> **Khonjel = a rebranded, de-monetized fork of a mature open-source voice codebase, on
> the same stack, minus the subscription — plus the productivity polish of the reference
> design.** "We have pretty much everything else."

**Tech stack (adopted verbatim):** React 19 · TypeScript · Tailwind CSS v4 · Electron 41
· shadcn/ui · better-sqlite3 · whisper.cpp · sherpa-onnx (Parakeet) · llama.cpp · Qdrant
· Vercel AI SDK. See [Technology Stack](04-architecture-and-delivery/04-technology-stack.md).

---

## How to read this spec

1. **Start with foundation** → vision, who it's for, and the language we use.
2. **Then product** → the full feature set, capture modes, the model system, text
   intelligence, and notes/insights.
3. **Then IA & UX/UI** → information architecture, navigation, design language, the app
   shell, and reproduction-grade screen specs.
4. **Then architecture & delivery** → technical architecture, privacy/security,
   **technology stack**, and the roadmap.
5. **Reference analysis (appendix)** → the **OpenWhispr source-repo capture**
   (authoritative) plus high-fidelity screenshot captures of both apps.

---

## Document map

```
docs/product-spec/
├── README.md                        ← you are here
├── 00-execution-playbook.md         ← READ FIRST: how we code & execute (resume here)
├── 00-foundation/
│   ├── 01-vision-positioning-principles.md
│   ├── 02-personas-and-jobs.md
│   └── 03-glossary.md
├── 01-product/
│   ├── 01-feature-map.md
│   ├── 02-capture-modes-and-flows.md
│   ├── 03-ai-engines-and-providers.md
│   ├── 04-text-intelligence.md
│   └── 05-notes-insights-collaboration.md
├── 02-information-architecture/
│   ├── 01-sitemap-and-ia.md
│   └── 02-navigation-and-content-model.md
├── 03-ux-ui/
│   ├── 01-design-language.md
│   ├── 02-app-shell-and-layout.md
│   ├── 03-screen-specifications.md
│   ├── 04-floating-bar-overlays-and-settings.md
│   ├── 05-interaction-states-and-accessibility.md
│   ├── 06-ui-design-spec.md
│   ├── 07-local-model-management.md
│   ├── 08-local-model-fre-readiness-and-compatibility.md
│   └── design-system/
│       ├── README.md
│       └── 01-intent.md
├── 04-architecture-and-delivery/
│   ├── 01-system-architecture.md
│   ├── 02-privacy-data-security.md
│   ├── 03-roadmap-mvp-open-questions.md
│   ├── 04-technology-stack.md
│   ├── 05-mock-frontend-plan.md
│   ├── 06-test-and-validation-strategy.md
│   ├── parakeet-integration-plan.md
│   └── gpu-acceleration/
│       ├── README.md
│       ├── 01-gpu-detection-and-capability.md
│       ├── 02-backend-provisioning-and-rollback.md
│       ├── 03-runtime-acceleration-and-fallback.md
│       ├── 04-contracts-data-and-ipc.md
│       ├── 05-ux-setup-test-validate.md
│       └── 06-edd-tdd-and-implementation-plan.md
└── 99-reference-analysis/
    ├── 01-open-wisper-screen-by-screen.md
    ├── 02-wisper-flow-screen-by-screen.md
    └── 03-openwhispr-repo-analysis.md
```

### Index with one-line purpose

| Doc | What it covers |
|---|---|
| [00 · **Execution Playbook**](00-execution-playbook.md) | **READ FIRST** — how we code & execute; the doc to revisit when context is lost |
| [00 · Vision, Positioning & Principles](00-foundation/01-vision-positioning-principles.md) | Why Khonjel exists, the wedge, product principles |
| [00 · Personas & Jobs](00-foundation/02-personas-and-jobs.md) | Who it's for + JTBD + journeys |
| [00 · Glossary & Naming](00-foundation/03-glossary.md) | Canonical terms (Khonjel Bar, inference modes, purposes…) |
| [01 · Feature Map](01-product/01-feature-map.md) | Master merged inventory with source + priority |
| [01 · Capture Modes & Flows](01-product/02-capture-modes-and-flows.md) | Dictation, Voice/Chat Agent, Note Recording, Meeting Mode, Upload |
| [01 · AI Engines & Providers](01-product/03-ai-engines-and-providers.md) | 5 inference modes, Whisper/Parakeet/llama.cpp, provider matrix |
| [01 · Text Intelligence](01-product/04-text-intelligence.md) | Cleanup, Dictionary, Snippets, Prompt Studio, Transforms/Style |
| [01 · Notes, Insights & Collaboration](01-product/05-notes-insights-collaboration.md) | Notes (semantic search), history, optional account/workspace |
| [02 · Sitemap & IA](02-information-architecture/01-sitemap-and-ia.md) | Surfaces, sitemap, settings IA, screen inventory |
| [02 · Navigation & Content Model](02-information-architecture/02-navigation-and-content-model.md) | Nav system, routing, keyboard, data model |
| [03 · Design Language & Tokens](03-ux-ui/01-design-language.md) | Token layer: color, type, spacing, components, motion |
| [03 · **UI Design Spec (Khonjel design language)**](03-ux-ui/06-ui-design-spec.md) | **The visual hero** — art direction, palette, signatures, component looks |
| [03 · **Design System discipline**](03-ux-ui/design-system/01-intent.md) | **Strict token/component rules (P1–P13)** that stop design drift across agent sessions |
| [03 · App Shell & Layout](03-ux-ui/02-app-shell-and-layout.md) | Chrome, sidebar, content layouts, responsive |
| [03 · Screen Specifications](03-ux-ui/03-screen-specifications.md) | Reproduction-grade specs for every main screen |
| [03 · Floating Bar, Overlays & Settings](03-ux-ui/04-floating-bar-overlays-and-settings.md) | Dictation Panel, overlays, full settings spec |
| [03 · Interaction, States & Accessibility](03-ux-ui/05-interaction-states-and-accessibility.md) | States, motion, keyboard, WCAG 2.2 AA |
| [03 · Local Model Management](03-ux-ui/07-local-model-management.md) | In-app local model asset download, verify, remove, storage, and row states |
| [03 · Local Model FRE, Readiness & Compatibility](03-ux-ui/08-local-model-fre-readiness-and-compatibility.md) | Consumer-grade setup, hardware compatibility, support copy, readiness, and seamless switching |
| [04 · System Architecture](04-architecture-and-delivery/01-system-architecture.md) | Multi-window Electron, pipeline, inference router, local engines |
| [04 · Privacy, Data & Security](04-architecture-and-delivery/02-privacy-data-security.md) | Defaults, data inventory, egress map, no-telemetry |
| [04 · Roadmap, MVP & Open Questions](04-architecture-and-delivery/03-roadmap-mvp-open-questions.md) | Phasing, NFRs, decisions |
| [04 · Technology Stack](04-architecture-and-delivery/04-technology-stack.md) | The exact OpenWhispr stack Khonjel adopts |
| [04 · **Mock Frontend Plan**](04-architecture-and-delivery/05-mock-frontend-plan.md) | **Build the inspectable, backend-free frontend** — stack, architecture, phases |
| [04 · **Test & Validation Strategy**](04-architecture-and-delivery/06-test-and-validation-strategy.md) | **The eval loop** — how we detect "what right looks like" against the spec |
| [04 · **GPU Acceleration (no-compromise + graceful fallback)**](04-architecture-and-delivery/gpu-acceleration/README.md) | **Full local-model GPU support** — smart detect, auto-provision, probe, rollback, test-and-validate UX, EDD + phased plan |
| [04 · **Parakeet Integration (no-compromise)**](04-architecture-and-delivery/parakeet-integration-plan.md) | **Make NVIDIA Parakeet a first-class local STT engine** via sherpa-onnx — runtime, multi-asset model, GPU provider, EDD + phased plan |
| [99 · OpenWhispr **repo** analysis](99-reference-analysis/03-openwhispr-repo-analysis.md) | **Authoritative** capture of the real app (stack, nav, features) |
| [99 · OpenWhispr screen-by-screen](99-reference-analysis/01-open-wisper-screen-by-screen.md) | Hi-fidelity capture of all 15 OW screenshots |
| [99 · Productivity reference — screen-by-screen](99-reference-analysis/02-wisper-flow-screen-by-screen.md) | Hi-fidelity capture of all 18 reference screenshots |

---

## What makes Khonjel different (the wedge)

1. **Universal model support (key feature)** — strong, wide support for **all sorts of
   transcription and language models**: local (Whisper/Parakeet, llama.cpp) · self-hosted
   (Ollama/LM Studio/vLLM) · BYO-key cloud (OpenAI, Anthropic, Gemini, Groq, Mistral,
   DeepSeek, xAI, Cohere, Deepgram, AssemblyAI, ElevenLabs, Together, Fireworks,
   OpenRouter, Perplexity…) · enterprise (Bedrock/Azure/Vertex) — plus a **universal
   OpenAI-compatible adapter + extensible registry** so even new/unknown providers work.
2. **Everything on-device** — local & open by default; **your profile and all storage
   (history, notes, dictionary, settings, models) stay on your device**. No account
   required, no telemetry. Cloud is opt-in only.
3. **One consistent selector everywhere** — *Local · Self-Hosted · Providers · Enterprise
   · Khonjel Cloud* — for both speech and language, on every surface.
4. **Purpose-scoped intelligence** — independent models for Cleanup, Voice Agent,
   Note Formatting, and Chat.
5. **A real productivity surface** — history, insights, dictionary, snippets, style,
   transforms, notes — not just a settings window.
6. **No subscription, transparent privacy** — no billing/quotas; everything that could
   leave the device is off by default.

---

## Conventions used in this spec
- **Priorities:** P0 (v1 must), P1 (v1 should), P2 (later).
- **Source tags:** **OW** = engine base, **WF** = productivity reference, **NEW** = Khonjel synthesis.
- **Copy in `code font`** is UI text (often verbatim from the references).
- **Tokens** (e.g. `--accent`) are defined in the Design Language doc; build against
  tokens, not raw values.
- **No emoji** in product UI — use the system icon set.

---

## Reference designs
Original screenshots live in [`../reference-designs/`](../reference-designs/):
`open-wisper/` (15) and `wisper-flow/` (18). Their exhaustive analysis is in
[`99-reference-analysis/`](99-reference-analysis/). Use those to validate any screen
built from this spec.

---

## Status
Living document. Section-level acceptance checklists appear at the end of each doc;
open product decisions are tracked in
[Roadmap, MVP & Open Questions](04-architecture-and-delivery/03-roadmap-mvp-open-questions.md#6-open-questions--decisions-to-make).
