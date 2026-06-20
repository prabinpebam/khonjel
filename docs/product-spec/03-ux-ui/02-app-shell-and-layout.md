# Khonjel — App Shell & Layout

> The frame every screen lives in: window chrome, the left sidebar, the content area,
> the optional right rail, and the responsive rules. Measurements are in px at the
> reference scale (1300×~1000 window). Build against the spacing tokens in
> [`01-design-language.md`](01-design-language.md).

---

## 1. Window & chrome

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [▥] [◔]                                              [🔔]  [─] [▢] [✕]      │  ← title bar (52)
├───────────────┬──────────────────────────────────────────────────────────┤
│               │                                                            │
│   SIDEBAR     │   CONTENT PANEL (rounded top-left, floats on --bg-window)  │
│   (218)       │                                          ┌──────────────┐  │
│               │   page header                            │  RIGHT RAIL  │  │
│               │   page body ...........................  │  (optional)  │  │
│               │                                          └──────────────┘  │
│               │                                                            │
└───────────────┴──────────────────────────────────────────────────────────┘
```

### 1.1 Title bar (height 52, `--bg-window`)
- **Left cluster:** sidebar-collapse toggle `▥`, then account/avatar `◔` (opens Account/quick menu).
- **Center:** draggable region (no title text; the brand lives in the sidebar).
- **Right cluster:** notification **bell** (badge when unread) → native **minimize / maximize / close**.
- Windows: native caption buttons; macOS (future): traffic lights left, mirror cluster right.
- The bar is the OS window drag handle.

### 1.2 Content panel
- White (`--bg-surface`) on light / `--bg-surface` on dark, **rounded top-left 16px**,
  floating on `--bg-window` — the signature "card on greige" look from wisper-flow.
- Internal padding: `32` top, `40` sides (page header), `24` between blocks.

---

## 2. Left sidebar (width 218; collapses to 64)

```
[Khonjel ▣]  ............... brand (logo glyph + wordmark)
─────────────────────────
 ◻ Home                      ← primary nav (40h rows, 8 gap icon↔label)
 ▤ Insights
 ▢ Dictionary
 ✄ Snippets
 Tt Style
 ⇄ Transforms
 ▭ Scratchpad
─────────────────────────
 (flex spacer)
 ┌─────────────────────┐
 │ Engine status card  │     ← NEW (replaces quota nag)
 │ Local · Qwen3.5 4B  │
 │ ● ready             │
 └─────────────────────┘
─────────────────────────
 ◑ Invite your team   (P2)
 ⚙ Settings        [•]
 ? Help
```

- **Background:** `--bg-window` (blends with chrome; no hard divider). Content panel’s
  rounded corner provides the visual separation.
- **Selected item:** raised white pill + `--shadow-card` (light) / `--bg-surface-2` fill
  (dark) + `--text-primary` bold + accent-tinted glyph.
- **Hover:** subtle bg tint.
- **Collapsed (64):** icons only, centered; labels become hover tooltips; brand → glyph.
- **Engine status card:** shows active STT/LLM archetype + model + health dot
  (ready/downloading/error). Click → Settings ▸ Language Models. Honest, dismissible to
  a one-line strip. **This is the deliberate replacement for the references' word-quota
  upsell card.**
- **Footer rows:** plain icon+label; Settings carries an attention dot when setup is
  incomplete (mirrors the references' "1" badge, but only when actionable).

---

## 3. Content layouts (three archetypes)

### 3.1 Timeline + rail (Home)
```
│ H1 greeting                                         ┌─ right rail (260) ─┐ │
│ ── date divider ──                                  │ stat: total words  │ │
│ [time]  transcript ...........................      │ stat: wpm          │ │
│ [time]  transcript (with bullets)                   │ stat: streak       │ │
│ ...                                                 │ Voice Profile      │ │
```
- Left column flexes; right rail fixed `260`, sticky, `24` gutter.
- Below `~1100px` window width, the rail collapses under the timeline (stacked).

### 3.2 Library page (Dictionary / Snippets / Style / Transforms)
```
│ H2 title                                            [Add new] (right)      │
│ ── tabs (All | Personal | Shared) ─────────  [search][sort][refresh]      │
│ ┌ promo banner (dismissible) ───────────────────────────────────────────┐ │
│ └────────────────────────────────────────────────────────────────────────┘ │
│ ┌ entries container ──────────────────────────────────────────────────────┐│
│ │ entry row ............................................. [edit][delete]   ││
│ │ entry row                                                               ││
│ └─────────────────────────────────────────────────────────────────────────┘│
```
- Title + primary action share the header row. Tabs + icon cluster share the second row.
- Promo banner appears until dismissed (persisted). Entries are a single card of
  divided rows. Transforms uses a 3-up **card grid** instead of rows.

### 3.3 Dashboard grid (Insights)
```
│ H2 title                tabs(Usage|Voice)                 [Share]          │
│ ┌ card ┐ ┌ card ┐ ┌ card ┐         (row 1: 3 stat cards)                   │
│ ┌ wide card ──────┐ ┌ wide card ─────┐  (row 2: 2 cards: bars + heatmap)   │
```
- 12-col grid; row-1 cards span 4 each; row-2 cards span 6 each. Reflows to 1-col
  below `~900px`.

---

## 4. Settings layout (modal)
```
        ┌──────────────────────────────────────────────────────┐
        │ ┌ nav rail (190) ┐ │ content pane (scroll)        [✕] │
        │ │ GENERAL         │ │  H2 page title                  │
        │ │  General        │ │  ── section header ──           │
        │ │  Hotkeys        │ │  ┌ card: setting rows ┐         │
        │ │  Appearance     │ │  └────────────────────┘         │
        │ │ AI MODELS       │ │  ...                            │
        │ │  ...            │ │                                 │
        │ │ v1.0 · ☁        │ │                                 │
        │ └────────────────┘ │                                 │
        └──────────────────────────────────────────────────────┘
```
- Modal `~960×680`, centered, `--radius-lg`, `--shadow-modal`, backdrop 50–60% black.
- Nav rail `190`, content pane fills the rest and scrolls independently.
- `×` top-right of the pane; `Esc` closes. Footer in rail: version + health/sync dot.

---

## 5. Responsive & window sizing
| Window width | Behaviour |
|---|---|
| ≥ 1200 | Full: sidebar 218 + content + right rail |
| 1000–1199 | Right rail collapses under content (Home); dashboards 2-col |
| 820–999 | Sidebar collapses to 64 (icons); dashboards 1-col |
| < 820 (min 720) | Compact: sidebar overlay drawer; single column |
- **Min window:** 720×560. Settings modal shrinks to fit with internal scroll.
- The **Khonjel Bar** and overlays are independent top-level windows, unaffected by
  Main Window size.

---

## 6. Density & theming
- **Density** (Appearance): Comfortable (default) / Compact (row heights −8, padding −4).
- Light/dark swap only changes tokens; the grid, sizes, and structure are identical.
- All cards use `--shadow-card`; modals `--shadow-modal`; floating surfaces `--shadow-pop`.

---

## 7. Shell acceptance checklist
- [ ] Title bar: left (collapse, account) + right (bell, min/max/close), draggable center.
- [ ] Sidebar: brand, 7 primary items, engine status card, 3 footer items; selected pill; collapsible to 64.
- [ ] Content panel: rounded top-left, floats on `--bg-window`.
- [ ] Three content archetypes (timeline+rail, library, dashboard) implemented per grid.
- [ ] Settings modal: rail + scrolling pane + ×/Esc + version footer.
- [ ] Responsive rules at each breakpoint; min 720×560.
