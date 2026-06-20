# Khonjel — Vision, Positioning & Principles

> **Khonjel** (Manipuri for *"Voice"*) is a local-first, privacy-first voice
> productivity application for the desktop. You speak; Khonjel transcribes, cleans
> up, formats, and places the text wherever you are working — and can act on your
> voice as an agent. It is built so that it works **completely on open-source and
> on-device models**, while also supporting a **wide range of cloud and enterprise
> APIs** for those who want them.

---

## 1. Product thesis

Khonjel is **built on OpenWhispr** (the open-source, MIT-licensed voice-to-text app) —
**the same technology stack**, replicating its full UI, navigation, and feature set —
with the **subscription/billing layer removed** and the productivity polish of a second
reference layered on top:

| Source | Role | What Khonjel takes |
|---|---|---|
| **OpenWhispr** (source repo, authoritative) | The **base product** | Tech stack, multi-window app, local engines (Whisper/Parakeet/llama.cpp), 5 inference modes, Prompt Studio, Notes + semantic search, meetings, integrations, **no-telemetry** privacy — **everything except subscription**. |
| **Wispr Flow** (reference) | **Additive polish** | History timeline, Insights, Style, Transforms, the warm light theme. |

> **Khonjel = OpenWhispr, rebranded, on the same stack, minus the subscription — plus
> Wispr Flow's productivity polish.** Per the directive: *"we are not going to have the
> subscription part of it and have pretty much everything else."*

The defining bet: most dictation products are thin clients in front of a single
proprietary cloud. Khonjel inverts that — the **default** experience is fully local,
free, **account-optional**, and **telemetry-free**; the cloud is an *option you opt
into*, never a dependency. There is **no subscription, no quota, no upsell**; the Public
API, MCP server, and CLI (Pro-gated in OpenWhispr) are **free** in Khonjel.

---

## 2. Who it is for

1. **Privacy-conscious professionals** who cannot or will not send audio to a vendor cloud (legal, medical, finance, government, journalism).
2. **Local-AI enthusiasts / tinkerers** already running Ollama, LM Studio, vLLM, or `llama-server` who want a first-class dictation client for their own stack.
3. **Developers & power users** who want hotkey-driven dictation, transforms, and code-aware input across every app.
4. **Teams & enterprises** needing self-hosted or cloud-account-backed deployment with shared vocabulary, HIPAA, and data controls.
5. **Accessibility & multilingual users** for whom voice is the primary or preferred input method.

See [`02-personas-and-jobs.md`](02-personas-and-jobs.md).

---

## 3. Positioning

**Category.** Desktop voice-to-text + voice-driven text intelligence ("dictation +
agent").

**Positioning statement.**
> For people who want fast, accurate dictation **without surrendering their data**,
> Khonjel is the voice productivity app that runs entirely on open-source and
> on-device models by default — and still connects to any cloud, self-hosted, or
> enterprise model you choose.

**What makes Khonjel different (the wedge):**

1. **Local & open by default.** Ships usable with $0 cloud spend and no account. On-device speech-to-text and on-device LLMs are first-class, not a footnote.
2. **Bring *any* model.** A single, consistent **engine selector** — *Managed Cloud · Cloud Providers (BYO key) · Local · Self-Hosted · Enterprise* — appears everywhere a model is used, for both speech and language tasks.
3. **Wide provider support.** OpenAI, Anthropic, Google Gemini, Groq, and Custom for cloud; Ollama / LM Studio / vLLM / `llama-server` for self-hosted; AWS Bedrock / Azure OpenAI / Google Vertex for enterprise.
4. **Purpose-scoped intelligence.** Separate, independently-configurable model choices for *Dictation Cleanup*, *Voice Agent*, *Note Formatting*, and *Chat*.
5. **A real productivity surface.** History, insights, dictionary, snippets, style, transforms, and a scratchpad — not just a settings window.
6. **Transparent privacy.** Everything that leaves the device is off by default, time-boxed retention, visible storage meters, and a no-training Privacy Mode.

---

## 4. Product principles

These principles resolve trade-offs. When in doubt, the earlier principle wins.

1. **Local-first, not local-only.** The product must be fully usable offline with open models; cloud is additive. Never make a cloud round-trip mandatory for a core action (dictate → clean up → paste).
2. **Private by default.** Off-by-default for anything that leaves the device. Retention is short, visible, and user-controlled. The default cleanup prompt treats transcribed speech as *data, never instructions*.
3. **One mental model for models.** The same five engine archetypes, the same provider/model pickers, the same config blocks — for speech and for language, on every surface. Learn it once.
4. **The hot path is sacred.** Press hotkey → speak → text appears. This path is in-memory, fast, and never blocked by indexing, network, or model downloads. Heavy work (model fetch, cloud sync, analytics) is off the interaction path.
5. **Meet the user where they type.** Output lands in the active app via the floating bar and global hotkeys; the main window is for history, configuration, and review — not a place you must visit to get value.
6. **Honest system state.** Show real model availability, real errors (e.g. a failed `/models` probe), real storage use, and real retention. No fake "it's working" affordances.
7. **Progressive disclosure.** A first-run user sees one simple path (a recommended local model). Depth (self-hosted endpoints, Prompt Studio, enterprise providers) is available but never in the way.
8. **No dark patterns, no nags.** Quotas/upgrades (if any) are honest and dismissible. Branding/social-promo toggles from the references are dropped.
9. **Accessible by construction.** Full keyboard operability, screen-reader semantics, reduced-motion support, and high-contrast theming are requirements, not add-ons.

---

## 5. Goals & non-goals (v1)

**Goals**
- A complete, reproducible UX spec covering IA, navigation, layout, and formatting.
- Every feature shown across both reference designs, unified under one shell.
- Local/open models as the default, with the full provider matrix supported.

**Non-goals (v1)**
- Mobile apps (the references show "Download on mobile"; Khonjel v1 is desktop-first, mobile is future).
- Real-time multi-party meeting transcription at scale (basic Note Recording with diarization is in; large-meeting infrastructure is later).
- A marketplace for community transforms/prompts (local import/export only in v1).

---

## 6. Success criteria

- A new user can go from install to "spoke a sentence, got clean text pasted" **without an account and without the cloud**, using a recommended on-device model.
- A user can point Khonjel at a local `llama-server`/Ollama endpoint and select a discovered model in under a minute.
- Every screen in this spec is described precisely enough to build without access to the original screenshots — validated against [`../99-reference-analysis/`](../99-reference-analysis/).
