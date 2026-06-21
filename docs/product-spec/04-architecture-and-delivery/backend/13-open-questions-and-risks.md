# 13 — Open questions & risks

> The honest list of **unresolved decisions and execution risks** for the backend. A spec is
> only implementation-ready if it admits what it doesn't yet know. Each item has an **owner
> decision**, a **default** (what we do if undecided), and a **trigger** (when we must decide).
> Product-level open questions live in
> [`../03-roadmap-mvp-open-questions.md`](../03-roadmap-mvp-open-questions.md); this doc is the
> backend-specific subset.

---

## 1. Top risks (rank-ordered)

| # | Risk | Impact | Default until decided | Decide by |
|---|---|---|---|---|
| R1 | **Wayland text injection** needs `ydotool`/`uinput` or a portal; may require user setup | Linux dictation unusable in some setups | Ship X11 path first; document Wayland `uinput` setup | Before Linux GA |
| R2 | **macOS permissions** (Accessibility + Screen/Audio capture) friction & notarization entitlements | Onboarding drop-off; meetings blocked | Guided permission flow; degrade to paste-only without AX | Before macOS GA |
| R3 | **Windows secure-field / elevated-app injection** (UIPI blocks SendInput into elevated windows) | Dictation fails in admin apps | Detect + show "can't inject here, copied to clipboard" | Phase 1 |
| R4 | **Bundled model size vs installer weight** (Whisper + a 1.5–7B GGUF = GBs) | Huge installer or slow first-run | Ship small default; download larger on first run | Phase 3 |
| R5 | **Model licensing for redistribution** (Whisper/Parakeet/Qwen/Llama terms) | Legal exposure if bundled wrong | Download at runtime from official sources; don't redistribute restricted weights | Before any bundling |
| R6 | **Code-signing certs** (Windows EV/OV, Apple Developer ID) procurement + CI secrets | Can't ship signed builds | Acquire early; unsigned dev builds meanwhile | Before public beta |
| R7 | **Local LLM latency on low-end hardware** (7B too slow without GPU) | Cleanup feels laggy | Default cleanup to ≤3B; `isClean` skip; recommend by hardware probe | Phase 3 |
| R8 | **Sync/account scope** (better-auth + sync backend) if Workspace ships | New server + privacy surface | Compile-out by default; local-only | Phase 8 |

## 2. Architecture questions
- **Sidecar vs `utilityProcess` vs in-proc** for STT/LLM: child-process sidecars (portable
  binaries) vs Electron `utilityProcess` (Node) vs in-proc native addon. *Default:* sidecar
  child processes for whisper.cpp/llama-server; revisit for embeddings.
- **One llama-server vs per-slot processes:** a single warm llama-server multiplexing slots, or
  one per active model? *Default:* single server, swap models on demand; measure swap cost.
- **MessagePort vs WebSocket** for the renderer stream transport at scale: *Default:*
  `MessagePort` ([08 §1.1](08-ipc-and-ports-contracts.md)); revisit only if it bottlenecks.
- **Renderer async migration:** flipping `ContentService` reads sync→`Promise` touches every
  call site. *Default:* migrate per-phase with the matrix; keep mock sync for dev. Quantify the
  call-site count before Phase 4.

## 3. Pipeline & quality questions
- **`isClean` skip rate for our models/languages** is unmeasured (FreeFlow's ~80%+ is theirs,
  not ours). *Trigger:* build a labelled eval set in Phase 1; tune the heuristic from data.
- **Dictated-punctuation rules per language** — the regex table is English-first; other
  languages need their own. *Default:* English at MVP; structure rules per-language from day one.
- **Tone-hint over-adaptation** — risk the LLM rewrites instead of nudging tone. *Mitigation:*
  keep tone a single secondary line; add a regression test.
- **Fine-tuned cleanup adapter** (FreeFlow's LoRA insight) — worth it for us? *Default:* defer;
  prompt + small instruct first; revisit with eval data.

## 4. Data & privacy questions
- **Search backend:** FTS5 (MVP) vs Qdrant+MiniLM (semantic). *Default:* FTS5; Qdrant opt-in.
- **History retention defaults** (off / 30d / forever) and **raw-text retention**. *Default:*
  keep final text, 30-day audio, raw text off — confirm with product.
- **Telemetry:** none by default is decided; revisit only an explicit **opt-in** crash export.

## 5. Provider questions
- **Azure `api-version` churn** — Azure's required `api-version` query param changes over time and
  differs across model families (the examples span `2024-12-01-preview` and `2025-03-01-preview`).
  *Default:* store it **per connection profile** ([10 §3a](10-providers-and-models.md)), ship a
  recent stable value as the field placeholder, and let users update it **without an app release**
  — never hardcode-lock it.
- **Realtime/streaming STT** beyond OpenAI (Deepgram live, etc.) — which get the warm-connection
  treatment? *Default:* implement the pattern generically; enable per provider as validated.
- **"Khonjel Cloud"** (optional, free) — does it exist at GA, and what's the egress/host story?
  *Default:* not at MVP; design the adapter seam so it can slot in later.

## 6. How these get closed
Each item is owned in the [coverage matrix](07-feature-coverage-matrix.md) phase that first
needs it. An item is "closed" when its decision is recorded here (struck through with the
resolution) and reflected in the relevant contract doc (03–12). No phase that depends on an
open R-item ships until that item is resolved or its default is explicitly accepted.
