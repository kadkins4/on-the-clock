# Mock Control Overhaul + Persistent Mini Board — Design

**Date:** 2026-06-02
**Status:** Draft — awaiting confirmation before planning/build
**Context:** Today the mock draft auto-runs bots on an 800ms timer with a single "Undo" button that immediately gets overwritten by the next bot tick. It's not pausable, can't recover from a stall, and the draft board is a slide-up sheet that's easy to lose. This reworks the mock into a controllable, recoverable draft with an always-visible mini board.

## Goals

1. **Pausable autodraft** — Play / Pause; Resume shown when paused.
2. **Undo that sticks** — Undo pauses the bots and steps back the most recent pick (the player returns to the pool/its tier); click again to keep stepping back.
3. **Edit any past pick** — clicking a made pick (mini board _or_ full board) opens a menu:
   - **Resume from here** — undo every pick up to & including it; that pick goes back on the clock (autodraft paused).
   - **Replace player** — swap who was drafted at that pick.
   - **Undo** — only offered on the single most-recent pick.
4. **Bot-stall fix** — a drained/edge pool can't freeze the draft.
5. **Persistent mini board** — always docked at the bottom (~15% of viewport), visible the whole draft regardless of filters; the eventual controller surface.
6. **No league/settings switching while a mock is active.**

## Engine (pure, TDD) — `src/lib/mock/engine.ts`

Existing `draftPlayer` / `undoLastPick` stay. Add:

- `rewindTo(state, overall): MockState` — drop all picks with `overall >= N` (so pick N is back on the clock). Rebuilds `draftedIds`. `undoLastPick` becomes `rewindTo(state, picks.length)`.
- `replacePick(state, overall, newPlayerId): MockState` — swap the player at pick `overall`; refuse if `newPlayerId` is already drafted (other than at this pick) or not in pool; keep teamIndex/round.
- `botPickId` already returns "" / undefined when the pool is dry — harden callers so a null pick **pauses** instead of looping (the stall fix is mostly in the tick effect, see below).

## State / control — `src/components/mock/MockMode.tsx` + `MockDraft.tsx`

- Add `paused: boolean` to MockMode (component state, not engine). The bot tick effect runs only when `!paused && onClock !== user && pickIsAvailable`. If a bot has no legal pick, set `paused` (stall guard) rather than tick.
- Undo / Resume-from-here / Replace all set `paused = true`.
- Controls in `MockDraft`: **Play/Pause** toggle (Resume label when paused), **Undo** (steps back, repeatable), Exit.

## Pick menu — clicking a made pick

A small popover anchored to the clicked cell (mini board or full grid):

- **Resume from here** → `rewindTo(overall)` + pause.
- **Replace player** → opens a player picker (**OPEN Q1** below) → `replacePick(overall, id)`.
- **Undo** → shown only when `overall === picks.length` → `undoLastPick` + pause.

## Persistent mini board — new `src/components/mock/MiniBoard.tsx`

- Fixed strip docked at viewport bottom, ~15vh, always visible during the draft (replaces the always-on `PickStrip` role, or evolves it). Filters/scroll above don't affect it.
- Shows recent/upcoming picks centered on the current pick; each made pick is clickable → pick menu.
- The full slide-up `DraftBoardGrid` stays as the expand-to-full view; its cells also open the pick menu.
- Available list above shrinks to fit (`100vh - banner - header - miniboard`).

## Block league switch during mock

Mock is full-screen (`App` renders `<MockMode>` and hides the Toolbar/cog), so league switching isn't reachable through the cog today. **OPEN Q2:** Kendall to point at where a league/settings switch is reachable from the mock so we guard the right control (or confirm it's already covered).

## Resolved decisions (2026-06-02)

- **Q1 — Replace-player UX → A (popover):** the pick popover holds an inline search + short list of available players; picking one swaps the slot. (Prototyped both A and B in a live mock; A chosen for speed.)
- **Q2 — League-switch guard → not needed:** confirmed the mock is full-screen and hides the cog, so a league/settings switch isn't reachable mid-draft. No extra guard.
- **Q3 — Mini board → docked pick strip:** a horizontal strip pinned at the bottom (~15vh), always visible. It auto-recenters on the current pick but **pauses that auto-scroll while the user is interacting** (pointer over or keyboard focus), resuming after. The full teams×rounds grid stays in the slide-up sheet; both surfaces open the pick menu.

## Status

Built and live-verified 2026-06-02: engine `rewindTo`/`replacePick` (TDD); pausable autodraft with stall guard; sticky/repeatable Undo; pick popover (resume-from-here / replace / undo-on-latest) on the mini board and full grid; docked interaction-aware mini board.

## Testing

- Engine (TDD): `rewindTo` (boundary N, rebuilds draftedIds, idempotent at end), `replacePick` (valid swap, refuses duplicate/unknown, preserves slot), stall (dry pool → no infinite tick).
- UI live-verify: pause/resume; undo steps back and sticks; click a pick → resume-from-here rewinds; replace swaps; mini board stays docked under filters; mock blocks league switch.
