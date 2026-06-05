# Editable Rank — Design Spec

**Date:** 2026-06-05
**Status:** Approved (design)
**Area:** `src/lib/tierBreaks.ts`, `src/state/reducer.ts`, `src/components/board/cells.tsx` (+ new `RankCell`)

## Goal

Let the user re-rank a player by typing a number. Double-click a player's `#`
(overall rank) cell, type a new rank, and the player moves to that overall
position — everyone between the old and new spot shifts by one to fill the gap.
A numeric counterpart to the existing drag-to-reorder.

## Behavior

- Double-click a `#` cell → it becomes a small number input, pre-filled with the
  current rank and text-selected. **Enter** (or blur / click-away) commits;
  **Escape** cancels with no change.
- Commit moves the player to the typed **overall** rank and shifts the players
  between the old and new positions by one:
  - 1 → 7: players 2–7 each move up one; the player lands at 7.
  - 7 → 1: the player goes to 1; players 1–6 each move down one.
- Available in **every view** (default tier view, column-sorted, or filtered).
  The number always means overall rank, so editing while filtered to e.g. RBs
  still sends the player to that rank in the full list.
- **Clamp / no-op:** values out of range clamp to 1…N; an empty/invalid value or
  the unchanged rank does nothing.
- **Tiers:** tier bands are position-based (`breaks`) and stay fixed — the moved
  player joins whichever tier band contains the destination rank. Same outcome
  as dragging today.

## Components

### `moveToRank(players, breaks, id, rank)` — `src/lib/tierBreaks.ts`

Pure function returning `BoardState`. Orders players by `overallRank`, finds the
player's index, computes `to = clamp(rank - 1, 0, N - 1)`, `arrayMove`s the
player to `to`, then `reassignOverallRanks` + `tiersFromBreaks` (breaks
unchanged). Returns the original state unchanged if the id is missing or the
position doesn't change. Mirrors the existing `applyDrag` tail.

### Reducer action `setRank` — `src/state/reducer.ts`

`{ type: "setRank"; id: string; rank: number }` → returns
`{ ...state, ...moveToRank(players, breaks, id, rank) }` (players + breaks).
Sits next to the existing `move` (drag) case.

### `RankCell` — `src/components/board/RankCell.tsx`

Replaces the one-line `rank` cell renderer
(`rank: (p) => <td className="rank num">{p.overallRank}</td>`). Owns local edit
state:

- Not editing: renders `<td className="rank num">` showing `overallRank`, with a
  `title="Double-click to edit rank"` and an `onDoubleClick` that enters edit.
- Editing: renders a controlled `<input type="number">` (autofocus, select-on-
  focus). Enter/blur → parse int; if valid and changed, `dispatch({ type:
"setRank", id, rank })`; Escape → exit without dispatch.

The `rank` renderer becomes `(p, ctx) => <RankCell player={p} dispatch={ctx.dispatch} />`
(`ctx.dispatch` already exists on `CellCtx`).

### Styling — `src/index.css`

A small rule for `.rank input` (compact, right-aligned, matches the cell width).
Reuse existing tokens. No new colors.

## Data flow

double-click → local edit state → Enter/blur → `dispatch(setRank)` → reducer →
`moveToRank` → `reassignOverallRanks` + `tiersFromBreaks` → new players/breaks →
re-render with updated `#`s and order.

## Testing

- **`moveToRank`** (`tierBreaks.test.ts`): down-shift (1→7), up-shift (7→1),
  clamp above N and below 1, no-op on same rank and on unknown id, and that
  `breaks` are unchanged so a moved player adopts the destination tier.
- **reducer `setRank`** (`reducer.test.ts`): dispatching reorders and re-ranks.
- **`RankCell`** (`RankCell.test.tsx`): double-click shows the input with the
  current rank; Enter dispatches `setRank` with the parsed number; Escape
  dispatches nothing.

## Out of scope

- Changing how drag-to-reorder or tier breaks work.
- Keyboard-only entry into edit mode (double-click is the affordance, matching
  the app's existing interactions); revisit if needed.
