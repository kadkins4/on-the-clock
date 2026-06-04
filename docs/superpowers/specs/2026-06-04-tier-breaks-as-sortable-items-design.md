# Tier breaks as sortable items — design

Date: 2026-06-04
Branch: `fix-tier-dnd`

## Problem

Tier breaks today are not real participants in the drag list. They render as
fixed `<tr class="tier-divider">` header rows; only players are sortable items.
Consequences the user reported:

1. **Down-drag snap-back** (fixed already via `arrayMove` in `moveAndRetier`):
   dragging a player down within a tier could reinsert it above the neighbor =
   same slot = snap-back.
2. **Breaks don't move; neighbors do.** Dragging #12 down past the tier-2 break
   leaves the break fixed and shifts #13 up in the preview. The user wants the
   opposite: the **break** moves up above #12, and **#13 never moves** until the
   player is dragged fully past it.

Root cause for (2): a break can't shift during a drag because it isn't an item
in the `SortableContext`. And the current model can't persist an **empty tier**
(two adjacent breaks, or a break above all / below all players) because tiers
are inferred from `player.tier` — a number that has no representation for "a
break with nothing under it".

## Decision (from brainstorming)

- **Allow empty tiers** (they persist and sit there until filled or deleted).
- Ship in two phases: **Phase 1 = players push breaks** (breaks become passive
  sortable items that shift correctly), **Phase 2 = grab-and-drag a break
  directly** (deferred — small once Phase 1 lands).

## Approach: breaks as data

### Data model

`TierList` gains `breaks?: { id: string; above: number }[]`. Each break has a
**stable `id`** (a `uid()`, survives reorders) and `above` = **how many players
sit above it** in the overall-rank ordering. Sorted by `above` ascending,
**duplicates allowed**:

- `[{id:b1,above:12},{id:b2,above:24}]` → breaks after the 12th and 24th (3 tiers).
- two breaks with the same `above` (e.g. both 12) → an **empty tier** between
  players 12 and 13; the stable ids keep the two distinct (removable/draggable
  individually).
- `above: 0` → empty top tier. `above: N` → trailing empty tier.

The stable id is required to disambiguate duplicate (empty-tier) breaks and is
the dnd-kit sortable id a break needs for Phase 2 grab-and-drag.

`board: Player[]` stays a clean list ordered by `overallRank`. Everything that
reads players (CSV export, mock draft, ranking math, future PDF) is unaffected.

`player.tier` becomes **derived** from `breaks` for display/back-compat:
`tier(i) = 1 + count(breaks ≤ i)` for the player at 0-based index `i`. We keep
writing a synced `tier` onto each player on every breaks change so existing
consumers and tests keep working, but **`breaks` is the source of truth** for
boundaries.

### Migration

On load / normalize: if `breaks` is absent, derive it from existing
`player.tier` boundaries (a break wherever consecutive players change tier).
This converts every saved board transparently. Going forward `breaks` is
authoritative; `tier` is recomputed from it.

### Pure logic module: `src/lib/tierBreaks.ts`

Owns all break logic, fully unit-tested (TDD). Functions:

- `breaksFromTiers(players): number[]` — migration helper.
- `tiersFromBreaks(players, breaks): Player[]` — write derived `tier` onto each
  player (contiguous 1..N, including empty tiers in the numbering).
- `buildItems(players, breaks): Item[]` — interleaved list of player ids and
  break ids for the `SortableContext`. Each break contributes its stable
  `break.id` directly (no positional derivation needed).
- `applyDrag(players, breaks, activeId, overId): { players, breaks }` —
  `arrayMove` over the combined item list, then recompute `players`' order +
  the `breaks` counts from the new combined order. This supersedes
  `moveAndRetier` (player-only) and `moveIntoNewTier` (empty-slot drop).
- `insertBreak(players, breaks, abovePlayerId)` — the `+` split control.
- `removeBreak(players, breaks, breakId|tier)` — the `✕` control; also used to
  discard an empty tier.

### dnd / component changes

- `SortableContext` `items` = combined ids from `buildItems`.
- New `TierBreakRow` renders the divider via `useSortable({ id: breakId })` so
  it shifts in the preview. **Phase 1: attach `setNodeRef` + transform style but
  NO `listeners`/`attributes`** — the break moves when pushed but can't be
  grabbed yet. (Phase 2 adds a handle with listeners.)
- `onDragEnd`: when active is a player, run `applyDrag`; dispatch one new action
  (`reorderBoard` or reuse `move`) that stores `{ board, breaks }`.
- Remove the session-only empty-tier mechanism: `emptyTiers` state, `EmptyTier`
  droppable, `moveIntoNewTier` action, `empty:` drop ids. Empty tiers are now
  real persisted breaks rendered by `TierBreakRow`.

### Reducer / storage

- `TierList` carries `breaks`. The board-mutating actions update `board` +
  `breaks` together and keep `player.tier` synced via `tiersFromBreaks`.
- `normalize` derives `breaks` when absent.
- Persistence: `breaks` is serialized with the tier list; load migrates.

## Testing

- `tierBreaks.test.ts` is the core: migration round-trip, tiers-from-breaks
  (incl. empty tiers / top / trailing), `applyDrag` for the user's exact cases:
  - `[#12][break][#13]`, drag #12 down one step → `[break][#12][#13]` (break up,
    #13 unmoved).
  - drag #13 up one step → `[#12][#13][break]` ... etc.
  - dragging fully past a neighbor moves the player, not just the break.
  - empty-tier creation (drag the only player out of a tier) and persistence.
- Keep `ranking.test.ts` green; fold the `moveAndRetier` arrayMove tests into
  the new model where they still apply.

## Phasing

- **Phase 1 (this spec):** data model + `tierBreaks.ts` + passive sortable
  breaks + reducer/storage/migration. Players push breaks correctly; empty tiers
  persist; `+`/`✕` create/remove breaks.
- **Phase 2 (deferred):** drag handle on `TierBreakRow` (attach listeners) →
  grab-and-drag a break directly. `moveTier` (currently unwired) may back this.

## Open questions

1. ~~Stable break ids.~~ **RESOLVED:** breaks are `{ id, above }[]` with a
   stable `uid()` id.
2. **RESOLVED: keep `tier` synced.** `breaks` is the sole source of truth and
   the only thing any action mutates; `player.tier` is _always_ recomputed by a
   single `tiersFromBreaks()` on every change and never hand-edited (this is the
   only writer, which prevents drift). Upside: existing consumers untouched, and
   the future printable view can label tier numbers per player even without
   physical divider rows. `tier` is a lossy mirror (can't express empty tiers) —
   acceptable since it's derived, and empty tiers just render no print label.
3. **RESOLVED (required by "allow empty tiers"):** `applyDrag` must handle
   dropping onto an empty-tier region. Break rows are real drop targets, so
   dropping onto a break id that sits between two breaks lands the player in
   that empty tier.
