# App Header — Design Spec

**Date:** 2026-06-05
**Status:** Approved (design), pending build plan
**Area:** `src/App.tsx`, `src/components/` (new `Header`), `src/components/Toolbar.tsx`

## Goal

Replace the bare brand-only header with a real, minimalist header section so the
app no longer drops the user straight from the splash into a spreadsheet. The
header gives the product an identity and a home for top-level actions: About,
Changelog ("Log"), Mock, and Draft.

## Chosen design — "D, ultra-minimal"

A single header row, left-to-right:

```
[🕐] On The Clock.        |  About   Log                    [ Mock ]  [ Draft ]
     draft day cheat sheet
```

- **Brand (left):** the existing stopwatch logo + `<Wordmark/>` ("On The Clock.")
  with a small, centered **"draft day cheat sheet"** tagline directly beneath the
  wordmark. Logo sits tight to the wordmark (small gap, ~5px). Clicking the brand
  keeps today's behavior: refresh data + replay the intro splash (`onBrandClick`).
- **Light vertical divider** separates the brand from the nav links.
- **About · Log:** underlined text links (muted, underline turns accent-orange on
  hover). Each opens a modal.
- **Mock / Draft (right):** two separate buttons. `Mock` is a plain bordered
  button; `Draft` is the filled accent-orange primary (it's the marquee feature).
- The existing **drafted-summary counts row** (`QB 3 (1) …`) stays as its own row
  _below_ the header, unchanged.

Label note: using **"Log"** for now; "Changelog" is a later workshop decision.
Not a blocker — single string.

Faithful mockup served during brainstorming (header-mockups.html), variant "D, refined".

## Components

### `Header` (new) — `src/components/Header.tsx`

Owns the header row. Replaces the inline `<header className="otc-header">` block
currently in `App.tsx`. Props:

- `onBrandClick: () => void` — existing refresh + replay-intro handler.
- `onAbout: () => void` / `onLog: () => void` — open the respective info modal.
- `onMock: () => void` — enter mock mode (relocated, see below).
- `onDraft: () => void` — placeholder for live-draft mode (see below).

Renders brand (logo + `Wordmark` + tagline), divider, About/Log links, spacer,
Mock/Draft buttons. No business logic — pure presentational, handlers passed in.

### `InfoModal` (new) — `src/components/InfoModal.tsx`

One reusable modal for the About and Log content. Props: `title`, `children`,
`onClose`. Dismiss on ✕, backdrop click, and Escape. Reuses the dark panel
styling (`--panel`, `--border`). App holds a single `infoModal: "about" | "log"
| null` state; About/Log links set it, modal renders the matching content.

- **About content:** what the app is + benefits (tiers & targets you control,
  multi-source ADP blend, mock drafts, per-league columns/scoring; no logins,
  data lives in the browser). Static copy.
- **Log content:** a short changelog / roadmap. Static, hand-maintained list for
  now — no data source. (Real changelog plumbing is out of scope.)

### Mock action — relocated

Today Mock is a `🏈 Mock draft…` item inside the Toolbar `SettingsMenu`
(`Toolbar.tsx`). Remove it from the menu; surface it as the header `Mock` button.
The existing `onMock`/`setMockMode(true)` wiring in `App.tsx` is unchanged — only
where the button lives moves. Drop the now-unused `onMock` prop from `Toolbar`.

### Draft action — placeholder

Live-draft mode is **not built yet**. The `Draft` button renders as the primary
CTA but, on click, shows a brief "Live draft mode is coming soon" notice via the
existing `toast` mechanism in `App.tsx`. No new route/mode is created here. This
keeps the button discoverable and reserves its visual slot without faking
functionality.

## Styling

New classes mirroring the mockup, added to `src/index.css`, reusing existing
tokens (`--otc-ink`, `--otc-accent`, `--muted`, `--border`, `--panel`). The
current `.otc-header` rules are extended/replaced. Tagline is small (~10.5px),
letter-spaced, muted, centered under the wordmark. No new color tokens.

## Testing

- `Header` renders brand, tagline, About/Log links, Mock/Draft buttons.
- Clicking About / Log opens `InfoModal` with the right title; Escape/backdrop/✕
  closes it.
- Clicking `Mock` calls `onMock`.
- Clicking `Draft` fires the placeholder notice (no mode change).
- Brand click still calls `onBrandClick`.
- Toolbar no longer renders a Mock item (and no longer requires `onMock`).

## Out of scope

- The actual live-draft mode and its features (separate future spec).
- A real/dynamic changelog or roadmap data source.
- Finalizing the "Log" vs "Changelog" label.

## Open questions (non-blocking)

- "Log" vs "Changelog" wording — deferred.
- Whether Draft's placeholder should be a toast vs a tiny modal — toast assumed.
