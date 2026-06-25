# Khonjel — Chat: Threads, Streaming & Message Actions

> The Chat surface today is a single flat conversation with a blocking (non-streamed)
> reply. This spec turns it into a **fully functional, multi-thread chat** with **token
> streaming**, **auto-generated thread titles**, **rename/delete**, and **per-message
> actions** (copy, regenerate, stop, edit-and-resend), built on the existing typed IPC
> seam and the same streaming pattern already proven by long-form capture.
>
> **Status:** proposed. **Owner:** TBD. **Implementation plan:**
> [`chat-implementation-plan.md`](../../archive/delivery-plans/chat-implementation-plan.md). **Refs:**
> [`Chat.tsx`](../../../app/src/features/chat/Chat.tsx),
> [`ports/index.ts`](../../../app/src/services/ports/index.ts),
> [`02-navigation-and-content-model.md`](../02-information-architecture/02-navigation-and-content-model.md).

---

## 1. Goals & non-goals

**Goals**
- **Threads.** Multiple persistent conversations, switchable from a list, each with its own message history.
- **Auto thread title.** A concise title is generated from the first exchange; never overwrites a manual title.
- **Rename / delete thread.** Inline rename and guarded delete.
- **Streaming chat.** Assistant replies stream token-by-token, with a **Stop** control.
- **Message actions.** Copy, regenerate, stop, and edit-and-resend at minimum.

**Non-goals (this iteration)**
- Semantic search across threads (P2), message-level branching/variants (P2), shared/exported transcripts (P2), per-thread model pinning (P2), image/file attachments.

---

## 2. Current state & gap

| Area | Today | Gap |
|---|---|---|
| Data | One flat `ChatMessage[]` (`content.chat()` / `saveChat()`); `ChatMessage = { id, role, content, createdAt }` | No thread concept; no per-message status |
| Inference | `inference.chat(turns) → { text }` — **blocking**, returns the full reply | No streaming, no abort |
| Reply UX | A `…` placeholder is swapped for the full text when the promise resolves | No live tokens, no Stop, no regenerate |
| Titles | None | No thread titles |
| Actions | None on messages | No copy/regenerate/edit |

The **streaming template already exists**: `CaptureService` (`start` / `pushChunk` / `stop` /
`onTranscript`) streams `TranscriptEvent`s from main to the renderer via `webContents.send`. Chat
streaming mirrors it exactly (a `ChatService` with `send` / `stop` / `onToken`).

---

## 3. Data model

Add a thread entity and evolve the message entity ([`types.ts`](../../../app/src/services/ports/types.ts)).

```ts
export interface ChatThread {
  id: string;
  title: string;                 // "" until set; UI shows "New chat" when empty
  createdAt: string;             // ISO
  updatedAt: string;             // ISO; bumped on each new/edited message
  titleStatus: "pending" | "auto" | "manual"; // gates auto-title overwrites
}

export interface ChatMessage {
  id: string;
  threadId: string;              // NEW — owning thread
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  status?: "streaming" | "complete" | "stopped" | "error"; // NEW — drives UI; absent == complete
  model?: string;                // NEW (optional) — which model produced an assistant message
}
```

**Persistence (content store).** Add a `chatThreads` collection (metadata) and keep messages in the
existing `chat` collection, now carrying `threadId`:

- `content.chatThreads(): Promise<ChatThread[]>`
- `content.saveChatThreads(threads: ChatThread[]): Promise<void>`
- `content.chat(): Promise<ChatMessage[]>` — **all** messages (UI filters by active `threadId`)
- `content.saveChat(messages: ChatMessage[]): Promise<void>` — unchanged signature

> Rationale: reuses the existing wholesale-collection seam (`content:replace`) with the smallest
> surface change. Per-thread lazy loading is a P2 optimization (see §12).

**Migration** ([`store/migrations.ts`](../../../app/electron/store/migrations.ts)): on first run after
upgrade, if flat `chat` messages exist with no `threadId`, create one `ChatThread`
(`title: "Imported chat"`, `titleStatus: "manual"`) and stamp every existing message with its id.

---

## 4. Information architecture

- New durable collections in the content model: **`chatThreads`** (metadata) and the evolved
  **`chat`** messages — add both to
  [`02-navigation-and-content-model.md`](../02-information-architecture/02-navigation-and-content-model.md) §Storage.
- The Chat **view** gains an internal **thread list rail** (left) + **conversation** (right). The app
  sidebar entry (`/chat`) is unchanged; deep-linking to a thread (`/chat?thread=<id>`) is P1.

---

## 5. UX / screen specification

### 5.1 Layout
A two-pane Chat view:

```
┌ Threads ───────────┬ Conversation ───────────────────────────┐
│ [+ New chat]       │  PageHeader  ·  model badge              │
│ ─ Today ─          │                                          │
│ • Plan my week  ⋯  │  ┌ user bubble ─────────────────────┐    │
│ • Draft reply   ⋯  │  └──────────────────────────────────┘    │
│ ─ Earlier ─        │  ┌ assistant bubble (streaming…) ───┐    │
│ • Imported chat ⋯  │  │ tokens appear here ▋              │    │
│                    │  └────── copy · regenerate ──────────┘    │
│                    │  [ composer · mic · Send / Stop ]         │
└────────────────────┴──────────────────────────────────────────┘
```

- **Thread rail:** `+ New chat` button; threads grouped by day (reuse Home's `formatDateLabel`),
  reverse-chronological by `updatedAt`. Each item shows the title (or "New chat"), with a hover
  `⋯`/kebab → **Rename**, **Delete**. Active thread highlighted (the white-pill treatment).
- **Conversation:** message list (existing bubble styling) + the existing composer (with mic
  dictation via `useDictationField`). On narrow widths the rail collapses to a drawer.

### 5.2 States
| State | Behavior |
|---|---|
| No threads | Centered prompt + suggestion chips; sending a suggestion **creates the first thread** |
| Empty thread | "Ask me anything." + suggestions; composer focused |
| Sending | User bubble appended; assistant bubble shows a typing caret; **Send → Stop** |
| Streaming | Assistant bubble fills token-by-token; list auto-scrolls if pinned to bottom |
| Stopped | Partial assistant text kept; bubble marked stopped; **Regenerate** offered |
| Error | Assistant bubble shows an error line + **Retry** |
| Title pending | Thread shows "New chat" until the auto-title resolves, then updates in place |

### 5.3 Per-message actions (hover toolbar, like Home rows)
- **Copy** (all messages) — via `window.electronAPI.copyText` with a transient "Copied" check
  (the clipboard fix already landed; reuse that pattern).
- **Regenerate** (assistant) — re-runs from the preceding user turn, replacing the assistant message.
- **Stop** (while streaming) — aborts generation; keeps partial text.
- **Edit & resend** (user, P1) — edit a user message; truncate everything after it; regenerate.
- **Delete message** (P2).

### 5.4 Rendering — markdown & reasoning
- **Markdown.** Assistant messages render markdown (headings, **bold**, lists, links, and fenced code
  with a copy-on-block control); render incrementally as tokens arrive. Use a **sanitized** renderer
  (no raw HTML) so the strict CSP and the hardened renderer guarantees hold. User messages stay plain
  text. **(P1.)**
- **Reasoning tokens.** Reasoning models (e.g. Qwen `<think>…</think>`) stream chain-of-thought
  before the answer. When `llm.chat.reasoning` is **on**, reasoning streams into a collapsible
  "Thinking" disclosure above the answer; when **off**, the streamer strips it and shows only the
  final answer (the same intent as `llm.cleanup.disableThinking`).

---

## 6. Streaming protocol

Mirror `CaptureService`. Add a `ChatService` port and a main-process session manager.

```ts
// ports/index.ts
export interface ChatService {
  /** Start a streamed completion. Fire-and-forget; tokens arrive via onToken. */
  send(req: ChatSendRequest): Promise<void>;
  /** Abort an in-flight completion. */
  stop(requestId: string): void;
  /** Subscribe to streamed tokens / completion / error. Returns an unsubscribe fn. */
  onToken(callback: (event: ChatTokenEvent) => void): () => void;
}

export interface ChatSendRequest {
  requestId: string;     // renderer-generated; correlates tokens + the placeholder message
  threadId: string;
  messages: ChatTurn[];  // full prior turns + the new user turn
}

export interface ChatTokenEvent {
  requestId: string;
  threadId: string;
  kind: "token" | "done" | "error";
  delta: string;         // incremental text for "token"
  fullText: string;      // running accumulation (so a late subscriber can resync)
  error?: string;        // present for "error"
}
```

**Flow**
1. Renderer creates `requestId`, appends the user message + an empty assistant placeholder
   (`status: "streaming"`), calls `chat.send({ requestId, threadId, messages })`.
2. Main's **chat session manager** (a `Map<requestId, AbortController>`, modeled on `captureManager`)
   calls the inference runtime's **streaming** completion:
   - **Local (llama.cpp):** the server supports SSE (`"stream": true`); read the chunked stream and
     emit a `ChatTokenEvent{ kind: "token" }` per delta.
   - **Cloud / OpenAI-compatible:** use the provider's SSE streaming endpoint via the existing
     provider router; same event shape.
3. Each token is broadcast via `webContents.send("khonjel:chat-token", event)` (preload relays it,
   like `onTranscript` / `onHotkey`).
4. On completion emit `kind: "done"`; on failure `kind: "error"`. `stop(requestId)` aborts the
   underlying request and emits `done` with whatever was accumulated (`status: "stopped"`).
5. Renderer updates the placeholder by `requestId`, then persists the thread + messages.

**Context, system prompt & concurrency**
- **System prompt.** Main prepends a concise default system prompt (assistant persona) to every
  request; it is not stored in the thread. A user-editable per-thread persona is P2.
- **Context budget.** The renderer sends the full thread; **main** trims to a token budget for the
  active model (oldest turns dropped first) so the policy lives in one place. Summarizing dropped
  context is P2.
- **Local single-stream.** The persistent `llama-server` generates one completion at a time. The
  session manager **serializes local generations** (FIFO): a second `send` while one is streaming
  queues, and the waiting thread shows a subtle "waiting…" state. Cloud requests are not serialized.

**IPC seam deltas**
- [`ipc-contract.ts`](../../../app/electron/shared/ipc-contract.ts): channels `content:chat-threads`,
  `chat:send`, `chat:stop`; relayed event `khonjel:chat-token`.
- [`ipc-schemas.ts`](../../../app/electron/shared/ipc-schemas.ts): `ChatThreadSchema`,
  `ChatSendRequestSchema`, and `ChatTokenEvent` validation.
- [`dispatch.ts`](../../../app/electron/shared/dispatch.ts): handlers for the new channels.
- [`preload.ts`](../../../app/electron/main/preload.ts): `onChatToken` relay + `chat:send` / `chat:stop`
  senders, mirroring `onHotkey` / capture.
- **Mock adapter** ([`adapters/mock`](../../../app/src/services/adapters/mock)): simulate streaming by
  emitting a canned reply word-by-word on a timer (so the browser EDD preview shows live tokens),
  and an in-memory thread store.

---

## 7. Auto thread title

- Trigger: after the **first** assistant reply in a thread completes **and** `titleStatus !== "manual"`.
- Generate via `inference.chat` with a titling prompt (mirror Notes' `llm.note.autoTitle` flow):
  a pure `chatTitlePrompt(messages)` builds the request; the model returns a short title.
- **Fallback** (pure, always available): `deriveThreadTitle(firstUserMessage)` → first ~6 words,
  trimmed, ≤ 48 chars. Used when the title model is unavailable/errors, or while the LLM title is
  pending. Set `titleStatus: "auto"` once applied.
- Gated by a new setting **`llm.chat.autoTitle`** (toggle, default **true**). When off, threads keep
  the fallback title only.
- A manual **Rename** sets `titleStatus: "manual"` and is never overwritten.

---

## 8. Settings

| Key | Type | Default | Effect |
|---|---|---|---|
| `llm.chat.autoTitle` | toggle | `true` | Generate LLM thread titles (else first-words fallback only) |
| `llm.chat.mode` / `.model` / `.provider` / `.connectionId` / `.target` | values | existing | The model the chat runs against (local or routed) — already wired via `useActiveModel("llm.chat", "llm")` |
| `llm.chat.reasoning` | toggle | existing | Existing reasoning toggle, honored by the streaming path |

Add the `llm.chat.autoTitle` default to [`stores/settings.ts`](../../../app/src/stores/settings.ts)
`DEFAULT_TOGGLES` and a row under **Settings → Language Models** (chat scope).

---

## 9. Error handling & edge cases

- **Model unavailable** → assistant bubble shows a clear message + **Retry**; thread is preserved.
- **Stop mid-stream** → keep partial text, mark `stopped`, allow **Regenerate**.
- **Rapid send** → composer + Send disabled while a request for the active thread is in flight.
- **Delete active thread** → select the most-recent remaining thread, or the empty state.
- **Switch thread mid-stream** → the stream keeps running for its `threadId`; tokens are applied to
  that thread's messages even when it isn't focused (correlation by `requestId` + `threadId`).
- **Empty/whitespace input** → ignored.
- **Concurrent sends (local)** → serialized FIFO by the session manager; the waiting thread shows
  "waiting…" until the prior local generation finishes (see §6).
- **Long thread** → main trims to a token budget before sending; the user sees the full thread, the
  model sees the recent window (see §6).
- **Draft threads** → "New chat" opens a draft that is **persisted on first send**, so abandoned
  empty threads never clutter the list.
- **Persistence races** → debounce `saveChat` (the placeholder churns per token); persist on
  `done`/`stopped`/`error`, not on every token.

---

## 10. Accessibility

- Thread list is a `listbox`/`option` set; active thread `aria-current`.
- Streaming region uses `aria-live="polite"` so assistant text is announced as it settles (announce
  on `done`, not per token, to avoid spam).
- All actions have `aria-label`s; Stop is reachable by keyboard; `Enter` sends, `Shift+Enter` newlines.

---

## 11. Test & eval plan

**Unit (Vitest, pure logic — write first):**
- `deriveThreadTitle` (first-words fallback; trimming; length cap; empty input).
- `chatTitlePrompt` (shape of the titling request).
- Thread reducer: create / select / rename (sets `manual`) / delete (re-selects) / auto-title (skips `manual`).
- Streaming accumulator: `token` deltas → `fullText`; `done`/`error`/`stopped` transitions.
- Regenerate: truncates after the target user turn correctly.

**EDD (Playwright vs mock — gates behavior):**
- Send a message → tokens stream into the assistant bubble → completes.
- New chat / switch / rename / delete thread persists across reload.
- Auto-title appears after the first reply; a manual rename survives a second reply.
- Regenerate replaces the last assistant reply; Stop halts streaming and keeps partial text.
- Copy a message (asserts the copy affordance + Copied state).

**eval:electron (optional):** real token streaming against local llama.cpp end to end.

---

## 12. Delivery phasing

**P0 — Threaded streaming chat**
- [ ] `ChatThread` + `ChatMessage.threadId/status`; migration of the existing flat chat.
- [ ] `content.chatThreads()/saveChatThreads()`; thread list rail; create/select/persist.
- [ ] `ChatService` (`send`/`stop`/`onToken`) + main session manager + llama SSE streaming; mock streaming.
- [ ] Streaming UI (live tokens, Stop) + error/Retry state.
- [ ] Per-message **Copy** (reuse `copyText`); **Regenerate**.
- [ ] Fallback auto-title (`deriveThreadTitle`).

**P1 — Polish**
- [ ] LLM auto-title behind `llm.chat.autoTitle`.
- [ ] Markdown rendering (sanitized) + reasoning "Thinking" disclosure.
- [ ] Rename + delete thread (guarded).
- [ ] Edit-and-resend user messages; autoscroll-when-pinned.
- [ ] Cloud/provider streaming parity.

**P2 — Advanced**
- [ ] Message variants / branching; per-message delete.
- [ ] Thread search; export/share a thread.
- [ ] Per-thread model pinning; lazy per-thread message loading.

---

## 13. Open questions

1. **Branching vs replace** on Regenerate — replace in place (P0) vs keep variants (P2)?
2. **Per-thread model / persona** — pin a model + system prompt per thread, or always use the global `llm.chat` scope?
3. **Dropped-context summarization** — when a thread exceeds the token budget, summarize older turns (P2) or just drop them?
4. **Thread search** — reuse the local semantic index (Notes / Qdrant) for chat too?
