# Mock Draft Board Grid — Design

**Date:** 2026-06-01
**Status:** Approved (brainstorming complete)

## Goal

Make the mock draft readable as it runs. Today the mock "flies by" — you can't see who's been picked or what's coming. Add two presentational pieces to the existing mock screen: an always-on **pick strip** centered on the current pick, and a toggleable **draft board grid** (teams × rounds) that slides up as a bottom sheet.

## Constraints

- **Zero engine changes.** Both additions are pure derive-and-render from `MockState` (`picks`, `order`, `pool`, `settings`). The mock remains fully **non-destructive** — never touches the real board, reducer, or `localStorage`.
- Follow existing mock patterns: headless logic in `src/lib/mock/`, presentational React in `src/components/mock/`.
- TDD the pure helpers; verify the visual pieces live in the browser (Playwright). Animation is visual-only, not unit-tested.

## Feature 1 — Pick strip (always-on, bottom of on-the-clock screen)

A horizontal row of pick cards centered on the current pick.

- **Default window:** 4 previous · current · 2 next.
- **Scrollable:** the user can scrub horizontally through the entire draft; the strip **auto-snaps back to the current pick** when a new pick is made.
- **Completed pick card:** pick number (`1.04`), player name, position. Background **color-coded by position**.
- **Current pick card:** highlighted/outlined ("on the clock").
- **Upcoming pick card:** pick number + team label only (e.g. `1.07 · Team 7`), muted — no player yet (bots haven't picked).

## Feature 2 — Draft board overlay (toggle → slide-up bottom sheet)

A "Draft board" toggle button (with tap feedback) reveals the full grid.

- The grid **slides up from the bottom** (animated bottom sheet, from where the pick strip sits), covering most of the screen.
- It stops short, leaving the **top ~4–5 available players peeking** above it. The peek shows the **full row** (rank, name, position color-coded, team, ADP), is **scrollable** up/down, and is **draftable** when the user is on the clock.
- **Grid layout:** teams across the top, rounds down the left side. Each cell is a position-color-coded card showing player name + position + pick number. **Snake order respected** (even rounds read right→left). Future (un-drafted) cells are blank.
- **Highlighting:** the user's team column is highlighted; the latest pick is subtly emphasized.
- The slide-up animation is a **prototype-and-revisit** detail — build it, look at it, tune if it feels off.

## Defaults (locked, tunable later)

- **Position colors** (shared by strip and grid for consistency): QB red · RB green · WR blue · TE orange · K purple · DST slate.
- **Bot auto-pick delay:** 350ms → **800ms** (slower so the board is readable). Tune live.
- **Overlay default state:** board hidden; toggle opens to peek + grid.

## Components

Small, focused units:

- `src/lib/mock/board.ts` — **pure helpers (TDD):**
  - `formatPick(overall, teams)` → `"1.04"` (1-based round + 2-digit slot; handles rollover `1.12 → 2.01`).
  - `buildBoardGrid(state)` → a rounds × teams matrix of cells `{ overall, label, playerId, name, position } | null`, laid out in **draft (snake) order** so column = team, row = round.
  - `pickWindow(state, before, after)` → the strip's ordered slice of cells (completed players, current, upcoming team-only slots), clamped at draft start/end.
- `src/components/mock/PickStrip.tsx` — presentational; renders `pickWindow`, scrollable, auto-centers on current.
- `src/components/mock/DraftBoardGrid.tsx` — presentational; renders `buildBoardGrid` + the peeking available list; owns the slide-up bottom-sheet animation.
- `src/components/mock/MockDraft.tsx` — wires both in + the toggle state. Bot delay bumped to 800ms here.
- Position color tokens + `.mock-strip` / `.mock-board` styles in `src/index.css`.

## Testing

- **TDD `board.ts`:**
  - `formatPick`: round rollover (`12, teams=12 → "1.12"`; `13 → "2.01"`), slot zero-padding.
  - `buildBoardGrid`: matrix dimensions; snake row direction (round 2 reversed); cell content for drafted vs empty; user-column index.
  - `pickWindow`: default 4-before/2-after window; clamping at the very start (no negatives) and end of draft; current-pick position in the slice.
- **Components:** verified live in the browser end-to-end (start mock → strip updates → toggle board → peek scroll → draft from peek → non-destructive board after exit). Animation judged by eye.

## Out of scope (parked in `WeDev/FF Draft Helper.md`)

League settings editor (superflex/bench), tier/helper-sheet view in the mock, pick timer + auto-pick-on-timeout, bot run-chasing, writeback diff to the real board.
