# Draggable tier break (Phase 2) — design

Date: 2026-06-04
Branch: `fix-tier-dnd`
Builds on: `2026-06-04-tier-breaks-as-sortable-items-design.md` (Phase 1)

## Goal

Let the user grab a tier break (the "Tier N" bar) and drag it through the player
list. Only the bar moves; the players it crosses change tier membership. Nobody
reorders. This avoids dragging players out one-by-one to resize a tier.

Example: Jonathan Taylor and Derrick Henry sit at the end of Tier 1 with the
Tier 2 bar directly below them. Dragging the Tier 2 bar up past those two makes
both of them Tier 2 — they don't move, the bar does.

## Why this is small

Phase 1 already made breaks first-class sortable items and made
`applyDrag(players, breaks, activeId, overId)` **symmetric**: it does an
`arrayMove` over the interleaved player+break list and recomputes each break's
`above` from the final positions. When the active item is a _break_, the players
keep their order and only the dragged break's `above` changes — exactly this
feature. No new data logic is required.

## What changes

### 1. Make the break bar grabbable (`src/components/TierGroup.tsx`)

`TierBreakRow` already calls `useSortable({ id: breakId })` but (Phase 1,
passive) spreads no `attributes`/`listeners`. Phase 2:

- Pull `attributes` and `listeners` from `useSortable` and spread them onto a
  drag-handle element (the `⠿` grip) inside the bar — mirroring how `PlayerRow`
  passes drag props to its `.drag-handle`.
- Apply the dragging style already used for players: `opacity: isDragging ? 0.5
: 1` plus the existing transform/transition.
- The `✕` remove button stays a separate control (its `onClick` must not start a
  drag — keep it outside the handle, as today).
- Add a visible affordance: the grip shows `cursor: grab` and reads as draggable.

### 2. Drag end — no change (`src/components/PlayerTable.tsx`)

`onDragEnd` already dispatches `{ type: "move", activeId, overId }` for any
sortable item. When `activeId` is a break id, the reducer routes to `applyDrag`,
which handles it. Verified end-to-end, no code change expected here.

### 3. Reducer — no change (`src/state/reducer.ts`)

The `move` action already calls `applyDrag`. No change; covered by a test.

## Data behavior (already implemented, now exercised for break-active)

- Drag a break up past N players → its `above` decreases by N; those N players
  fall into the tier below the break.
- Drag a break to the very top → `above: 0` → empty Tier 1 (allowed).
- Drag a break onto/just past another break → two breaks share an `above` →
  empty tier between them (allowed).
- Drag a break below all players → trailing empty tier (allowed).
- Tier 1's top label is the non-sortable `topHeader` (no break above it), so it
  is not draggable — correct; there is no boundary there to move.

## Testing

- `tierBreaks.test.ts`: add `applyDrag` cases with a **break** as `activeId`:
  - break dragged up past two players → `above` drops by 2; player order
    unchanged; the two crossed players' derived `tier` increases.
  - break dragged onto the first player (top) → `above: 0`.
  - break dragged onto another break → adjacent breaks (empty tier).
- `reducer.test.ts`: a `move` action whose `activeId` is a break id updates
  `breaks` (and keeps `players` order) on the active list.
- Manual: in the running app, grab a Tier bar's grip and drag it up/down; the
  crossed players re-tier without moving; reload persists the new boundary.

## Out of scope

- Whole-tier **swap/reorder** (moving an entire tier block among other tiers).
  Parked by user decision; revisit later if it proves useful.
- Touch/keyboard drag refinements beyond what `PointerSensor` already gives.
