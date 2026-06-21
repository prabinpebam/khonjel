# Khonjel — Execution Playbook (READ ME FIRST)

> **This is the single source of truth for *how* we build Khonjel.** If you are an agent
> or developer **resuming with little/no context, read this whole doc first**, then skim
> the linked detail docs. When in doubt about approach, strategy, or "how should I be
> doing this," **return here.** This doc is intentionally concise and stable — the detail
> lives in the linked specs.
>
> Last aligned: this playbook reflects all decisions through the current spec. If a
> detail doc conflicts with a **Non-negotiable** below, the non-negotiable wins.

---

## 0. Resume protocol (do this when you have no context)

1. **Read this playbook top to bottom** (5 min).
2. Skim the **doc map** (§11) and open the 4 hubs: [Mock Frontend Plan](04-architecture-and-delivery/05-mock-frontend-plan.md), [UI Design Spec](03-ux-ui/06-ui-design-spec.md), [Design System discipline](03-ux-ui/design-system/01-intent.md), [Test & Validation Strategy](04-architecture-and-delivery/06-test-and-validation-strategy.md).
3. Check **what phase we're in** (§7) and `git log --oneline -10` to see recent work.
4. Run the **eval loop** (`npm run verify` in `/app`, once it exists) to see current state.
5. Pick up the next phase task. Follow **§8 (how we code)** and **§9 (the per-change loop)**.

---

## 1. Mission (one paragraph)

**Khonjel** ("Voice" in Manipuri) is a **local-first, privacy-first desktop voice
productivity app**: press a hotkey, speak, and clean text appears at your cursor — with
dictation, an AI agent, meeting transcription, notes, and dictionary. It is **built on a
mature open-source voice-to-text codebase (same tech stack), rebranded, with the
subscription layer removed**, and a **warm, editorial** visual polish layered on. Two
headline features: **universal model support** (any STT/LLM — local, self-hosted, BYO-key
cloud, enterprise) and **everything on-device** (profile + storage local; no account; no
telemetry).

---

## 2. Non-negotiables (the contracts — never violate)

1. **This phase = the complete FINAL frontend with ZERO backend.** No server, no Electron
   IPC implementation, no DB, no network. Only **mock adapters** (in-memory + localStorage)
   + a mock `window.electronAPI` shim. *(Do not write a backend. At all.)*
2. **Final UI, not throwaway.** UI/components depend **only on service ports** (interfaces),
   never on adapters. A real backend later is just `adapters/real/` selected by config —
   **zero UI changes**. Lint boundaries enforce this.
3. **No subscription.** No billing, pricing, checkout, quota, referral, or upgrade UI.
   Public API / MCP / CLI are **free**. "Khonjel Cloud" = optional, free, self-hostable.
4. **Everything on-device.** Local profile (no account required), local storage for all
   data, **no telemetry**. Cloud is strictly opt-in.
5. **Universal model support is a key feature.** Wide STT + LLM providers + local engines +
   self-hosted + enterprise + a universal OpenAI-compatible adapter + extensible registry.
6. **Visual direction = the Khonjel design language.** Warm greige canvas, white panel
   floating on it, generous rounding, **serif promo headlines**, **violet UI accent + teal
   data-viz** (never crossed). Light is the hero; Dark mirrors it.
7. **Strict design-system discipline (P1–P13).** Values live in **tokens**; variants are
   **CVA props, never forks**; **reuse before create**; theme/density are **token overrides**;
   **Storybook is the inventory**. No hardcoded hex/px, no `!important`, no emoji.
8. **Validate against spec via the eval loop** before any "done."

> If a request seems to conflict with these, surface it — don't silently break a contract.

---

## 3. Tech stack (fixed)

**Vite 8 · TypeScript (strict) · React 19 · Tailwind CSS v4 · shadcn/ui (Radix) ·
class-variance-authority · lucide-react · Zustand (+persist) · TipTap · react-markdown ·
@tanstack/react-virtual · i18next.** Charts = custom SVG/CSS. Tests = Vitest + RTL +
Playwright + axe + Storybook. **No backend deps installed** (no better-sqlite3 /
whisper.cpp / llama.cpp / @ai-sdk / better-auth) — those arrive only with future real
adapters. Detail: [Technology Stack](04-architecture-and-delivery/04-technology-stack.md).

---

## 4. Architecture in one picture

```
Surfaces (windows)        ControlPanel · DictationPanel(Khonjel Bar) · AgentOverlay · overlays · Settings modal
   ↓ compose
Features                  home · insights · chat · notes · upload · dictionary · transforms · integrations · models · settings · capture …
   ↓ use
Components                ui/ (shadcn primitives) + common/ (StatCard, Gauge, PromoBanner, SettingRow, …)
   ↓ data via
Service Ports (the SEAM)  Transcription · Inference/Chat · ModelCatalog · Meeting · Integrations · Hotkey · Profile · Settings
   ↓ implemented by (now)
Mock Adapters             canned text, fake catalogs, simulated streaming/downloads, localStorage, electronAPI shim
                          (real adapters added LATER → zero UI change)
```
- **Multi-window is simulated** in one viewport + param routes (`?panel`, `?agent`,
  `?meeting-notification`, …) mirroring the real `AppRouter` — Electron-ready.
- **State:** Zustand stores, persisted to localStorage, seeded from fixtures.

---

## 5. Folder structure (feature-based, at `/app`)

`src/{app, surfaces, features/*, components/{ui,common}, services/{ports,adapters/mock},
stores, mock, config, hooks, lib, i18n, styles, types, assets}`. Each `features/*` is
self-contained with a public `index.ts`. **Path aliases** (`@features/*`, `@services/*`,
…). **Import boundaries**: UI can't import adapters; features can't import each other's
internals; `lib/` is pure. Full detail: [Mock Frontend Plan §4](04-architecture-and-delivery/05-mock-frontend-plan.md).

---

## 6. Primary navigation (what we're building, screen-wise)

Control Panel sidebar = **Home · Insights · Chat · Notes · Upload · Dictionary ·
Transforms · Integrations** (+ ⌘K palette, Settings modal). The reference's productivity
features are merged with definite homes (Insights/Transforms first-class; Style under
Cleanup; Snippets under Dictionary; Scratchpad → Notes). Capture surfaces: Khonjel Bar,
Agent Overlay, meeting/preview/update overlays. Full inventory: [Sitemap & IA §5](02-information-architecture/01-sitemap-and-ia.md#5-full-screen-inventory-build-checklist).

---

## 7. Build phases (each ends in something inspectable)

0. **Scaffold** — Vite+TS+Tailwind v4+shadcn, design tokens, theme, services seam, Mock Studio, **eval loop wired**.
1. **App shell** — chrome, sidebar (white-pill nav), content panel (card-on-greige).
2. **Core** — Home, Dictionary/Snippets, Settings shell (General/Hotkeys).
3. **Model system** — inference modes, wide provider chips, local manager, self-hosted discovery, Prompt Studio. *(key inspect target)*
4. **Capture surfaces** — Khonjel Bar states, Agent overlay, meeting notification.
5. **Productivity** — Notes (semantic search), Upload, Chat (streaming), Insights, Transforms, Style.
6. **Onboarding, Integrations, ⌘K, notifications.**
7. **Polish** — empty/loading/error, a11y, dark parity, motion.
8. *(next)* **Backend build** — Electron shell + real adapters, executed per the
   [Backend Implementation Plan](04-architecture-and-delivery/backend/14-implementation-plan.md)
   with a **strict TDD + EDD** gate per task. The frontend phases above are complete; both test
   lanes are operational (`npm run test`, `npm run eval`).

Detail: [Mock Frontend Plan §5](04-architecture-and-delivery/05-mock-frontend-plan.md).

---

## 8. How we code (rules of engagement)

**Before creating anything, answer:** *what existing token / primitive / common component
did I consider, and why couldn't I reuse or extend it?* No answer → don't create it.

- **Values → tokens only.** No hex/`rgb`/`bg-[#…]`; no bare px for spacing/radius/font
  (only the scale; arbitrary px only for P1a instance dimensions via a named token).
- **Variants via CVA**, not forked components. One `Button`, one `cn()`, one icon wrapper.
- **Respect layers** (Tokens → ui → common → feature → surface); never reach sideways/skip up.
- **Theme/density/motion = root token overrides**; never branch on theme in component code.
- **Content is data** (fixtures/stores/`config/`), components render it; no hardcoded
  user-facing strings in shared components (i18n keys).
- **A11y is a contract** (keyboard + ARIA + focus-visible); don't break Radix semantics.
- **No emoji** in UI — lucide icons only. **Logical** CSS props (`ps/pe/ms/me`), not left/right.
- **No backend code.** Mock behaviour lives in `services/adapters/mock` + `mock/`.

Full rules: [Design System P1–P13](03-ux-ui/design-system/01-intent.md).

---

## 9. The development loop (per change)

```
edit  →  npm run verify:quick        (types + lint + design-system lint + unit)
      →  npm run eval:shots          (render screens/states/themes → PNGs)
      →  AGENT VIEWS the PNGs vs the UI Design Spec rubric + the design reference
      →  fix visual/structural gaps
      →  npm run verify              (full: + a11y + visual regression + spec coverage)
      →  all green  →  done
```
**How we know "right":** three oracles — (A) spec **acceptance checklists**, (B) **UI
Design Spec + reference screenshots**, (C) approved **baselines**. The agent's "eyes" =
render → screenshot → inspect (closes what code tests can't judge). Detail:
[Test & Validation Strategy](04-architecture-and-delivery/06-test-and-validation-strategy.md).

---

## 10. Definition of done (the gate)

A screen/feature is done only when `npm run verify` is green **and**: types+lint clean ·
design-system lint clean · unit/interaction tests pass · axe zero-violations + keyboard ·
**visual baseline reviewed (Light+Dark)** · reachable + states toggle + **Storybook story
exists** for new shared components · **agent visual review** done vs spec/reference · the
screen's **spec acceptance items asserted**.

---

## 11. Doc map (where the detail lives)

| Area | Doc |
|---|---|
| Spec index | [README](README.md) |
| Vision / principles | [00-foundation/01](00-foundation/01-vision-positioning-principles.md) |
| Glossary | [00-foundation/03](00-foundation/03-glossary.md) |
| Features (merged) | [01-product/01-feature-map](01-product/01-feature-map.md) |
| **Models & providers** | [01-product/03-ai-engines-and-providers](01-product/03-ai-engines-and-providers.md) |
| IA / nav / data model | [02-information-architecture](02-information-architecture/01-sitemap-and-ia.md) |
| **Visual hero** | [03-ux-ui/06-ui-design-spec](03-ux-ui/06-ui-design-spec.md) |
| **Design-system discipline** | [03-ux-ui/design-system/01-intent](03-ux-ui/design-system/01-intent.md) |
| Screen specs | [03-ux-ui/03-screen-specifications](03-ux-ui/03-screen-specifications.md) |
| Settings + overlays | [03-ux-ui/04-floating-bar-overlays-and-settings](03-ux-ui/04-floating-bar-overlays-and-settings.md) |
| Tech stack | [04/04-technology-stack](04-architecture-and-delivery/04-technology-stack.md) |
| **Build plan** | [04/05-mock-frontend-plan](04-architecture-and-delivery/05-mock-frontend-plan.md) |
| **Eval loop** | [04/06-test-and-validation-strategy](04-architecture-and-delivery/06-test-and-validation-strategy.md) |
| **Backend architecture spec** | [04/backend/README](04-architecture-and-delivery/backend/README.md) |
| **Backend build order** | [04/backend/14-implementation-plan](04-architecture-and-delivery/backend/14-implementation-plan.md) |
| **EDD framework + harness** | [frameworks/eval-driven-development](../frameworks/eval-driven-development/README.md) |
| OpenWhispr repo capture | [99/03-openwhispr-repo-analysis](99-reference-analysis/03-openwhispr-repo-analysis.md) |

---

## 12. Locked decisions (don't relitigate)

| # | Decision |
|---|---|
| App location | **`/app`** at repo root |
| Backend | **None this phase** (mock adapters + localStorage only) |
| Final UI | UI → ports → mock adapters; real adapters later, no UI change |
| Router | **Param router** mirroring `AppRouter` |
| Mic waveform | **Faked** default (real Web-Audio optional later) |
| Storybook | **Yes**, P1 (inventory + visual review) |
| Subscription | **Removed** entirely |
| Account/auth | **Optional**, local profile default |
| Visual style | **Khonjel design language** (light hero), violet UI / teal data-viz |
| Design system | **Strict P1–P13**, token-driven, CVA variants, Storybook inventory |
| Validation | **Eval loop** (L0–L6) gates every "done" |

---

## 13. Working agreement (process)

- **Small, reviewable commits**; conventional messages; commit after each green phase/feature.
- **Update the spec** when a decision changes — the spec is the contract; keep it true.
- **Use the eval loop in a loop**, not just at the end.
- **Surface conflicts** with the non-negotiables instead of silently working around them.
- **Prefer reuse**; justify every new token/component.
- **When resuming, start at §0.**
