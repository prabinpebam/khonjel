# Chat: Threads + Streaming — Implementation Plan

> **Status:** Proposed (not started). **Spec:** [`06-chat-threads-and-streaming.md`](../../product-spec/01-product/06-chat-threads-and-streaming.md).
> **Audience:** Frontend + Electron/backend engineers, EDD authors.
> **Goal:** Ship the spec's **P0 — threaded, streaming chat** end to end (data model → mock → UI →
> real llama streaming), then P1 polish, with the same TDD/EDD discipline as the rest of Khonjel.

---

## 0. Principles & guardrails

- **Mock-first.** Build the data model, pure logic, the `ChatService` **mock**, and the **full UI**
  so the feature is EDD-provable **in the browser** *before* touching llama. This mirrors Khonjel's
  seam philosophy (the same React UI runs on mock adapters in the browser and IPC in Electron).
- **Tests first for pure logic.** Every pure module (thread reducer, title derivation, streaming
  accumulator, regenerate truncation, SSE delta parser, context trimmer) gets a Vitest spec written
  **before** the implementation (red → green).
- **EDD gates user-visible behavior.** A browser Playwright scenario drives the UI against the mock;
  an Electron scenario proves real streaming.
- **Always green.** `npm run verify:quick` (typecheck + eslint + ds-lint + unit) and `npm run eval`
  stay green at every commit; `npm run eval:electron` green once Phase 5 lands.
- **House rules.** ASCII `->` in `src` `.ts/.tsx` (ds-lint bans unicode arrows/emoji); new deps via
  `--legacy-peer-deps`; **commit per phase**.
- **Baseline:** 468 unit tests + 6 browser EDD scenarios passing today.

---

## 1. What changes (map)

| Layer | File(s) | Change |
|---|---|---|
| Types | [`ports/types.ts`](../../../app/src/services/ports/types.ts) | `ChatThread`; `ChatMessage += threadId/status/model`; `ChatTokenEvent`; `ChatSendRequest` |
| Ports | [`ports/index.ts`](../../../app/src/services/ports/index.ts) | `ContentService += chatThreads()/saveChatThreads()`; new `ChatService` |
| IPC contract | [`shared/ipc-contract.ts`](../../../app/electron/shared/ipc-contract.ts) | channels `content:chat-threads`, `chat:send`, `chat:stop`; event `khonjel:chat-token` |
| IPC schemas | [`shared/ipc-schemas.ts`](../../../app/electron/shared/ipc-schemas.ts) | `ChatThreadSchema`, evolved `ChatMessageSchema`, `ChatSendRequestSchema`, token event |
| Dispatch | [`shared/dispatch.ts`](../../../app/electron/shared/dispatch.ts) | handlers for the new channels |
| Store | [`services/content.ts`](../../../app/electron/main/services/content.ts), [`store/migrations.ts`](../../../app/electron/store/migrations.ts) | `chatThreads` collection; migrate flat chat |
| Main | [`main.ts`](../../../app/electron/main/main.ts), inference runtime | chat session manager + llama SSE streaming + abort + FIFO |
| Preload | [`main/preload.ts`](../../../app/electron/main/preload.ts) | `onChatToken` relay + `chat:send`/`chat:stop` senders |
| Mock | [`adapters/mock`](../../../app/src/services/adapters/mock) | in-memory threads + simulated token streaming |
| IPC adapter | [`adapters/ipc`](../../../app/src/services/adapters/ipc) | wire the new channels |
| Pure logic | `src/lib/chat/*` (new) | reducer, title, stream accumulator, regenerate, SSE parser |
| UI | [`features/chat/Chat.tsx`](../../../app/src/features/chat/Chat.tsx) (+ a small store) | thread rail, streaming bubble, actions |
| EDD | `eval/scenarios/chat-*.eval.mjs` (new) | browser + electron scenarios |

---

## 2. Phases

Each phase ends **green + committed**. Phases 1–4 are mock-only (no llama); Phase 5 adds the backend.

### Phase 1 — Data model, seam & store (no UI)
**Do**
- Add the types + the `ContentService`/`ChatService` ports.
- Extend CHANNELS + zod schemas + dispatch for `content:chat-threads`, `chat:send`, `chat:stop`,
  and the `khonjel:chat-token` event.
- Content store: add the `chatThreads` collection; stamp messages with `threadId`.
- Migration: flat `chat` (no `threadId`) → one `ChatThread { title: "Imported chat", titleStatus: "manual" }`.
- Mock content adapter: `chatThreads()/saveChatThreads()` + seed two sample threads.

**Tests first**
- `store/migrate.test.ts`: flat-chat fixture → migrated threads + stamped messages; empty-chat no-op.
- `services/content.test.ts`: chatThreads round-trip; `saveChat` preserves `threadId`.
- `services/ipc/contract.test.ts` + `seam.test.ts`: new channels validate + dispatch.

**Done:** `verify:quick` green. Commit `feat(chat): data model, seam + store for threads`.

### Phase 2 — Pure logic (TDD)
**New** `src/lib/chat/`:
- `threads.ts` — `createThread`, `renameThread` (→ `manual`), `deleteThread` (→ reselect newest),
  `touchThread` (bump `updatedAt`), `groupByDay`.
- `title.ts` — `deriveThreadTitle(firstUserText)` (first ~6 words, trim, ≤48 chars) + `chatTitlePrompt(messages)`.
- `stream.ts` — `applyTokenEvent(state, event) -> { fullText, reasoning, status }`; `parseReasoning`
  (split `<think>` … `</think>` from the answer).
- `regenerate.ts` — `truncateAfter(messages, messageId)` (for regenerate + edit-resend).

**Tests first:** one spec per module (`threads.test.ts`, `title.test.ts`, `stream.test.ts`, `regenerate.test.ts`).

**Done:** `verify:quick` green. Commit `feat(chat): pure thread/title/stream/regenerate logic`.

### Phase 3 — ChatService: mock streaming + IPC wiring
**Do**
- **Mock** `ChatService`: `send(req)` emits a canned reply word-by-word on a timer → `onToken`
  (`token` × N → `done`); `stop(requestId)` cancels the timer and emits `done` (stopped).
- **IPC adapter** `ChatService`: `send`/`stop` send `chat:send`/`chat:stop`; `onToken` subscribes to
  the preload `onChatToken` relay.
- **Preload**: relay `khonjel:chat-token`; add `chat:send`/`chat:stop` senders (mirror `onHotkey`/capture).
- **ServicesProvider**: expose `chat` (mock in browser, ipc in Electron).

**Tests first:** `seam.test.ts` — `chat.send` emits ordered token→done; `stop` cancels.

**Done:** `verify:quick` green. Commit `feat(chat): ChatService mock + IPC seam`.

### Phase 4 — Renderer: threads + streaming UI (EDD in browser)
**Do**
- Rewrite [`Chat.tsx`](../../../app/src/features/chat/Chat.tsx) (+ a small `useChatStore` or local state):
  thread rail (list grouped by day, **+ New chat**, hover rename/delete affordances), conversation,
  composer with **Send/Stop**, streaming assistant bubble driven by `onToken`, per-message **Copy**
  (reuse `electronAPI.copyText`) + **Regenerate**, fallback **auto-title** on first reply.
- Draft-thread lifecycle (persist on first send); persist threads + messages **debounced**, on
  `done`/`stopped`/`error`.
- Add `data-eval` hooks: `chat-thread`, `chat-thread-new`, `chat-message`, `chat-send`, `chat-stop`.

**EDD (new)** `eval/scenarios/chat-streaming.eval.mjs` (browser, vs mock):
send → tokens stream into the assistant bubble → completes; new/switch thread persists across reload;
auto-title appears; regenerate replaces the last reply; stop keeps partial text; copy shows Copied.

**Done:** `verify:quick` + `eval` green. Commit `feat(chat): threaded streaming UI (mock-backed) + EDD`.
**Milestone:** the whole feature is demoable in the browser (`npm run dev`).

### Phase 5 — Main: real llama streaming + session manager
**Do**
- `src/.../inference` (main): add a **streaming** chat call to `llama-server` (`stream: true` SSE on
  the endpoint inference already uses); parse deltas; honor the **system prompt**, **context budget
  trim** (main-side), and the **reasoning** toggle (`<think>` keep/strip).
- **Chat session manager** in main (a `Map<requestId, AbortController>`, modeled on `captureManager`):
  `chat:send` starts a generation and emits `khonjel:chat-token`; `chat:stop` aborts; **FIFO serialize**
  local generations (one llama stream at a time); cleanup on done/abort/error.
- Graceful `model_unavailable` → emit a `kind: "error"` token event.

**Tests first (pure):** `parseSseDelta` (llama SSE line → delta/done), `trimToBudget(messages, budget)`,
`fifoQueue` behavior.

**EDD (new)** `eval/scenarios/chat-streaming.eval.electron.mjs`: launches the real app; if a model is
present, asserts streamed tokens then a final answer; else asserts a graceful error state.

**Done:** `verify:quick` + `eval` + `eval:electron` green. Commit `feat(chat): real llama SSE streaming + abort`.

### Phase 6 — P0 finish & polish
- Wire fallback auto-title on first completed reply; finalize empty/stopped/error states; a11y pass
  (`aria-live`, listbox roles, keyboard Stop). Commit `feat(chat): P0 finish (auto-title, states, a11y)`.

**P0 complete.**

---

## 3. P1 (separate commits, each green + EDD where user-visible)

- **P1.1 LLM auto-title** behind `llm.chat.autoTitle` (default toggle in [`settings.ts`](../../../app/src/stores/settings.ts) + a Language-Models row); fallback stays when off/unavailable.
- **P1.2 Markdown + reasoning** — sanitized markdown renderer (no raw HTML; CSP-safe) + collapsible "Thinking" disclosure.
- **P1.3 Rename + delete thread** — inline rename, guarded delete dialog.
- **P1.4 Edit-and-resend** + autoscroll-when-pinned + "scroll to bottom".
- **P1.5 Cloud streaming parity** — provider-router SSE for OpenAI-compatible/Azure.

## 4. P2 (backlog)
Branching/variants, per-message delete, thread search (reuse the local semantic index), per-thread
model/persona, lazy per-thread message loading + summarized context.

---

## 5. Risks & mitigations

| Risk | Mitigation |
|---|---|
| llama SSE format variance (endpoint, stop tokens, `n_predict`) | Reuse the endpoint `inference.ts` already calls; unit-test `parseSseDelta` against captured fixtures |
| Reasoning tokens interleave with the answer | `parseReasoning` state machine, unit-tested; gated by `llm.chat.reasoning` |
| Half-open HTTP on abort | `AbortController` + `finally` cleanup in the session manager |
| Persistence churn (token spam) | Persist only on terminal events (`done`/`stopped`/`error`); debounce |
| Local concurrency (single llama stream) | FIFO queue in the session manager; "waiting…" state; unit-tested |
| Migration correctness | `migrate.test.ts` with flat-chat + empty fixtures |
| Markdown XSS | Sanitized renderer, no raw HTML; preserves the strict CSP |

---

## 6. Test matrix

| Concern | Unit (Vitest) | Browser EDD | Electron EDD |
|---|---|---|---|
| Migration | ✓ | — | — |
| Thread reducer / title / regenerate | ✓ | ✓ (behavior) | — |
| Stream accumulator / reasoning | ✓ | ✓ | ✓ |
| SSE parse / context trim / FIFO | ✓ | — | ✓ |
| Seam (channels) | ✓ | — | — |
| Streaming UX, threads, actions | — | ✓ | ✓ (real tokens) |

---

## 7. Sequencing rationale & estimate

Build value **inward-out**: data + pure logic (provable in isolation) → mock service → **full UI
EDD-tested in the browser** → real backend last. This de-risks the UX (provable without a model) and
keeps llama work to a single, well-scoped phase. **~8–10 commits** for P0; P1 items are independent
follow-ups. Recommended first slice to land: **Phases 1–4** (a fully working, browser-demoable
threaded streaming chat on the mock), then Phase 5 to make it real.
