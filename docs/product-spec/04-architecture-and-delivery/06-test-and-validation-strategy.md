# Khonjel — Test & Validation Strategy (the Eval Loop)

> **The question this answers:** *How do we know what we coded is actually correct and
> on-spec — without a human eyeballing every change?* A mock frontend's correctness is
> mostly **visual + behavioural**, so code-only tests are not enough. The answer is an
> **automated, multi-layer eval loop** that produces objective pass/fail, **plus an
> agent visual-inspection protocol** (render → screenshot → the agent *views* it →
> compare to the spec and the reference). This loop runs **continuously during
> development** and gates every "done."
>
> Companion to: [Design System discipline](../03-ux-ui/design-system/01-intent.md)
> (success criteria → tests), [Mock Frontend Plan](05-mock-frontend-plan.md),
> [Screen Specifications](../03-ux-ui/03-screen-specifications.md) (acceptance
> checklists → assertions), [UI Design Spec](../03-ux-ui/06-ui-design-spec.md) (the
> visual oracle).

---

## 1. How "right" is defined (the three oracles)

We cannot test against a vibe. Correctness is pinned to **three concrete oracles**:

| Oracle | What it pins | Where it lives |
|---|---|---|
| **A. Spec acceptance checklists** | Required structure, copy, states, options per screen | `screen-specifications.md` §6, `floating-bar-overlays-and-settings.md` §C, every doc's "Requirements & acceptance" |
| **B. UI Design Spec + reference screenshots** | The *visual* truth — tokens, layout, signatures (greige canvas, white panel, serif promo, teal data-viz) | `06-ui-design-spec.md`, `docs/reference-designs/wisper-flow/*` |
| **C. Approved baselines** | The frozen "this is correct" snapshot for regression | `app/eval/__screenshots__/` (committed after review) |

Every test/assertion traces back to one of these. New screen → its acceptance items
become assertions; its look is compared to B; once approved, it becomes a C baseline.

---

## 2. The validation pyramid (layers, fast → slow)

```
L6  Agent visual review     render → screenshot → VIEW → compare to UI spec & reference
L5  Spec coverage           every screen reachable · every state toggles · story-per-component · token round-trip
L4  Visual regression       Playwright screenshots vs baselines (screen × state × theme)
L3  Accessibility           axe: zero violations · keyboard · focus-visible
L2  Unit / interaction      Vitest + RTL: component contracts, variants, states, stores, service mocks, insights math
L1  Design-system lint      forbidden patterns + import boundaries (the "design accuracy" gate)
L0  Static                  tsc --noEmit (strict) · eslint · prettier --check
```
A change must pass **L0–L5 automatically**; **L6** is the agent's eyes for anything code
can't assert (proportion, warmth, hierarchy, "does it feel like Wispr Flow").

---

## 3. The eval-loop commands (run in a loop)

Defined in `app/package.json`:

| Command | Runs | When |
|---|---|---|
| `npm run verify:quick` | L0 + L1 + L2 | **inner loop** — after every edit (seconds) |
| `npm run verify` | L0–L5 (full) | before declaring any task/feature done; CI |
| `npm run typecheck` | `tsc --noEmit` | L0 |
| `npm run lint` / `lint:ds` | eslint / design-system rules | L0 / L1 |
| `npm run test` / `test:watch` | Vitest + RTL | L2 |
| `npm run test:a11y` | axe (vitest + Playwright) | L3 |
| `npm run test:visual` / `:update` | Playwright snapshots / refresh baselines | L4 |
| `npm run verify:coverage` | spec-coverage manifest checks | L5 |
| `npm run eval:shots` | render every screen/state/theme → PNGs in `eval/screens/` | feeds **L6** |

**The development loop (per change):**
```
edit → npm run verify:quick → (fix) → npm run eval:shots → agent VIEWS shots vs spec
     → fix visual gaps → npm run verify (full) → all green → done
```

---

## 4. Layer detail

### L0 — Static
- **TypeScript strict** (`strict: true`, `noUncheckedIndexedAccess`). Types are the first
  contract: a `Button`'s `variant` union, a service port's signature, a store's shape.
- **ESLint** (react-hooks, jsx-a11y, import) + **Prettier**. Zero warnings policy.

### L1 — Design-system lint (the design-accuracy gate)
Enforces the [discipline](../03-ux-ui/design-system/01-intent.md) so agents can't drift:
- **No literal colors** in components: ban `#hex`, `rgb()/rgba()`, and `bg-[#…]`/`text-[#…]`
  arbitrary color utilities → must use semantic tokens.
- **No bare px for scale** (spacing/radius/font/stroke): ban `*-[Npx]` **except** an
  allowlist of P1a instance-dimension tokens (`--sidebar-width`, bar size, modal size).
- **No `!important`**, **no `left/right`/`ml-`/`mr-`** (logical only), **no hardcoded
  transition durations**, **no `z-[NNN]`** magic numbers.
- **No theme branching** in component logic (`/theme\s*===\s*['"]dark/`).
- **No emoji** in any `.tsx`/copy (regex over emoji ranges).
- **No forked singletons**: exactly one `cn()`, one icon wrapper; ban duplicate `Button`/`Btn`.
- **Import boundaries** (eslint-plugin-boundaries): UI/features **cannot** import
  `services/adapters/**` (only `@services` ports); features cannot import another
  feature's internals; `lib/` imports nothing app-specific.
Implementation: ESLint rules where possible + a small `scripts/ds-lint.mjs` for the
regex/AST checks. Output is a concrete list of violations (file:line) — directly fixable.

### L2 — Unit / interaction (Vitest + React Testing Library)
- **Component contracts:** each shared component renders its **variants** (CVA) and
  **states** (default/hover/active/disabled/selected/loading/error); exposes correct
  roles; `cn()` merges classes; no console errors.
- **Stores:** Zustand logic (add/edit/delete dictionary entry; toggle settings;
  persistence round-trip).
- **Service mocks:** each port's mock adapter behaves per contract (transcription emits a
  typewriter stream; `discover(badUrl)` returns the error shape; download progresses to 100%).
- **Derived logic:** Insights aggregates computed from seeded history equal expected
  values (the local-compute design, on fixtures).
- Query by **role/label/text** (user-facing), not test-ids, so tests assert real semantics.

### L3 — Accessibility
- **axe** on every shared component (Storybook test-runner / vitest-axe) and every screen
  (`@axe-core/playwright`) → **zero violations**.
- **Keyboard:** tab order, `Enter/Space` activate, `Esc` closes overlays, arrow keys for
  tablists/menus (user-event + Playwright).
- **Focus-visible** ring present (uses `--ring`). Reduced-motion honored.
- Ties to spec [a11y doc](../03-ux-ui/05-interaction-states-and-accessibility.md) (WCAG 2.2 AA).

### L4 — Visual regression (Playwright)
- For each **screen × key state × theme(Light/Dark)** capture a screenshot and diff
  against the committed **baseline** (`toHaveScreenshot`).
- Baselines are **reviewed once** (by the user, and by the agent against oracle B), then
  committed. Any later pixel drift fails the build → caught immediately.
- Mock Studio drives deterministic states (seeded data, fixed clock) so shots are stable.
- This is how we "freeze what right looks like" and detect regressions automatically.

### L5 — Spec coverage (the completeness gate)
A **coverage manifest** (`app/eval/spec-coverage.ts`) lists every screen/state from the
[screen inventory](../02-information-architecture/01-sitemap-and-ia.md#5-full-screen-inventory-build-checklist).
Automated checks assert:
- **Reachability:** every screen/surface route renders without crashing.
- **State toggles:** every Mock Studio toggle (empty/loading/error, capture states,
  overlays) actually changes the UI.
- **Inventory parity (P10):** every shared component in `components/{ui,common}` has a
  **Storybook story**; CI fails if one is missing.
- **Token round-trip (design-system #7):** flipping `[data-theme]`, `[data-density]`,
  `dir` re-renders with **no component edits** and visual snapshots remain valid.
- **Provider/registry coverage:** the wide model/provider list from `config/provider-registry`
  all render in the model pickers.

### L6 — Agent visual review (the agent's "eyes")
Code can't judge proportion, warmth, hierarchy, or "is this the Wispr Flow look." So the
agent closes the gap directly:
1. `npm run eval:shots` renders each screen/state/theme to `app/eval/screens/*.png`
   (via Playwright against the running app **and** Storybook).
2. The agent **opens each PNG** (image-view tool) and checks it against a **per-screen
   visual rubric** (below) and the matching **Wispr Flow reference screenshot**
   (`docs/reference-designs/wisper-flow/`).
3. Gaps become fixes; once it matches, the shot is promoted to an L4 baseline.

**Per-screen visual rubric (example — applies the UI Design Spec):**
- [ ] Greige canvas `#F2F1EE`; white content panel **floating** with rounded top-left.
- [ ] Sidebar selected item = **white pill + soft shadow + violet glyph**.
- [ ] Page title `~26/700`; stat numbers `~40/700`; **uppercase** captions.
- [ ] Library page: title + Add-new + **underline tabs** + search/sort/refresh + **serif
      promo banner** (one italic word) + divided white list.
- [ ] Data-viz uses the **teal** ramp; UI accent **violet**; the two never cross.
- [ ] Primary buttons near-black; generous rounding; **soft, low** shadows; **no emoji**.

---

## 5. Per-feature Definition of Done (the gate)

A feature/screen is **not done** until, in CI-equivalent `npm run verify`:
- [ ] L0 types + lint clean.
- [ ] L1 design-system lint clean (no hardcoded values, boundaries respected).
- [ ] L2 unit/interaction tests for its components/stores pass.
- [ ] L3 axe zero-violations + keyboard path works.
- [ ] L4 visual baseline reviewed & committed (Light + Dark).
- [ ] L5 reachable, states toggle, **story exists** for any new shared component.
- [ ] L6 agent visual review done against the UI spec + reference; rubric ticked.
- [ ] The screen's **spec acceptance-checklist items** (oracle A) are each asserted.

---

## 6. Tooling (added to `/app`, dev-deps only — no backend)

`vitest` · `@testing-library/react` · `@testing-library/user-event` ·
`@testing-library/jest-dom` · `vitest-axe` / `jest-axe` · `@playwright/test` ·
`@axe-core/playwright` · `@storybook/react-vite` + `@storybook/test-runner` ·
`eslint-plugin-jsx-a11y` · `eslint-plugin-boundaries` · `eslint-plugin-import` ·
(optional) `eslint-plugin-tailwindcss` · a project `scripts/ds-lint.mjs`.

> None of these touch a backend. Determinism for visual tests comes from **seeded
> fixtures + a fixed clock**, set via Mock Studio / test setup.

---

## 7. CI (optional, P1)
A GitHub Actions workflow runs `npm run verify` on push/PR; uploads **visual diffs** and
the **coverage report** as artifacts so regressions are visible in review. Same command
locally and in CI — no divergence.

---

## 8. What this does and does not guarantee (honesty)
- **Does:** structural correctness, behavioural correctness (mocked), accessibility,
  design-system conformance, visual regression safety, and **spec coverage**.
- **Does not:** make subjective taste calls (final aesthetic sign-off stays with the
  user — L6 narrows the gap but doesn't replace it), and validates **no backend** (there
  is none; service contracts are tested against the mock adapters that real adapters must
  later satisfy).

---

## 9. Readiness
- [ ] `verify:quick` and `verify` scripts exist and run all layers.
- [ ] Oracles wired: acceptance items → assertions; UI spec/reference → rubric; baselines committed.
- [ ] `eval:shots` produces per-screen PNGs the agent inspects each loop.
- [ ] Design-system lint + import boundaries fail the build on violation.
- [ ] Spec-coverage manifest enumerates every screen/state and is checked.
- [ ] Per-feature Definition of Done enforced before any "done."
