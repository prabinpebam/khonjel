# Khonjel — Roadmap, MVP & Open Questions

> How the spec phases into shippable releases, the non-functional bar, and the
> decisions still open. Priorities (P0/P1/P2) trace to
> [`../01-product/01-feature-map.md`](../01-product/01-feature-map.md).

---

## 1. Release phasing

### Phase 0 — Foundations (internal)
- App shell (chrome, sidebar, content panel, theming light/dark).
- `ModelGateway` + **Local** and **Self-Hosted** adapters.
- Capture pipeline (hotkey → STT → insert) with the Khonjel Bar.
- Local store + settings.

### Phase 1 — MVP / v1.0 (public) — the local-first core
**Must include (P0):**
- Onboarding (local model + hotkey, no account/cloud).
- **Dictation** (Tap/Hold) with the Khonjel Bar; insert at cursor.
- **Speech-to-Text** settings: Local + Self-Hosted (+ Cloud Providers, Enterprise present).
- **Language Models** with four purposes; **Dictation Cleanup** functional.
- Engine archetype selector everywhere; **Local default**; Self-Hosted `/models` discovery.
- **Cloud Providers** matrix (OpenAI/Anthropic/Gemini/Groq/Custom).
- **Dictionary** (vocab + substitutions; auto-add).
- **Home/History** timeline; **Hotkeys**, **General**, **Appearance**, **System**,
  **Privacy & Data** settings.
- Privacy: everything off by default; retention + storage controls; data management/reset.
- Local model download manager (families + sized variants + background download).

### Phase 2 — v1.x — productivity depth (P1)
- **Transforms**, **Style**, **Snippets**, **Scratchpad**.
- **Note Recording** + diarization, **Meeting Mode**, **Voice Agent** + **Chat**.
- **Prompt Studio** (View/Customize/Test).
- **Insights** dashboard (Your Usage).
- **Enterprise** adapters (Bedrock/Azure/Vertex); **Disable thinking output**.
- Notifications, sounds, updates, debug logging polish.

### Phase 3 — v2 — collaboration, cloud & compliance (P2)
- **Account/Team/Plans**, shared Dictionary/Snippets.
- **Khonjel Cloud** managed tier; **Cloud Sync**; note sharing.
- **HIPAA BAA**, Data Controls export/delete.
- **Vibe coding** (IDE integration); **Insights ▸ Your Voice**; **Voice Profiles**.
- Mobile companion (deferred from references' "Download on mobile").

---

## 2. MVP scope statement
> **v1.0 is a complete, private, local-first dictation product**: install → pick a local
> model → set a hotkey → dictate clean text into any app, with a searchable history, a
> custom dictionary, and full model flexibility (local, self-hosted, BYO-key cloud) —
> **without an account or any data leaving the device**. Productivity extras
> (transforms/style/snippets/insights/meeting/agent) and collaboration/cloud follow.

**Explicitly out of v1:** teams/billing, cloud sync, HIPAA, Vibe coding, mobile,
large-scale meeting infrastructure, community prompt marketplace.

---

## 3. Non-functional requirements (NFRs)

| Area | Requirement |
|---|---|
| **Latency** | Hotkey→listening feedback < 100ms. STT/LLM time model-dependent but never blocks UI. |
| **Offline** | Full dictate→cleanup→insert works offline on Local engines. |
| **Reliability** | A failed/slow model never freezes UI or Bar (process isolation). Capture cancel always works. |
| **Resource use** | Idle CPU negligible; downloads/inference backgrounded; hardware-aware model recommendations. |
| **Scalability (local)** | History/notes lists virtualize; search stays responsive at 10k+ entries. |
| **Security** | Credentials in OS secure store; signed updates; defensive parsing; sandboxed renderers. |
| **Privacy** | Zero egress in default config; opt-in egress only; honest retention. |
| **Accessibility** | WCAG 2.2 AA; full keyboard; reduced motion; 200% zoom; RTL-ready. |
| **i18n** | UI language switch; multilingual dictation; locale formatting. |
| **Platforms** | Windows first (references are Windows builds); macOS next; Linux later. |
| **Compatibility** | Any OpenAI-compatible self-hosted server (Ollama, LM Studio, vLLM, llama-server). |
| **Updatability** | In-app update check/apply; clear version surface. |

---

## 4. Cross-platform notes
- References show **Windows** chrome (min/max/close) and `Ctrl+Win` hotkeys, `%USERPROFILE%`
  cache paths. v1 targets Windows.
- macOS parity (P2): traffic-light chrome, `Cmd`-based hotkeys, `~/Library` cache, dock
  presence (the references already hint at "Show app in dock").
- Keep OS-specific bits (hotkeys, injection, secure store, paths) behind the OS
  integration layer.

---

## 5. Success metrics (product)
- **Time-to-first-dictation** (install → first inserted text) — target < 3 min, fully local.
- **Local-only share** — % of active users running with zero egress (north-star for the wedge).
- **Self-hosted attach rate** — % connecting their own endpoint.
- **Cleanup acceptance** — % of dictations kept without manual edits.
- **Retention/streaks** — surfaced in Insights; healthy daily habit.

---

## 6. Open questions / decisions to make

| # | Question | Options | Lean |
|---|---|---|---|
| Q1 | Default local STT model | Whisper-small vs distil vs hardware-scaled | Hardware-scaled "Recommended" |
| Q2 | Default local LLM for cleanup | Qwen 4B vs 2B vs Gemma | Smallest that hits quality bar; hardware-scaled |
| Q3 | Desktop runtime | Electron vs Tauri vs native | Optimize for OS integration + bundle size |
| Q4 | Local LLM engine | bundled llama.cpp vs require Ollama | Bundle a runtime; allow Self-Hosted to reuse Ollama |
| Q5 | Style app→context mapping | curated defaults vs user-only | Curated defaults + override |
| Q6 | Transforms sharing | files only vs marketplace | Files in v1; marketplace later |
| Q7 | Account optionality | local profile vs required for sync | Local profile always; account only for cloud/team |
| Q8 | Quota/monetization | none vs managed-tier metering | Local free; meter only Khonjel Cloud |
| Q9 | Diarization engine | local vs cloud | Local where feasible; cloud optional |
| Q10 | Mobile | companion vs full app | Companion capture/sync first |

---

## 7. Definition of done (for this spec)
- [ ] Every feature across both reference designs is represented and assigned a priority.
- [ ] Local/open models are the default; the full provider matrix is supported.
- [ ] IA, navigation, layout, and formatting are specified to reproduction grade.
- [ ] Each screen has a layout, components, copy, states, and a11y notes.
- [ ] Privacy/security defaults and egress are explicit.
- [ ] Reference analysis preserved for fidelity checks in
      [`../99-reference-analysis/`](../99-reference-analysis/).
