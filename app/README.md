# Khonjel - App

The **final Khonjel frontend** plus a real Electron backend behind a typed IPC seam. The renderer
imports only service **ports**, so the same UI runs on mock adapters in the browser and on the real
backend (local whisper.cpp + llama.cpp) under Electron. See the canonical execution guide before
changing anything:

- **Read first:** [`../docs/product-spec/00-execution-playbook.md`](../docs/product-spec/00-execution-playbook.md)
- Backend architecture: [`../docs/product-spec/04-architecture-and-delivery`](../docs/product-spec/04-architecture-and-delivery)
- Design-system discipline (P1–P13): [`../docs/product-spec/03-ux-ui/design-system/01-intent.md`](../docs/product-spec/03-ux-ui/design-system/01-intent.md)
- Eval loop: [`../docs/product-spec/04-architecture-and-delivery/06-test-and-validation-strategy.md`](../docs/product-spec/04-architecture-and-delivery/06-test-and-validation-strategy.md)

## Commands

```bash
npm run dev            # run the renderer in the browser (mock adapters)
npm run electron       # build + run the real Electron app (real backend)
npm run verify:quick   # typecheck + eslint + design-system lint + unit tests (inner loop)
npm run verify         # verify:quick + production build
npm run eval           # browser EDD (Playwright vs vite)
npm run eval:electron  # real Electron EDD (launches the app, exercises the live seam)
npm run fetch:llama    # download llama.cpp server + a small GGUF model (local LLM)
npm run fetch:whisper  # download whisper.cpp + a ggml model (local STT)
```

## Local AI (native engines)

The local engines run as **standalone child processes** (no native node modules -> no Electron/Node
ABI rebuild). Download them once:

```bash
npm run fetch:llama     # -> vendor/llama/llama-server(.exe) + models/*.gguf   (~1 GB model)
npm run fetch:whisper   # -> vendor/whisper/.../whisper-cli(.exe) + models/ggml-*.bin
```

Then `npm run electron`. On startup the app auto-detects:

- **LLM** — `vendor/llama/llama-server` + a `models/*.gguf`. It spawns the server in the background;
  dictation cleanup + chat upgrade from the deterministic stub to the real model. Cleanup never
  blocks: a missing/down model falls back to deterministic cleanup.
- **STT** — `vendor/whisper/.../whisper-cli` + a `models/ggml-*.bin`. Transcription goes live; without
  it, `transcription:transcribe` reports `model_unavailable`.

Env overrides: `KHONJEL_LLAMA_ENDPOINT`, `KHONJEL_LLAMA_SERVER`, `KHONJEL_LLM_MODEL`,
`KHONJEL_LLM_GPU_LAYERS`, `KHONJEL_WHISPER_BIN`, `KHONJEL_WHISPER_MODEL`. `vendor/` and `models/` are
git-ignored.

## Stack
Electron · Vite · React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui (Radix) · CVA ·
lucide-react · Zustand · zod · Vitest · Playwright. Under Electron the ports are backed by a real
main-process backend (typed IPC seam); in the browser they run on in-memory mock adapters.

## Non-negotiables
- **The seam.** UI imports **ports** (`@services`), never adapters; one composition root binds them.
- **Final UI, not throwaway.** The renderer is the shipping UI; only the bound adapter changes.
- **Strict design system.** Values live in tokens; variants are CVA props; reuse before create.
- **TDD + EDD.** Unit-test pure logic; gate behaviour with browser + Electron evals.
