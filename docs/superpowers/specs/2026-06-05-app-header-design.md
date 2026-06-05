# App Header — Design Spec

**Date:** 2026-06-05
**Status:** Built (reflects the as-shipped design after live iteration)
**Area:** `src/App.tsx`, `src/components/` (`Header`, `InfoPage`, `infoContent`), `src/components/Toolbar.tsx`, `src/index.css`

## Goal

Replace the bare brand-only header with a real, minimalist header section so the
app no longer drops the user straight from the splash into a spreadsheet. The
header gives the product an identity and a home for top-level navigation (About,
Log) while the draft actions (Mock, Draft) live on the status row just below it.

## Layout (as built)

```
┌──────────────────────────────────────────────────────────────────────┐
│ [🕐] On The Clock.                                   About    Log      │   header band
│      draft day cheat sheet                                             │
├──────────────────────────────────────────────────────────────────────┤   ← separator line
│ QB 3 (1)  RB 8 (2)  WR 11 (3)  TE 2 (1) …            [ Mock ] [ Draft ]│   counts row
│ … toolbar / board …                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

- **Header band:** stopwatch logo + `<Wordmark/>` ("On The Clock.") with a small
  **"draft day cheat sheet"** tagline centered beneath, on the left. **About** and
  **Log** are underlined nav links pushed to the right (no divider). A 1px
  bottom border fences the band off as its own zone. Brand click keeps the
  refresh + replay-intro behavior (and returns to the board view).
- **Counts row (below the line):** the existing `drafted-summary` position counts
  on the left; **Mock** and **Draft** buttons right-aligned. `Mock` is a plain
  button that enters mock mode (moved out of the Toolbar settings menu). `Draft`
  is **grayed out / inactive** (live-draft mode isn't built) — no tooltip, no
  action on click.
- **About / Log are separate pages**, not modals. Clicking a nav link swaps the
  board for a full-page view (`view: "board" | "about" | "log"` state); the
  header stays visible and each page has a "← Back to board" link. Real routing
  can replace the view swap later.

## Components

- **`Header`** (`src/components/Header.tsx`) — presentational header band: brand
  (logo + `Wordmark` + tagline), spacer, About/Log links. Props: `onBrandClick`,
  `onAbout`, `onLog`. No Mock/Draft (those live on the counts row in `App`).
- **`InfoPage`** (`src/components/InfoPage.tsx`) — full-page view for the About /
  Log destinations. Props: `page: "about" | "log"`, `onBack`. About shows a
  `Wordmark` title + `AboutContent`; Log shows **no page title** — just the
  Road Map and Change Log section headers from `LogContent`.
- **`infoContent`** (`src/components/infoContent.tsx`) — `AboutContent` (what the
  app is + benefits) and `LogContent`:
  - **Road Map** section — planned work (e.g. live draft mode, guided onboarding,
    smarter mocks).
  - **Change Log** section — dated, feature-level entries (new/removed features),
    newest first, format `Mon D, YYYY`. Hand-maintained; minor styling/bug tweaks
    are intentionally omitted. (See the `otc-log-maintenance` working note: keep
    this current whenever a feature ships.)
- **Mock relocated:** removed the `🏈 Mock draft…` item and the `onMock` prop
  from `Toolbar`; the entry point is now the counts-row `Mock` button.
- **App shell:** `.app` is a flex column with `min-height` so the footer sticks
  to the bottom on every view. The footer (`.otc-footer`) has a top border and
  the portfolio link (`kendalladkins.dev`, utm-tagged).

## Styling

New classes in `src/index.css`, reusing existing tokens (`--otc-ink`,
`--otc-accent`, `--muted`, `--border`, `--panel`): header band + bottom border,
`.otc-tagline`, `.otc-navlink` (underline → orange on hover), `.otc-btn` /
`.otc-btn-soon` (grayed inactive Draft), `.drafted-summary-counts` /
`.drafted-summary-actions`, the `.otc-page*` page styles, `.otc-log*` /
`.otc-changelog` log styles, and the sticky `.otc-footer`. No new color tokens.

## Testing

- `Header` renders brand/tagline/About/Log and fires each handler (incl. brand).
- `InfoPage` renders the About copy and the Log (Change Log) copy, and fires
  `onBack`.
- `infoContent` smoke-renders About + Log.
- Toolbar no longer renders a Mock item (and no longer requires `onMock`).
- Full suite + `tsc --noEmit` + `pnpm build` green.

## Out of scope

- The actual live-draft mode and its in-draft tools (separate future spec; it's
  the first Road Map item and what the grayed Draft button will become).
- Real routing/URLs for About/Log (currently a view swap).
- A dynamic changelog data source (the Change Log is hand-maintained copy).
