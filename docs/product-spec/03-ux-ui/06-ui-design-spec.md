# Khonjel — UI Design Spec (Wispr Flow–style)

> **The definitive visual design direction for Khonjel.** Khonjel adopts the **Wispr
> Flow** look & feel: a **warm, calm, editorial** interface — a greige canvas with a
> white content panel floating on it, generous rounding, friendly line icons, **serif
> display headlines** for education moments, and a **teal data-viz** accent kept separate
> from the violet UI accent.
>
> This document is the **art direction + visual system** (how it looks and feels).
> Machine-readable tokens live in [`01-design-language.md`](01-design-language.md);
> layout grids in [`02-app-shell-and-layout.md`](02-app-shell-and-layout.md); component
> behaviour/states in [`05-interaction-states-and-accessibility.md`](05-interaction-states-and-accessibility.md).
> Source fidelity: [`../99-reference-analysis/02-wisper-flow-screen-by-screen.md`](../99-reference-analysis/02-wisper-flow-screen-by-screen.md).
>
> **How these tokens & components must be used is governed by the strict**
> **[Design System discipline](design-system/01-intent.md) (P1–P13).** Read it before
> writing any UI: values live in tokens, variants are CVA props (never forks), reuse
> before creation, and theme/density are token overrides — so the system never drifts.

---

## 1. Design direction & mood

**Adjectives:** warm · calm · friendly · editorial · spacious · trustworthy.

Wispr Flow does not look like a "technical AI tool." It looks like a **well-crafted
writing app**: soft warm neutrals, lots of whitespace, big confident headings, playful
illustrations, and the occasional **magazine-style serif headline**. Khonjel inherits
this exactly. Color is reserved; the canvas is quiet so content and voice take the
stage.

**The three signatures (get these right and it reads as Wispr Flow):**
1. **Card-on-greige.** A warm greige window with a **white content panel floating on
   it**, rounded on the top-left where it meets the sidebar.
2. **Serif display moments.** Education/promo banners use a **serif headline with one
   italicized word** over a soft photographic background.
3. **Two accents, two jobs.** **Violet** for brand/UI accents (sparingly); **teal** for
   all data-visualization (gauges, bars, streak heatmap).

---

## 2. Color system

> Light is the **primary** theme (the Wispr Flow hero). Dark is a faithful counterpart.
> All values are starting hexes; tune to keep AA contrast.

### 2.1 Light theme (primary) — warm neutrals

| Role | Hex | Use |
|---|---|---|
| Canvas (window + sidebar) | `#F2F1EE` | The greige behind everything |
| Surface (content panel, cards) | `#FFFFFF` | Floating white panel, cards |
| Surface-2 (insets) | `#FBFAF8` | Card insets, stat cards, settings panels |
| Border / hairline | `#E6E4DF` | Card borders, row dividers (warm) |
| Border-subtle | `#F0EEEB` | List-row dividers (even lighter) |
| Text primary | `#2A2A28` | Headings, body (warm near-black) |
| Text secondary | `#6E6B65` | Subtitles, descriptions |
| Text tertiary / meta | `#9A968E` | Timestamps, uppercase captions |
| Selected-nav pill | `#FFFFFF` + soft shadow | The white pill on greige |

### 2.2 Accents & semantics

| Role | Light | Dark | Use |
|---|---|---|---|
| **Accent (violet)** | `#6C5CE7` | `#8B7CF6` | Brand, links, selected, key numbers, focus ring |
| Accent-soft | `#EEEBFB` | `#241F3D` | Accent badge/selected-chip background |
| **Data-viz (teal)** | `#1F7A6B` | `#36C2A8` | Gauges, bars, heatmap — **only** charts |
| Teal ramp (heatmap) | `#1F5C54 → #4A8A7E → #8FBFB5 → #C8E2DB` | inverse | 4-step intensity |
| Success | `#1F9D57` | `#34D17E` | Confirmations, connected |
| Warning | `#C9821A` | `#E0A33C` | Caution |
| Danger | `#D2433B` | `#F1675E` | Destructive (delete/clear/reset) |
| Notification dot | `#E5484D` | `#F1675E` | The red "1" badge on Settings |
| Primary button | **`#1A1A18` (near-black)** | `#F2F3F5` | "Add new", "Upgrade"-style CTAs |

### 2.3 Dark theme (counterpart)

| Role | Hex |
|---|---|
| Canvas | `#15161A` |
| Surface | `#1C1D21` |
| Surface-2 | `#212226` |
| Border | `rgba(255,255,255,0.08)` |
| Text primary | `#F2F3F5` |
| Text secondary | `#A6ABB2` |
| Text tertiary | `#73787F` |

Dark keeps the **same structure, rounding, and the violet/teal split** — only neutrals
invert. The serif promo banners darken their photo a touch more.

---

## 3. Typography

Three families:

| Family | Role | Candidates |
|---|---|---|
| **UI Sans** | Everything functional | Inter / Geist / system-ui (friendly humanist) |
| **Display Serif** | Promo/education headlines only | Newsreader / Source Serif / Spectral (with italic) |
| **Mono** | Endpoints, paths, keycaps, code | JetBrains Mono / ui-monospace |

**Type scale (px / line-height / weight):**

| Token | Size / LH | Weight | Use |
|---|---|---|---|
| Display serif | 28 / 34 | 500 | Promo headline (e.g. *"Flow spells the way you do."*) |
| Page title (H1) | 26 / 32 | 700 | "Welcome back, {name}", "Dictionary", "Insights" |
| Section title (H2) | 20 / 26 | 600 | Card headings ("Desktop usage", "1 day streak") |
| Card/row title (H3) | 15 / 20 | 600 | Setting-row titles, list titles |
| Body | 14–15 / 22 | 400 | Transcripts, descriptions |
| Body strong | 14 / 20 | 600 | Inline emphasis, values |
| **Stat number** | 40 / 44 | 700 | Big numbers (140, 3,599, 61) — tabular figures |
| Caption (uppercase) | 11 / 14 | 600 | "WORDS PER MINUTE", date dividers; tracking +0.08em |
| Small / meta | 13 / 18 | 400 | Timestamps, helper text |
| Mono | 13 / 18 | 400 | Paths, endpoints, keycaps |

**Signature treatments (do these to feel like Wispr Flow):**
- **Big confident stats:** large bold number immediately followed by a **small gray
  lowercase label** on the same line ("3,599 total words", "140 wpm").
- **Uppercase letter-spaced captions** for stat labels and date dividers ("JUNE 18, 2026").
- **Serif italic emphasis:** in promo headlines, italicize exactly one word
  (*you*, *your*) for editorial warmth.

---

## 4. Spacing, grid & the floating panel

- **Base unit 4px.** Scale: `2 · 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 48 · 64`.
- **Window padding:** the white content panel is **inset from the window edges** by the
  greige — about `12–16px` on the top/right/bottom — so it reads as a card floating on
  the canvas. Its **top-left corner is rounded `16px`** (and top-right where visible).
- **Sidebar width:** `218px` (collapses to `64px` icons-only).
- **Content padding:** `32px` top, `40px` horizontal for the page header block; `24px`
  between major blocks.
- **Content max-width:** `~1040px`; the optional **right rail** is `~260px` with a `24px`
  gutter.
- **Card grid (dashboards):** 12-col; row-1 stat cards span 4, row-2 wide cards span 6;
  reflow to 1-col under ~900px.

---

## 5. Radius, border & elevation

| Token | Value | Use |
|---|---|---|
| Radius — pill | `999px` | Buttons, chips, tabs-as-pills, toggles, nav pill, FAB |
| Radius — lg | `16px` | Content panel corner, promo banners, big cards |
| Radius — md | `12px` | Cards, list containers, inputs, quota/status card |
| Radius — sm | `8px` | Primary buttons, keycaps, small controls |
| Border | `1px solid #E6E4DF` | Default separation (warm hairline) |
| Shadow — card | `0 1px 2px rgba(40,40,38,.04), 0 1px 3px rgba(40,40,38,.06)` | Cards, right rail |
| Shadow — nav pill | `0 1px 2px rgba(40,40,38,.06)` | The white selected sidebar pill |
| Shadow — pop | `0 8px 24px rgba(40,40,38,.12)` | Popovers, the floating bar |
| Shadow — modal | `0 24px 64px rgba(20,20,18,.24)` | Settings modal |

**Rule of thumb:** rounding is generous and shadows are *soft and low*. Nothing has a
harsh or high-contrast edge. Borders do most of the separation; shadows add a hint of
lift.

---

## 6. Iconography, illustration & imagery

- **Line icons** (lucide), ~`1.5px` stroke, rounded joins, sizes `16 / 18 / 20`. Idle =
  tertiary gray; active = violet (nav) or primary text.
- **Friendly illustrations:** the right-rail "Voice Profile" uses a soft, rounded
  character illustration (warm palette). Use this style for empty states and onboarding —
  approachable, not corporate clip-art, never emoji.
- **Photographic promo imagery:** education banners use a **soft, warm-toned photograph**
  (people, desks, ambient) **darkened with a gradient** so white text and frosted chips
  stay legible. Keep imagery warm and human.
- **Brand mark:** a small **equalizer / waveform glyph** (3–4 vertical bars of varying
  heights) + the wordmark "Khonjel".

---

## 7. App shell — visual spec

### 7.1 Window chrome (height 52, greige)
```
[▢ sidebar-toggle]  [◯ account]                         [🔔]  [—] [▢] [✕]
```
- Left: two ghost icon-buttons (sidebar toggle, account) — tertiary gray line icons.
- Right: notification **bell**, then native min/max/close (thin gray).
- No title text; the bar is the drag handle and blends with the sidebar.

### 7.2 Sidebar (greige, 218px)
```
[≣ Khonjel]                  ← brand: waveform glyph + wordmark
────────────────────────────
🔍 Search…             ⌘K    ← command palette field
────────────────────────────
▦ Home          ← SELECTED: white pill, soft shadow, violet glyph, bold label
▤ Insights
▢ Notes
… (idle: tertiary-gray glyph + secondary-gray label, no background)
────────────────────────────
(flex spacer)
┌ Engine status card ┐       ← white md-radius card (replaces WF quota card)
│ Local · Qwen 4B    │
│ ● ready            │
└────────────────────┘
────────────────────────────
◔ Invite teammate  (optional)
⚙ Settings        ●1         ← red notification dot when actionable
? Help
[avatar] Name / email
```
- **Selected nav item:** **white pill** (`#FFFFFF`), `radius-pill`/`12px`, `shadow-nav`,
  inset `~8px` from sidebar edges, height `40px`; glyph tinted violet, label `#2A2A28`
  semibold. Idle rows have no background; hover = `rgba(0,0,0,.04)`.
- **Brand** top-left, `20px` from top.
- **Engine status card** is Khonjel's honest replacement for Wispr Flow's word-quota
  card — same shape and placement, but it shows the active model + health, **never an
  upsell** (no subscription).

### 7.3 Content panel
- White, `radius-lg` top-left, floating on greige. All page content lives here.

---

## 8. Component visual specs

### 8.1 Buttons
| Variant | Look |
|---|---|
| **Primary** | Near-black `#1A1A18` fill, white text, `radius-sm` (8px), `36–40px` tall, `12×16` padding (e.g. **Add new**, **Upgrade-style CTA**). |
| **Secondary / outline** | White fill, `1px #E6E4DF` border, primary text (e.g. **Download on mobile**). |
| **Ghost** | No fill/border; tertiary→primary on hover (icon buttons, footer nav). |
| **Danger** | `#D2433B` text + soft border; filled red only for high-stakes confirm. |

### 8.2 Tabs (underline style — the WF default)
- A row of labels; the **active** tab is `#2A2A28` semibold with a **2px dark underline**
  directly beneath; idle tabs are tertiary gray. A full-width hairline sits under the row.
- Used for: Insights (Usage/Voice), Dictionary scopes, Speech-to-Text / Language Models
  purpose tabs.

### 8.3 Chips
- **Filter/quick-add chips:** rounded-pill, `13px`. On promo photos they are **frosted
  glass** (semi-transparent dark, subtle blur, white text); on white surfaces they are
  `#F2F1EE` fill with `#E6E4DF` border.
- **Provider/model chips:** rounded-pill, brand logo + label; selected = violet-soft fill
  + violet border.

### 8.4 Cards & list rows
- **Card:** white, `radius-md/lg`, `1px #E6E4DF`, `shadow-card`, padding `20–24px`.
- **List container:** white `radius-md` card holding rows; each **row** is `~52px`,
  left-padded `20px`, separated by `border-subtle` hairlines. Row hover = `#FBFAF8`.
- **Setting row:** title + description on the left, control right-aligned, inside a
  `radius-md` panel with divided rows.

### 8.5 Inputs, toggles, selects
- **Text input:** white, `1px #E6E4DF`, `radius-md`, `36–40px`; focus = violet ring
  (`2px` + `2px` offset). Mono variant for endpoints/paths.
- **Toggle:** pill track; **ON = near-black** (Wispr Flow uses dark, not loud color) or
  violet for brand-forward toggles; OFF = `#D9D6CF`. Knob white.
- **Select / dropdown:** input-like with chevron; menu = white `radius-md` popover, soft
  shadow.

### 8.6 Badges
- **Plan/label badge** (e.g. "Basic"): rounded-pill, thin gray border, tertiary text.
- **Status badge:** Success/Connected = green soft; Beta = violet soft; Offline = outline.
- **Notification dot:** small red circle with white count.

### 8.7 Promo / education banner (signature)
```
┌───────────────────────────────────────────── × ┐
│  ‘Khonjel spells the way you do.’   ← serif, italic “you”
│  short supporting line (white, ~14px, some bold) │
│  [Add new word] [chip] [chip] [chip]            │  ← frosted chips
└──[ warm darkened photographic background ]───────┘
```
- `radius-lg`, full content width, `~180–200px` tall.
- Warm photo + dark gradient overlay (left-weighted) for legibility.
- **Serif display headline** with one italic word; white body; frosted chips; circular
  frosted `×` top-right. **Dismissible and remembered.**

### 8.8 Stat card + gauge
- **Stat card:** big `40px` number, uppercase caption beneath, optional `(i)` info icon.
- **Gauge:** semicircular speedometer; thick (`~16px`) **teal** arc with rounded ends; a
  light track behind; centered label ("Top" small gray over `0.2%` large dark).

### 8.9 Bar chart (per-app usage)
- Rows: category line-icon + a **teal bar** (height ≈ value) with the **% inside** (white
  on the long bar; teal-on-soft chip for short/zero bars) + a `count CATEGORY` label
  (uppercase, gray) to the right. Bars rounded.

### 8.10 Contribution heatmap (streak)
- Month headers + `‹ ›` paging; weekday rows `Sun…Sat`; grid of `~12px` rounded squares,
  `3px` gaps. Empty = warm greige `#D9D6CF`; active = **4-step teal ramp**. Legend:
  `More ▮▮▮▯ Less`.

### 8.11 Share sticker, FAB
- **Share sticker:** circular badge with **rotating "SHARE · SHARE ·" text** around an
  upload glyph (teal). Playful, top-right of shareable pages.
- **FAB** (e.g. record a note): near-black circular button, `radius-pill`, glyph, soft
  shadow, bottom-right.

---

## 9. Signature layout patterns

### 9.1 Library page (Dictionary / Snippets / Transforms)
```
{Title}                                              [ Add new ]
── All   Personal   Shared with team ────────  🔍  ⇅  ↻
┌ promo banner (dismissible) ──────────────────────────┐
└───────────────────────────────────────────────────────┘
┌ entries (white card, divided rows) ──────────────────┐
│ entry …                                               │
└───────────────────────────────────────────────────────┘
```

### 9.2 Home (timeline + rail)
```
Welcome back, {name}                         ┌ stats card ─────┐
── JUNE 18, 2026 ──────────────              │ 3,599 total…    │
06:39 pm   transcript …                      │ 140 wpm         │
06:38 pm   transcript …                      │ 1 day           │
…                                            │ ── Voice Profile │
                                             │ Design Critique  │ + illo
```

### 9.3 Dashboard (Insights)
```
Insights        Your Usage | Your Voice                  (SHARE sticker)
┌ 140 / WPM + gauge ┐ ┌ 61 / FIXES ┐ ┌ 3,599 / TOTAL ┐
┌ Desktop usage (bars) ──────────┐ ┌ streak (heatmap) ──────────┐
```

> Khonjel's primary nav (from the merged spec) is **Home · Insights · Chat · Notes ·
> Upload · Dictionary · Transforms · Integrations** — all rendered in this visual system.

---

## 10. Motion & micro-interactions

- **Durations:** `120ms` (fast), `180ms` (default), `280ms` (modal).
- **Easing:** `cubic-bezier(.2,0,0,1)` standard.
- Page/tab change: `120–180ms` cross-fade + subtle slide. Modal: `180ms` scale-in from
  `.98` + backdrop fade. Nav pill: background slides between items.
- Data-viz: gauge sweeps, bars grow, heatmap fades in once (`≤400ms`).
- The floating bar's listening waveform animates continuously (violet/teal).
- **Reduced motion:** transitions become instant; waveform → static meter; no looping.

---

## 11. Light & dark

- **Light is the hero** (the Wispr Flow look). **Dark** mirrors structure with inverted
  neutrals and the same violet/teal accents.
- Theme switch lives in **Settings ▸ General ▸ Appearance** (`Light / Dark / Auto`),
  matching OpenWhispr's control. No layout changes between themes.

---

## 12. Do & don't

**Do**
- Keep the greige canvas + floating white panel.
- Use serif italic headlines for education moments only.
- Reserve teal for data-viz, violet for UI accent.
- Prefer big stats, uppercase captions, generous whitespace, soft shadows.

**Don't**
- Don't use loud, saturated fills for surfaces or buttons (primary is near-black).
- Don't mix teal into UI controls or violet into charts.
- Don't use emoji, harsh borders, or heavy drop-shadows.
- Don't reintroduce upsell/quota visuals (no subscription) — the status card replaces them.

---

## 13. Acceptance checklist
- [ ] Greige canvas (`#F2F1EE`) with a white content panel floating on it, rounded top-left `16px`.
- [ ] Sidebar selected item = white pill + soft shadow + violet glyph.
- [ ] Page titles `26/700`; stat numbers `40/700` with uppercase captions.
- [ ] Library pages: title + Add-new + underline tabs + search/sort/refresh + dismissible **serif promo banner** + divided white list.
- [ ] Promo banners use a warm darkened photo + serif headline with one italic word + frosted chips.
- [ ] Data-viz uses the **teal** ramp (gauge, bars, heatmap); UI accent is **violet**; both never cross.
- [ ] Primary buttons near-black; secondary outline; toggles dark-when-on.
- [ ] Generous rounding (cards 12–16px, buttons 8px, chips/pills full) and soft, low shadows.
- [ ] Light theme is the default visual hero; dark mirrors it; switch in General ▸ Appearance.
- [ ] No emoji, no harsh edges, no upsell visuals.
