# Khonjel Design System — Discipline & Inventory

> **Why this folder exists.** Agentic coding breaks design systems: agents write localized,
> forked, hardcoded components and the UI drifts every session. Khonjel uses a **strict,
> token-driven design-system discipline** to prevent that. This is **not the mainstream
> "ship a component and move on" approach** — it is deliberately strict, and it is meant
> to be **referenced again and again** during implementation.
>
> **Start here, every time you touch UI:** [`01-intent.md`](01-intent.md). When in doubt,
> that document wins.

---

## The one-paragraph rule

> Values live in **tokens**; components hold **structure + state**. **Reuse before you
> create** — scan the inventory (Storybook), snap to the nearest scale step. **Variants
> are props (CVA), never new components.** Respect the layers (Tokens → `ui/` → `common/`
> → feature → surfaces); never reach sideways or skip up. **One** `Button`, **one**
> `cn()`, **one** icon system. Theme/density/motion are **token overrides on the root** —
> components never branch on theme. **No** hardcoded hex/rgb, **no** bare px for scale
> values, **no** `!important`, **no** `style={{}}` (except runtime-dynamic), **no** emoji.

---

## Documents

| Doc | Purpose | Status |
|---|---|---|
| [`01-intent.md`](01-intent.md) | **The contract** — principles P1–P13, anti-patterns, success criteria | ✅ anchor |
| `02-tokens.md` | The token scales (color, spacing, radius, type, shadow, motion, z) | to build with `/app` |
| `03-inventory.md` | Every layer member (primitive / common / feature) + reuse justification | to build with `/app` |
| `04-token-mapping.md` | Each component → the tokens it consumes | to build with `/app` |
| `05-eval-and-lint.md` | The enforced lint/eval checks that reject forbidden patterns | see [Test & Validation Strategy](../../04-architecture-and-delivery/06-test-and-validation-strategy.md) (L1) |

Token **values** are defined in the [UI Design Spec](../06-ui-design-spec.md) and
[Design Language & Tokens](../01-design-language.md). This folder governs the **discipline
and inventory** around them.

---

## Before you create *anything* (the gate)

Answer in the commit/PR description:

1. **Token:** Is there a token within ±1 scale step? → use it. (Don't add a one-off.)
2. **Component:** Does a primitive (`ui/`) or common component already fit, possibly via a
   **variant** (CVA)? → use/extend it.
3. **New member?** Only if it has a different **role / interaction / anatomy** (not just a
   different look). State *what you considered and why it didn't fit*.
4. **Placement:** Shared/reusable → `components/common/` + a Storybook story. One feature
   only → `features/{id}/components/` (removable, not in the shared inventory).

No answer to (3) when adding a new member → the change is rejected.

---

## How it's enforced

- **Storybook is the inventory** (P10): shared component not in Storybook = bug.
- **ESLint + project rules** reject literal hex, `bg-[#…]`, bare px for scale values,
  `!important`, cross-component selectors, `left/right` in components, theme branching,
  emoji, and forked `cn()`/components (see `05-eval-and-lint.md`).
- **Token round-trip test:** flip `[data-theme]`, `[data-density]`, `dir` at the root —
  the whole app must re-render correctly with **zero component edits** (P6, success #7).

---

## Relationship to the rest of the spec
- **What it looks like:** [UI Design Spec (Wispr Flow–style)](../06-ui-design-spec.md).
- **Token values:** [Design Language & Tokens](../01-design-language.md).
- **Where the code lives / how it's structured:** [Mock Frontend Plan](../../04-architecture-and-delivery/05-mock-frontend-plan.md).
- **What screens exist:** [Screen Specifications](../03-screen-specifications.md).
