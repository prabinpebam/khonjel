# Khonjel — Product Specification

> **Khonjel** (Manipuri for *"Voice"*) is a **local-first, privacy-first voice
> productivity app** for the desktop. Speak, and Khonjel transcribes, cleans up,
> formats, and places text wherever you're working — and can act on your voice as an
> agent. It works fully on **open-source and on-device models**, and also supports a
> **wide range of cloud, self-hosted, and enterprise APIs**.

This folder is the complete, world-class product specification. It merges two
reference designs into one coherent product:

- **OpenWhispr** (`open-wisper`) — the model/engine depth (local, BYO-key, self-hosted,
  enterprise, Prompt Studio, privacy-by-default).
- **Wispr Flow** (`wisper-flow`) — the productivity surface (history, insights,
  dictionary, snippets, style, transforms, scratchpad, the always-on bar).

> **Khonjel = Wispr Flow's productivity surface, powered by OpenWhispr's local/open
> engine backbone.**

---

## How to read this spec

1. **Start with foundation** → vision, who it's for, and the language we use.
2. **Then product** → the full feature set, capture modes, the model system, text
   intelligence, and notes/insights.
3. **Then IA & UX/UI** → information architecture, navigation, design language, the app
   shell, and reproduction-grade screen specs.
4. **Then architecture & delivery** → technical shape, privacy/security, and the roadmap.
5. **Reference analysis (appendix)** → high-fidelity, screen-by-screen capture of both
   original apps, used to verify fidelity.

---

## Document map

```
docs/product-spec/
├── README.md                        ← you are here
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
│   └── 05-interaction-states-and-accessibility.md
├── 04-architecture-and-delivery/
│   ├── 01-system-architecture.md
│   ├── 02-privacy-data-security.md
│   └── 03-roadmap-mvp-open-questions.md
└── 99-reference-analysis/
    ├── 01-open-wisper-screen-by-screen.md
    └── 02-wisper-flow-screen-by-screen.md
```

### Index with one-line purpose

| Doc | What it covers |
|---|---|
| [00 · Vision, Positioning & Principles](00-foundation/01-vision-positioning-principles.md) | Why Khonjel exists, the wedge, product principles |
| [00 · Personas & Jobs](00-foundation/02-personas-and-jobs.md) | Who it's for + JTBD + journeys |
| [00 · Glossary & Naming](00-foundation/03-glossary.md) | Canonical terms (Khonjel Bar, engine archetypes, purposes…) |
| [01 · Feature Map](01-product/01-feature-map.md) | Master merged inventory with source + priority |
| [01 · Capture Modes & Flows](01-product/02-capture-modes-and-flows.md) | Dictation, Note Recording, Meeting Mode, Voice Agent, Scratchpad |
| [01 · AI Engines & Providers](01-product/03-ai-engines-and-providers.md) | The five engine archetypes, provider matrix, local manager |
| [01 · Text Intelligence](01-product/04-text-intelligence.md) | Cleanup, Transforms, Style, Snippets, Dictionary, Prompt Studio |
| [01 · Notes, Insights & Collaboration](01-product/05-notes-insights-collaboration.md) | Home/history, Insights, Notes, Account/Team |
| [02 · Sitemap & IA](02-information-architecture/01-sitemap-and-ia.md) | Surfaces, sitemap, settings IA, screen inventory |
| [02 · Navigation & Content Model](02-information-architecture/02-navigation-and-content-model.md) | Nav system, routing, keyboard, data model |
| [03 · Design Language & Tokens](03-ux-ui/01-design-language.md) | Themes, color, type, spacing, components, motion |
| [03 · App Shell & Layout](03-ux-ui/02-app-shell-and-layout.md) | Chrome, sidebar, content layouts, responsive |
| [03 · Screen Specifications](03-ux-ui/03-screen-specifications.md) | Reproduction-grade specs for every main screen |
| [03 · Floating Bar, Overlays & Settings](03-ux-ui/04-floating-bar-overlays-and-settings.md) | Khonjel Bar, overlays, full settings spec |
| [03 · Interaction, States & Accessibility](03-ux-ui/05-interaction-states-and-accessibility.md) | States, motion, keyboard, WCAG 2.2 AA |
| [04 · System Architecture](04-architecture-and-delivery/01-system-architecture.md) | Components, pipeline, ModelGateway, local models |
| [04 · Privacy, Data & Security](04-architecture-and-delivery/02-privacy-data-security.md) | Defaults, data inventory, egress map, security |
| [04 · Roadmap, MVP & Open Questions](04-architecture-and-delivery/03-roadmap-mvp-open-questions.md) | Phasing, NFRs, decisions |
| [99 · OpenWhispr screen-by-screen](99-reference-analysis/01-open-wisper-screen-by-screen.md) | Hi-fidelity capture of all 15 OW screenshots |
| [99 · Wispr Flow screen-by-screen](99-reference-analysis/02-wisper-flow-screen-by-screen.md) | Hi-fidelity capture of all 18 WF screenshots |

---

## What makes Khonjel different (the wedge)

1. **Local & open by default** — usable with $0 cloud spend and no account.
2. **Bring *any* model** — one consistent engine selector everywhere:
   *Local · Self-Hosted · Cloud Providers · Enterprise · Khonjel Cloud*.
3. **Wide provider support** — OpenAI, Anthropic, Google Gemini, Groq, Custom;
   Ollama / LM Studio / vLLM / `llama-server`; AWS Bedrock / Azure OpenAI / Google Vertex.
4. **Purpose-scoped intelligence** — independent models for Cleanup, Voice Agent,
   Note Formatting, and Chat.
5. **A real productivity surface** — history, insights, dictionary, snippets, style,
   transforms, scratchpad — not just a settings window.
6. **Transparent privacy** — everything off by default, time-boxed retention, no-training
   Privacy Mode.

---

## Conventions used in this spec
- **Priorities:** P0 (v1 must), P1 (v1 should), P2 (later).
- **Source tags:** **OW** = OpenWhispr, **WF** = Wispr Flow, **NEW** = Khonjel synthesis.
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
