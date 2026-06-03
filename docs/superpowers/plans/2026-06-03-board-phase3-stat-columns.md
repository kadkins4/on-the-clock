# Board Redesign — Phase 3: Proj + Last-Season Stat Columns

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add two scoring-aware board columns — **Proj** (this-season projection) and **'25** (last-season actual) — both derived through one shared scorer so flipping PPR/half/standard re-scores them in lockstep.

**Architecture:** Extract the per-stat-line math out of `projectedPoints` into a pure `scoreStatLine(stats, position, scoring, tePremium)` core; `projectedPoints` delegates (no behavior change for VOR). Player gains an optional `lastStats` line (same `ProjStats` shape). Both columns thread through the existing VOR pipeline: per-id scored maps computed in `useRankings`, passed to `sortPlayers` and down `PlayerTable → PlayerRow → CellCtx` exactly like `vorById`. Data comes from ESPN's same `kona_player_info` payload (`statSourceId === 0`, prior `seasonId`); the committed seed is enriched **non-destructively** (only `lastStats` added, order/ADP untouched).

**Tech Stack:** React 19 + TS, Vitest, Node fetch script.

**Spec:** `docs/superpowers/specs/2026-06-02-board-redesign-columns-filters-design.md` §6.

**Season note:** draft `SEASON = 2026`, so "last season" = **2025**; the column header is **'25** (spec said "'24" loosely — corrected). Tracks `SEASON − 1`.

---

## File Structure

- **Modify** `src/lib/projection.ts` — extract `scoreStatLine` core; add `lastSeasonPoints`; `projectedPoints` delegates.
- **Modify** `src/types.ts` — `Player.lastStats?: ProjStats | null`; `SortKey` += `"proj" | "last"`.
- **Modify** `src/lib/ranking.ts` — `sortPlayers` takes a unified `scored?: ScoredMaps` and handles `proj`/`last`; `defaultSortAsc` for the two.
- **Modify** `src/lib/columns.ts` — add `proj`/`last` `ColumnDef`s (after `vor`, before `bye`); `ColumnId` union.
- **Modify** `src/components/board/cells.tsx` — `CellCtx` += `proj`/`last`; two renderers (incl. rookie `R` / missing `–`).
- **Modify** `src/components/PlayerRow.tsx` + `src/components/PlayerTable.tsx` — thread `proj`/`last` scalars + maps.
- **Modify** `src/state/useRankings.ts` — compute `projById` / `lastById`.
- **Modify** `src/App.tsx` — destructure + pass the maps to `sortPlayers` and `<PlayerTable>`.
- **Modify** `scripts/fetch-espn.mjs` + `src/lib/fetchEspn.ts` — `extractLastStats` (prior-season actual row).
- **Create** `scripts/enrich-last-stats.mjs` — non-destructive seed enrichment (adds only `lastStats`).
- **Tests:** `src/lib/projection.test.ts` (new/extended), `src/lib/ranking.test.ts` (proj/last sort), `src/components/board/cells` covered via existing render path + a focused test.

---

## Task 1: `scoreStatLine` core + `lastSeasonPoints`

**Files:** Modify `src/lib/projection.ts`; Test `src/lib/projection.test.ts`.

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/projection.test.ts
import { describe, it, expect } from "vitest";
import { scoreStatLine, projectedPoints, lastSeasonPoints } from "./projection";
import type { ProjStats, Player } from "../types";

const line = (over: Partial<ProjStats> = {}): ProjStats => ({
  passYds: 0,
  passTD: 0,
  int: 0,
  rushYds: 0,
  rushTD: 0,
  rec: 0,
  recYds: 0,
  recTD: 0,
  fumblesLost: 0,
  twoPt: 0,
  ...over,
});

describe("scoreStatLine", () => {
  it("scores receptions by scoring format", () => {
    const s = line({ rec: 100, recYds: 1000 });
    expect(scoreStatLine(s, "WR", "ppr")).toBe(200); // 100*1 + 1000*0.1
    expect(scoreStatLine(s, "WR", "half")).toBe(150);
    expect(scoreStatLine(s, "WR", "standard")).toBe(100);
  });
  it("adds TE premium to receptions only for TEs", () => {
    const s = line({ rec: 10 });
    expect(scoreStatLine(s, "TE", "ppr", true)).toBe(15); // 10*1.5
    expect(scoreStatLine(s, "WR", "ppr", true)).toBe(10);
  });
});

describe("projectedPoints (unchanged behavior)", () => {
  it("delegates to the core for a projStats line", () => {
    const p = {
      position: "WR",
      projStats: line({ rec: 50 }),
      projPoints: 999,
    } as Player;
    expect(projectedPoints(p, "ppr")).toBe(50);
  });
  it("falls back to projPoints when no projStats", () => {
    const p = { position: "K", projStats: null, projPoints: 123 } as Player;
    expect(projectedPoints(p, "ppr")).toBe(123);
  });
});

describe("lastSeasonPoints", () => {
  it("scores lastStats with the same core", () => {
    const p = {
      position: "RB",
      lastStats: line({ rushYds: 1000, rushTD: 10 }),
    } as Player;
    expect(lastSeasonPoints(p, "ppr")).toBe(160); // 1000*0.1 + 10*6
  });
  it("returns null when no last line (no projPoints fallback)", () => {
    const p = { position: "RB", lastStats: null } as Player;
    expect(lastSeasonPoints(p, "ppr")).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect fail** (`scoreStatLine`/`lastSeasonPoints` undefined).
      Run: `npx vitest run src/lib/projection.test.ts`

- [ ] **Step 3: Refactor `projection.ts`**

Replace the body of `projectedPoints` so the math lives in a reusable core:

```ts
import type { Player, Position, Scoring, ProjStats } from "../types";

export const OFFENSE: Position[] = ["QB", "RB", "WR", "TE"];

// Pure scorer for ONE raw stat line under a league's rules. Used for both the
// season projection (projStats) and last-season actual (lastStats).
export function scoreStatLine(
  stats: ProjStats,
  position: Position,
  scoring: Scoring,
  tePremium = false,
): number {
  const perRec =
    (scoring === "ppr" ? 1 : scoring === "half" ? 0.5 : 0) +
    (tePremium && position === "TE" ? 0.5 : 0);
  return (
    stats.passYds * 0.04 +
    stats.passTD * 4 -
    stats.int * 2 +
    stats.rushYds * 0.1 +
    stats.rushTD * 6 +
    stats.recYds * 0.1 +
    stats.recTD * 6 +
    stats.rec * perRec +
    stats.twoPt * 2 -
    stats.fumblesLost * 2
  );
}

export function projectedPoints(
  player: Pick<Player, "position" | "projStats" | "projPoints">,
  scoring: Scoring,
  tePremium = false,
): number | null {
  const s = player.projStats;
  if (!s) return player.projPoints ?? null; // K/DST or no line → ESPN total
  return scoreStatLine(s, player.position, scoring, tePremium);
}

// Last-season actual points; null when there's no actual line (no fallback).
export function lastSeasonPoints(
  player: Pick<Player, "position" | "lastStats">,
  scoring: Scoring,
  tePremium = false,
): number | null {
  const s = player.lastStats;
  if (!s) return null;
  return scoreStatLine(s, player.position, scoring, tePremium);
}
```

(`Pick` on `lastStats` requires the `types.ts` change in Task 2; if running Task 1 first causes a type error on `lastStats`, do Task 2 Step 1 immediately — they are co-dependent and may share a commit.)

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/lib/projection.test.ts`

- [ ] **Step 5: Commit** (with Task 2 if types are needed). `git commit -m "Extract scoreStatLine core; add lastSeasonPoints"`

---

## Task 2: Types — `lastStats` + SortKey

**Files:** Modify `src/types.ts`.

- [ ] **Step 1: Add `lastStats` to `Player`** (next to `projStats`):

```ts
  // Raw last-season ACTUAL stat line (offensive players); same shape as
  // projStats, scored by the same core. Absent for K/DST, rookies, unmatched.
  lastStats?: ProjStats | null;
```

- [ ] **Step 2: Extend `SortKey`:**

```ts
export type SortKey =
  | "overall"
  | "adp"
  | "name"
  | "bye"
  | "vor"
  | "pos"
  | "proj"
  | "last";
```

- [ ] **Step 3: Typecheck.** `npx tsc --noEmit` — expect new errors only where `sortPlayers`/columns must handle the new keys (Tasks 3–4). Commit with Task 1.

---

## Task 3: Sorting — unified scored maps + proj/last

**Files:** Modify `src/lib/ranking.ts`; Test `src/lib/ranking.test.ts`.

- [ ] **Step 1: Write failing tests** (append to `ranking.test.ts`):

```ts
describe("sortPlayers proj/last", () => {
  it("sorts by proj descending-better via scored map", () => {
    const players = [
      { id: "a", overallRank: 1 },
      { id: "b", overallRank: 2 },
      { id: "c", overallRank: 3 },
    ] as any;
    const proj = { a: 100, b: 250, c: null };
    expect(
      sortPlayers(players, "proj", true, { proj }).map((p) => p.id),
    ).toEqual(["b", "a", "c"]);
  });
  it("sorts by last descending-better via scored map", () => {
    const players = [
      { id: "a", overallRank: 1 },
      { id: "b", overallRank: 2 },
    ] as any;
    const last = { a: 50, b: 300 };
    expect(
      sortPlayers(players, "last", true, { last }).map((p) => p.id),
    ).toEqual(["b", "a"]);
  });
});
```

Update the existing vor test call from `sortPlayers(players, "vor", true, vor)` to `sortPlayers(players, "vor", true, { vor })`.

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/lib/ranking.test.ts`

- [ ] **Step 3: Refactor `sortPlayers`**

```ts
export type ScoredMaps = Partial<
  Record<"vor" | "proj" | "last", Record<string, number | null>>
>;

export function sortPlayers(
  players: Player[],
  key: SortKey,
  asc = true,
  scored: ScoredMaps = {},
): Player[] {
  const dir = asc ? 1 : -1;
  const byScore = (
    map?: Record<string, number | null>,
    a?: Player,
    b?: Player,
  ) => nullableCompare(map?.[a!.id] ?? null, map?.[b!.id] ?? null, -dir);
  const cmp = (a: Player, b: Player): number => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "adp":
        return nullableCompare(a.adp, b.adp, dir);
      case "bye":
        return nullableCompare(a.byeWeek, b.byeWeek, dir);
      case "pos":
        return (
          a.position.localeCompare(b.position) * dir ||
          a.overallRank - b.overallRank
        );
      case "vor":
        return byScore(scored.vor, a, b);
      case "proj":
        return byScore(scored.proj, a, b);
      case "last":
        return byScore(scored.last, a, b);
      case "overall":
      default:
        return (a.overallRank - b.overallRank) * dir;
    }
  };
  return players.slice().sort(cmp);
}
```

- [ ] **Step 4: `defaultSortAsc`** — ensure `proj` and `last` default descending (higher is better), like `vor`. Find the `defaultSortAsc` function and add them to the descending set (e.g. `key === "vor" || key === "proj" || key === "last" ? false : true` or extend the existing list).

- [ ] **Step 5: Run — expect pass** (incl. updated vor test). `npx vitest run src/lib/ranking.test.ts`

- [ ] **Step 6: Commit.** `git commit -m "sortPlayers: unified scored maps + proj/last sort"`

---

## Task 4: Column registry — Proj + '25

**Files:** Modify `src/lib/columns.ts`; existing `ColumnHeader.test.tsx` must stay green.

- [ ] **Step 1: Extend `ColumnId`** — add `"proj"` and `"last"` to the union (after `"vor"`).

- [ ] **Step 2: Insert defs** after the `vor` def, before `bye`:

```ts
  {
    id: "proj",
    label: "Proj",
    sortable: true,
    sortKey: "proj",
    align: "r",
    width: "3.6rem",
  },
  {
    // Last completed season (SEASON−1). Header tracks the year; update on the
    // yearly seed regen alongside fetch-espn's SEASON bump.
    id: "last",
    label: "'25",
    sortable: true,
    sortKey: "last",
    align: "r",
    width: "3.2rem",
  },
```

- [ ] **Step 3: Run column-header test.** `npx vitest run src/components/board/ColumnHeader.test.tsx` — expect pass (registry-driven; new columns just appear). If the test asserts an exact column count/order, update that assertion to include `proj`/`last`.

- [ ] **Step 4: Commit.** `git commit -m "Add Proj + last-season columns to registry"`

---

## Task 5: Cell renderers + row/table threading

**Files:** Modify `cells.tsx`, `PlayerRow.tsx`, `PlayerTable.tsx`.

- [ ] **Step 1: `CellCtx` gains `proj` / `last`** (`cells.tsx`):

```ts
vor: number | null;
proj: number | null;
last: number | null;
rookie: boolean; // no NFL season yet → '25 cell shows "R"
```

- [ ] **Step 2: Renderers** (add to `CELL_RENDERERS`, after `vor`):

```tsx
  proj: (_p, ctx) => (
    <td className="proj num">{ctx.proj == null ? "–" : Math.round(ctx.proj)}</td>
  ),
  last: (_p, ctx) => (
    <td className="last num">
      {ctx.last != null ? Math.round(ctx.last) : ctx.rookie ? "R" : "–"}
    </td>
  ),
```

- [ ] **Step 3: `PlayerRow` props + ctx** — add `proj: number | null`, `last: number | null`, `rookie: boolean` to `Props`, destructure, and include in the `ctx` object. `rookie` = "player has no lastStats AND is flagged rookie" — but we don't have a rookie flag; derive `rookie` upstream as `player.lastStats === undefined && <rookie-heuristic>`. **Simplification:** since we have no explicit rookie field, pass `rookie={false}` for now (cell shows `–` for everyone missing a line). Leave a `// TODO rookie heuristic` — `R` vs `–` is cosmetic and the spec allows `–` for missing. (Keeps Phase 3 from inventing a data field.)

- [ ] **Step 4: `PlayerTable`** — add `projById`/`lastById` to `Props`, and in `renderRow` pass:

```tsx
      proj={projById[p.id] ?? null}
      last={lastById[p.id] ?? null}
      rookie={false}
```

Add `projById`, `lastById` to the destructured props + the `Props` interface (`Record<string, number | null>`).

- [ ] **Step 5: Typecheck** — expect errors only at the `<PlayerTable>` call in App (Task 6). `npx tsc --noEmit`

- [ ] **Step 6: Commit** (may compile-red at App call site until Task 6; note it). `git commit -m "Render Proj + last-season cells; thread through table/row"`

---

## Task 6: Compute maps in useRankings + wire App

**Files:** Modify `src/state/useRankings.ts`, `src/App.tsx`.

- [ ] **Step 1: Compute `projById` / `lastById`** in `useRankings` (next to `vorById`):

```ts
import { projectedPoints, lastSeasonPoints } from "../lib/projection";
// ...
const projById = useMemo(() => {
  const m: Record<string, number | null> = {};
  for (const p of players)
    m[p.id] = projectedPoints(p, current.scoring, current.tePremium);
  return m;
}, [players, current.scoring, current.tePremium]);
const lastById = useMemo(() => {
  const m: Record<string, number | null> = {};
  for (const p of players)
    m[p.id] = lastSeasonPoints(p, current.scoring, current.tePremium);
  return m;
}, [players, current.scoring, current.tePremium]);
```

Return `projById, lastById` from the hook.

- [ ] **Step 2: App** — destructure `projById, lastById` from `useRankings()`; update the `sortPlayers` call to `sortPlayers(renderPlayers, sortKey!, sortAsc, { vor: vorById, proj: projById, last: lastById })` (and its `useMemo` deps); pass `projById={projById}` and `lastById={lastById}` to `<PlayerTable>`.

- [ ] **Step 3: Full suite + typecheck.** `npx vitest run && npx tsc --noEmit` — expect green.

- [ ] **Step 4: Commit.** `git commit -m "Compute proj/last maps in useRankings; wire App"`

---

## Task 7: ESPN extraction for last-season actuals

**Files:** Modify `scripts/fetch-espn.mjs`, `src/lib/fetchEspn.ts`.

- [ ] **Step 1: `fetch-espn.mjs`** — add a prior-season actual row finder + extractor, mirroring `projRow`/`extractProjStats`:

```js
const LAST_SEASON = SEASON - 1; // 2025 actuals

// The player's prior-season ACTUAL row (statSourceId 0 = actual, full-season).
const lastRow = (p) =>
  p.stats?.find(
    (x) =>
      x.statSourceId === 0 &&
      x.statSplitTypeId === 0 &&
      x.seasonId === LAST_SEASON,
  );

function extractLastStats(p, position) {
  if (!OFFENSE.includes(position)) return null;
  const st = lastRow(p)?.stats;
  if (!st) return null;
  const g = (k) => Number(st[k]) || 0;
  return {
    passYds: g(STAT.passYds),
    passTD: g(STAT.passTD),
    int: g(STAT.int),
    rushYds: g(STAT.rushYds),
    rushTD: g(STAT.rushTD),
    rec: g(STAT.rec),
    recYds: g(STAT.recYds),
    recTD: g(STAT.recTD),
    fumblesLost: g(STAT.fumblesLost),
    twoPt: g(STAT.pass2) + g(STAT.rush2) + g(STAT.rec2),
  };
}
```

Add `lastStats: extractLastStats(p, position),` to the mapped player object (next to `projStats`).

- [ ] **Step 2: Mirror in the client `src/lib/fetchEspn.ts`** — it shares the STAT id map and projection extraction (per the script's "kept in sync" comment). Add the same `lastRow`/`extractLastStats` and include `lastStats` on each mapped player, so the in-app **Fetch players** path also populates it. (Read the file first; match its existing style and the constant it uses for the season.)

- [ ] **Step 3: Typecheck.** `npx tsc --noEmit` — green (the `lastStats` field is now consumed end-to-end).

- [ ] **Step 4: Commit.** `git commit -m "Fetch last-season actual stat line (ESPN statSourceId 0)"`

---

## Task 8: Non-destructive seed enrichment

**Files:** Create `scripts/enrich-last-stats.mjs`; regenerate `src/data/seed.json` (only `lastStats` added).

- [ ] **Step 1: Write the enrichment script** — fetch ESPN once, build an `id → lastStats` map, then add `lastStats` to existing seed entries by id, **writing every other field back untouched**:

```js
// scripts/enrich-last-stats.mjs
// Adds ONLY `lastStats` to each existing seed player by ESPN id. Does not
// reorder, re-rank, or change ADP/projStats. Run: node scripts/enrich-last-stats.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SEASON = 2026,
  LAST_SEASON = SEASON - 1;
const OFFENSE = ["QB", "RB", "WR", "TE"];
const STAT = {
  passYds: "3",
  passTD: "4",
  int: "20",
  rushYds: "24",
  rushTD: "25",
  rec: "53",
  recYds: "42",
  recTD: "43",
  fumblesLost: "72",
  pass2: "19",
  rush2: "26",
  rec2: "44",
};
const POS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DST" };

const lastRow = (p) =>
  p.stats?.find(
    (x) =>
      x.statSourceId === 0 &&
      x.statSplitTypeId === 0 &&
      x.seasonId === LAST_SEASON,
  );
function extractLastStats(p, position) {
  if (!OFFENSE.includes(position)) return null;
  const st = lastRow(p)?.stats;
  if (!st) return null;
  const g = (k) => Number(st[k]) || 0;
  return {
    passYds: g(STAT.passYds),
    passTD: g(STAT.passTD),
    int: g(STAT.int),
    rushYds: g(STAT.rushYds),
    rushTD: g(STAT.rushTD),
    rec: g(STAT.rec),
    recYds: g(STAT.recYds),
    recTD: g(STAT.recTD),
    fumblesLost: g(STAT.fumblesLost),
    twoPt: g(STAT.pass2) + g(STAT.rush2) + g(STAT.rec2),
  };
}

const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/players?view=kona_player_info`;
const res = await fetch(url, {
  headers: {
    "x-fantasy-filter": JSON.stringify({
      players: {
        limit: 1500,
        sortPercOwned: { sortPriority: 1, sortAsc: false },
      },
    }),
  },
});
const raw = await res.json();
const byId = new Map();
for (const p of raw) {
  const position = POS[p.defaultPositionId];
  if (!position) continue;
  byId.set(String(p.id), extractLastStats(p, position));
}

const here = dirname(fileURLToPath(import.meta.url));
const seedPath = join(here, "..", "src", "data", "seed.json");
const seed = JSON.parse(readFileSync(seedPath, "utf8"));
let hit = 0;
for (const pl of seed.players ?? seed) {
  const ls = byId.get(String(pl.espnId ?? pl.id));
  if (ls) {
    pl.lastStats = ls;
    hit++;
  }
}
writeFileSync(seedPath, JSON.stringify(seed, null, 2) + "\n");
console.log(
  `enriched ${hit} players with lastStats (of ${(seed.players ?? seed).length})`,
);
```

**Before running, read `src/data/seed.json`'s shape** (is it `{players:[...]}` or a bare array? what is the id field — `id`, `espnId`?) and the `x-fantasy-filter` header the real `fetch-espn.mjs` uses, and align the script's id-match + request to it. The id used in the seed must match ESPN's `p.id`.

- [ ] **Step 2: Run it.** `node scripts/enrich-last-stats.mjs` — expect a non-trivial hit count (most offensive non-rookies). If `hit` is ~0, the id field or season row assumption is wrong → fix before proceeding (do **not** commit a seed with no lastStats).

- [ ] **Step 3: Verify the diff is additive only.** `git diff --stat src/data/seed.json` then spot-check: `git diff src/data/seed.json | grep '^[-+]' | grep -v lastStats | grep -vE '^(\+\+\+|---)'` should show **nothing** removed/changed except added `lastStats` keys (and reflow). If formatting reflowed the whole file, re-dump with the seed's existing indentation so the diff stays readable.

- [ ] **Step 4: Commit.** `git commit -m "Enrich seed with last-season actual stat lines"`

---

## Task 9: CSS + final verification

**Files:** Modify `src/index.css` (column widths/alignment for `.proj`/`.last` if the static `.col-*` rules need them).

- [ ] **Step 1: Column CSS** — Phase 1 noted static `.col-<id>` CSS owns width/alignment. Add `.col-proj` / `.col-last` (and any `td.proj`/`td.last` right-align/tabular rules) mirroring `.col-vor`. Grep `col-vor` and `\.vor` in `index.css` and copy the pattern.

- [ ] **Step 2: Full suite + build.** `npx vitest run && npx tsc --noEmit && npm run build` — all green.

- [ ] **Step 3: Live smoke** (`npm run dev`): board shows **Proj** and **'25** columns with numbers; switching scoring (⚙ → PPR/Half/Standard) changes both in lockstep; clicking the **Proj** / **'25** headers sorts desc-first; missing lines render `–`; columns right-aligned and don't jitter.

- [ ] **Step 4: Update status doc** — add a Phase 3 "Built" bullet to `…/WeDev/On The Clock/FF Draft Helper.md`.

---

## Self-Review notes (author)

- **Spec §6 coverage:** `scoreStatLine` core + delegation (Task 1), Proj column reusing `projectedPoints` (Tasks 4–6), '25 column via `lastSeasonPoints` scored by the same core → lockstep re-scoring (Tasks 1, 6), lastStats data both seed + client-fetch (Tasks 7–8), missing → `–` (Task 5; `R` deferred — no rookie field, spec permits `–`).
- **Out of scope:** refetch surfacing + ESPN-shape guard + /dev panel = **Phase 5** (spec §7/§9). Column manager = Phase 4.
- **Type consistency:** `ScoredMaps` keyed by `"vor"|"proj"|"last"`; `sortPlayers(..., scored)` single object; `useRankings` returns `projById`/`lastById`; `CellCtx`/`PlayerRow`/`PlayerTable` all carry `proj`/`last` as `number|null`.
- **Risk:** Task 8 depends on the seed id matching ESPN `p.id` and 2025 actuals being present in the 2026 payload — Step 2 gates on a non-zero hit count; if zero, stop and reassess (may need the actual `fetch-espn.mjs` request shape).
