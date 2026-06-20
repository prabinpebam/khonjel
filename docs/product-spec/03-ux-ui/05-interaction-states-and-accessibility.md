# Khonjel — Interaction, States & Accessibility

> Universal behaviour: component states, feedback, motion, keyboard model, and
> accessibility requirements that apply across every screen.

---

## 1. Universal component states

Every interactive element defines all applicable states:

| State | Visual treatment |
|---|---|
| **Default** | Token-defined rest appearance |
| **Hover** | +4–6% surface tint / slight elevation |
| **Focus-visible** | 2px `--accent` ring, 2px offset (keyboard only) |
| **Active/pressed** | −2% scale or darker fill |
| **Selected** | Accent fill/underline/radio dot + bold label |
| **Disabled** | 40% opacity, no pointer, `aria-disabled` |
| **Loading** | Spinner/skeleton; control non-interactive but focus retained |
| **Error** | `--danger` border/text + message + retry |
| **Read-only** | Plain text, no input affordance (e.g. Email) |

---

## 2. Feedback & status

- **Optimistic where safe** (toggles flip immediately, persist in background; revert + toast on failure).
- **Explicit for risk** (model download, reset, clear) — show progress and confirmation.
- **Honest errors** — surface the real cause (e.g. raw `/models` 404, endpoint
  unreachable, no model installed, mic permission denied) with a concrete next step.
- **No fake success** — never show inserted/ready unless it actually happened.
- **Toasts** for background outcomes; **inline** for in-context validation; **dialogs**
  for destructive confirmation only.

### 2.1 Key error scenarios → resolution
| Scenario | Message | Action |
|---|---|---|
| No STT/LLM model selected | "Pick a model to start dictating." | → Settings ▸ relevant page |
| Self-hosted endpoint down | raw error + "Couldn't reach {endpoint}." | Retry · Edit endpoint |
| Local model still downloading | "Model downloading — {pct}%." | Continue (queues capture) |
| Mic permission denied | "Microphone access is blocked." | Open OS settings |
| Cloud provider key invalid | "{provider} rejected the API key." | Re-enter key |
| Offline + cloud engine selected | "You're offline. Switch to a Local model?" | Switch · Retry |

---

## 3. Confirmation & destructive actions
- **Confirm dialogs** for: Clear Cache, Reset app data, Delete account, Delete
  entry/note/transform, Clear All Audio.
- Dialog states the **exact consequence** and scope; primary button uses `--danger`;
  default focus on **Cancel**.
- Reset/Clear copy mirrors the references' cautious tone ("Permanently delete…",
  "Reset only if advised by support").

---

## 4. Motion & animation
- Durations/easing per [`01-design-language.md`](01-design-language.md#8-motion).
- **Allowed motion:** page/tab fades (120–180ms), modal scale-in, toast slide, bar
  waveform, download progress, gauge/bar/heatmap reveal (one-shot, ≤400ms).
- **Never:** parallax, looping decorative motion, motion that blocks input.
- **`prefers-reduced-motion`:** all transitions become instant; waveform → static level
  meter; reveals → immediate; no pulsing.

---

## 5. Keyboard model

### 5.1 Global (system-wide)
Dictation, Meeting Mode, Agent, Transforms, view-changes, Cancel — see
[`../02-information-architecture/02-navigation-and-content-model.md`](../02-information-architecture/02-navigation-and-content-model.md#61-global-hotkeys-system-wide-ref-ow-s15).

### 5.2 In-app
| Keys | Action |
|---|---|
| `Ctrl/Cmd + ,` | Open Settings |
| `Ctrl/Cmd + F` | Focus search in current list |
| `Ctrl/Cmd + N` | Add new (in libraries) |
| `↑ ↓` | Move list selection |
| `Enter` | Open/activate selection |
| `Space` | Toggle the focused switch/checkbox |
| `Del/Backspace` | Delete selected (with confirm) |
| `Esc` | Close modal/popover/overlay; cancel capture |
| `Tab / Shift+Tab` | Forward/back focus traversal |
| `1..n` | Switch tabs/pills when the tablist is focused |

- **Full operability without a mouse**, including hotkey capture (type the combo),
  engine selection, model download, and Prompt Studio.
- **Focus order** follows visual order; modals trap focus and restore it on close.

---

## 6. Accessibility requirements (WCAG 2.2 AA)

### 6.1 Semantics
- Landmarks: `banner` (title bar), `navigation` (sidebar), `main` (content),
  `dialog` (settings/confirm), `complementary` (right rail).
- Sidebar = nav list with `aria-current` on the active item.
- Tabs/pills = proper `tablist`/`tab`/`tabpanel` with arrow-key support.
- Engine list = radiogroup; toggles = `switch` with `aria-checked`.
- Live regions: capture status ("Listening", "Transcribing", "Inserted"), download
  progress, and errors announced politely (assertive for errors).

### 6.2 Contrast & color
- Text ≥ 4.5:1 (normal), ≥ 3:1 (large/UI). Promo overlays guarantee AA on photos.
- **Color is never the only signal** — charts/states include labels, icons, or values
  (e.g. heatmap exposes counts; bars show numbers; engine selection shows a dot + bold).

### 6.3 Charts & data
- Every chart (gauge, bars, heatmap) has a **text/table alternative** and accessible
  names with values; keyboard-focusable data points where interactive.

### 6.4 Voice & AT
- As a voice-input product, Khonjel must coexist with screen readers and OS dictation;
  capture status is announced; the Khonjel Bar is reachable and labelled.
- Vibe coding's "Screen Reader mode" interplay is documented (P2).

### 6.5 Targets & input
- Hit targets ≥ 24×24 (≥ 44×44 for the Bar/FAB). Hover-only actions also keyboard/menu
  reachable. No motion- or timing-dependent interactions without alternatives.

### 6.6 Text & zoom
- Respect OS text scaling to 200% without loss of content/function; layouts reflow
  (no horizontal scrolling at 320px-equivalent content width within panes).

---

## 7. Internationalization
- All copy externalized; supports `App Language` switching (Ref: WF W8).
- RTL-ready layouts (mirror sidebar/rows). Tabular numerals for stats.
- Dictation languages independent of UI language; multilingual local STT supported.
- Date/time/number formatting per locale (history dividers, timestamps, sizes).

---

## 8. Performance & responsiveness (UX-level)
- **Hot path first:** hotkey→listening feedback < 100ms; never blocked by indexing,
  network, or downloads (architecture enforces this).
- Lists virtualize beyond ~200 rows (history, notes, dictionary).
- Theme/density changes apply without reload.
- Background work (downloads, sync, analytics) shows progress but never freezes the UI.

---

## 9. Accessibility acceptance checklist
- [ ] Full keyboard operability incl. hotkey capture, engine select, downloads, Prompt Studio.
- [ ] Correct landmarks/roles; `aria-current`; tablists; radiogroup; switches.
- [ ] Live-region announcements for capture status, progress, and errors.
- [ ] AA contrast in both themes; color never the sole signal; charts have text equivalents.
- [ ] `prefers-reduced-motion` fully honored.
- [ ] 200% zoom and OS text scaling supported; RTL-ready; i18n externalized.
