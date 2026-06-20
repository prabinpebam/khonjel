# Khonjel — Personas & Jobs-to-be-Done

> Who Khonjel serves, what they are trying to accomplish, and the concrete scenarios
> the product must support. Personas are prioritised; P0 personas drive v1 scope.

---

## 1. Personas

### P0 — "Maya", the privacy-bound professional
- **Context:** Works in law/health/finance. Compliance forbids sending client audio or text to third-party clouds.
- **Needs:** Fully on-device speech-to-text and cleanup; local-only storage; clear proof that nothing leaves the machine; optional HIPAA posture.
- **Pain with status quo:** Mainstream dictation tools are cloud-only; she cannot use them at all.
- **Khonjel value:** Local engine archetype + Privacy Mode + everything-off-by-default + local data storage.

### P0 — "Devin", the local-AI power user / developer
- **Context:** Already runs Ollama / LM Studio / vLLM / `llama-server`. Lives in the keyboard and an IDE.
- **Needs:** Point dictation at his own endpoint, pick a discovered model, bind global hotkeys, run Transforms anywhere, dictate code with variable awareness.
- **Pain:** Existing apps can't target a self-hosted OpenAI-compatible server or are locked to one vendor.
- **Khonjel value:** Self-Hosted engine + model discovery + Transforms + Vibe coding + Prompt Studio.

### P1 — "Sara", the prosumer writer / creator
- **Context:** Writes a lot across email, chat, and docs. Wants speed and a consistent voice.
- **Needs:** Fast accurate dictation, per-context Style, Snippets for boilerplate, Insights to track habit, a Scratchpad for drafting.
- **Khonjel value:** Productivity surface (Style, Snippets, Dictionary, Scratchpad, Insights).

### P1 — "The Hartman team", a small business / enterprise unit
- **Context:** 8–200 people; shared terminology; IT wants control.
- **Needs:** Shared Dictionary/Snippets, self-hosted or enterprise-account models (Bedrock/Azure/Vertex), centralized data controls, HIPAA BAA.
- **Khonjel value:** Enterprise engine + Team sharing + Data controls.

### P2 — "Ravi", the multilingual / accessibility-first user
- **Context:** Uses voice as a primary input method; works across multiple languages incl. Manipuri/regional languages.
- **Needs:** Multiple dictation languages, reliable hands-free operation, full keyboard/AT support.
- **Khonjel value:** Local multilingual STT, accessible shell, hotkey/voice operation.

---

## 2. Jobs-to-be-Done (JTBD)

> Format: *When [situation], I want to [motivation], so I can [expected outcome].*

**Capture**
- When an idea strikes mid-task, I want to **press one key and speak**, so I can capture it without breaking flow.
- When I'm in any app, I want my words to **appear where my cursor is**, so I don't copy-paste.
- When I dictate messily, I want **fillers removed and grammar fixed automatically**, so the output is publishable.

**Act / transform**
- When I've written something, I want to **rewrite/polish it with a hotkey**, so I can improve it in place.
- When I address the app by name, I want it to **treat my speech as an instruction**, so I can command an agent by voice.

**Reuse**
- When I retype the same blocks (signatures, links, prompts), I want a **spoken trigger to expand them**, so I save time.
- When the app misspells names/jargon, I want to **teach it once**, so it's correct forever.

**Adapt**
- When I switch between work email and personal chat, I want the **tone/formatting to match the context**, so I sound right everywhere.

**Record & review**
- When I record a conversation/note, I want **speakers labelled**, so the transcript is readable.
- When I want to see what I dictated, I want a **searchable history grouped by day**, so I can find and reuse it.
- When I want to understand my habit, I want **usage insights**, so I can improve.

**Configure & trust**
- When I care about privacy, I want to **run everything locally and see that nothing leaves**, so I can trust the tool.
- When I have my own model server, I want to **point Khonjel at it and pick a model**, so I use my own stack.
- When I work in an enterprise, I want to **use our cloud account and shared vocabulary**, so we stay compliant and consistent.

---

## 3. Primary user journeys

### J1 — First run (local, no account)
1. Launch → brief welcome → **choose a recommended on-device model** (one click, downloads in background).
2. Set/confirm the **dictation hotkey** (default Tap/Hold).
3. Prompt: "Hold the key and say a sentence." → text appears in a test field.
4. Done — no account, no cloud. (Cloud/provider setup is offered but skippable.)

### J2 — Dictate into any app
1. Focus a text field in any app → **press/hold the dictation hotkey**.
2. The **Khonjel Bar** shows listening state + live audio.
3. Release/tap to stop → speech is transcribed → **cleanup** runs → text is inserted at the cursor.

### J3 — Point at my own server
1. Settings → Speech-to-Text or Language Models → **Self-Hosted**.
2. Enter **Endpoint URL** (e.g. `http://localhost:11434/v1`) + optional API key.
3. **Refresh** → discovered models list → pick one. (Errors shown inline.)

### J4 — Teach vocabulary & reuse text
1. Dictionary → **Add new** → add a name or `trigger → replacement`.
2. Snippets → **Add new** → save a block with a spoken trigger.
3. Next dictation respects both.

### J5 — Record a note with speakers
1. Trigger **Note Recording / Meeting Mode** (hotkey snaps a side panel).
2. Speak / capture a conversation → transcript with **labelled speakers**.
3. Auto-generated **note title**; saved to history/scratchpad.

### J6 — Transform on demand
1. Select or dictate text in any app.
2. Press a **Transform** hotkey (e.g. `Win+Alt+1` Polish) → text is rewritten in place.

---

## 4. Anti-personas (explicitly not optimizing for v1)
- Pure mobile-only users (desktop-first in v1).
- Users wanting a fully managed, zero-config cloud-only product with no interest in local/privacy — they are served, but they are not who the wedge is for.
