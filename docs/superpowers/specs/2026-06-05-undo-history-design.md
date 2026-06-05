# Undo History — Design Spec

**Date:** 2026-06-05
**Status:** Approved (design)
**Area:** `src/state/undoable.ts` (new), `src/state/useRankings.ts`, `src/App.tsx`, `src/components/Toolbar.tsx`

## Goal

A general, multi-step undo so a user can reverse recent board edits (rank
changes, drag reorders, tier splits/merges, notes, flags, draft status) — a
safety net for "I just made a huge mistake." No redo (yet).

## Architecture — a history wrapper around the reducer

`useRankings` wraps `leaguesReducer` in a higher-order reducer that holds
`{ past: LeaguesState[]; present: LeaguesState }`. The wrapper classifies each
action by `type`:

- **Undoable** (record history, then apply): board-content edits delegated to
  `boardReducer` — `setAll`, `add`, `remove`, `update`, `move`, `setRank`,
  `splitTier`, `removeBreak`, `merge`, `applyAdp`.
- **Clearing** (apply, then reset `past` to `[]`): context changes — `setLeagues`
  (refresh), `switchLeague`, `addLeague`, `duplicateLeague`, `deleteLeague`,
  `switchTierList`, `addTierList`, `duplicateTierList`, `deleteTierList`. Undo
  never crosses into a different board.
- **Pass-through** (apply, leave `past` untouched): everything else —
  `renameLeague`, `updateLeagueSettings`, `setLeagueColumns`, `renameTierList`,
  `setDefaultTierList`, `setListValueFlags`.

**No-op guard:** `leaguesReducer` returns the _same_ state reference when an
action doesn't change anything (e.g. `setRank` to the current rank). The wrapper
checks `next === present` and, when unchanged, records no history entry.

**Bounds & persistence:** `past` is capped at **25** entries (oldest dropped)
and lives **in memory only** — it resets on reload. Only `present` is persisted
to localStorage (`saveLeagues(state.present)`), exactly as today. The undo trail
is intentionally ephemeral.

## Components

### `withHistory` — `src/state/undoable.ts`

```ts
type HistoryState<S> = { past: S[]; present: S };
type HistoryAction = { type: "undo" };

function withHistory<S, A extends { type: string }>(
  reducer: (s: S, a: A) => S,
  opts: { undoable: Set<string>; clear: Set<string>; limit: number },
): (h: HistoryState<S>, a: A | HistoryAction) => HistoryState<S>;
```

Logic:

- `undo`: if `past` empty → unchanged; else pop the last past entry as the new
  `present`, drop it from `past`.
- otherwise `next = reducer(present, action)`:
  - `clear.has(type)` → `{ past: [], present: next }`
  - `next === present` (no-op) → return the history state unchanged
  - `undoable.has(type)` → `{ past: [...past, present].slice(-limit), present: next }`
  - else (pass-through) → `{ past, present: next }`

Pure and self-contained — unit-tested with a tiny fake reducer.

### `useRankings` — `src/state/useRankings.ts`

- `useReducer(wrapped, undefined, () => ({ past: [], present: loadLeagues() }))`.
- Effect persists `state.present`.
- Derive `current`/`players` from `state.present`.
- Expose `undo: () => dispatch({ type: "undo" })` and `canUndo: state.past.length > 0`.

### `App.tsx`

- Global `keydown`: on **Cmd/Ctrl+Z** (no Shift) call `undo()` and
  `preventDefault()` — **unless** the focused element is an `input`, `textarea`,
  or contenteditable, in which case do nothing (let the browser's native text
  undo handle it inside the rank/notes field).
- Pass `onUndo`/`canUndo` to `Toolbar`.

### `Toolbar.tsx`

- An **"Undo" button** next to "Clear filters", `disabled` when `!canUndo`,
  `title="Undo last change (⌘Z)"`, `onClick={onUndo}`. Reuses existing toolbar
  button styling.

## Out of scope / unchanged

- **No redo** (easy later: keep a `future` stack).
- The existing **"Undo draft"** bar and the **mock-draft** undo stay as-is —
  separate, contextual, and non-conflicting.

## Testing

- **`withHistory`** (`undoable.test.ts`, fake reducer): undoable action records a
  step; `undo` restores; multi-step undo; depth cap at `limit`; clear-type resets
  `past`; pass-through leaves `past`; a no-op (reducer returns same ref) records
  nothing; `undo` on empty `past` is a no-op.
- **Integration** (`undoable.test.ts`): wrap `leaguesReducer`, dispatch `setRank`,
  then `undo`, and assert the board order is restored.
