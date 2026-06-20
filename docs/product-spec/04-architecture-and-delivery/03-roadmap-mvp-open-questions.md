# Khonjel — Roadmap, MVP & Open Questions

> How the spec phases into shippable releases, the non-functional bar, and the
> decisions still open. Priorities (P0/P1/P2) trace to
> [`../01-product/01-feature-map.md`](../01-product/01-feature-map.md).

---

## 1. Release phasing

> Khonjel forks the OpenWhispr codebase (same stack), removes the subscription layer,
> rebrands, and layers in additive polish. Phasing reflects "rebrand + de-monetize
> first, then enhance."

### Phase 0 — Fork & rebrand (internal)
- Fork OpenWhispr; **strip Plans & Billing, referral, upgrade/limit, usage/quota** code.
- Rebrand → Khonjel (name, logo, wake word, Khonjel Bar); disable telemetry.
- Make auth/sync optional (compile-out path verified); **ungate API/MCP/CLI**.
- Verify the multi-window shell, local engines, and capture pipeline build & run.

### Phase 1 — MVP / v1.0 (public) — the local-first core
**Must include (P0):**
- Onboarding (local model + hotkey, no account/cloud).
- **Dictation** (Tap/Push-to-talk) with the Dictation Panel; **auto-paste** at cursor.
- **Speech-to-Text:** Local (**Whisper + Parakeet**, Silero VAD, GPU) + Self-Hosted (+ Providers).
- **Language Models** with four scopes; **Dictation Cleanup** + **Prompt Studio**.
- Inference-mode selector everywhere; **Local default**; Self-Hosted `/models` discovery.
- **Providers** matrix (OpenAI/Anthropic/Gemini/Groq/Custom; Deepgram/xAI for STT).
- **Dictionary** (vocab + auto-learn) + **Snippets**.
- **Home/History**; **Notes** (TipTap + folders + **local semantic search**); **Upload**.
- **Control Panel** nav (Home/Chat/Notes/Upload/Dictionary/Integrations) + command palette.
- Settings: General · Hotkeys · Speech-to-Text · Language Models · Privacy & Data · System.
- Privacy: no telemetry; retention + storage + permissions; data management/reset.

### Phase 2 — v1.x — agent, meetings & integrations (P1)
- **Chat** view + **Voice Agent** / **Chat Agent** hotkeys + Agent overlay; reasoning mode.
- **Note Recording** + diarization + **voice fingerprint**; **Meeting Mode** auto-detect.
- **Integrations:** Google Calendar, **Public API**, **MCP server**, **CLI** (all free).
- **Enterprise** modes (Bedrock/Azure/Vertex); transcription preview; updates polish.
- **Additive (Wispr Flow):** Insights (Your Usage), Style, Transforms.

### Phase 3 — v2 — optional sync, teams & compliance (P2)
- **Optional account** + **Workspaces/Team** (shared Dictionary/Snippets), feature-flagged.
- **Khonjel Cloud** optional/self-hostable sync (**not paid**); save-notes-as-files.
- **HIPAA BAA**, Data Controls export/delete; Insights ▸ Your Voice; Voice Profiles.
- Mobile companion (deferred).

---

## 2. MVP scope statement
> **v1.0 is OpenWhispr, rebranded and de-monetized**: install → pick a local model →
> set a hotkey → dictate clean text into any app, with searchable history, Notes with
> local semantic search, a custom dictionary, file upload, and full model flexibility
> (local, self-hosted, BYO-key cloud) — **without an account, subscription, telemetry,
> or any data leaving the device**. Agent/meetings/integrations and optional sync follow.

**Explicitly out of v1:** the entire subscription/billing layer (**removed for good**),
optional teams/sync, HIPAA, mobile, large-scale meeting infrastructure.

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

> Several earlier questions are now **resolved** by adopting the OpenWhispr stack.

| # | Question | Decision |
|---|---|---|
| Q1 | Desktop runtime | **Resolved: Electron 41** (OpenWhispr stack). |
| Q2 | Local STT | **Resolved: Whisper (whisper.cpp) + NVIDIA Parakeet (sherpa-onnx)** + Silero VAD, GPU-aware. |
| Q3 | Local LLM engine | **Resolved: bundle llama.cpp/llama-server**; Self-Hosted reuses Ollama/LM Studio/vLLM. |
| Q4 | Components | **Resolved: shadcn/ui + Radix + Tailwind v4 + lucide-react.** |
| Q5 | Semantic search | **Resolved: Qdrant + MiniLM, local.** |
| Q6 | Storage / secrets | **Resolved: better-sqlite3 + kysely; keychain via @napi-rs/keyring.** |
| Q7 | Monetization | **Resolved: none.** No subscription/quota; API/MCP/CLI free; local unmetered. |
| Q8 | Account/auth | **Resolved: optional/skippable** (compile-out via `AUTH_URL`); local-first. |
| Q9 | Telemetry | **Resolved: none** (off/removed). |
| Q10 | Default local model | Open — hardware-scaled "Recommended" Whisper + small local LLM. |
| Q11 | Khonjel Cloud sync backend | Open — self-host vs optional managed (still free); how to host. |
| Q12 | Additive features depth | Open — how much of Insights/Style/Transforms to ship vs defer. |
| Q13 | Mobile | Open — companion capture/sync first (deferred). |

---

## 7. Definition of done (for this spec)
- [ ] Every feature across both reference designs is represented and assigned a priority.
- [ ] Local/open models are the default; the full provider matrix is supported.
- [ ] IA, navigation, layout, and formatting are specified to reproduction grade.
- [ ] Each screen has a layout, components, copy, states, and a11y notes.
- [ ] Privacy/security defaults and egress are explicit.
- [ ] Reference analysis preserved for fidelity checks in
      [`../99-reference-analysis/`](../99-reference-analysis/).
