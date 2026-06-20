# Khonjel — Design Language & Tokens

> The **token layer** of the visual system. The full **art direction / look & feel** —
> **the Khonjel design language** — is the hero spec in
> [`06-ui-design-spec.md`](06-ui-design-spec.md); read that first for *how it looks*,
> then use this doc for the machine-readable values.
>
> Built with **shadcn/ui** (Radix UI primitives) + **Tailwind CSS v4** + **lucide-react**
> icons. The **primary direction is a warm, editorial light** aesthetic; a refined dark
> theme is the counterpart. All values are **design tokens** (CSS variables, shadcn
> convention); build against tokens, not raw hex.
>
> Heritage: a warm light theme (violet UI accent + teal data-viz) studied from a light,
> editorial productivity reference and now Khonjel's own; a near-black dark counterpart.
> Khonjel ships **Light / Dark / Auto**, Light-first. Tokens map to shadcn's
> `--background`, `--foreground`, `--primary`, `--muted`, `--border`, etc.

---

## 1. Design tenets
1. **Calm, warm, neutral.** Surfaces are quiet; color is reserved for meaning and brand.
2. **Rounded & soft.** Generous radii, hairline borders, soft shadows — never harsh.
3. **Content-first.** Cards group; whitespace separates; one clear primary action per view.
4. **Theme-flexible, one structure.** Light / Dark / Auto differ only in tokens, never in layout.
5. **Honest data-viz.** A distinct chart ramp (teal) so analytics never masquerade as UI accent.
6. **Built on shadcn/ui + Radix.** Use the primitives (Dialog, Popover, Select, Tabs,
   DropdownMenu, Progress, Accordion, Label, Slot) and `lucide-react` icons; restyle via
   tokens rather than forking components.

---

## 2. Color tokens

### 2.1 Brand & semantic (theme-independent intent)
| Token | Light | Dark | Use |
|---|---|---|---|
| `--accent` | `#6C5CE7` | `#8B7CF6` | Brand, selected radio, primary fill, links |
| `--accent-contrast` | `#FFFFFF` | `#0E0E10` | Text/icon on accent |
| `--accent-soft` | `#EEEBFB` | `#241F3D` | Selected pill bg, accent badge bg |
| `--dataviz` | `#1F7A6B` | `#36C2A8` | Charts, gauges, heatmap ramp |
| `--success` | `#1F9D57` | `#34D17E` | Confirmations, "Latest", installed |
| `--warning` | `#C9821A` | `#E0A33C` | Caution banners, logged-bullets |
| `--danger` | `#D2433B` | `#F1675E` | Destructive (Clear/Reset/Delete) |
| `--info` | `#2F6BFF` | `#5B8CFF` | Neutral info, "Get your API key" link |

### 2.2 Light theme neutrals (warm greige)
| Token | Value | Use |
|---|---|---|
| `--bg-window` | `#F2F1EE` | Window + sidebar background |
| `--bg-surface` | `#FFFFFF` | Cards, content panel |
| `--bg-surface-2` | `#FBFAF8` | Inset card (settings rows container) |
| `--bg-elevated` | `#FFFFFF` | Modals, popovers (with shadow) |
| `--border` | `#E6E4DF` | Hairline borders/dividers |
| `--border-strong` | `#D8D5CE` | Inputs, stronger separation |
| `--text-primary` | `#2A2A28` | Headings, body |
| `--text-secondary` | `#6E6B65` | Subtitles, descriptions |
| `--text-tertiary` | `#9A968E` | Meta, timestamps, labels |
| `--text-on-photo` | `#FFFFFF` | Promo banner text |

### 2.3 Dark theme neutrals (near-black)
| Token | Value | Use |
|---|---|---|
| `--bg-window` | `#0E0E10` | Window background |
| `--bg-surface` | `#16171A` | Cards, content panel |
| `--bg-surface-2` | `#1C1D21` | Inset/engine cards |
| `--bg-elevated` | `#1A1B1F` | Modals, popovers |
| `--border` | `rgba(255,255,255,0.08)` | Hairline borders/dividers |
| `--border-strong` | `rgba(255,255,255,0.14)` | Inputs |
| `--text-primary` | `#F2F3F5` | Headings, body |
| `--text-secondary` | `#9AA0A6` | Subtitles |
| `--text-tertiary` | `#6B7077` | Meta, labels |

### 2.4 Theme behaviour
- Default **System**; user override to Light/Dark in Settings ▸ Appearance.
- Photographic promo banners darken with an overlay so `--text-on-photo` stays AA.
- Accent is user-selectable (Appearance ▸ accent) from a curated set; default violet.

---

## 3. Typography

**Families.** UI: a humanist sans (Inter / system UI fallback). Display (promo
headlines only): a serif (e.g. *Newsreader*/*Source Serif*) with an italic emphasis
cut — mirrors the references' serif marketing headlines. Mono: for code/paths/endpoints
(`ui-monospace`, *JetBrains Mono*).

**Type scale (px / line-height / weight):**
| Token | Size/LH | Weight | Use |
|---|---|---|---|
| `--font-display` | 28 / 34 | 600 | Promo headlines (serif) |
| `--font-h1` | 26 / 32 | 700 | Page greeting/title (Home) |
| `--font-h2` | 20 / 28 | 600 | Settings page title, section heads |
| `--font-h3` | 16 / 22 | 600 | Card titles, setting-row titles |
| `--font-body` | 14 / 20 | 400 | Body, descriptions |
| `--font-body-strong` | 14 / 20 | 600 | Emphasis, values |
| `--font-small` | 13 / 18 | 400 | Subtitles, helper text |
| `--font-label` | 11 / 14 | 600 | Uppercase nav-group & stat labels (tracking +0.06em) |
| `--font-mono` | 13 / 18 | 400 | Endpoints, paths, code chips |
| `--font-stat` | 40 / 44 | 700 | Big numbers (Insights/stats) |

**Rules.** One H1 per page. Uppercase labels only for nav-group headers and stat
captions. Numerals use tabular figures in stats/tables.

---

## 4. Spacing & layout grid
- **Base unit = 4px.** Scale: `2,4,8,12,16,20,24,32,40,48,64`.
- Card padding: `16` (compact) / `20` (default) / `24` (page header blocks).
- Row height: nav `40`; setting/list row `52–56`; engine row `64`.
- Content max-width: `880` (settings pane), `1040` (main content), right rail `250–280`.
- Gutter between content and right rail: `24`.

---

## 5. Radii, borders, shadows
| Token | Value | Use |
|---|---|---|
| `--radius-pill` | 999px | Pills, chips, toggles, FAB |
| `--radius-lg` | 16px | Modals, promo banners, big cards |
| `--radius-md` | 12px | Cards, engine cards, inputs |
| `--radius-sm` | 8px | Keycap chips, small controls |
| `--border-hair` | 1px solid `--border` | Default separation |
| `--shadow-card` | light: `0 1px 2px rgba(0,0,0,.04), 0 1px 3px rgba(0,0,0,.06)` | Cards/rails |
| `--shadow-pop` | `0 8px 24px rgba(0,0,0,.12)` | Popovers, Khonjel Bar |
| `--shadow-modal` | `0 24px 64px rgba(0,0,0,.24)` | Settings modal |

Dark theme shadows are softer + rely more on border contrast.

---

## 6. Iconography
- **Line icons**, ~1.5px stroke, 16/20/24 sizes; rounded joins. (Per references.)
- Brand/provider logos (OpenAI, Anthropic, Gemini, Groq, Qwen, Mistral, Llama, Gemma)
  shown at their brand colors in chips.
- **No emoji** in product UI — use the icon set. (Honors user's no-emoji rule.)
- Nav glyphs: Home(grid), Insights(bars), Dictionary(book), Snippets(scissors),
  Style(Tt), Transforms(shuffle), Scratchpad(note), Settings(gear), Help(question).

---

## 7. Core components (catalog)

| Component | Anatomy | Key states |
|---|---|---|
| **Button / primary** | filled `--accent` (or black on light promos), `--radius-pill`, 36–40h | hover, active, focus-ring, disabled, loading |
| **Button / secondary** | surface + `--border-strong` | hover, focus, disabled |
| **Button / danger** | filled `--danger` (Clear) or outline `--danger` (Reset) | hover, focus |
| **Toggle switch** | pill track; ON = `--accent` (light) / black-or-accent; knob | on, off, focus, disabled |
| **Radio (engine)** | 18px circle; selected = `--accent` dot+ring | selected, idle, focus |
| **Segmented pills** | rounded-full container; active = filled segment | active, idle |
| **Underline tabs** | label row; active = `--accent` underline | active, idle, focus |
| **Provider/family chip** | rounded-full, logo + label; selected = border/fill | selected, idle |
| **Keycap chip** | `--radius-sm`, mono, subtle bg/border (e.g. `Ctrl`) | static |
| **Engine card** | container of divided rows (icon tile + title(+badge) + subtitle + radio) | — |
| **Setting row** | title + subtitle left, control right | — |
| **Input / text** | `--radius-md`, `--border-strong`, 36–40h; mono variant for endpoints | focus, error, disabled |
| **Dropdown / select** | input-like + chevron; menu popover | open, focus |
| **Badge** | pill; variants: accent("Active"), outline("Latest"), beta(violet), danger | — |
| **Card / promo** | `--radius-lg`, photo bg + overlay, serif headline, chips, `×` | dismissed |
| **Stat card** | big number + caption + optional gauge/chart | — |
| **Toast** | elevated pill/card, icon + text + action | enter/exit |
| **Empty state** | centered icon + line + CTA | — |
| **FAB** | `--radius-pill`, dark circle, glyph; bottom-right | idle, active |

All components have a defined **focus-visible ring** = 2px `--accent` offset 2px.

---

## 8. Motion
- **Durations:** `--motion-fast 120ms`, `--motion 180ms`, `--motion-slow 280ms`.
- **Easing:** `--ease-standard cubic-bezier(.2,.0,.0,1)`; `--ease-emphasis cubic-bezier(.2,.0,0,1.2)` (bar pulse only).
- Page/tab switches: 120–180ms fade/slide. Modal: 180ms scale-in from 0.98 + backdrop fade.
- Khonjel Bar listening: continuous waveform; gentle pulse on accent.
- **Reduced motion:** replace transitions with instant state changes; no looping pulse.

---

## 9. Theming the references' specifics
| Reference detail | Khonjel token mapping |
|---|---|
| OW blue radio/active | `--accent` (violet) |
| OW dark surfaces | dark-theme neutrals |
| WF warm greige + white cards | light-theme neutrals |
| WF violet numbers/links | `--accent` |
| WF teal charts | `--dataviz` |
| WF black "Upgrade" CTA | primary button MAY use black on photographic promos only |
| WF serif promo headlines | `--font-display` (serif) |
| OW amber "Caution"/log bullets | `--warning` |
| Red Clear/Reset | `--danger` (filled vs outline by severity) |
