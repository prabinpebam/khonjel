# 01 — Intent & Principles (Khonjel Design System)

> **Read this before writing any UI code.** Khonjel is built across many agent/dev
> sessions and many screens. Without strict discipline, a "button" gets redefined five
> times, an accent color gets hardcoded, and the design system drifts after every
> session. This document is the **non-negotiable contract** that keeps the UI coherent.
> It is **referenced again and again** — treat every principle (P1–P13) and every
> anti-pattern as a rule, not a suggestion.
>
> Stack context: **React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui (Radix) ·
> class-variance-authority (CVA) · lucide-react**. Token values come from the
> [UI Design Spec](../06-ui-design-spec.md) and
> [Design Language & Tokens](../01-design-language.md). This doc governs **how** those
> tokens and components are used.

---

## TL;DR — the agent contract (memorize)

1. **Values live in tokens. Components hold structure + state. Never inline a value.**
2. **Reuse before you create.** Scan the inventory (Storybook) first. Snap to the nearest scale step.
3. **Variants are props (CVA), never new components.** No `PrimaryButton` beside `Button`.
4. **Respect the layers:** Tokens → `ui/` primitives → `common/` → feature components → surfaces. Never reach sideways or skip up.
5. **One of everything:** one `Button`, one `cn()`, one icon system (lucide), one render path.
6. **Theme/density/motion = token overrides on the root.** Components never branch on theme.
7. **No hardcoded hex/rgb, no bare px for scale values, no `!important`, no `style={{}}` (except runtime-dynamic), no emoji.**
8. **If it's shared, it's in Storybook.** Not in Storybook = not real.

**Before you create *anything*, answer in the PR/commit:** *What existing token / primitive
/ common component did I consider, and why couldn't I use or extend it?* No answer → reject.

---

## The problem

Agentic coding optimizes locally. An agent building the Notes screen will happily write
a one-off card with `style={{ background: '#fff', borderRadius: 14, padding: 18 }}`, a
`bg-[#6C5CE7]` accent, and a bespoke `NoteButton`. The Insights screen does the same with
slightly different numbers. Multiply by ~30 screens (Home, Insights, Chat, Notes, Upload,
Dictionary, Transforms, Integrations, Onboarding, all Settings sections, Dictation Panel,
Agent Overlay, overlays) across many sessions and the result is **N inconsistent
definitions of every element** and a design system that cannot be retuned from one place.

## The goal

A design system robust enough that:

- A **new screen** is built by composing existing tokens, primitives, and common
  components. **Near-zero new styling** for ~90% of any screen.
- Changing a **single token** (e.g. `--radius` or the accent) updates **every** button,
  card, input, chip, and tile across the whole app simultaneously.
- An agent can **inspect the live inventory (Storybook)** and know exactly what exists
  and what each piece consumes — without reading screen code.
- Theming (Light/Dark/Auto), density, reduced-motion, and direction are tuned at the
  **token layer** without touching a single component.

---

## Principles

### P1 — Tokens are values, components are structure
Tokens hold **every** value: color, spacing, font size, radius, shadow, motion duration,
stroke, z-index. Components hold **structure** (JSX), **layout** (flex/grid via Tailwind),
and **state** (hover/active/disabled/selected). **No component hardcodes a value.** If a
value is needed and no token exists, **add the token first**.

#### P1a — Three-tier token hierarchy
1. **Fundamental tokens** — `src/styles/tokens.css` (`:root` + Tailwind v4 `@theme`).
   The raw design scales: color palette (greige canvas, white surfaces, warm text,
   violet accent, teal data-viz), spacing, radius, font sizes/weights, shadows, motion
   durations, z-index. **These are what theming/density tune** (e.g. a "Compact" density
   swaps the spacing scale in one shot).
2. **Semantic tokens** — shadcn-style names that **reference a fundamental token, never a
   literal**: `--background`, `--foreground`, `--card`, `--primary`, `--muted`,
   `--border`, `--ring`, plus Khonjel additions `--canvas`, `--surface`, `--dataviz`,
   `--accent-soft`. Tailwind utilities (`bg-card`, `text-foreground`, `rounded-md`) map
   to these. When a fundamental scale changes, every semantic token follows automatically.
3. **Instance-specific dimensions** (the exception) — a measurement structurally unique to
   one element with no relationship to the design scale (sidebar width `218px`, Khonjel
   Bar size, settings modal `~960×680`, content max-width `1040px`, heatmap cell `12px`)
   may be a **bare value on that element's own named token** (e.g. `--sidebar-width`).
   These are **layout measurements**, not design-scale values — the radius/spacing scale
   must not move them.

> **Rule:** If a value controls **spacing, padding, gap, radius, font-size, or stroke**,
> it **must** resolve to a fundamental token. If it controls an element's **unique
> physical dimension**, a bare value (named token) is acceptable.

### P2 — Scoped ownership, no leaking styles
Each component owns its appearance through Tailwind classes (mapped to tokens) + its own
CVA config. **A component never styles another component.** No global selectors that reach
into children (`.sidebar .button { … }` is forbidden). Parents may pass **layout-only**
`className` to a child's outer slot (margins/placement) — never restyle a child's internals.

### P3 — One source, two consumers (app **and** Storybook)
A shared component has **exactly one implementation**, imported by both the running app
and its Storybook story. **Never** fork a component for Storybook, and never re-implement
a primitive inline. If a component renders differently in a story than in the app, one of
them is wrong.

### P4 — Strict layering
```
Tokens          (CSS vars / Tailwind theme)              src/styles/tokens.css
   ↓
UI primitives   (shadcn/ui: Button, Dialog, Tabs,        src/components/ui/
                 Select, Switch, Popover, Progress…)
   ↓
Common          (StatCard, Gauge, BarChart, Heatmap,     src/components/common/
                 PromoBanner, SettingRow, EngineStatusCard,
                 UnderlineTabs, ProviderChip, KeycapChip,
                 Waveform, EmptyState, PageHeader…)
   ↓
Feature comps   (feature-specific compositions)          src/features/*/components/
   ↓
Surfaces/Views  (Control Panel views, settings sections, src/surfaces/, src/features/*
                 capture surfaces)
```
A layer may use anything **at or below** its level. It must **not** reach sideways into a
sibling's internals, and must **not** skip upward. (Example: a feature view composes
`common` + `ui`; it never imports another feature's internal component.)

### P5 — Variants are data (CVA), not forks
A component's looks are **variants** defined with `cva()` and selected by props — not
separate components. A `Button` has `variant: primary | secondary | ghost | danger` and
`size: sm | md`. Toggle via `<Button variant="primary" />`.

> ✅ `<Button variant="primary">Add new</Button>` · `<Button variant="secondary">Download</Button>`
> ❌ `<PrimaryButton/>` next to `<ActionButton/>` — two forks for one role.

If two things genuinely differ in **role, interaction model, or anatomy**, they are
separate, separately-named components. **Visual difference alone is a variant, not a new
component.**

### P6 — Theme, density & modes apply via token overrides
Light/Dark/Auto, density, reduced-motion, high-contrast, and direction resolve **at the
token layer** via root attributes: `[data-theme="dark"]`, `[data-density="compact"]`,
`[data-contrast="high"]`, `dir="rtl"`, `@media (prefers-reduced-motion)`. **Components
consume tokens and never branch on mode.** No `theme === 'dark' ? … : …` in component
logic, ever. Theme is the OpenWhispr `Light / Dark / Auto` control (Settings ▸ General ▸
Appearance).

### P7 — Accessibility is a token + structure contract, not a retrofit
Every shared component documents (in its story):
- **Keyboard** map (focus order, activate/escape, arrow keys for tablists/menus).
- **ARIA** role/state (`role`, `aria-pressed`, `aria-expanded`, `aria-selected`, `aria-current`, `aria-label`).
- **Focus-visible** styling using the `--ring` token (2px ring, 2px offset).
- **Contrast** target (AA body, AAA critical) — guaranteed by token choices.

shadcn/Radix give correct semantics for free — **do not break them** (don't strip roles,
don't replace a Radix primitive with a bare `div` + click handler). If it can't be
operated by keyboard and announced by a screen reader, it is **not done**.

### P8 — Directionality & locale are not the component's problem
Use **logical** Tailwind utilities (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`,
`text-start`) — never `left/right/ml/mr`. Direction-carrying icons (chevrons, back arrows)
resolve via a prop, not a CSS override. Root `dir` drives the whole app. Copy is
externalized through i18n (`react-i18next`); **no hardcoded user-facing strings** in
shared components — text comes from props/i18n keys.

### P9 — Motion respects user preference
All transitions/animations reference **motion-duration tokens** (`--motion-fast/…`).
Under `@media (prefers-reduced-motion: reduce)` those tokens collapse to `0ms` **at the
token layer** — components don't branch. Reduced motion is a **mode**, not a per-component
override. (Use `tw-animate-css` + token durations; the listening waveform falls back to a
static meter.)

### P10 — Storybook is the inventory
**Storybook is the authoritative list of what the design system provides.** Every shared
component (`ui/` + `common/`) has a story rendered from the **same source** the app uses.
If a shared component exists in the app but not in Storybook, **that is a bug**. Agents
discover what's available by reading the inventory — not by grepping screens.

### P11 — Reuse before creation; closest token wins
The default action is **reuse**, not creation.
- **Closest token wins.** If a value is needed and an existing token is within ±1 step on
  the relevant scale (spacing, radius, font-size), **use it**. Do **not** add a one-off
  token to hit a Figma pixel — **snap to the scale**.
- **New layer members require justification.** A new primitive/common/feature component is
  allowed **only** when no existing one fits — a different **role**, **interaction model**,
  or **anatomy**. Visual difference is a variant (P5), not a new component.
- **Justify it.** When adding a layer member, state what existing piece was considered and
  why it couldn't be extended. Unjustified additions are rejected.
- **Duplication is the failure mode.** `Button` + `Btn`, or `--radius-card` + `--radius-md`
  with the same value, are both bugs — collapse them.
- **One-off composition stays local.** A unique arrangement only one screen needs (e.g.
  "two stacked cards with a gap" on one settings page) lives in that screen — it is **not**
  promoted to `common/` until a **second** consumer needs it.

### P12 — Data describes *what*; components describe *how* (one render path)
Per the [mock frontend plan](../../04-architecture-and-delivery/05-mock-frontend-plan.md),
content is **data** (fixtures / Zustand stores / `config/` registries), and components
**render** it. The design layer carries **no business content**.
- **No content baked into shared components.** A `StatCard` takes `value`/`label` props;
  it doesn't hardcode "3,599". The provider list, nav items, and model catalog are **data
  in `config/`**, not JSX literals.
- **One render path.** ONE `cn()`, ONE icon helper (lucide via a thin wrapper), ONE
  `Button`. No forked helpers. If `features/*` needs a helper, it **imports** it.
- **No raw markup outside components.** No `dangerouslySetInnerHTML` for app content, no
  template-string DOM, no parallel render utilities.

> **Why:** when a token changes (accent, radius, density, theme), every component updates
> at once. Anything authored *outside* the component layer (inline styles, forked helpers,
> hardcoded content) goes **stale** the moment the system evolves. Data has no opinion
> about markup, so it never drifts; components are the single source of *how*.

```
Data (what)  →  Component (how, token-driven)  →  DOM
```

### P13 — Two tiers of components — shared library vs feature-specific
| Tier | Lives in | In Storybook inventory? | Removable? |
|---|---|---|---|
| **Shared library** — used (or reusable) across features: `Button`, `Tabs`, `StatCard`, `Gauge`, `PromoBanner`, `SettingRow`, `ProviderChip`… | `components/ui/`, `components/common/` | **Yes** — authoritative | No (core) |
| **Feature-specific** — unique to one feature: Prompt Studio tester, the Khonjel Bar waveform composition, an Integrations OAuth card | `features/{id}/components/` | **No** | Yes — delete the feature, library untouched |

**The boundary is the inventory.** A feature-specific component is **promoted** to
`common/` (and into Storybook) **only when a second feature needs it** (P11). Until then it
stays in the feature and is cleanly removable. Feature components still consume library
**tokens + primitives** — they are compositions, not new design primitives.

---

## Anti-patterns (the explicit "do not" list)

- **No literal `#hex`, `rgb()`, `rgba()` in components.** Use token-mapped Tailwind classes
  (`bg-primary`, `text-foreground`, `border-border`) or `color-mix(in srgb, var(--token) N%, transparent)`. For alpha, use Tailwind opacity on a token (`bg-foreground/5`).
- **No `bg-[#…]` / `text-[#…]` arbitrary color values.** Colors come from semantic tokens.
- **No bare px for spacing/radius/font-size/stroke.** Use the Tailwind scale (token-mapped). Arbitrary `*-[Npx]` is allowed **only** for P1a instance-specific dimensions, and preferably via a named token (`w-(--sidebar-width)`).
- **No `!important`.** If specificity fights, a layer boundary was violated — fix the structure.
- **No `style={{ … }}`** except **runtime-dynamic** values: floating-window/overlay `top/left`, progress `width: N%`, waveform bar heights, download `%`.
- **No forked components.** If `Button` exists, never add `Btn`, `MyButton`, `PrimaryButton`. Add a **variant** (P5).
- **No forked utilities.** ONE `cn()`. ONE icon wrapper over lucide. ONE theme hook. Parallel copies are bugs.
- **No cross-component selectors / restyling another component's internals** via `className` beyond layout placement.
- **No theme branching in component logic** (`theme === 'dark'`). Use tokens (P6).
- **No `left`/`right`/`ml-`/`mr-`** in components — logical utilities only (P8).
- **No hardcoded transition durations** (`transition: … 200ms`, `duration-200` literals tied to no token). Reference motion tokens.
- **No `z-[999]` magic numbers.** Use the `--z-*` scale.
- **No emoji** in any UI copy, label, status, or tooltip. Use **lucide** icons (e.g. `Check`, `CircleAlert`, `TriangleAlert`). Emoji render inconsistently and can't be token-styled.
- **No hardcoded user-facing strings in shared components.** Text is props / i18n keys (P8).
- **No business content baked into design components** (P12); no forked render helpers; no markup outside the component layer.
- **No bypassing Radix semantics** (don't replace a Radix primitive with a bare `div` + onClick) (P7).

---

## Success criteria — "done enough to rely on"

1. Every UI element is classified into a layer (primitive / common / feature / surface) in the **inventory doc** (and Storybook).
2. Every shared component lists its **token dependencies**.
3. A **new screen** is added by composing existing pieces with **near-zero new styling** — proven by a test screen.
4. Changing **any single token** updates every downstream consumer visibly — verified.
5. **Storybook enumerates** every primitive + common component, each rendered from the **identical source** the app uses.
6. Every shared component has a **keyboard + ARIA** contract documented; focus-visible uses `--ring`.
7. Toggling `[data-theme]`, `[data-density]`, `[data-contrast]`, and `dir` at the root re-renders the whole app correctly **without touching any component**.
8. A **lint step** rejects forbidden patterns: literal hex/`rgb`, `bg-[#…]`, bare px for scale values, `!important`, cross-component selectors, `left/right` in components, theme branching, emoji, forked `cn()`/components.

---

## How this maps to the stack (quick reference)

| Concept | Khonjel implementation |
|---|---|
| Fundamental tokens | CSS vars in `src/styles/tokens.css` + Tailwind v4 `@theme` |
| Semantic tokens | shadcn vars (`--background`, `--primary`, …) + `--canvas`, `--dataviz` |
| Variants | **CVA** (`cva()`), via `class-variance-authority` |
| Primitives | **shadcn/ui** (Radix) in `components/ui/` |
| Common components | `components/common/` |
| Inventory | **Storybook** (P1 of tooling; the live library) |
| Icons | **lucide-react** via one wrapper |
| Class merge | one **`cn()`** (`clsx` + `tailwind-merge`) |
| Theme/density/motion | root `data-*` attributes + token overrides |
| Lint enforcement | ESLint + project rules (see companion `05-eval-and-lint.md`) |

> Companion docs in this folder (build them as the system grows): `02-tokens.md`
> (the scales), `03-inventory.md` (every layer member + justification), `04-token-mapping.md`
> (component → tokens), `05-eval-and-lint.md` (the enforced checks). This `01-intent.md`
> is the anchor — **when in doubt, this document wins.**
