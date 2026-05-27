# FF Cheat Sheet — Draft-Night Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the existing ranking board into a shippable dark-mode draft-night tool: locked reference fields, tri-state draft status, board-wide positional counts, smart search, and a delayed-hide animation.

**Architecture:** Incremental changes to the existing Vite + React 19 + TS app. New pure logic lands in small `src/lib/*` modules (each with a vitest test); UI changes go in the existing components. Persistence stays in localStorage. No backend, no migration (no existing users).

**Tech Stack:** Vite, React 19, TypeScript, @dnd-kit, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-05-27-ff-cheat-sheet-polish-design.md`

---

## Task 1: Replace `drafted` boolean with `draftStatus` tri-state

**Files:**

- Modify: `src/types.ts`
- Create: `src/lib/draft.ts`
- Create: `src/lib/draft.test.ts`
- Modify: `src/state/reducer.ts` (remove `toggleDrafted`)
- Modify: `src/state/reducer.test.ts` (remove `toggleDrafted` test, fix `mk`)
- Modify: `src/components/AddPlayerForm.tsx` (default `draftStatus`)
- Modify: `src/components/PlayerRow.tsx` (replace `drafted` references so it compiles — full UI rework is Task 6)
- Modify: `src/App.tsx` (hide-drafted filter)
- Modify: `src/lib/csv.ts` (the `mk`-style references — handled in Task 5; here only keep it compiling)
- Modify: `src/data/seed.json` (transform 300 rows)
- Modify: `scripts/fetch-espn.mjs`

- [ ] **Step 1: Add the `DraftStatus` type and change `Player`**

In `src/types.ts`, add the type and replace the `drafted` field:

```ts
export type DraftStatus = "available" | "mine" | "taken";
```

In the `Player` interface, replace `drafted: boolean;` with:

```ts
draftStatus: DraftStatus;
```

- [ ] **Step 2: Write the failing test for the cycle function**

Create `src/lib/draft.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { nextDraftStatus } from "./draft";

describe("nextDraftStatus", () => {
  it("cycles available -> mine -> taken -> available", () => {
    expect(nextDraftStatus("available")).toBe("mine");
    expect(nextDraftStatus("mine")).toBe("taken");
    expect(nextDraftStatus("taken")).toBe("available");
  });
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `pnpm test -- src/lib/draft.test.ts`
Expected: FAIL — cannot find module `./draft`.

- [ ] **Step 4: Implement `nextDraftStatus`**

Create `src/lib/draft.ts`:

```ts
import type { DraftStatus } from "../types";

const ORDER: DraftStatus[] = ["available", "mine", "taken"];

export function nextDraftStatus(s: DraftStatus): DraftStatus {
  const i = ORDER.indexOf(s);
  return ORDER[(i + 1) % ORDER.length];
}
```

- [ ] **Step 5: Run it, expect pass**

Run: `pnpm test -- src/lib/draft.test.ts`
Expected: PASS.

- [ ] **Step 6: Remove the `toggleDrafted` reducer action**

In `src/state/reducer.ts`, delete the `| { type: "toggleDrafted"; id: string }` line from the `Action` union and delete the entire `case "toggleDrafted":` block. (Draft status is set via the existing `update` action with a `{ draftStatus }` patch.)

- [ ] **Step 7: Fix reducer test**

In `src/state/reducer.test.ts`: in the `mk` helper, replace `drafted: false,` with `draftStatus: "available",`. Delete the `it("toggleDrafted flips drafted", ...)` test entirely. Add:

```ts
it("update can set draftStatus", () => {
  const out = rankingReducer(base, {
    type: "update",
    id: "a",
    patch: { draftStatus: "mine" },
  });
  expect(out.find((p) => p.id === "a")!.draftStatus).toBe("mine");
});
```

- [ ] **Step 8: Fix remaining `drafted` references so the build compiles**

- `src/components/AddPlayerForm.tsx`: replace `drafted: false,` with `draftStatus: "available",`.
- `src/components/PlayerRow.tsx`: replace `player.drafted ? 0.45 : 1` with `player.draftStatus !== "available" ? 0.45 : 1`; replace `player.drafted ? "row drafted" : "row"` with `player.draftStatus !== "available" ? "row drafted" : "row"`; in the drafted `<td>`, replace the checkbox `onChange` `dispatch({ type: "toggleDrafted", id: player.id })` with `dispatch({ type: "update", id: player.id, patch: { draftStatus: nextDraftStatus(player.draftStatus) } })` and `checked={player.drafted}` with `checked={player.draftStatus !== "available"}`. Add `import { nextDraftStatus } from "../lib/draft";`. (This is throwaway wiring; Task 6 rebuilds the row.)
- `src/App.tsx`: in the `visible` filter, replace `(!hideDrafted || !p.drafted)` with `(!hideDrafted || p.draftStatus === "available")`.
- `src/lib/csv.ts`: no change yet (CSV gains the column in Task 5). It does not reference `drafted`, so it still compiles.

- [ ] **Step 9: Transform the seed data**

Every row in `src/data/seed.json` currently has `"drafted": false`. Replace them all:

Run: `cd "$(git rev-parse --show-toplevel)" && perl -0pi -e 's/"drafted": false/"draftStatus": "available"/g' src/data/seed.json`
Expected: no output; `git diff --stat src/data/seed.json` shows the file changed. Verify with `grep -c '"draftStatus": "available"' src/data/seed.json` → `300`.

- [ ] **Step 10: Update the ESPN generator**

In `scripts/fetch-espn.mjs`, in the `players.push({ ... })` object, replace `drafted: false,` with `draftStatus: "available",`.

- [ ] **Step 11: Verify build + all tests**

Run: `pnpm test && pnpm build`
Expected: all tests PASS; `tsc --noEmit && vite build` succeeds with no type errors.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "Replace drafted boolean with draftStatus tri-state"
```

---

## Task 2: Team metadata module + default bye weeks

**Files:**

- Create: `src/data/teamMeta.ts`
- Create: `src/lib/byes.ts`
- Create: `src/lib/byes.test.ts`
- Modify: `src/lib/storage.ts` (apply byes on load)
- Modify: `src/state/reducer.ts` (`setAll` applies byes so imports get them)

- [ ] **Step 1: Bye weeks (already sourced — 2026)**

The 2026 bye weeks were fetched from the ESPN API on 2026-05-27 (`GET …/seasons/2026?view=proTeamSchedules_wl` → `settings.proTeams[].byeWeek`) and are already filled into the map below — no invented numbers. To re-verify, re-query that endpoint.

- [ ] **Step 2: Create the team metadata module**

Create `src/data/teamMeta.ts` (city/nickname fixed; 2026 `byeWeek` values already filled from Step 1):

```ts
export interface TeamInfo {
  city: string;
  nickname: string;
  byeWeek: number | null;
}

// byeWeek: 2026 NFL schedule via ESPN proTeamSchedules_wl (sourced 2026-05-27).
export const teamMeta: Record<string, TeamInfo> = {
  ARI: { city: "Arizona", nickname: "Cardinals", byeWeek: 14 },
  ATL: { city: "Atlanta", nickname: "Falcons", byeWeek: 11 },
  BAL: { city: "Baltimore", nickname: "Ravens", byeWeek: 13 },
  BUF: { city: "Buffalo", nickname: "Bills", byeWeek: 7 },
  CAR: { city: "Carolina", nickname: "Panthers", byeWeek: 5 },
  CHI: { city: "Chicago", nickname: "Bears", byeWeek: 10 },
  CIN: { city: "Cincinnati", nickname: "Bengals", byeWeek: 6 },
  CLE: { city: "Cleveland", nickname: "Browns", byeWeek: 11 },
  DAL: { city: "Dallas", nickname: "Cowboys", byeWeek: 14 },
  DEN: { city: "Denver", nickname: "Broncos", byeWeek: 10 },
  DET: { city: "Detroit", nickname: "Lions", byeWeek: 6 },
  GB: { city: "Green Bay", nickname: "Packers", byeWeek: 11 },
  HOU: { city: "Houston", nickname: "Texans", byeWeek: 8 },
  IND: { city: "Indianapolis", nickname: "Colts", byeWeek: 13 },
  JAX: { city: "Jacksonville", nickname: "Jaguars", byeWeek: 7 },
  KC: { city: "Kansas City", nickname: "Chiefs", byeWeek: 5 },
  LAC: { city: "Los Angeles", nickname: "Chargers", byeWeek: 7 },
  LAR: { city: "Los Angeles", nickname: "Rams", byeWeek: 11 },
  LV: { city: "Las Vegas", nickname: "Raiders", byeWeek: 13 },
  MIA: { city: "Miami", nickname: "Dolphins", byeWeek: 6 },
  MIN: { city: "Minnesota", nickname: "Vikings", byeWeek: 6 },
  NE: { city: "New England", nickname: "Patriots", byeWeek: 11 },
  NO: { city: "New Orleans", nickname: "Saints", byeWeek: 8 },
  NYG: { city: "New York", nickname: "Giants", byeWeek: 8 },
  NYJ: { city: "New York", nickname: "Jets", byeWeek: 13 },
  PHI: { city: "Philadelphia", nickname: "Eagles", byeWeek: 10 },
  PIT: { city: "Pittsburgh", nickname: "Steelers", byeWeek: 9 },
  SEA: { city: "Seattle", nickname: "Seahawks", byeWeek: 11 },
  SF: { city: "San Francisco", nickname: "49ers", byeWeek: 8 },
  TB: { city: "Tampa Bay", nickname: "Buccaneers", byeWeek: 10 },
  TEN: { city: "Tennessee", nickname: "Titans", byeWeek: 9 },
  WSH: { city: "Washington", nickname: "Commanders", byeWeek: 7 },
  FA: { city: "Free Agent", nickname: "FA", byeWeek: null },
};
```

- [ ] **Step 3: Write the failing test for bye population**

Create `src/lib/byes.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { withByeWeeks } from "./byes";
import { teamMeta } from "../data/teamMeta";
import type { Player } from "../types";

function mk(team: string): Player {
  return {
    id: team,
    name: team,
    position: "RB",
    team,
    overallRank: 1,
    byeWeek: null,
    tier: 1,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  };
}

describe("withByeWeeks", () => {
  it("fills byeWeek from teamMeta", () => {
    const [p] = withByeWeeks([mk("PIT")]);
    expect(p.byeWeek).toBe(teamMeta.PIT.byeWeek);
  });

  it("leaves byeWeek null for FA / unknown teams", () => {
    expect(withByeWeeks([mk("FA")])[0].byeWeek).toBeNull();
    expect(withByeWeeks([mk("XXX")])[0].byeWeek).toBeNull();
  });
});
```

- [ ] **Step 4: Run it, expect failure**

Run: `pnpm test -- src/lib/byes.test.ts`
Expected: FAIL — cannot find module `./byes`.

- [ ] **Step 5: Implement `withByeWeeks`**

Create `src/lib/byes.ts`:

```ts
import type { Player } from "../types";
import { teamMeta } from "../data/teamMeta";

export function withByeWeeks(players: Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    byeWeek: teamMeta[p.team]?.byeWeek ?? null,
  }));
}
```

- [ ] **Step 6: Run it, expect pass**

Run: `pnpm test -- src/lib/byes.test.ts`
Expected: PASS.

- [ ] **Step 7: Apply byes on load and on import**

In `src/lib/storage.ts`: `import { withByeWeeks } from "./byes";` and wrap both return paths in `loadPlayers` — `return withByeWeeks(parsed as Player[]);` and `return withByeWeeks(seed as unknown as Player[]);`. Also bump the persistence key `const KEY = "ff-cheat-sheet:players:v1";` to `...:v2` — the `Player` shape changed (`draftStatus`, optional `injuryStatus`), so any stale saved data should be ignored rather than loaded mismatched. (Player identity is the ESPN `id` for seeded rows / a UUID for custom rows; the seed regeneration never touches a user's localStorage, so user rankings are not reset by data refreshes.)

In `src/state/reducer.ts`: `import { withByeWeeks } from "../lib/byes";` and in `case "setAll"` change the return to `return withByeWeeks(reassignOverallRanks(sorted));`.

- [ ] **Step 8: Verify + commit**

Run: `pnpm test && pnpm build`
Expected: all PASS, build clean.

```bash
git add -A
git commit -m "Add team metadata and default bye weeks"
```

---

## Task 3: Row visual-state function

**Files:**

- Create: `src/lib/rowState.ts`
- Create: `src/lib/rowState.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/rowState.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rowState } from "./rowState";

describe("rowState", () => {
  it("drafted status overrides flag color", () => {
    expect(rowState("mine", "target")).toBe("mine");
    expect(rowState("taken", "avoid")).toBe("taken");
  });

  it("uses flag color when available", () => {
    expect(rowState("available", "target")).toBe("target");
    expect(rowState("available", "avoid")).toBe("avoid");
    expect(rowState("available", "none")).toBe("neutral");
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm test -- src/lib/rowState.test.ts`
Expected: FAIL — cannot find module `./rowState`.

- [ ] **Step 3: Implement**

Create `src/lib/rowState.ts`:

```ts
import type { DraftStatus, Flag } from "../types";

export type RowState = "mine" | "taken" | "target" | "avoid" | "neutral";

export function rowState(draftStatus: DraftStatus, flag: Flag): RowState {
  if (draftStatus === "mine") return "mine";
  if (draftStatus === "taken") return "taken";
  if (flag === "target") return "target";
  if (flag === "avoid") return "avoid";
  return "neutral";
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `pnpm test -- src/lib/rowState.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add row visual-state function"
```

---

## Task 4: Board-wide positional drafted counter

**Files:**

- Create: `src/lib/counts.ts`
- Create: `src/lib/counts.test.ts`
- Modify: `src/App.tsx` (render the summary)

- [ ] **Step 1: Write the failing test**

Create `src/lib/counts.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { draftedByPosition } from "./counts";
import type { Player } from "../types";
import type { DraftStatus } from "../types";

function mk(pos: Player["position"], status: DraftStatus): Player {
  return {
    id: Math.random().toString(),
    name: "x",
    position: pos,
    team: "FA",
    overallRank: 1,
    byeWeek: null,
    tier: 1,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: status,
  };
}

describe("draftedByPosition", () => {
  it("counts non-available players per position", () => {
    const out = draftedByPosition([
      mk("RB", "mine"),
      mk("RB", "taken"),
      mk("RB", "available"),
      mk("WR", "taken"),
    ]);
    expect(out.RB).toBe(2);
    expect(out.WR).toBe(1);
    expect(out.QB).toBe(0);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm test -- src/lib/counts.test.ts`
Expected: FAIL — cannot find module `./counts`.

- [ ] **Step 3: Implement**

Create `src/lib/counts.ts`:

```ts
import type { Player, Position } from "../types";
import { POSITIONS } from "../types";

export function draftedByPosition(players: Player[]): Record<Position, number> {
  const counts = Object.fromEntries(POSITIONS.map((p) => [p, 0])) as Record<
    Position,
    number
  >;
  for (const p of players) {
    if (p.draftStatus !== "available") counts[p.position]++;
  }
  return counts;
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `pnpm test -- src/lib/counts.test.ts`
Expected: PASS.

- [ ] **Step 5: Render the summary in App**

In `src/App.tsx`: `import { draftedByPosition } from "./lib/counts";` and `import { POSITIONS } from "./types";`. Compute `const drafted = useMemo(() => draftedByPosition(players), [players]);`. Render below the `<h1>` and above `<Toolbar>`:

```tsx
<div className="drafted-summary">
  {POSITIONS.map((pos) => (
    <span key={pos} className="drafted-summary-item">
      {pos} <b>{drafted[pos]}</b>
    </span>
  ))}
</div>
```

- [ ] **Step 6: Verify + commit**

Run: `pnpm test && pnpm build`
Expected: all PASS, build clean.

```bash
git add -A
git commit -m "Add board-wide positional drafted counter"
```

---

## Task 5: Smart search (name + team, exact-before-partial, DST-first) and CSV draftStatus

**Files:**

- Create: `src/lib/search.ts`
- Create: `src/lib/search.test.ts`
- Modify: `src/App.tsx` (use `searchPlayers`)
- Modify: `src/lib/csv.ts` (add `draft` column)
- Modify: `src/lib/csv.test.ts` (round-trip draftStatus) — only if a csv test file exists; otherwise add the case to the existing csv test.

- [ ] **Step 1: Write the failing search test**

Create `src/lib/search.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { searchPlayers } from "./search";
import type { Player } from "../types";

function mk(
  id: string,
  name: string,
  pos: Player["position"],
  team: string,
): Player {
  return {
    id,
    name,
    position: pos,
    team,
    overallRank: Number(id),
    byeWeek: null,
    tier: 1,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  };
}

const players = [
  mk("1", "Najee Harris", "RB", "PIT"),
  mk("2", "Steelers D/ST", "DST", "PIT"),
  mk("3", "George Pickens", "WR", "PIT"),
  mk("4", "Bijan Robinson", "RB", "ATL"),
];

describe("searchPlayers", () => {
  it("returns all players for an empty query", () => {
    expect(searchPlayers(players, "")).toHaveLength(4);
  });

  it("matches by player name", () => {
    expect(searchPlayers(players, "bijan").map((p) => p.id)).toEqual(["4"]);
  });

  it("team-nickname query surfaces the D/ST first, then team players", () => {
    const ids = searchPlayers(players, "steelers").map((p) => p.id);
    expect(ids[0]).toBe("2"); // Steelers D/ST
    expect(ids).toEqual(expect.arrayContaining(["1", "3"]));
    expect(ids).not.toContain("4"); // ATL excluded
  });

  it("ranks exact before partial", () => {
    const ps = [
      mk("1", "Chase", "WR", "CIN"),
      mk("2", "Chase Brown", "RB", "CIN"),
    ];
    expect(searchPlayers(ps, "chase").map((p) => p.id)).toEqual(["1", "2"]);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm test -- src/lib/search.test.ts`
Expected: FAIL — cannot find module `./search`.

- [ ] **Step 3: Implement `searchPlayers`**

Create `src/lib/search.ts`:

```ts
import type { Player } from "../types";
import { teamMeta } from "../data/teamMeta";

function fieldScore(field: string, q: string): number {
  const f = field.toLowerCase();
  if (f === q) return 100;
  if (f.startsWith(q)) return 50;
  if (f.includes(q)) return 25;
  return 0;
}

export function searchPlayers(players: Player[], query: string): Player[] {
  const q = query.trim().toLowerCase();
  if (q === "") return players;

  const scored = players
    .map((p) => {
      const meta = teamMeta[p.team];
      const nameScore = fieldScore(p.name, q);
      const teamScore = Math.max(
        fieldScore(p.team, q),
        meta ? fieldScore(meta.city, q) : 0,
        meta ? fieldScore(meta.nickname, q) : 0,
      );
      const base = Math.max(nameScore, teamScore);
      if (base === 0) return null;
      // a D/ST whose team matched ranks above that team's individual players
      const dstBonus = teamScore >= nameScore && p.position === "DST" ? 10 : 0;
      return { p, score: base + dstBonus };
    })
    .filter((x): x is { p: Player; score: number } => x !== null);

  scored.sort((a, b) => b.score - a.score || a.p.overallRank - b.p.overallRank);
  return scored.map((x) => x.p);
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `pnpm test -- src/lib/search.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire search into App**

In `src/App.tsx`: `import { searchPlayers } from "./lib/search";`. Replace the name-substring logic in the `visible` memo. Current code filters with `q === "" || p.name.toLowerCase().includes(q)`. Change `visible` so that position filter + hide-drafted still apply, then search-rank the result:

```tsx
const visible = useMemo(() => {
  const filtered = players.filter(
    (p) =>
      (posFilter === "All" || p.position === posFilter) &&
      (!hideDrafted || p.draftStatus === "available"),
  );
  return searchPlayers(filtered, search);
}, [players, search, posFilter, hideDrafted]);
```

Note: when `search` is non-empty the list is ranked by relevance, so it renders flat (the existing `reorderable`/`grouped` logic already disables grouping unless `search.trim() === ""`). No further change needed there.

- [ ] **Step 6: Add `draftStatus` to CSV round-trip (failing test first)**

If `src/lib/csv.test.ts` exists, add this test; otherwise create it with the standard imports. Add:

```ts
import { describe, it, expect } from "vitest";
import { toCsv, parseCsv } from "./csv";
import type { Player } from "../types";

it("round-trips draftStatus through CSV", () => {
  const p: Player = {
    id: "1",
    name: "A",
    position: "RB",
    team: "ATL",
    overallRank: 1,
    byeWeek: null,
    tier: 1,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "mine",
  };
  const back = parseCsv(toCsv([p]));
  expect(back[0].draftStatus).toBe("mine");
});
```

- [ ] **Step 7: Run it, expect failure**

Run: `pnpm test -- src/lib/csv.test.ts`
Expected: FAIL — `back[0].draftStatus` is `"available"` (column not written/read yet).

- [ ] **Step 8: Implement the CSV column**

In `src/lib/csv.ts`:

- Add `"draft"` to the end of the `HEADER` array.
- In `toCsv`, add `p.draftStatus,` as the last field of the row array.
- Add a coercion helper near `toFlag`:

```ts
import type { DraftStatus } from "../types";

function toDraftStatus(v: string): DraftStatus {
  return v === "mine" || v === "taken" ? v : "available";
}
```

- In `parseCsv`, add `draft: col("draft"),` to the `ci` object and `draftStatus: toDraftStatus(get(ci.draft).trim()),` to the pushed player object (replacing the removed `drafted: false`).

- [ ] **Step 9: Run it, expect pass**

Run: `pnpm test -- src/lib/csv.test.ts`
Expected: PASS.

- [ ] **Step 10: Verify + commit**

Run: `pnpm test && pnpm build`
Expected: all PASS, build clean.

```bash
git add -A
git commit -m "Add smart search and draftStatus CSV round-trip"
```

---

## Task 6: PlayerRow rework — locked fields, tri-state draft cell, layout, colors

**Files:**

- Modify: `src/components/PlayerRow.tsx` (full replacement)
- Modify: `src/components/PlayerTable.tsx` (header cells)

- [ ] **Step 1: Replace PlayerRow**

Replace the entire contents of `src/components/PlayerRow.tsx`:

```tsx
import type { Dispatch, CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Player, Flag } from "../types";
import type { Action } from "../state/reducer";
import { nextDraftStatus } from "../lib/draft";
import { rowState } from "../lib/rowState";

function toNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

interface Props {
  player: Player;
  positionalRank: number;
  draggable: boolean;
  dispatch: Dispatch<Action>;
}

const DRAFT_LABEL: Record<Player["draftStatus"], string> = {
  available: "·",
  mine: "✓",
  taken: "✕",
};

export function PlayerRow({
  player,
  positionalRank,
  draggable,
  dispatch,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id, disabled: !draggable });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const upd = (patch: Partial<Omit<Player, "id" | "overallRank">>) =>
    dispatch({ type: "update", id: player.id, patch });

  const cycleFlag = () => {
    const next: Flag =
      player.flag === "none"
        ? "target"
        : player.flag === "target"
          ? "avoid"
          : "none";
    upd({ flag: next });
  };

  const cycleDraft = () =>
    upd({ draftStatus: nextDraftStatus(player.draftStatus) });

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={`row state-${rowState(player.draftStatus, player.flag)}`}
    >
      <td className="draft-cell">
        <button
          className={`draft draft-${player.draftStatus}`}
          onClick={cycleDraft}
          title={player.draftStatus}
        >
          {DRAFT_LABEL[player.draftStatus]}
        </button>
      </td>
      <td
        className="drag"
        {...(draggable ? { ...attributes, ...listeners } : {})}
      >
        {draggable ? "⠷" : ""}
      </td>
      <td className="rank">{player.overallRank}</td>
      <td className="pos">
        <span className="posrank">
          {player.position}·{player.team} ({player.position}
          {positionalRank})
        </span>
      </td>
      <td className="name-cell" title={player.name}>
        {player.name}
      </td>
      <td className="num">{player.byeWeek ?? ""}</td>
      <td className="num">{player.adp ?? ""}</td>
      <td>
        <input
          className="num tier-input"
          inputMode="numeric"
          value={player.tier ?? ""}
          onChange={(e) => upd({ tier: toNum(e.target.value) })}
        />
      </td>
      <td>
        <input
          className="notes"
          value={player.notes}
          onChange={(e) => upd({ notes: e.target.value })}
        />
      </td>
      <td>
        <button
          className={`flag flag-${player.flag}`}
          onClick={cycleFlag}
          title={player.flag}
        >
          {player.flag === "target" ? "★" : player.flag === "avoid" ? "⚑" : "·"}
        </button>
      </td>
    </tr>
  );
}
```

Notes: `name`, `position`, `team`, `byeWeek`, `adp` are now read-only text (locked). `tier` stays an editable input (spec: tier editable) and `notes`/`flag` stay editable. The delete button is removed. Draft status is a single cycling cell, placed first.

- [ ] **Step 2: Update PlayerTable header to match the new columns**

In `src/components/PlayerTable.tsx`, replace the `<tr>` inside `<thead>` with header cells in the new order:

```tsx
<tr>
  <th>Draft</th>
  <th></th>
  <th>#</th>
  <th>Pos·Tm</th>
  <th>Player</th>
  <th>Bye</th>
  <th>ADP</th>
  <th>Tier</th>
  <th>Notes</th>
  <th>{"★/⚑"}</th>
</tr>
```

- [ ] **Step 3: Verify build + manual check**

Run: `pnpm build`
Expected: clean. Then `pnpm dev` and confirm rows render: draft cell first, locked fields are plain text, tier/notes/flag still editable, no delete button.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Rework PlayerRow: locked fields, tri-state draft cell, layout"
```

---

## Task 7: Dark mode theme + row state colors + column widths

**Files:**

- Modify: `src/index.css` (full replacement)

- [ ] **Step 1: Replace index.css**

Replace the entire contents of `src/index.css` with a dark palette, the row-state colors (target=purple, avoid=red, mine=green, taken=grey/dimmed), the drafted summary, and column widths matching the 10 columns in PlayerTable:

```css
:root {
  font-family: system-ui, sans-serif;
  font-size: 14px;
  --bg: #0f1115;
  --panel: #171a21;
  --text: #e6e8eb;
  --muted: #8b93a1;
  --border: #2a2f3a;
  --green: #22c55e;
  --red: #ef4444;
  --purple: #a855f7;
  --grey: #5b6573;
}
body {
  margin: 1rem;
  background: var(--bg);
  color: var(--text);
}
.app h1 {
  font-size: 1.25rem;
}

.drafted-summary {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  color: var(--muted);
}
.drafted-summary-item b {
  color: var(--text);
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 1rem;
}
.toolbar .search {
  padding: 0.3rem 0.5rem;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
}
.chips {
  display: flex;
  gap: 0.25rem;
}
.chip {
  padding: 0.2rem 0.6rem;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  border-radius: 999px;
  cursor: pointer;
}
.chip.active {
  background: var(--text);
  color: var(--bg);
  border-color: var(--text);
}
.toolbar select,
.toolbar button {
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
}

table.players {
  border-collapse: collapse;
  width: 100%;
  table-layout: fixed;
}
table.players th,
table.players td {
  padding: 0.25rem 0.4rem;
  text-align: left;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
table.players th:nth-child(1) {
  width: 3rem;
} /* draft */
table.players th:nth-child(2) {
  width: 1.6rem;
} /* drag */
table.players th:nth-child(3) {
  width: 2.4rem;
} /* # */
table.players th:nth-child(4) {
  width: 7rem;
} /* pos·tm */
table.players th:nth-child(5) {
  width: 9rem;
} /* name (narrower) */
table.players th:nth-child(6) {
  width: 3rem;
} /* bye */
table.players th:nth-child(7) {
  width: 3.4rem;
} /* adp */
table.players th:nth-child(8) {
  width: 3rem;
} /* tier */
table.players th:nth-child(9) {
  width: auto;
} /* notes (wider) */
table.players th:nth-child(10) {
  width: 2.4rem;
} /* flag */

table.players input:not([type="checkbox"]) {
  width: 100%;
  box-sizing: border-box;
  background: transparent;
  color: var(--text);
  border: 1px solid transparent;
  border-radius: 3px;
}
table.players input:focus {
  border-color: var(--border);
  outline: none;
}

/* row state colors via a left accent + tint */
.row td {
  border-left: 3px solid transparent;
}
.row.state-target td:first-child {
  border-left-color: var(--purple);
}
.row.state-avoid td:first-child {
  border-left-color: var(--red);
}
.row.state-mine td:first-child {
  border-left-color: var(--green);
}
.row.state-taken td:first-child {
  border-left-color: var(--grey);
}
.row.state-mine {
  color: var(--green);
}
.row.state-avoid {
  color: var(--red);
}
.row.state-target {
  color: var(--purple);
}
.row.state-taken {
  color: var(--muted);
  opacity: 0.55;
}
.row.state-taken .name-cell {
  text-decoration: line-through;
}

.tier-divider td {
  background: var(--panel);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.75rem;
  color: var(--muted);
}
.drag {
  cursor: grab;
  color: var(--muted);
  user-select: none;
  text-align: center;
}
.draft {
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text);
  cursor: pointer;
  width: 1.6rem;
  border-radius: 4px;
}
.draft-mine {
  color: var(--green);
  border-color: var(--green);
}
.draft-taken {
  color: var(--grey);
  border-color: var(--grey);
}
.flag {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1rem;
  color: var(--muted);
}
.flag-target {
  color: var(--purple);
}
.flag-avoid {
  color: var(--red);
}
.posrank {
  color: var(--muted);
  font-size: 0.85rem;
}
.add-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: var(--panel);
  border: 1px solid var(--border);
}
.add-form input,
.add-form select,
.add-form button {
  background: var(--bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 0.25rem 0.5rem;
}
```

- [ ] **Step 2: Verify**

Run: `pnpm dev` and confirm: dark background, purple targets, red avoids, green "mine", greyed/struck "taken", drafted summary visible, columns aligned (name narrower, notes wider).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Dark mode theme and row-state colors"
```

---

## Task 8: Delayed hide + undo

**Files:**

- Create: `src/state/useDelayedHide.ts`
- Create: `src/state/useDelayedHide.test.ts`
- Modify: `src/App.tsx` (use the hook to compute rendered players + undo bar)

- [ ] **Step 1: Write the failing test (fake timers)**

Create `src/state/useDelayedHide.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDelayedHide } from "./useDelayedHide";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useDelayedHide", () => {
  it("keeps a just-hidden id visible until the delay elapses", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useDelayedHide(ids, 2500),
      { initialProps: { ids: ["a", "b", "c"] } },
    );
    // 'b' becomes hidden (no longer in visible ids)
    rerender({ ids: ["a", "c"] });
    expect(result.current.rendered).toContain("b"); // still lingering
    expect(result.current.pending).toContain("b");

    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.rendered).not.toContain("b");
    expect(result.current.pending).not.toContain("b");
  });

  it("cancels the hide if the id returns before the delay", () => {
    const { result, rerender } = renderHook(
      ({ ids }) => useDelayedHide(ids, 2500),
      { initialProps: { ids: ["a", "b"] } },
    );
    rerender({ ids: ["a"] }); // b hidden
    rerender({ ids: ["a", "b"] }); // b restored (undo) before timer
    act(() => vi.advanceTimersByTime(2500));
    expect(result.current.rendered).toEqual(["a", "b"]);
    expect(result.current.pending).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `pnpm test -- src/state/useDelayedHide.test.ts`
Expected: FAIL — cannot find module `./useDelayedHide`.

- [ ] **Step 3: Implement the hook**

Create `src/state/useDelayedHide.ts`:

```ts
import { useEffect, useRef, useState } from "react";

/**
 * Given the set of ids that *should* be visible, returns the ids to actually
 * render — lingering ids that just dropped out for `delayMs` so a row can
 * animate out / be undone before it disappears.
 */
export function useDelayedHide(visibleIds: string[], delayMs: number) {
  const [pending, setPending] = useState<string[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const prev = useRef<string[]>(visibleIds);

  useEffect(() => {
    const prevSet = new Set(prev.current);
    const nowSet = new Set(visibleIds);

    // ids that just dropped out -> start a linger timer
    for (const id of prev.current) {
      if (!nowSet.has(id) && !timers.current.has(id)) {
        setPending((p) => (p.includes(id) ? p : [...p, id]));
        const t = setTimeout(() => {
          timers.current.delete(id);
          setPending((p) => p.filter((x) => x !== id));
        }, delayMs);
        timers.current.set(id, t);
      }
    }
    // ids that came back -> cancel any linger timer (undo)
    for (const id of visibleIds) {
      if (prevSet.has(id) || nowSet.has(id)) {
        const t = timers.current.get(id);
        if (t) {
          clearTimeout(t);
          timers.current.delete(id);
          setPending((p) => p.filter((x) => x !== id));
        }
      }
    }
    prev.current = visibleIds;
  }, [visibleIds, delayMs]);

  useEffect(
    () => () => {
      for (const t of timers.current.values()) clearTimeout(t);
      timers.current.clear();
    },
    [],
  );

  const rendered = [
    ...visibleIds,
    ...pending.filter((id) => !visibleIds.includes(id)),
  ];
  return { rendered, pending };
}
```

- [ ] **Step 4: Run it, expect pass**

Run: `pnpm test -- src/state/useDelayedHide.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the hook into App + an Undo button**

In `src/App.tsx`: `import { useDelayedHide } from "./state/useDelayedHide";`. After computing `visible`, render lingering rows and expose an undo:

```tsx
const visibleIds = useMemo(() => visible.map((p) => p.id), [visible]);
const { rendered: renderedIds, pending } = useDelayedHide(visibleIds, 2500);
const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
const renderPlayers = useMemo(
  () =>
    renderedIds
      .map((id) => byId.get(id))
      .filter((p): p is (typeof players)[number] => !!p),
  [renderedIds, byId],
);
const undoLast = () => {
  const id = pending[pending.length - 1];
  if (id) dispatch({ type: "update", id, patch: { draftStatus: "available" } });
};
```

Then build `groups`/`flat` from `renderPlayers` instead of `visible` (pass `renderPlayers` to `groupByTier(...)` and `sortPlayers(...)`; leave the `grouped`/`reorderable` conditions unchanged). Render a fixed Undo control right after `<PlayerTable .../>`:

```tsx
{
  pending.length > 0 && (
    <button className="undo-bar" onClick={undoLast}>
      Undo draft ({pending.length})
    </button>
  );
}
```

Why this works: with "Hide drafted" on, drafting a player drops its id from `visible`, but `useDelayedHide` keeps it in `renderedIds` for 2.5s — so the row lingers (already dimmed via its `state-mine`/`state-taken` class) and Undo restores it (returning the id to `visible` cancels the timer). With "Hide drafted" off, drafted players stay in `visible`, nothing enters `pending`, and the hook is a no-op.

Add to `index.css`:

```css
.undo-bar {
  position: fixed;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--green);
  border-radius: 999px;
  padding: 0.4rem 1rem;
  cursor: pointer;
}
.row.state-taken,
.row.state-mine {
  transition: opacity 0.4s ease;
}
```

(A richer per-row fade/collapse animation would need a `pending` flag threaded into `PlayerRow` via `TierGroup`; deferred to keep this task self-contained. The linger + dim + Undo already deliver the misclick-safety and "comes alive" intent.)

- [ ] **Step 6: Verify build + manual check**

Run: `pnpm test && pnpm build`
Expected: all PASS, build clean. With "Hide drafted" on, mark a player drafted → it lingers ~2.5s with a fade before disappearing; undrafting within the window keeps it.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add delayed hide with undo for drafted players"
```

---

## Task 9: Injury status badges

**Files:**

- Modify: `src/types.ts` (add optional `injuryStatus`)
- Create: `src/lib/injury.ts`
- Create: `src/lib/injury.test.ts`
- Modify: `scripts/fetch-espn.mjs` (emit injuryStatus)
- Modify: `src/data/seed.json` (regenerate to capture injuries)
- Modify: `src/components/PlayerRow.tsx` (render badge)
- Modify: `src/index.css` (badge styles)

- [ ] **Step 1: Add the optional field to `Player`**

In `src/types.ts`, add to the `Player` interface (optional, so existing constructors/tests are unaffected):

```ts
  injuryStatus?: string; // raw ESPN value, present only when not ACTIVE
```

- [ ] **Step 2: Write the failing test for `injuryBadge`**

Create `src/lib/injury.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { injuryBadge } from "./injury";

describe("injuryBadge", () => {
  it("maps ESPN statuses to short code + severity", () => {
    expect(injuryBadge("QUESTIONABLE")).toEqual({
      code: "Q",
      severity: "minor",
    });
    expect(injuryBadge("DOUBTFUL")).toEqual({ code: "D", severity: "minor" });
    expect(injuryBadge("OUT")).toEqual({ code: "O", severity: "major" });
    expect(injuryBadge("INJURY_RESERVE")).toEqual({
      code: "IR",
      severity: "major",
    });
    expect(injuryBadge("SUSPENSION")).toEqual({
      code: "SUS",
      severity: "major",
    });
  });

  it("returns null for healthy / unknown / undefined", () => {
    expect(injuryBadge("ACTIVE")).toBeNull();
    expect(injuryBadge(undefined)).toBeNull();
    expect(injuryBadge("WHATEVER")).toBeNull();
  });
});
```

- [ ] **Step 3: Run it, expect failure**

Run: `pnpm test -- src/lib/injury.test.ts`
Expected: FAIL — cannot find module `./injury`.

- [ ] **Step 4: Implement `injuryBadge`**

Create `src/lib/injury.ts`:

```ts
export interface InjuryBadge {
  code: string;
  severity: "minor" | "major";
}

export function injuryBadge(status: string | undefined): InjuryBadge | null {
  switch (status) {
    case "QUESTIONABLE":
      return { code: "Q", severity: "minor" };
    case "DOUBTFUL":
      return { code: "D", severity: "minor" };
    case "OUT":
      return { code: "O", severity: "major" };
    case "INJURY_RESERVE":
      return { code: "IR", severity: "major" };
    case "SUSPENSION":
      return { code: "SUS", severity: "major" };
    default:
      return null;
  }
}
```

- [ ] **Step 5: Run it, expect pass**

Run: `pnpm test -- src/lib/injury.test.ts`
Expected: PASS.

- [ ] **Step 6: Emit injuryStatus from the generator**

In `scripts/fetch-espn.mjs`, in the `players.push({ ... })` object, add as the last property (spread so healthy players omit the key):

```js
    ...(p.injuryStatus && p.injuryStatus !== "ACTIVE"
      ? { injuryStatus: p.injuryStatus }
      : {}),
```

- [ ] **Step 7: Regenerate the seed with injury data**

Run: `pnpm fetch-espn`
Expected: `Wrote 300 players to .../seed.json`. This refreshes the snapshot (ranks/ADP/injuries current). Sanity check: `grep -c injuryStatus src/data/seed.json` returns a small non-zero count (only injured players). If the network is unavailable, skip regeneration — the field stays absent (all healthy) until a later refresh.

- [ ] **Step 8: Render the badge in PlayerRow**

In `src/components/PlayerRow.tsx`, add `import { injuryBadge } from "../lib/injury";`. Inside the component, before `return`, add `const inj = injuryBadge(player.injuryStatus);`. Then render it inside the name cell:

```tsx
<td className="name-cell" title={player.name}>
  {player.name}
  {inj && (
    <span className={`inj inj-${inj.severity}`} title={player.injuryStatus}>
      {inj.code}
    </span>
  )}
</td>
```

- [ ] **Step 9: Badge styles**

Add to `src/index.css`:

```css
.inj {
  margin-left: 0.35rem;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0 0.25rem;
  border-radius: 3px;
  vertical-align: middle;
}
.inj-minor {
  background: #78350f;
  color: #fcd34d;
}
.inj-major {
  background: #7f1d1d;
  color: #fecaca;
}
```

- [ ] **Step 10: Verify + commit**

Run: `pnpm test && pnpm build`
Expected: all PASS, build clean. In `pnpm dev`, injured players show a Q/D/O/IR/SUS badge; healthy players don't.

```bash
git add -A
git commit -m "Add injury status badges from ESPN data"
```

---

## Final verification

- [ ] Run `pnpm test` — all suites green.
- [ ] Run `pnpm build` — type-check + production build clean.
- [ ] `pnpm dev` smoke test against the spec: dark mode; locked fields; rank vs read-only ADP; tri-state draft cell with green/grey/neutral; purple/red flags; injury badges (Q/D/O/IR/SUS); positional counter updates; search exact-before-partial and "Steelers" → D/ST first; delayed hide + undo.
