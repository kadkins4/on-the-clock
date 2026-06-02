# VOR Column + Mock Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a projections-based Value Over Replacement (VOR) column to the board, plus three mock-draft polish features: a user-only pick timer (auto-pick at zero), run-chasing bots, and a consolidated on-the-clock banner.

**Architecture:** VOR is a pure function over the active board + league roster, fed by ESPN projected points newly parsed from the existing fetch. Mock changes thread recent-pick context into the bot and lift draft status into a single banner component; the pick timer is local mock state that calls the existing draft path.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest (jsdom), existing reducer/mock-engine pure functions.

**Spec:** `docs/superpowers/specs/2026-06-02-vor-and-mock-polish-design.md`

---

## ⚠️ Revision (2026-06-02, during implementation) — projection source

Discovered mid-build: ESPN's **precomputed** projected total (`appliedTotal`) is
sparse — only ~8% of players have it — so the original plan (read `appliedTotal`
into `projPoints`) cannot fill a VOR column. The **raw** projected stat line,
however, is present for ~all offensive players. Per user decision (Option 1), the
implemented design is:

- `Player` gains `projStats?: ProjStats` (raw line: pass/rush/rec yds, TDs, INTs,
  receptions, fumbles, 2pt) **and** keeps `projPoints` as the ESPN-total **fallback**
  for K/DST (null today; auto-fills nearer the season).
- New module `src/lib/projection.ts` → `projectedPoints(player, scoring, tePremium)`
  scores the raw line at the **league's** scoring (resolves the spec's scoring
  caveat). `fetchEspn.ts` exposes `extractProjStats` + `appliedProjTotal` (renamed
  from `projectedPoints`); the seed script mirrors it. Stat ids validated against
  ESPN's PPR totals (skill players within ~1%; e.g. Bijan computed 352 vs ESPN 353).
- `computeVor(players, roster, teams, scoring, tePremium)` uses `projectedPoints`
  for both player value and the positional baselines.

Tasks 1–3 below were implemented in this revised form (committed). Tasks 4–11 are
unchanged **except** the Task 5 `useRankings` call passes `scoring` + `tePremium`
(updated inline). The Task 1–3 code blocks below show the original `appliedTotal`
approach and are kept for history only.

---

## File Structure

- `src/types.ts` — add `projPoints` to `Player`; add `"vor"` to `SortKey`.
- `src/lib/fetchEspn.ts` — parse projected points from ESPN `stats`; carry through `FetchedPlayer` + `mergeFetched`.
- `scripts/fetch-espn.mjs` — same parse; regenerate `src/data/seed.json`.
- `src/lib/vor.ts` (new) — `replacementSlots`, `computeVor`. Pure, tested.
- `src/lib/ranking.ts` — `sortPlayers` gains a `vorById` argument + `"vor"` case.
- `src/state/useRankings.ts` — expose memoized `vorById`.
- `src/App.tsx` — thread `vorById` to sort + table.
- `src/components/Toolbar.tsx` — add VOR sort option.
- `src/components/PlayerTable.tsx` / `src/components/PlayerRow.tsx` — VOR column.
- `src/lib/mock/engine.ts` — `bestAvailableId`; recent-positions wiring into `botPickId`.
- `src/lib/mock/bot.ts` — run-chasing weight bonus.
- `src/components/mock/OnTheClockBanner.tsx` (new) — status/timer/recent-picks/controls.
- `src/components/mock/MockDraft.tsx` — timer state + auto-pick; render banner.
- `src/index.css` — `.col-vor`, banner, timer styles.

---

## Part A — VOR Column

### Task 1: Parse ESPN projected points

**Files:**

- Modify: `src/types.ts`
- Modify: `src/lib/fetchEspn.ts`
- Test: `src/lib/fetchEspn.test.ts`

- [ ] **Step 1: Add the field to `Player`**

In `src/types.ts`, inside `interface Player`, after the `adpSources?` line add:

```ts
  projPoints?: number | null; // ESPN projected season total (default scoring); feeds VOR
```

- [ ] **Step 2: Write the failing test**

Append to `src/lib/fetchEspn.test.ts`:

```ts
import { projectedPoints, mapEspnPlayers } from "./fetchEspn";

describe("projectedPoints", () => {
  it("reads the 2026 projected season total from stats", () => {
    const p = {
      stats: [
        {
          seasonId: 2025,
          statSourceId: 0,
          statSplitTypeId: 0,
          appliedTotal: 300,
        },
        {
          seasonId: 2026,
          statSourceId: 1,
          statSplitTypeId: 0,
          appliedTotal: 287.4,
        },
        {
          seasonId: 2026,
          statSourceId: 1,
          statSplitTypeId: 1,
          appliedTotal: 18,
        },
      ],
    };
    expect(projectedPoints(p)).toBe(287.4);
  });

  it("returns null when no projection is present", () => {
    expect(projectedPoints({})).toBeNull();
    expect(projectedPoints({ stats: [] })).toBeNull();
  });

  it("mapEspnPlayers carries projPoints through", () => {
    const raw = [
      {
        player: {
          id: 1,
          fullName: "Test Back",
          defaultPositionId: 2,
          proTeamId: 12,
          draftRanksByRankType: { PPR: { rank: 1 } },
          ownership: { averageDraftPosition: 1.2 },
          stats: [
            {
              seasonId: 2026,
              statSourceId: 1,
              statSplitTypeId: 0,
              appliedTotal: 290,
            },
          ],
        },
      },
    ];
    expect(mapEspnPlayers(raw)[0].projPoints).toBe(290);
  });
});
```

- [ ] **Step 3: Run it; expect failure**

Run: `npx vitest run src/lib/fetchEspn.test.ts`
Expected: FAIL — `projectedPoints` is not exported.

- [ ] **Step 4: Implement the parse**

In `src/lib/fetchEspn.ts`:

Add to the `FetchedPlayer` interface (after `adp`):

```ts
projPoints: number | null;
```

Add a stats type and extend `EspnPlayer`:

```ts
interface EspnStat {
  seasonId?: number;
  statSourceId?: number; // 0 = actual, 1 = projected
  statSplitTypeId?: number; // 0 = season total
  appliedTotal?: number;
}
```

In `interface EspnPlayer`, add:

```ts
  stats?: EspnStat[];
```

Add the exported helper (above `mapEspnPlayers`):

```ts
// ESPN ships each player's stats array in kona_player_info. The projected
// season total for the draft year is statSourceId 1 (projected), split 0 (full
// season). Returns null when absent (e.g. some K/DST or stale rows).
export function projectedPoints(p: { stats?: EspnStat[] }): number | null {
  const s = p.stats?.find(
    (x) =>
      x.statSourceId === 1 && x.statSplitTypeId === 0 && x.seasonId === SEASON,
  );
  return s && s.appliedTotal != null ? s.appliedTotal : null;
}
```

In `mapEspnPlayers`, in the `out.push({ ... })` object, add after `adp`:

```ts
      projPoints: projectedPoints(p),
```

- [ ] **Step 5: Carry it through `mergeFetched`**

In `mergeFetched`, in the existing-player `.map` return object, add after `adpSources`:

```ts
        projPoints: f.projPoints,
```

In the newcomer `list.splice(...)` object, add after `adpSources: { espn: f.adp }`:

```ts
        projPoints: f.projPoints,
```

- [ ] **Step 6: Run tests; expect pass**

Run: `npx vitest run src/lib/fetchEspn.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types.ts src/lib/fetchEspn.ts src/lib/fetchEspn.test.ts
git commit -m "Parse ESPN projected points for VOR

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 2: Seed script parse + regenerate seed

**Files:**

- Modify: `scripts/fetch-espn.mjs`
- Modify: `src/data/seed.json` (regenerated)

- [ ] **Step 1: Add the parse to the script**

In `scripts/fetch-espn.mjs`, inside the `for (const entry of raw)` loop, in the `players.push({ ... })` object, add after the `adp:` line:

```js
    projPoints: (() => {
      const s = p.stats?.find(
        (x) =>
          x.statSourceId === 1 && x.statSplitTypeId === 0 && x.seasonId === SEASON,
      );
      return s && s.appliedTotal != null ? s.appliedTotal : null;
    })(),
```

- [ ] **Step 2: Regenerate the seed**

Run: `node scripts/fetch-espn.mjs`
Expected: `Wrote NNN players to .../src/data/seed.json`.

> If ESPN is unreachable in this environment, skip the regen — `projPoints` is
> optional, so VOR simply shows "—" on the seeded board until the user runs
> **Fetch players**. Note the skip in the commit and move on; do NOT hand-edit
> seed.json.

- [ ] **Step 3: Sanity-check the seed**

Run: `node -e "const s=require('./src/data/seed.json'); console.log(s.filter(p=>p.projPoints!=null).length, 'of', s.length, 'have projPoints')"`
Expected: a large majority have `projPoints` (K/DST may be null).

- [ ] **Step 4: Commit**

```bash
git add scripts/fetch-espn.mjs src/data/seed.json
git commit -m "Seed projected points for VOR

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 3: VOR computation

**Files:**

- Create: `src/lib/vor.ts`
- Test: `src/lib/vor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/vor.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { computeVor, replacementSlots } from "./vor";
import type { Player, RosterSettings } from "../types";

const roster: RosterSettings = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  K: 1,
  DST: 1,
  bench: 6,
  disabled: [],
};

function rb(id: string, pts: number | null): Player {
  return {
    id,
    name: id,
    position: "RB",
    team: "FA",
    overallRank: 1,
    byeWeek: null,
    tier: null,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
    projPoints: pts,
  };
}

describe("replacementSlots", () => {
  it("adds base starters plus distributed flex by base weight", () => {
    // teams=10: RB base = 10*2 = 20; FLEX total = 10*1 = 10 split across
    // RB/WR/TE by base weight (2/2/1) -> RB gets round(10*2/5)=4 -> 24.
    const slots = replacementSlots(roster, 10);
    expect(slots.RB).toBe(24);
    expect(slots.QB).toBe(10); // 1*10, no flex/superflex share
    expect(slots.K).toBe(10);
  });
});

describe("computeVor", () => {
  it("subtracts the replacement-slot player's points", () => {
    // 4 RBs, slot N=2 (use a tiny roster), baseline = 2nd best (80).
    const small: RosterSettings = { ...roster, RB: 1, FLEX: 0, K: 0, DST: 0 };
    const players = [rb("a", 100), rb("b", 80), rb("c", 60), rb("d", 40)];
    const vor = computeVor(players, small, 2); // RB slot = 2*1 = 2
    expect(vor.a).toBe(20); // 100 - 80
    expect(vor.b).toBe(0);
    expect(vor.c).toBe(-20);
  });

  it("returns null for players or positions without projections", () => {
    const small: RosterSettings = { ...roster, RB: 1, FLEX: 0, K: 0, DST: 0 };
    const players = [rb("a", null), rb("b", 50)];
    const vor = computeVor(players, small, 1);
    expect(vor.a).toBeNull();
  });

  it("skips disabled positions (null baseline)", () => {
    const d: RosterSettings = { ...roster, disabled: ["RB"] };
    const players = [rb("a", 100)];
    expect(computeVor(players, d, 10).a).toBeNull();
  });
});
```

- [ ] **Step 2: Run it; expect failure**

Run: `npx vitest run src/lib/vor.test.ts`
Expected: FAIL — cannot import `./vor`.

- [ ] **Step 3: Implement `src/lib/vor.ts`**

```ts
import type { Player, Position, RosterSettings } from "../types";

const FLEX_POOL: Position[] = ["RB", "WR", "TE"];
const SUPER_POOL: Position[] = ["QB", "RB", "WR", "TE"];
const SCORERS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

// League-wide count of "starter" slots a position fills before a drafter is
// reaching for replacement-level talent: base starters across all teams plus a
// share of FLEX (RB/WR/TE) and SUPERFLEX (QB/RB/WR/TE) weighted by base count.
export function replacementSlots(
  roster: RosterSettings,
  teams: number,
): Record<Position, number> {
  const base: Record<string, number> = {};
  for (const pos of SCORERS) {
    base[pos] = roster.disabled.includes(pos) ? 0 : roster[pos];
  }
  const slots: Record<string, number> = {};
  for (const pos of SCORERS) slots[pos] = teams * base[pos];

  distribute(slots, base, FLEX_POOL, teams * roster.FLEX);
  distribute(slots, base, SUPER_POOL, teams * roster.SUPERFLEX);

  return slots as Record<Position, number>;
}

function distribute(
  slots: Record<string, number>,
  base: Record<string, number>,
  pool: Position[],
  total: number,
): void {
  if (total <= 0) return;
  const sum = pool.reduce((a, p) => a + base[p], 0);
  if (sum <= 0) return;
  for (const p of pool) slots[p] += Math.round((total * base[p]) / sum);
}

// VOR per player id = projected points minus the position's replacement
// baseline (the projPoints of the player at the position's last starter slot).
// null when the player has no projection or the position has no baseline.
export function computeVor(
  players: Player[],
  roster: RosterSettings,
  teams: number,
): Record<string, number | null> {
  const slots = replacementSlots(roster, teams);

  const byPos: Record<string, number[]> = {};
  for (const p of players) {
    if (p.projPoints == null) continue;
    (byPos[p.position] ??= []).push(p.projPoints);
  }
  for (const pos of Object.keys(byPos)) byPos[pos].sort((a, b) => b - a);

  const baseline: Record<string, number | null> = {};
  for (const pos of SCORERS) {
    const pts = byPos[pos];
    const n = slots[pos];
    baseline[pos] =
      !pts || pts.length === 0 || n <= 0
        ? null
        : pts[Math.min(n - 1, pts.length - 1)];
  }

  const out: Record<string, number | null> = {};
  for (const p of players) {
    const b = baseline[p.position];
    out[p.id] =
      p.projPoints == null || b == null ? null : Math.round(p.projPoints - b);
  }
  return out;
}
```

- [ ] **Step 4: Run tests; expect pass**

Run: `npx vitest run src/lib/vor.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/vor.ts src/lib/vor.test.ts
git commit -m "Add VOR computation (projections vs replacement slot)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 4: Sort by VOR

**Files:**

- Modify: `src/types.ts`
- Modify: `src/lib/ranking.ts`
- Test: `src/lib/ranking.test.ts`

- [ ] **Step 1: Add `"vor"` to `SortKey`**

In `src/types.ts`:

```ts
export type SortKey = "overall" | "adp" | "name" | "bye" | "vor";
```

- [ ] **Step 2: Write the failing test**

Append to `src/lib/ranking.test.ts`:

```ts
import { sortPlayers } from "./ranking";

describe("sortPlayers vor", () => {
  const base = {
    position: "RB" as const,
    team: "FA",
    byeWeek: null,
    tier: null,
    adp: null,
    notes: "",
    flag: "none" as const,
    draftStatus: "available" as const,
  };
  it("sorts by VOR descending with nulls last", () => {
    const players = [
      { ...base, id: "a", name: "A", overallRank: 1 },
      { ...base, id: "b", name: "B", overallRank: 2 },
      { ...base, id: "c", name: "C", overallRank: 3 },
    ];
    const vor = { a: 10, b: 50, c: null };
    const out = sortPlayers(players, "vor", true, vor).map((p) => p.id);
    expect(out).toEqual(["b", "a", "c"]);
  });
});
```

- [ ] **Step 3: Run it; expect failure**

Run: `npx vitest run src/lib/ranking.test.ts`
Expected: FAIL — `sortPlayers` ignores the 4th arg / no `"vor"` case.

- [ ] **Step 4: Implement**

In `src/lib/ranking.ts`, change the `sortPlayers` signature and add the case:

```ts
export function sortPlayers(
  players: Player[],
  key: SortKey,
  asc = true,
  vorById?: Record<string, number | null>,
): Player[] {
  const dir = asc ? 1 : -1;
  const cmp = (a: Player, b: Player): number => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "adp":
        return nullableCompare(a.adp, b.adp, dir);
      case "bye":
        return nullableCompare(a.byeWeek, b.byeWeek, dir);
      case "vor":
        // higher VOR is better, so invert dir; nulls sort last regardless
        return nullableCompare(
          vorById?.[a.id] ?? null,
          vorById?.[b.id] ?? null,
          -dir,
        );
      case "overall":
      default:
        return (a.overallRank - b.overallRank) * dir;
    }
  };
  return players.slice().sort(cmp);
}
```

- [ ] **Step 5: Run tests; expect pass**

Run: `npx vitest run src/lib/ranking.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/ranking.ts src/lib/ranking.test.ts
git commit -m "Sort board by VOR (descending, nulls last)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 5: Expose `vorById` + wire sort/toolbar

**Files:**

- Modify: `src/state/useRankings.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/Toolbar.tsx`

- [ ] **Step 1: Compute `vorById` in `useRankings`**

In `src/state/useRankings.ts`:

Change the React import line to include `useMemo`:

```ts
import { useEffect, useMemo, useReducer } from "react";
```

Add the import:

```ts
import { computeVor } from "../lib/vor";
```

After `const current = ...` and before `refresh`, add:

```ts
const players = activeBoard(current);
const vorById = useMemo(
  () =>
    computeVor(
      players,
      current.roster,
      current.teams,
      current.scoring,
      current.tePremium,
    ),
  [players, current.roster, current.teams, current.scoring, current.tePremium],
);
```

Change the returned `players: activeBoard(current),` to `players,` and add `vorById,` to the returned object.

- [ ] **Step 2: Thread it through `App.tsx`**

In `src/App.tsx`, add `vorById` to the `useRankings()` destructure (near `players`, `dispatch`).

Change the `flat` memo (around line 160) to pass `vorById`:

```ts
const flat = useMemo(
  () => (grouped ? [] : sortPlayers(renderPlayers, sortKey!, true, vorById)),
  [grouped, renderPlayers, sortKey, vorById],
);
```

In the `<PlayerTable ... />` JSX (around line 487), add the prop:

```tsx
vorById = { vorById };
```

- [ ] **Step 3: Add the Toolbar option**

In `src/components/Toolbar.tsx`, in the Sort `<select>`, after the `bye` option:

```tsx
<option value="vor">VOR</option>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors (the `PlayerTable` prop will type-error until Task 6 — acceptable; if you want a clean checkpoint, do Task 6 before running this).

- [ ] **Step 5: Commit**

```bash
git add src/state/useRankings.ts src/App.tsx src/components/Toolbar.tsx
git commit -m "Wire VOR through state, sort, and toolbar

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 6: VOR column in the table

**Files:**

- Modify: `src/components/PlayerTable.tsx`
- Modify: `src/components/PlayerRow.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add the prop + header + thread to rows in `PlayerTable.tsx`**

In `interface Props`, add:

```ts
vorById: Record<string, number | null>;
```

Add `vorById` to the destructured params of `PlayerTable({ ... })`.

In `<thead>`, after the `col-adp` header `<th>`, add:

```tsx
<th className="col-vor">VOR</th>
```

In `renderRow`, pass the value:

```tsx
const renderRow = (p: Player, startsTier: boolean) => (
  <PlayerRow
    key={p.id}
    player={p}
    positionalRank={positionalRanks[p.id]}
    vor={vorById[p.id] ?? null}
    draggable={reorderable}
    startsTier={startsTier}
    onAddTier={onAddTier}
    dispatch={dispatch}
  />
);
```

- [ ] **Step 2: Render the cell in `PlayerRow.tsx`**

In `interface Props`, add:

```ts
vor: number | null;
```

Add `vor` to the destructured params of `PlayerRow({ ... })`.

After the ADP `<td>` (the one ending `{player.adp == null ? "" : Number(player.adp.toFixed(1))}</td>`) and before the `bye` `<td>`, add:

```tsx
<td className="vor num">
  {vor == null ? "—" : vor > 0 ? `+${vor}` : String(vor)}
</td>
```

- [ ] **Step 3: Add column CSS**

In `src/index.css`, near the `.col-adp` / `.col-bye` rules, add:

```css
.col-vor {
  width: 3.5rem;
  text-align: right;
}
td.vor {
  font-variant-numeric: tabular-nums;
  color: #9aa4b2;
}
```

- [ ] **Step 4: Typecheck + run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 5: Visual check**

Run: `npm run dev` and confirm the board shows a VOR column with signed numbers, and Sort → VOR orders highest-first. (Or defer to the final verification task.)

- [ ] **Step 6: Commit**

```bash
git add src/components/PlayerTable.tsx src/components/PlayerRow.tsx src/index.css
git commit -m "Add VOR column to the board

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Part C — Run-Chasing Bots

### Task 7: `bestAvailableId` engine helper

**Files:**

- Modify: `src/lib/mock/engine.ts`
- Test: `src/lib/mock/engine.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/mock/engine.test.ts` (reuse the file's existing `League`/mock fixtures; this test builds a minimal state via the existing helpers — match the file's current fixture style):

```ts
import { bestAvailableId } from "./engine";

describe("bestAvailableId", () => {
  it("returns the available player with the lowest overallRank", () => {
    // Build a tiny pool; lower overallRank = better board rank.
    const m = {
      pool: [
        { id: "x", overallRank: 3 },
        { id: "y", overallRank: 1 },
        { id: "z", overallRank: 2 },
      ],
      draftedIds: new Set<string>(["y"]),
    } as unknown as Parameters<typeof bestAvailableId>[0];
    expect(bestAvailableId(m)).toBe("z");
  });
});
```

- [ ] **Step 2: Run it; expect failure**

Run: `npx vitest run src/lib/mock/engine.test.ts`
Expected: FAIL — `bestAvailableId` not exported.

- [ ] **Step 3: Implement in `engine.ts`**

Add after the `available` function:

```ts
// The user's best still-available player by board rank (lowest overallRank).
// Used by the pick timer's auto-pick. Returns "" when nothing is available.
export function bestAvailableId(m: MockState): string {
  let best: Player | null = null;
  for (const p of available(m)) {
    if (!best || p.overallRank < best.overallRank) best = p;
  }
  return best ? best.id : "";
}
```

- [ ] **Step 4: Run tests; expect pass**

Run: `npx vitest run src/lib/mock/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/engine.ts src/lib/mock/engine.test.ts
git commit -m "Add bestAvailableId for timer auto-pick

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 8: Bots chase positional runs

**Files:**

- Modify: `src/lib/mock/bot.ts`
- Modify: `src/lib/mock/engine.ts`
- Test: `src/lib/mock/bot.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/mock/bot.test.ts`:

```ts
import { botPick } from "./bot";
import type { Player } from "../../types";

function mk(id: string, position: Player["position"], rank: number): Player {
  return {
    id,
    name: id,
    position,
    team: "FA",
    overallRank: rank,
    byeWeek: null,
    tier: null,
    adp: rank,
    notes: "",
    flag: "none",
    draftStatus: "available",
  };
}

describe("botPick run-chasing", () => {
  // Two adjacent equal-need players: a WR and an RB. With a WR run in the
  // recent window, the WR should be selected more often across many seeds.
  function shareOfWr(recent: Player["position"][]): number {
    const avail = [mk("wr", "WR", 1), mk("rb", "RB", 2)];
    const needs = {
      base: { WR: 1, RB: 1 },
      flex: 0,
      superflex: 0,
    } as unknown as Parameters<typeof botPick>[1];
    let wr = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const rng = () => (i + 0.5) / N; // deterministic sweep of [0,1)
      if (botPick(avail, needs, 5, rng, recent) === "wr") wr++;
    }
    return wr / N;
  }

  it("raises the running position's selection share", () => {
    const noRun = shareOfWr([]);
    const run = shareOfWr(["WR", "WR", "WR", "WR"]);
    expect(run).toBeGreaterThan(noRun);
  });
});
```

- [ ] **Step 2: Run it; expect failure**

Run: `npx vitest run src/lib/mock/bot.test.ts`
Expected: FAIL — `botPick` takes 4 args, ignores `recent`.

- [ ] **Step 3: Implement run bonus in `bot.ts`**

Add the import at top:

```ts
import type { Player, Position } from "../../types";
```

Add a constant near `MAX_WINDOW`:

```ts
const RUN_BONUS = 1.5; // extra weight per recent pick at a player's position
```

Change the `botPick` signature and weighting:

```ts
export function botPick(
  available: Player[],
  needs: Needs,
  round: number,
  rng: () => number,
  recentPositions: Position[] = [],
): string {
  if (available.length === 0) throw new Error("botPick: no players available");

  const needed = available.filter((pl) => servesNeed(pl.position, needs));
  const ranked = needed.length > 0 ? needed : available;

  const w = Math.min(pickWindowSize(round), ranked.length);
  const window = ranked.slice(0, w);

  // count recent picks per position to bias toward an ongoing run
  const runs: Partial<Record<Position, number>> = {};
  for (const pos of recentPositions) runs[pos] = (runs[pos] ?? 0) + 1;

  // linear decay (top of window heaviest) plus a run bonus for hot positions
  const weights = window.map(
    (pl, i) => w - i + RUN_BONUS * (runs[pl.position] ?? 0),
  );
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < window.length; i++) {
    r -= weights[i];
    if (r < 0) return window[i].id;
  }
  return window[window.length - 1].id;
}
```

- [ ] **Step 4: Pass recent positions from the engine**

In `src/lib/mock/engine.ts`, in `botPickId`, before the `return botPick(...)`:

```ts
const byId = new Map(m.pool.map((pl) => [pl.id, pl]));
const recentPositions = m.picks
  .slice(-6)
  .map((pk) => byId.get(pk.playerId)!.position);
return botPick(available(m), needs, round, rng, recentPositions);
```

(Replace the existing `return botPick(available(m), needs, round, rng);` line.)

- [ ] **Step 5: Run tests; expect pass**

Run: `npx vitest run src/lib/mock/bot.test.ts src/lib/mock/engine.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mock/bot.ts src/lib/mock/engine.ts src/lib/mock/bot.test.ts
git commit -m "Bots chase positional runs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Part D + B — Banner and Pick Timer

### Task 9: Extract the on-the-clock banner

**Files:**

- Create: `src/components/mock/OnTheClockBanner.tsx`
- Modify: `src/components/mock/MockDraft.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Create the banner component**

Create `src/components/mock/OnTheClockBanner.tsx`:

```tsx
import type { ReactNode } from "react";
import type { MockState } from "../../lib/mock/types";

interface Props {
  state: MockState;
  status: string;
  round: number;
  overall: number;
  isUser: boolean;
  isComplete: boolean;
  paused: boolean;
  onTogglePause: () => void;
  onUndo: () => void;
  onExit: () => void;
  timer?: ReactNode; // pick-timer UI, shown on the user's clock
}

// Last few picks as "Name (POS)", most recent first.
function recentPicks(state: MockState): { id: string; label: string }[] {
  const byId = new Map(state.pool.map((p) => [p.id, p]));
  return state.picks
    .slice(-5)
    .reverse()
    .map((pk) => {
      const p = byId.get(pk.playerId);
      return {
        id: `${pk.overall}`,
        label: p ? `${p.name} (${p.position})` : "—",
      };
    });
}

export function OnTheClockBanner({
  state,
  status,
  round,
  overall,
  isUser,
  isComplete,
  paused,
  onTogglePause,
  onUndo,
  onExit,
  timer,
}: Props) {
  const recent = recentPicks(state);
  return (
    <div className="mock-banner">
      <div className="mock-banner-main">
        <strong className={isUser ? "on-clock-you" : ""}>{status}</strong>
        <span className="mock-banner-pick">
          R{round} · Pick {overall} of {state.order.length}
        </span>
        {isUser && timer}
      </div>

      {recent.length > 0 && (
        <div className="mock-ticker">
          {recent.map((r) => (
            <span className="mock-ticker-item" key={r.id}>
              {r.label}
            </span>
          ))}
        </div>
      )}

      <div className="mock-controls">
        {!isUser && !isComplete && (
          <button className={paused ? "active" : ""} onClick={onTogglePause}>
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
        )}
        <button onClick={onUndo} disabled={state.picks.length === 0}>
          Undo
        </button>
        <button className="secondary" onClick={onExit}>
          Exit
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Use it in `MockDraft.tsx`**

Add the import:

```ts
import { OnTheClockBanner } from "./OnTheClockBanner";
```

Replace the entire `<div className="mock-status"> ... </div>` block with:

```tsx
<OnTheClockBanner
  state={state}
  status={status}
  round={round}
  overall={overall}
  isUser={isUser}
  isComplete={isComplete(state)}
  paused={paused}
  onTogglePause={() => setPaused((p) => !p)}
  onUndo={undoAndPause}
  onExit={onExit}
/>
```

(The "Draft board" toggle button moves to sit beside the position chips — add it to the `.chips` row, or keep a small control row. For now, add it just above `<div className="chips">`:)

```tsx
<div className="mock-boardtoggle">
  <button
    className={boardOpen ? "active" : ""}
    onClick={() => setBoardOpen((v) => !v)}
  >
    {boardOpen ? "Hide board" : "Draft board"}
  </button>
</div>
```

- [ ] **Step 3: Banner CSS**

In `src/index.css`, add (you may remove the now-unused `.mock-status` rule or leave it):

```css
.mock-banner {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  background: #11161d;
  border-bottom: 1px solid #232b36;
}
.mock-banner-main {
  display: flex;
  align-items: center;
  gap: 12px;
}
.on-clock-you {
  color: #f0c000;
}
.mock-ticker {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  font-size: 0.8rem;
  color: #9aa4b2;
}
.mock-ticker-item {
  white-space: nowrap;
}
.mock-ticker-item:not(:last-child)::after {
  content: " ·";
  margin-left: 8px;
}
```

- [ ] **Step 4: Typecheck + build sanity**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/mock/OnTheClockBanner.tsx src/components/mock/MockDraft.tsx src/index.css
git commit -m "Consolidate mock status into an on-the-clock banner

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

### Task 10: Pick timer with auto-pick

**Files:**

- Modify: `src/components/mock/MockDraft.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Add timer state + auto-pick effect**

In `src/components/mock/MockDraft.tsx`:

Add `bestAvailableId` to the engine import:

```ts
import {
  available,
  bestAvailableId,
  botPickId,
  currentTeamIndex,
  isComplete,
  teamRosterPositions,
} from "../../lib/mock/engine";
```

Add state near the other `useState` calls:

```ts
const [timerSec, setTimerSec] = useState<number | null>(60); // null = Off
const [remaining, setRemaining] = useState(60);
```

Reset the clock to full whenever a new pick comes on the clock, the duration
changes, or the draft resumes from a pause (per spec: Resume restarts the
countdown from full, not mid-count):

```ts
useEffect(() => {
  if (timerSec != null) setRemaining(timerSec);
}, [overall, timerSec, paused]);
```

Countdown + auto-pick (runs only on the user's live, unpaused clock):

```ts
useEffect(() => {
  if (timerSec == null || paused || !isUser) return;
  if (remaining <= 0) {
    const id = bestAvailableId(state);
    if (id) onDraft(id);
    return;
  }
  const t = setTimeout(() => setRemaining((s) => s - 1), 1000);
  return () => clearTimeout(t);
}, [timerSec, paused, isUser, remaining, state, onDraft]);
```

- [ ] **Step 2: Build the timer UI and pass it to the banner**

Add this just before the `return (`:

```tsx
const timerUi = (
  <span className="mock-timer-wrap">
    <span className={`mock-timer ${remaining <= 10 ? "urgent" : ""}`}>
      {timerSec == null
        ? "—"
        : `0:${String(Math.max(remaining, 0)).padStart(2, "0")}`}
    </span>
    <select
      className="mock-timer-sel"
      value={timerSec ?? "off"}
      onChange={(e) =>
        setTimerSec(e.target.value === "off" ? null : Number(e.target.value))
      }
    >
      <option value="30">0:30</option>
      <option value="60">1:00</option>
      <option value="90">1:30</option>
      <option value="off">Off</option>
    </select>
  </span>
);
```

Pass it into the banner by adding the `timer` prop to the `<OnTheClockBanner ... />` element:

```tsx
timer = { timerUi };
```

- [ ] **Step 3: Timer CSS**

In `src/index.css`, add:

```css
.mock-timer-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.mock-timer {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  background: #1c2430;
}
.mock-timer.urgent {
  background: #5a1c1c;
  color: #ff8a8a;
}
.mock-timer-sel {
  font-size: 0.75rem;
}
```

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, start a mock, take the draft to your pick, and confirm:

- The clock counts down only on your pick; pausing a bot run freezes nothing on your clock when it's not your turn.
- Under 10s it turns red.
- At 0:00 it auto-drafts your top available player and advances.
- Switching the selector to Off hides the countdown and disables auto-pick.

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/mock/MockDraft.tsx src/index.css
git commit -m "Add user pick timer with auto-pick at zero

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 2: Typecheck + production build**

Run: `npx tsc --noEmit && npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 3: Smoke-test the app**

Run: `npm run dev` and verify end-to-end:

- Board shows a **VOR** column; **Sort → VOR** lists highest-first.
- A mock draft shows the **on-the-clock banner** (round/pick, whose turn, recent-picks ticker, Pause/Resume + Undo).
- The **pick timer** counts down on your pick and auto-picks at zero.
- Over several rounds, bots visibly **chase runs** (a burst at one position makes more of that position go).

- [ ] **Step 4: Done** — report results; do not merge/cherry-pick to `main` until the user approves.

---

## Notes for the implementer

- TDD: write the test, watch it fail, implement, watch it pass, commit. Don't batch.
- This worktree symlinks `node_modules` from the main checkout; run all commands from the worktree root.
- VOR uses ESPN **default-scoring** projections by design (see spec's "Revisit" note) — do not try to make it league-scoring-accurate in this pass.
- Apply-to-board writeback is **out of scope** (deferred).
