# Tier breaks as sortable items — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make tier breaks first-class draggable items so players push them (instead of breaks staying fixed while neighbors jump), and persist empty tiers.

**Architecture:** Each tier list gains `breaks: { id, above }[]` as the source of truth for tier boundaries (`above` = players above the break; duplicates = empty tiers). `player.tier` becomes a derived mirror, recomputed by a single `tiersFromBreaks()` on every change. A new pure module `src/lib/tierBreaks.ts` owns all break logic and is fully unit-tested. The board is threaded through the reducer as a `BoardState = { players, breaks }`. In the UI, breaks render as sortable rows (passive in Phase 1 — they shift when pushed but have no drag handle yet), interleaved with players in one `SortableContext`. This is **Phase 1** of the spec; Phase 2 (grab-and-drag a break directly) is deferred.

**Tech Stack:** React 19 + TypeScript, dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`), Vitest 4 + @testing-library/react, Vite.

**Spec:** `docs/superpowers/specs/2026-06-04-tier-breaks-as-sortable-items-design.md`

---

## File Structure

- **Create** `src/lib/tierBreaks.ts` — pure break logic (types + functions). The heart.
- **Create** `src/lib/tierBreaks.test.ts` — unit tests for the above.
- **Modify** `src/types.ts` — add `Break` type; add `breaks?: Break[]` to `TierList`.
- **Modify** `src/state/reducer.ts` — thread `BoardState` ({players, breaks}); rewire `move` / `splitTier` / `removeTier`; drop `moveIntoNewTier`.
- **Modify** `src/lib/storage.ts` — migrate `breaks` (derive from `tier` when absent) on load.
- **Modify** `src/components/PlayerTable.tsx` — interleaved item list; render `TierBreakRow`; new `onDragEnd`.
- **Modify** `src/components/TierGroup.tsx` — add `TierBreakRow` (sortable, no listeners); remove `EmptyTier`.
- **Modify** `src/App.tsx` — build the interleaved display from `breaks`; delete `emptyTiers` state + `onRemoveEmpty`; simplify `onAddTier`.
- **Modify** `src/lib/ranking.test.ts` — remove/relocate `moveAndRetier` & `moveIntoNewTier` tests superseded by `tierBreaks`.

---

## Conventions for every task

- Run a single test file with: `npx vitest run src/lib/tierBreaks.test.ts`
- Run the whole suite with: `npx vitest run`
- Typecheck with: `npx tsc --noEmit`
- Commit messages: short imperative, ending with the co-author trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```

---

## Task 0: Commit the existing arrayMove fix as a baseline

**Files:**

- Modify (already changed, uncommitted): `src/lib/ranking.ts`, `src/lib/ranking.test.ts`

- [ ] **Step 1: Confirm the suite is green**

Run: `npx vitest run`
Expected: PASS (the `moveAndRetier` arrayMove down-drag tests pass).

- [ ] **Step 2: Commit**

```bash
git add src/lib/ranking.ts src/lib/ranking.test.ts
git commit -m "Fix tier down-drag snap-back via arrayMove

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

This locks the interim fix; the new model supersedes it but the tests inform it.

---

## Task 1: Add the `Break` type and `TierList.breaks`

**Files:**

- Modify: `src/types.ts`

- [ ] **Step 1: Add the `Break` type and field**

In `src/types.ts`, add above the `TierList` interface:

```typescript
// A tier boundary. `above` = how many players sit above this break in the
// overall-rank ordering. Sorted by `above`; duplicates = an empty tier. The
// stable `id` keeps duplicate breaks distinct and is the dnd-kit sortable id.
export interface Break {
  id: string;
  above: number;
}
```

Then inside `interface TierList`, add after `board: Player[];`:

```typescript
  breaks?: Break[]; // tier boundaries; source of truth. Absent => derive from tier.
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (field is optional; no consumers yet).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "Add Break type and TierList.breaks field

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `tierBreaks.ts` — derive tiers + migrate (TDD)

**Files:**

- Create: `src/lib/tierBreaks.ts`
- Test: `src/lib/tierBreaks.test.ts`

Helper used in tests below — put at the top of the test file:

```typescript
import { describe, it, expect } from "vitest";
import type { Player } from "../types";
import { breaksFromTiers, tiersFromBreaks } from "./tierBreaks";

// Minimal players: only id/overallRank/tier matter here.
function P(id: string, rank: number, tier: number): Player {
  return {
    id,
    name: id,
    position: "RB",
    team: "FA",
    overallRank: rank,
    byeWeek: null,
    tier,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  } as Player;
}
```

- [ ] **Step 1: Write failing tests for `breaksFromTiers` + `tiersFromBreaks`**

```typescript
describe("breaksFromTiers", () => {
  it("emits one break at each tier boundary (above = index of first player)", () => {
    const players = [P("a", 1, 1), P("b", 2, 1), P("c", 3, 2), P("d", 4, 3)];
    const breaks = breaksFromTiers(players);
    expect(breaks.map((b) => b.above)).toEqual([2, 3]);
    expect(breaks.every((b) => typeof b.id === "string" && b.id)).toBe(true);
  });

  it("returns no breaks for a single tier", () => {
    expect(breaksFromTiers([P("a", 1, 1), P("b", 2, 1)])).toEqual([]);
  });
});

describe("tiersFromBreaks", () => {
  it("derives tier = 1 + count(above <= index)", () => {
    const players = [P("a", 1, 9), P("b", 2, 9), P("c", 3, 9), P("d", 4, 9)];
    const breaks = [
      { id: "x", above: 2 },
      { id: "y", above: 3 },
    ];
    const out = tiersFromBreaks(players, breaks);
    expect(out.map((p) => p.tier)).toEqual([1, 1, 2, 3]);
  });

  it("counts empty tiers in the numbering (duplicate above)", () => {
    const players = [P("a", 1, 1), P("b", 2, 1)];
    const breaks = [
      { id: "x", above: 1 },
      { id: "y", above: 1 },
    ];
    // a is above both breaks (tier 1); b is below both (tier 3); tier 2 empty.
    expect(tiersFromBreaks(players, breaks).map((p) => p.tier)).toEqual([1, 3]);
  });

  it("round-trips: breaksFromTiers then tiersFromBreaks preserves contiguous tiers", () => {
    const players = [P("a", 1, 1), P("b", 2, 2), P("c", 3, 2), P("d", 4, 3)];
    const out = tiersFromBreaks(players, breaksFromTiers(players));
    expect(out.map((p) => p.tier)).toEqual([1, 2, 2, 3]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/tierBreaks.test.ts`
Expected: FAIL ("Failed to resolve import './tierBreaks'").

- [ ] **Step 3: Implement `tierBreaks.ts` (this part)**

```typescript
import type { Break, Player } from "../types";
import { uid } from "./uid";

function ordered(players: Player[]): Player[] {
  return players.slice().sort((a, b) => a.overallRank - b.overallRank);
}

function sortedBreaks(breaks: Break[]): Break[] {
  return breaks.slice().sort((a, b) => a.above - b.above);
}

// Migration: derive breaks from existing contiguous `tier` values. A break sits
// wherever the tier number increases, at `above` = index of the first player of
// the new tier. Legacy boards have no empty tiers, so this is lossless for them.
export function breaksFromTiers(players: Player[]): Break[] {
  const list = ordered(players);
  const breaks: Break[] = [];
  for (let i = 1; i < list.length; i++) {
    if ((list[i].tier ?? 0) !== (list[i - 1].tier ?? 0)) {
      breaks.push({ id: uid(), above: i });
    }
  }
  return breaks;
}

// Derive each player's `tier` from breaks: tier(i) = 1 + count(above <= i).
// Empty tiers (duplicate `above`) are counted, so a player's tier may skip a
// number — that's the intended "lossy mirror" (player.tier can't hold an empty
// tier). Returns a new players array (same order) with `tier` written.
export function tiersFromBreaks(players: Player[], breaks: Break[]): Player[] {
  const sorted = sortedBreaks(breaks);
  return ordered(players).map((p, i) => ({
    ...p,
    tier: 1 + sorted.filter((b) => b.above <= i).length,
  }));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/tierBreaks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tierBreaks.ts src/lib/tierBreaks.test.ts
git commit -m "Add tierBreaks: derive tiers from breaks + migration

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `tierBreaks.ts` — `buildItems` (TDD)

**Files:**

- Modify: `src/lib/tierBreaks.ts`, `src/lib/tierBreaks.test.ts`

`buildItems` produces the interleaved dnd item list. An item is a player or a
break, each identified by id.

- [ ] **Step 1: Write failing tests**

Add to the test file's imports: `buildItems, type Item`. Then:

```typescript
describe("buildItems", () => {
  const players = [P("a", 1, 1), P("b", 2, 1), P("c", 3, 2)];

  it("interleaves breaks before the player at their `above` index", () => {
    const items = buildItems(players, [{ id: "x", above: 2 }]);
    expect(items).toEqual<Item[]>([
      { kind: "player", id: "a" },
      { kind: "player", id: "b" },
      { kind: "break", id: "x" },
      { kind: "player", id: "c" },
    ]);
  });

  it("emits a top break (above 0) before all players", () => {
    const items = buildItems(players, [{ id: "t", above: 0 }]);
    expect(items[0]).toEqual({ kind: "break", id: "t" });
  });

  it("emits a trailing break (above = N) after all players", () => {
    const items = buildItems(players, [{ id: "z", above: 3 }]);
    expect(items[items.length - 1]).toEqual({ kind: "break", id: "z" });
  });

  it("keeps duplicate breaks adjacent (empty tier)", () => {
    const items = buildItems(players, [
      { id: "x", above: 2 },
      { id: "y", above: 2 },
    ]);
    const ids = items.map((i) => i.id);
    expect(ids).toEqual(["a", "b", "x", "y", "c"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/tierBreaks.test.ts`
Expected: FAIL ("buildItems is not exported").

- [ ] **Step 3: Implement `buildItems`**

Append to `src/lib/tierBreaks.ts`:

```typescript
export type Item =
  | { kind: "player"; id: string }
  | { kind: "break"; id: string };

// Interleave players and breaks into one ordered dnd list. Breaks with the same
// `above` keep their sorted order (stable, so duplicates stay adjacent).
export function buildItems(players: Player[], breaks: Break[]): Item[] {
  const list = ordered(players);
  const sorted = sortedBreaks(breaks);
  const items: Item[] = [];
  let b = 0;
  const flushBreaksAt = (idx: number) => {
    while (b < sorted.length && sorted[b].above === idx) {
      items.push({ kind: "break", id: sorted[b].id });
      b++;
    }
  };
  for (let i = 0; i < list.length; i++) {
    flushBreaksAt(i);
    items.push({ kind: "player", id: list[i].id });
  }
  flushBreaksAt(list.length); // trailing breaks
  return items;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/tierBreaks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tierBreaks.ts src/lib/tierBreaks.test.ts
git commit -m "Add buildItems: interleave players and breaks for dnd

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `tierBreaks.ts` — `applyDrag` (TDD, the core behavior)

**Files:**

- Modify: `src/lib/tierBreaks.ts`, `src/lib/tierBreaks.test.ts`

`applyDrag` reproduces the dnd-kit preview: `arrayMove` over the interleaved
list, then recompute player order + each break's `above` from the new positions.

- [ ] **Step 1: Write failing tests for the user's exact cases**

Add import `applyDrag`. Then:

```typescript
describe("applyDrag", () => {
  // [a b][break][c d]  (above=2)
  const players = [P("a", 1, 1), P("b", 2, 1), P("c", 3, 2), P("d", 4, 2)];
  const breaks = () => [{ id: "x", above: 2 }];

  it("dragging the last player of tier1 onto the break moves the BREAK up, not the player order", () => {
    // drag b (idx1) onto break x => break slides above b; players unchanged.
    const out = applyDrag(players, breaks(), "b", "x");
    expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(out.breaks.map((bk) => bk.above)).toEqual([1]); // now above the 2nd player
    // b and c are both tier 2 now; a is tier 1 alone.
    expect(out.players.map((p) => p.tier)).toEqual([1, 2, 2, 2]);
  });

  it("dragging the first player of tier2 onto the break moves the break DOWN, player order unchanged", () => {
    // drag c (idx2) onto break x => break slides below c.
    const out = applyDrag(players, breaks(), "c", "x");
    expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(out.breaks.map((bk) => bk.above)).toEqual([3]);
    expect(out.players.map((p) => p.tier)).toEqual([1, 1, 1, 2]);
  });

  it("dragging a player fully past a neighbor reorders the players", () => {
    // drag a (idx0) onto c => a lands below c (arrayMove down).
    const out = applyDrag(players, breaks(), "a", "c");
    expect(out.players.map((p) => p.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("dragging the only player out of its tier leaves an empty tier (adjacent breaks)", () => {
    // [a][x][b][y][c]: tiers a|b|c. Drag b up onto x => b joins tier1, tier2 empty.
    const three = [P("a", 1, 1), P("b", 2, 2), P("c", 3, 3)];
    const br = [
      { id: "x", above: 1 },
      { id: "y", above: 2 },
    ];
    const out = applyDrag(three, br, "b", "x");
    expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    const aboves = out.breaks.map((bk) => bk.above).sort((m, n) => m - n);
    expect(aboves).toEqual([2, 2]); // both breaks now sit above c => empty tier
  });

  it("is a no-op when active === over", () => {
    const out = applyDrag(players, breaks(), "a", "a");
    expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/tierBreaks.test.ts`
Expected: FAIL ("applyDrag is not exported").

- [ ] **Step 3: Implement `applyDrag`**

Append to `src/lib/tierBreaks.ts`:

```typescript
import { reassignOverallRanks } from "./ranking";

function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const copy = arr.slice();
  const [el] = copy.splice(from, 1);
  copy.splice(to, 0, el);
  return copy;
}

export interface BoardState {
  players: Player[];
  breaks: Break[];
}

// Reproduce the dnd-kit drag preview over the interleaved list, then rebuild
// player order + each break's `above` from the final positions. Works for both
// player-onto-player (reorders players) and player-onto-break (slides the break).
export function applyDrag(
  players: Player[],
  breaks: Break[],
  activeId: string,
  overId: string,
): BoardState {
  if (activeId === overId)
    return { players: ordered(players), breaks: sortedBreaks(breaks) };
  const items = buildItems(players, breaks);
  const from = items.findIndex((it) => it.id === activeId);
  const over = items.findIndex((it) => it.id === overId);
  if (from === -1 || over === -1)
    return { players: ordered(players), breaks: sortedBreaks(breaks) };

  const moved = arrayMove(items, from, over);
  const byId = new Map(players.map((p) => [p.id, p]));
  const breakById = new Map(breaks.map((b) => [b.id, b]));

  const newPlayers: Player[] = [];
  const newBreaks: Break[] = [];
  let seenPlayers = 0;
  for (const it of moved) {
    if (it.kind === "player") {
      newPlayers.push(byId.get(it.id)!);
      seenPlayers++;
    } else {
      newBreaks.push({ id: it.id, above: seenPlayers });
      // keep any extra fields (none today) via breakById if needed
      void breakById;
    }
  }
  const ranked = reassignOverallRanks(newPlayers);
  return {
    players: tiersFromBreaks(ranked, newBreaks),
    breaks: sortedBreaks(newBreaks),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/tierBreaks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tierBreaks.ts src/lib/tierBreaks.test.ts
git commit -m "Add applyDrag: arrayMove over interleaved player+break list

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: `tierBreaks.ts` — `insertBreak` + `removeBreak` (TDD)

**Files:**

- Modify: `src/lib/tierBreaks.ts`, `src/lib/tierBreaks.test.ts`

These back the `+` (split / add empty tier) and `✕` (remove tier) controls.

- [ ] **Step 1: Write failing tests**

Add imports `insertBreak, removeBreak`. Then:

```typescript
describe("insertBreak", () => {
  const players = [P("a", 1, 1), P("b", 2, 1), P("c", 3, 1)];

  it("inserts a break above the given player (splitting a tier)", () => {
    const out = insertBreak(players, [], "b"); // above index 1
    expect(out.breaks.map((bk) => bk.above)).toEqual([1]);
    expect(out.players.map((p) => p.tier)).toEqual([1, 2, 2]);
  });

  it("inserting above a player that already starts a tier creates an empty tier", () => {
    const withBreak = [{ id: "x", above: 1 }];
    const out = insertBreak(players, withBreak, "b"); // duplicate above=1
    expect(out.breaks.map((bk) => bk.above).sort()).toEqual([1, 1]);
    expect(out.players.map((p) => p.tier)).toEqual([1, 3, 3]);
  });
});

describe("removeBreak", () => {
  it("removes the break by id and re-derives tiers", () => {
    const players = [P("a", 1, 1), P("b", 2, 2)];
    const out = removeBreak(players, [{ id: "x", above: 1 }], "x");
    expect(out.breaks).toEqual([]);
    expect(out.players.map((p) => p.tier)).toEqual([1, 1]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/tierBreaks.test.ts`
Expected: FAIL ("insertBreak is not exported").

- [ ] **Step 3: Implement**

Append to `src/lib/tierBreaks.ts`:

```typescript
// Insert a break directly above `abovePlayerId`. If a break already sits there,
// the new (duplicate) break creates an empty tier.
export function insertBreak(
  players: Player[],
  breaks: Break[],
  abovePlayerId: string,
): BoardState {
  const list = ordered(players);
  const idx = list.findIndex((p) => p.id === abovePlayerId);
  if (idx === -1) return { players: list, breaks: sortedBreaks(breaks) };
  const next = sortedBreaks([...breaks, { id: uid(), above: idx }]);
  return { players: tiersFromBreaks(list, next), breaks: next };
}

// Remove a break by id (used by both populated-tier ✕ and empty-tier ✕).
export function removeBreak(
  players: Player[],
  breaks: Break[],
  breakId: string,
): BoardState {
  const next = sortedBreaks(breaks.filter((b) => b.id !== breakId));
  return { players: tiersFromBreaks(players, next), breaks: next };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/tierBreaks.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/tierBreaks.ts src/lib/tierBreaks.test.ts
git commit -m "Add insertBreak/removeBreak for split and remove-tier controls

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Thread `breaks` through the reducer

**Files:**

- Modify: `src/state/reducer.ts`

The active list now carries `breaks`. We thread `{ players, breaks }` into a new
`boardReducer`, keeping `rankingReducer` for player-only actions.

- [ ] **Step 1: Update the `Action` union**

In `src/state/reducer.ts`, replace these lines in the `Action` type:

```typescript
  | { type: "move"; activeId: string; overId: string }
  | { type: "moveTier"; fromTier: number; toTier: number }
  | { type: "splitTier"; playerId: string }
  | { type: "removeTier"; tier: number }
  | { type: "moveIntoNewTier"; playerId: string; beforeId: string | null }
```

with:

```typescript
  | { type: "move"; activeId: string; overId: string }
  | { type: "splitTier"; playerId: string }
  | { type: "removeBreak"; breakId: string }
```

(`moveTier` and `moveIntoNewTier` are removed — `moveTier` returns in Phase 2;
`moveIntoNewTier` is replaced by dropping onto a break.)

- [ ] **Step 2: Add `boardReducer` and update imports**

Replace the `rankingReducer` import block and the `move`/tier cases. First, update the imports at the top:

```typescript
import {
  reassignOverallRanks,
  normalizeTiers,
  orderByAdp,
} from "../lib/ranking";
import {
  applyDrag,
  insertBreak,
  removeBreak,
  breaksFromTiers,
  tiersFromBreaks,
  type BoardState,
} from "../lib/tierBreaks";
```

Then replace the whole `rankingReducer` function with a `boardReducer` operating on `BoardState`:

```typescript
export function boardReducer(state: BoardState, action: Action): BoardState {
  const { players, breaks } = state;
  switch (action.type) {
    case "setAll": {
      const sorted = action.players
        .slice()
        .sort((a, b) => a.overallRank - b.overallRank);
      const norm = normalizeTiers(withByeWeeks(reassignOverallRanks(sorted)));
      return { players: norm, breaks: breaksFromTiers(norm) };
    }
    case "add": {
      // New player appends at the end (below all breaks); breaks unchanged.
      const next = reassignOverallRanks([...players, action.player]);
      return { players: tiersFromBreaks(next, breaks), breaks };
    }
    case "update":
      return {
        players: players.map((p) =>
          p.id === action.id ? { ...p, ...action.patch } : p,
        ),
        breaks,
      };
    case "remove": {
      // Decrement `above` for breaks below the removed player's index.
      const ordered = players
        .slice()
        .sort((a, b) => a.overallRank - b.overallRank);
      const idx = ordered.findIndex((p) => p.id === action.id);
      if (idx === -1) return state;
      const next = reassignOverallRanks(
        ordered.filter((p) => p.id !== action.id),
      );
      const shifted = breaks
        .map((b) => (b.above > idx ? { ...b, above: b.above - 1 } : b))
        .filter((b) => b.above <= next.length);
      return { players: tiersFromBreaks(next, shifted), breaks: shifted };
    }
    case "move":
      return applyDrag(players, breaks, action.activeId, action.overId);
    case "splitTier":
      return insertBreak(players, breaks, action.playerId);
    case "removeBreak":
      return removeBreak(players, breaks, action.breakId);
    case "merge": {
      const merged = withByeWeeks(mergeFetched(players, action.fetched));
      return { players: merged, breaks: breaksFromTiers(merged) };
    }
    case "applyAdp": {
      const next = applyFfcAdp(players, action.ffc);
      return { players: next, breaks: breaksFromTiers(next) };
    }
    default:
      return state;
  }
}
```

Note: `merge` and `applyAdp` re-derive breaks from `tier` (they reorder/extend
the list on a data refresh, where preserving empty tiers is not expected).

- [ ] **Step 3: Update `normalize` and the default delegation**

Replace `normalize` helper:

```typescript
function normalizeBoard(t: { board: Player[]; breaks?: Break[] }): {
  board: Player[];
  breaks: Break[];
} {
  const board = withByeWeeks(t.board);
  const breaks = t.breaks ?? breaksFromTiers(normalizeTiers(board));
  return { board: tiersFromBreaks(board, breaks), breaks };
}
```

Add `import type { Break } from "../types";` to the type imports.

In `normalizeActiveList`, replace the `board: normalize(t.board)` mapping:

```typescript
function normalizeActiveList(l: League): League {
  const activeId = activeTierList(l).id;
  return {
    ...l,
    tierLists: l.tierLists.map((t) => {
      if (t.id !== activeId) return t;
      const n = normalizeBoard(t);
      return { ...t, board: n.board, breaks: n.breaks };
    }),
  };
}
```

In the `leaguesReducer` **default** case, thread breaks:

```typescript
    default: {
      const current = state.leagues.find((l) => l.id === state.currentId);
      if (!current) return state;
      const active = activeTierList(current);
      const before: BoardState = {
        players: active.board,
        breaks: active.breaks ?? breaksFromTiers(active.board),
      };
      const after = boardReducer(before, action);
      if (after.players === before.players && after.breaks === before.breaks)
        return state;
      return mapLeague(state, state.currentId, (l) => ({
        ...l,
        tierLists: l.tierLists.map((t) =>
          t.id === active.id
            ? { ...t, board: after.players, breaks: after.breaks }
            : t,
        ),
        updatedAt: Date.now(),
      }));
    }
```

- [ ] **Step 4: Fix `addTierList` / `duplicateTierList` to carry breaks**

In `addTierList`, replace the board line and tier-list object:

```typescript
const id = uid();
const seeded = withByeWeeks(orderByAdp(seed as unknown as Player[]));
const breaks = breaksFromTiers(normalizeTiers(seeded));
const board = tiersFromBreaks(seeded, breaks);
return mapLeague(state, current.id, (l) => ({
  ...l,
  tierLists: [...l.tierLists, { id, name, board, breaks }],
  activeTierListId: id,
}));
```

In `duplicateTierList`, include `breaks: source.breaks` in the new tier list:

```typescript
        tierLists: [
          ...l.tierLists,
          { id, name, board, breaks: source.breaks, valueFlags: source.valueFlags },
        ],
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. If `ranking.ts` still exports now-unused `moveAndRetier`, `moveTier`, `splitTierAt`, `removeTier`, `moveIntoNewTier`, that is fine for now (Task 9 cleans their tests; leaving the functions is harmless). The PlayerTable still references old actions — that breaks the build until Task 7/8. If so, proceed to Task 7 before re-running tsc.

- [ ] **Step 6: Run the reducer-touching tests**

Run: `npx vitest run src/state`
Expected: failures only where tests reference removed actions (`moveTier`, `moveIntoNewTier`) or expect old `move` behavior — these are addressed in Task 9. Do not commit yet; commit after Task 7 compiles the app.

---

## Task 7: Render breaks as sortable rows in `PlayerTable`

**Files:**

- Modify: `src/components/PlayerTable.tsx`
- Modify: `src/components/TierGroup.tsx`

- [ ] **Step 1: Add `TierBreakRow` to `TierGroup.tsx`**

Replace the entire `EmptyTier` component in `src/components/TierGroup.tsx` with a
sortable break row (and drop the `useDroppable` import):

```typescript
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";

interface TierBreakRowProps {
  breakId: string;
  displayTier: number;
  count: number; // players in the tier BELOW this break
  colSpan: number;
  editable: boolean;
  onRemove: (breakId: string) => void;
}

// A tier boundary that participates in the sortable list. Phase 1: it shifts
// when players are dragged past it, but has no drag handle of its own (no
// listeners/attributes), so it can't be grabbed directly yet.
export function TierBreakRow({
  breakId,
  displayTier,
  count,
  colSpan,
  editable,
  onRemove,
}: TierBreakRowProps) {
  const { setNodeRef, transform, transition } = useSortable({ id: breakId });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <tr ref={setNodeRef} style={style} className="tier-divider">
      <td colSpan={colSpan}>
        <div className="tier-banner">
          <span className="tier-label">Tier {displayTier}</span>
          <span className="tier-count">
            {count > 0
              ? ` · ${count} player${count === 1 ? "" : "s"}`
              : " · empty"}
          </span>
          {editable && (
            <span className="tier-tools">
              <button
                className="tier-remove"
                title="Remove this tier break"
                onClick={() => onRemove(breakId)}
              >
                ✕
              </button>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
```

Keep the existing `TierHeader` export only if still referenced; after Task 8 the
first tier has no break above it, so its header is rendered separately. To keep
Tier 1's label, retain `TierHeader` as-is (it renders the non-sortable top
label). The interleaved render (next step) uses `TierHeader` for the implicit
top tier and `TierBreakRow` for every actual break.

- [ ] **Step 2: Rewrite `PlayerTable` to render an interleaved list**

In `src/components/PlayerTable.tsx`, change the `DisplayGroup` model and render.
Replace the `DisplayGroup` type:

```typescript
import type { Item } from "../lib/tierBreaks";

// Render model: an ordered list of player rows and break rows, already
// interleaved and labelled with a running display-tier number.
export type DisplayRow =
  | {
      kind: "player";
      player: Player;
      displayTier: number;
      startsTier: boolean;
      stripeIndex: number;
    }
  | { kind: "break"; breakId: string; displayTier: number; count: number };
```

Replace the `display: DisplayGroup[]` prop with `rows: DisplayRow[]`, and the
`orderedIds`/`onRemoveEmpty` props. New props block:

```typescript
interface Props {
  columns: ColumnDef[];
  grouped: boolean;
  rows: DisplayRow[];
  itemIds: string[]; // combined player + break ids, in order, for SortableContext
  flat: Player[];
  positionalRanks: Record<string, number>;
  vorById: Record<string, number | null>;
  projById: Record<string, number | null>;
  lastById: Record<string, number | null>;
  sortKey: SortKey | null;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  dispatch: Dispatch<Action>;
  reorderable: boolean;
  onAddTier: (playerId: string, startsTier: boolean) => void;
}
```

Replace `onDragEnd` (remove the `empty:` branch — drops onto break ids now flow
straight through `move`):

```typescript
const onDragEnd = (e: DragEndEvent) => {
  const active = String(e.active.id);
  const over = e.over ? String(e.over.id) : null;
  if (!over || active === over) return;
  dispatch({ type: "move", activeId: active, overId: over });
};
```

Replace the `<SortableContext items={orderedIds}>` body with:

```tsx
<SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
  {grouped
    ? rows.map((r) =>
        r.kind === "break" ? (
          <TierBreakRow
            key={r.breakId}
            breakId={r.breakId}
            displayTier={r.displayTier}
            count={r.count}
            colSpan={colSpan}
            editable={reorderable}
            onRemove={(breakId) => dispatch({ type: "removeBreak", breakId })}
          />
        ) : (
          renderRow(r.player, r.startsTier, r.stripeIndex % 2 === 1)
        ),
      )
    : flat.map((p, i) => renderRow(p, false, i % 2 === 1))}
</SortableContext>
```

Update imports: `import { TierHeader, TierBreakRow } from "./TierGroup";` and
delete the now-unused `TierBlock` function. Replace the top `TierHeader` usage:
the running display also needs Tier 1's label (no break precedes it). Emit it as
the first row when grouped and the first row is a player:

```tsx
{
  grouped && rows[0]?.kind === "player" && (
    <TierHeader
      tier={1}
      displayTier={rows[0].displayTier}
      count={
        rows.filter(
          (r, i) =>
            /* players in tier 1 */ r.kind === "player" &&
            r.displayTier === rows[0]!.displayTier,
        ).length
      }
      colSpan={colSpan}
      editable={false}
      onRemove={() => {}}
    />
  );
}
```

(Tier 1's header is non-removable, matching the old `tier !== 1` rule.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors now point only to `App.tsx` (which still passes `display`/
`onRemoveEmpty`). Fix in Task 8.

---

## Task 8: Build the interleaved display in `App.tsx`

**Files:**

- Modify: `src/App.tsx`

- [ ] **Step 1: Delete the session empty-tier state**

Remove these (around lines 187, 298-306, 341-342):

- `const [emptyTiers, setEmptyTiers] = useState<string[]>([]);`
- the `useEffect` that prunes `emptyTiers` against `firstIds`.
- `const onRemoveEmpty = ...`

- [ ] **Step 2: Replace `groups`/`display` with a breaks-driven row model**

Replace the `groups` memo and the `display` memo (lines ~277-329) with:

```tsx
const activeBreaks = activeList.breaks ?? [];

const { rows, itemIds } = useMemo(() => {
  if (!grouped) return { rows: [] as DisplayRow[], itemIds: [] as string[] };
  const items = buildItems(renderPlayers, activeBreaks);
  const byId = new Map(renderPlayers.map((p) => [p.id, p]));
  const rows: DisplayRow[] = [];
  const itemIds: string[] = [];
  let displayTier = 1;
  let stripeIndex = 0;
  let firstInTier = true;
  // count players in the tier that each break closes (the tier above it)
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    itemIds.push(it.id);
    if (it.kind === "break") {
      // players in the tier BELOW this break (until next break or end)
      let count = 0;
      for (let j = i + 1; j < items.length && items[j].kind === "player"; j++)
        count++;
      displayTier += 1;
      rows.push({ kind: "break", breakId: it.id, displayTier, count });
      firstInTier = true;
      stripeIndex = 0;
    } else {
      const player = byId.get(it.id)!;
      rows.push({
        kind: "player",
        player,
        displayTier,
        startsTier: firstInTier,
        stripeIndex,
      });
      firstInTier = false;
      stripeIndex += 1;
    }
  }
  return { rows, itemIds };
}, [grouped, renderPlayers, activeBreaks]);
```

Add the import: `import { buildItems } from "./lib/tierBreaks";` and
`import { type DisplayRow } from "./components/PlayerTable";` (rename the old
`DisplayGroup` import). Ensure `activeList` (the active `TierList`) is in scope;
if the component only has `renderPlayers`, derive `activeList` from the league
state where `renderPlayers` is derived.

- [ ] **Step 3: Simplify `onAddTier`**

Both the "+" actions become a single `splitTier` (insert a break above the
player). Replace `onAddTier`:

```tsx
const onAddTier = (playerId: string) => {
  dispatch({ type: "splitTier", playerId });
};
```

Update the `cells.tsx` call site if it passes `startsTier`: the `onAddTier`
signature in `CellCtx` / `PlayerRow` / `cells.tsx` drops the second arg. Change
`onAddTier: (playerId: string, startsTier: boolean) => void;` to
`onAddTier: (playerId: string) => void;` in `src/components/board/cells.tsx`,
`src/components/PlayerRow.tsx`, and `src/components/PlayerTable.tsx`, and update
the `onClick` in `cells.tsx` to `ctx.onAddTier(p.id)`.

- [ ] **Step 4: Update the `<PlayerTable>` props**

Replace `display={display}` with `rows={rows}` and add `itemIds={itemIds}`;
remove `onRemoveEmpty={onRemoveEmpty}`.

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npx vitest run`
Expected: only `ranking.test.ts` / reducer tests referencing removed actions
fail — fixed next.

---

## Task 9: Clean up superseded tests + dead code

**Files:**

- Modify: `src/lib/ranking.test.ts`
- Modify: `src/lib/ranking.ts`
- Modify: `src/state/reducer.ts` (if any stragglers)

- [ ] **Step 1: Remove superseded ranking tests**

In `src/lib/ranking.test.ts`, delete the `describe` blocks for `moveAndRetier`,
`moveIntoNewTier`, `moveTier`, `splitTierAt`, and `removeTier` (their behavior
now lives in `tierBreaks.test.ts`). Keep `reassignOverallRanks`, `orderByAdp`,
`groupByTier`, `normalizeTiers`, `sortPlayers`, `computePositionalRanks`,
`defaultSortAsc` tests.

- [ ] **Step 2: Remove dead exports from `ranking.ts`**

Delete `moveAndRetier`, `moveTier`, `splitTierAt`, `removeTier`,
`moveIntoNewTier`, and the now-unused private `toBlocks`/`fromBlocks`/`arrayMove`
if nothing else references them. Keep `reassignOverallRanks`, `orderByAdp`,
`groupByTier`, `normalizeTiers`, `computePositionalRanks`, `sortPlayers`,
`defaultSortAsc`. Verify with: `grep -rn "moveAndRetier\|moveIntoNewTier\|moveTier\|splitTierAt\|removeTier" src/` returns nothing outside the deletions.

- [ ] **Step 3: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS (whole suite green).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Wire breaks through reducer and board; render breaks as sortable rows

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Manual verification in the browser

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (note the localhost URL).

- [ ] **Step 2: Verify the reported bug is fixed**

With the default list, drag the 12th player down just below the Tier 2 break.
Expected: the **break** moves above the 12th player; the 13th player does NOT
move. Drag the 13th player up above the break: the break moves below it; the
12th does not move.

- [ ] **Step 3: Verify empty tiers persist**

Click `+` on a player to split a tier, then drag the only player out of a
one-player tier. Expected: an "empty" tier row remains. Reload the page
(`localStorage`-backed). Expected: the empty tier is still there.

- [ ] **Step 4: Verify create/remove controls**

`+` inserts a break (splits / adds empty tier). `✕` on a break removes it and
merges the tiers. Tier 1 has no removable break above it.

- [ ] **Step 5: Report results** in the conversation (no commit needed).

---

## Self-Review (completed by plan author)

- **Spec coverage:** breaks-as-data (Tasks 1,2,6) · pure `tierBreaks` module
  (Tasks 2-5) · passive sortable break rows / Phase 1 (Task 7) · interleaved
  display replacing `emptyTiers`/`EmptyTier`/`moveIntoNewTier` (Tasks 7,8) ·
  migration (Task 2 `breaksFromTiers`, Task 6 `normalizeBoard`) · tier synced as
  derived mirror (`tiersFromBreaks` everywhere players change) · empty-tier drop
  (Task 4 test) · `+`/`✕` controls (Tasks 5,7,8). Phase 2 (grab-and-drag) is
  explicitly out of scope.
- **Type consistency:** `Break = {id, above}`, `Item = {kind, id}`,
  `BoardState = {players, breaks}`, `DisplayRow` used consistently across
  Tasks 1-8. Reducer action renamed `moveIntoNewTier`/`removeTier(tier)` →
  `removeBreak(breakId)`; `moveTier` removed (Phase 2).
- **Open risk:** the Tier 1 top-label rendering in Task 7 Step 2 is the
  fiddliest bit (a non-break header for the implicit first tier). If it proves
  awkward, an alternative is to always render a non-removable break-like header
  for tier 1 driven by the display walk in Task 8 instead of special-casing in
  PlayerTable. Flagged for the executor.
