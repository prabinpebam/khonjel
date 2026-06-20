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
> on-device models by default, **keeps everything — including your profile and all your
> data — on your device**, and still connects to **virtually any** cloud, self-hosted,
> or enterprise transcription/language model you choose.

**What makes Khonjel different (the wedge):**

1. **Universal model support (key feature).** **Strong, wide support for all sorts of
   transcription and language models.** Local Whisper/Parakeet and on-device LLMs;
   BYO-key cloud across OpenAI, Anthropic, Gemini, Groq, Mistral, DeepSeek, xAI, Cohere,
   Deepgram, AssemblyAI, ElevenLabs, Together, Fireworks, OpenRouter, Perplexity, and
   more; self-hosted (Ollama / LM Studio / vLLM / `llama-server`); enterprise (Bedrock /
   Azure OpenAI / Vertex); and a **universal OpenAI-compatible adapter + extensible
   registry** so even unknown/new providers work. One consistent selector everywhere.
2. **Everything on-device.** Local & open by default — usable with $0 cloud spend and
   **no account**. **Your profile/identity and all storage (history, notes, dictionary,
   settings, models) live on your device.** Cloud is opt-in, never required.
3. **Purpose-scoped intelligence.** Separate, independently-configurable model choices
   for *Dictation Cleanup*, *Voice Agent*, *Note Formatting*, and *Chat*.
4. **A real productivity surface.** History, insights, dictionary, snippets, style,
   transforms, notes — not just a settings window.
5. **Transparent privacy.** **No telemetry, no data collection.** Everything that could
   leave the device is off by default, with time-boxed retention and visible controls.

---

## 4. Product principles

These principles resolve trade-offs. When in doubt, the earlier principle wins.

1. **Everything on-device by default.** Profile/identity, history, notes, dictionary, settings, and models are stored **locally**. No account is required; nothing leaves the device unless the user explicitly opts in. There is **no telemetry**.
2. **Universal model support.** Treat *wide* STT + LLM support as a core feature: any local, self-hosted, BYO-key cloud, or enterprise model the user can reach is usable through one consistent UI, plus a universal OpenAI-compatible adapter and an extensible registry. Never lock the user to one provider.
3. **Local-first, not local-only.** Fully usable offline with open models; cloud is additive. Never make a cloud round-trip mandatory for a core action (dictate → clean up → paste).
4. **Private by default.** Off-by-default for anything that could leave the device. Retention is short, visible, and user-controlled. The default cleanup prompt treats transcribed speech as *data, never instructions*.
5. **One mental model for models.** The same five inference modes, the same provider/model pickers, the same config blocks — for speech and for language, on every surface. Learn it once.
6. **The hot path is sacred.** Press hotkey → speak → text appears. This path is in-memory, fast, and never blocked by indexing, network, or model downloads. Heavy work (model fetch, sync) is off the interaction path.
7. **Meet the user where they type.** Output lands in the active app via the floating bar and global hotkeys; the main window is for history, configuration, and review — not a place you must visit to get value.
8. **Honest system state.** Show real model availability, real errors (e.g. a failed `/models` probe), real storage use, and real retention. No fake "it's working" affordances.
9. **Progressive disclosure.** A first-run user sees one simple path (a recommended local model). Depth (self-hosted endpoints, Prompt Studio, enterprise providers) is available but never in the way.
10. **No subscription, no dark patterns, no nags.** There is no billing/quota/upsell. Branding/social-promo toggles from the references are dropped.
11. **Accessible by construction.** Full keyboard operability, screen-reader semantics, reduced-motion support, and high-contrast theming are requirements, not add-ons.

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
