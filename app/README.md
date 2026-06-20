# Khonjel — App (mock-data frontend, no backend)

The **final Khonjel frontend**, built mock-first with **zero backend**. See the
canonical execution guide before changing anything:

- **Read first:** [`../docs/product-spec/00-execution-playbook.md`](../docs/product-spec/00-execution-playbook.md)
- Build plan: [`../docs/product-spec/04-architecture-and-delivery/05-mock-frontend-plan.md`](../docs/product-spec/04-architecture-and-delivery/05-mock-frontend-plan.md)
- Design-system discipline (P1–P13): [`../docs/product-spec/03-ux-ui/design-system/01-intent.md`](../docs/product-spec/03-ux-ui/design-system/01-intent.md)
- Eval loop: [`../docs/product-spec/04-architecture-and-delivery/06-test-and-validation-strategy.md`](../docs/product-spec/04-architecture-and-delivery/06-test-and-validation-strategy.md)

## Commands

```bash
npm run dev            # run the app (browser)
npm run verify:quick   # typecheck + eslint + design-system lint   (inner loop)
npm run verify         # verify:quick + production build
npm run eval:shots     # visual eval harness (placeholder in Phase 0)
npm run lint:ds        # design-system lint only
```

## Stack
Vite · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui (Radix) · CVA ·
lucide-react · Zustand. **No backend dependencies.** All data is mocked via the
service ports in `src/services/` (in-memory + localStorage).

## Non-negotiables
- **No backend.** Only mock adapters in `src/services/adapters/mock/`.
- **Final UI, not throwaway.** UI imports **ports** (`@services`), never adapters.
- **Strict design system.** Values live in tokens; variants are CVA props; reuse before create.
