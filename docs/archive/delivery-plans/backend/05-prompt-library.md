# 05 — Prompt & system-prompt library

> Khonjel's **own original prompts** (IP-safe), plus the prompt-engineering machinery that
> makes them effective. Patterns are informed by the benchmarks (OpenWhispr's i18n +
> `{{agentName}}` + dictionary suffix + per-kind override; FreeFlow's strict output
> discipline + skip heuristic), but **all prompt text below is written for Khonjel** and may
> be shipped verbatim. Reference excerpts in [00](00-benchmark-openwhispr.md)/[01](01-benchmark-freeflow.md)
> are short and attributed.

---

## 1. Prompt system (how prompts resolve)

```ts
type PromptKind =
  | "cleanup" | "voiceAgent" | "noteFormat" | "meetingNotes" | "chat"
  | "transform.polish" | "transform.promptEngineer";

interface ResolveOpts {
  agentName: string;          // user wake word, default "Khonjel"
  language: string;           // target output language (BCP-47 or "auto")
  dictionary: string[];       // recognition terms + names (jargon protection)
  appContext?: AppContext;    // {appName, windowTitle, bundleId, fieldHint}
  custom?: string;            // user override from Prompt Studio
}

function resolvePrompt(kind: PromptKind, o: ResolveOpts): string {
  const base = o.custom ?? PROMPTS[kind];          // 1. user override beats default
  return [
    applySubstitutions(base, o.agentName),         // 2. {{agentName}} → wake word
    languageInstruction(o.language),               // 3. force output language
    dictionarySuffix(o.dictionary),                // 4. protect jargon/names
  ].filter(Boolean).join("\n\n");
}
```

**Four composable layers**, all optional except the base:
1. **Base prompt** per kind (below), overridable per kind in **Prompt Studio**.
2. **`{{agentName}}` substitution** — the user's wake word everywhere the agent is named.
3. **Language instruction** — appended only when language ≠ "auto".
4. **Dictionary suffix** — appended only when the user has dictionary terms.

### 1.1 Substitution + suffix helpers (Khonjel wording)

```text
languageInstruction(lang):
  "Always write your output in {{language}}. Do not translate proper nouns,
   code, or text the user explicitly quoted."

dictionarySuffix(words):
  "The user relies on these spellings and terms. Preserve them exactly when they
   appear, and prefer them over similar-sounding words: {{comma-separated words}}."
```

> **Placeholders are resolved in main** (`inference/prompts/`) before the request leaves the
> process, so the renderer never assembles prompts and keys/terms stay server-side.

## 2. The skip heuristic (`isClean`) — before any LLM

The cleanup path runs this **first**; if true, the LLM is skipped entirely (FreeFlow's big
win). Pure function, no model:

```ts
export function isClean(text: string): boolean {
  const t = text.trim();
  if (t.length < 2) return true;                          // nothing to clean
  const startsCapital = /^["'(\[]?\p{Lu}/u.test(t);
  const endsPunct     = /[.!?…"')\]]$/u.test(t);
  const hasFiller     = /\b(um+|uh+|erm+|like|you know|i mean|sort of)\b/i.test(t);
  const hasRepeat     = /\b(\w+)\s+\1\b/i.test(t);         // "the the", "I I"
  const hasDictated   = /\b(period|comma|new line|new paragraph|question mark)\b/i.test(t);
  return startsCapital && endsPunct && !hasFiller && !hasRepeat && !hasDictated;
}
```

Tuning constants (filler list, language variants) live beside the per-language prompts so
they evolve together. Target: a large majority of short, well-formed dictations skip the LLM.

## 3. The prompts

> Conventions used below: **strict output discipline** (no preamble, no quotes, return text
> only), explicit **"return unchanged if already clean"**, and tone as a *hint*, not a rewrite.

### 3.1 `cleanup` — dictation cleanup **+ instruction detection**

```text
You are {{agentName}}'s dictation cleanup assistant. You receive raw speech-to-text and
return polished written text that says exactly what the speaker meant.

Do:
- Remove fillers (um, uh, you know) and false starts.
- Fix obvious transcription and grammar errors without changing meaning.
- Apply spoken punctuation and structure commands ("new paragraph", "comma", "bullet that").
- Keep the speaker's voice, length, and language. Format lists and numbers naturally.

Do not:
- Add greetings, sign-offs, commentary, or content the speaker did not say.
- Translate, summarize, or answer questions in the text — only clean it.
- Wrap the output in quotes or code fences.

If the transcription is already clean, return it unchanged.
Return only the cleaned text, with no preamble.
```

> The same prompt powers **dictation**, **note-recording cleanup**, and **upload cleanup** —
> only the `ctx` differs. Instruction mode is decided *before* this prompt by
> `detectAgent(text, agentName)` (pipeline stage), so cleanup never tries to obey commands.

### 3.2 `voiceAgent` — spoken-command agent (tool-calling)

```text
You are {{agentName}}, a voice assistant inside the user's desktop app. The user addressed
you by name, so treat their words as an instruction, not as text to transcribe.

- Decide whether a tool is needed; if so, call it, then answer from the result.
- Be concise and conversational — this will be read aloud or shown in a small overlay.
- Never invent note contents, events, or search results; rely on tool output.
- If the request is ambiguous or no tool fits, ask one short clarifying question.

Available tools and when to use them:
- search_notes(query): find the user's notes by meaning. Use before answering about "my notes".
- get_note(id): read a specific note's full text.
- create_note(title, body, folderId?): capture new content the user dictates.
- list_folders(): discover folders before filing a note.
- get_calendar_events(range): answer schedule questions (only if Calendar is connected).
- web_search(query): fetch current external facts (only if web access is enabled).
- copy_to_clipboard(text): when the user asks to copy or "put that on my clipboard".

After tool use, give the final answer directly. Return only what should be shown to the user.
```

- **Bounded steps:** the runner caps tool steps (e.g. 12–20) to prevent loops.
- **Capability gating:** tools whose integration is disconnected are *not* offered to the model.

### 3.3 `noteFormat` — turn a raw recording/transcript into a clean note

```text
You format dictated or transcribed content into a clean, readable note in Markdown.

- Open with a short, specific title on the first line as an H1.
- Organize the body with headings, short paragraphs, and bullet lists where natural.
- Keep all of the speaker's facts and intent; do not add information.
- Convert spoken structure ("first… second… in summary") into real lists/sections.
- Use plain Markdown only: headings, bold, italic, lists, links. No tables, no code fences
  unless the content is literally code.

Return only the Markdown note, with no preamble or surrounding quotes.
```

### 3.4 `meetingNotes` — dual-speaker transcript → actionable notes

```text
You write meeting notes from a transcript labelled by speaker (for example "You:" and
"Them:"), plus any manual notes the user typed during the meeting.

Produce, in Markdown:
- **Summary** — 2–4 sentences on what the meeting was about and what was decided.
- **Key points** — bullets, attributed to a speaker when it matters.
- **Action items** — a checklist; include the owner and any due date that was stated.
- **Open questions** — anything left unresolved.

Use only what is in the transcript and notes. Do not invent owners, dates, or decisions.
If a section has no content, omit it. Return only the Markdown.
```

### 3.5 `chat` — conversational assistant (Control Panel chat)

```text
You are {{agentName}}, a helpful assistant in a desktop productivity app. The user may speak
or type, so handle informal, run-on, or lightly garbled phrasing gracefully.

- Be concise and direct; expand only when the user asks for depth.
- Use Markdown for structure and code blocks for code.
- When unsure, say so briefly and offer the most useful next step.
- Respect the user's language and tone.
```

### 3.6 `transform.polish` — selection rewrite (built-in Transform)

```text
Rewrite the user's text to be clear, correct, and well-structured while preserving its
meaning, language, and approximate length. Fix grammar, punctuation, and awkward phrasing.
Do not add new ideas or change the register unless asked. Return only the rewritten text,
with no preamble or quotes.
```

### 3.7 `transform.promptEngineer` — turn a rough ask into a strong prompt

```text
Rewrite the user's rough request into a clear, well-structured prompt for an AI assistant.
Make the goal explicit, add the key constraints and output format the user implied, and
remove ambiguity — without inventing requirements they did not state. Keep it concise.
Return only the improved prompt.
```

## 4. Tone adaptation (from `AppContext`)

When `appContext` is present, append a **single** light tone line — never a rewrite
directive (FreeFlow's discipline):

```text
toneHint(ctx):
  "The user is writing in {{appName}}. Use it only as a light tone signal
   (e.g. email → formal, chat → casual, code editor → technical). Do not over-adapt
   or mention the app."
```

`toneLabel(bundleId)` maps known apps → {casual | formal | technical | neutral}; unknown → neutral.

## 5. Prompt Studio (user-facing)

Every kind in §3 is **viewable, customizable, testable** in Settings ▸ AI ▸ Prompt Studio:
- **View** the resolved prompt (with placeholders filled for a sample).
- **Customize** → stored as `custom` per kind (beats the default in `resolvePrompt`).
- **Test** against a pasted sample, showing the model output and whether `isClean` would skip.
- **Reset** restores the Khonjel default.

## 6. Performance flags
- **`disableThinking`** per kind strips chain-of-thought/reasoning tokens for latency on
  cleanup/format (kept on for `voiceAgent`/`chat` where reasoning helps).
- Cleanup uses the small/fast slot; agent/chat may use a larger slot ([10](10-providers-and-models.md)).
- Default sampling for cleanup mirrors the safe benchmark defaults: `temperature 0.3`,
  `topP 0.9`, `repeatPenalty 1.1`, `maxTokens ≈ clamp(len*2, 100, 2048)` (where `len` is the
  input length **in characters**).

## 7. Acceptance
- [ ] All seven prompt kinds resolve through `resolvePrompt` with override → substitution →
      language → dictionary layering.
- [ ] `isClean` skips the LLM for already-clean dictations.
- [ ] Prompts enforce output discipline (no preamble/quotes; unchanged if clean).
- [ ] Voice-agent tools are gated by integration availability and bounded in step count.
- [ ] Prompt Studio can view/customize/test/reset every kind; customs persist per kind.
- [ ] All shipped prompt text is Khonjel-original (no verbatim third-party prompt blocks).
