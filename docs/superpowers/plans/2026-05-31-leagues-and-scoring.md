# Leagues & Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace today's flat "named lists" board with a first-class **League** model — each league carries its own scoring, team count, roster settings, and player board — while keeping the existing app working.

**Architecture:** Today the app stores `Board { current: string; lists: Record<name, Player[]> }`. This plan introduces `LeaguesState { currentId: string; leagues: League[] }` where each `League` wraps a player board plus settings. A new `leaguesReducer` wraps the existing `rankingReducer` (player/tier actions delegate to the active league's board); league CRUD + settings are new actions. Storage migrates the old shapes forward with no data loss. This is the first of six plans (Leagues → ADP → Mock engine → Supabase sync → Mobile → Friends); it is pure local-first logic with no backend dependency.

**Tech Stack:** React 19 + TypeScript + Vite, `useReducer` + `localStorage`, Vitest (jsdom). `crypto.randomUUID()` for ids (already used in `src/lib/csv.ts`).

---

## File Structure

- **Create** `src/lib/league.ts` — League/Roster factories + `migrateBoardToLeagues`. One responsibility: constructing and migrating league data.
- **Create** `src/lib/league.test.ts` — tests for the above.
- **Modify** `src/types.ts` — add `Scoring`, `Platform`, `RosterSettings`, `League`, `LeaguesState`.
- **Modify** `src/state/reducer.ts` — add `LeagueAction` + `leaguesReducer` (keeps existing `rankingReducer`/`boardReducer` intact).
- **Modify** `src/state/reducer.test.ts` — add `leaguesReducer` tests.
- **Modify** `src/lib/storage.ts` — add `loadLeagues` / `saveLeagues` with migration chain.
- **Modify** `src/lib/storage.test.ts` — add migration/load tests.
- **Modify** `src/state/useRankings.ts` — drive the app from `leaguesReducer`.
- **Modify** `src/components/Toolbar.tsx` — rename list menu → league menu; add scoring selector.
- **Modify** `src/App.tsx` — wire the new hook shape + league handlers.

Default roster (used for migrated/new leagues): `QB1 RB2 WR2 TE1 FLEX1 SUPERFLEX0 K1 DST1 bench6`, no disabled positions. Roster-editing UI (sliders for each slot) is intentionally out of scope here — leagues get the default roster; the editing form is the lead-in to the next plan. Scoring IS editable in this plan (a dropdown) because it is needed for league setup.

---

## Task 1: League and roster types + factories

**Files:**

- Modify: `src/types.ts`
- Create: `src/lib/league.ts`
- Create: `src/lib/league.test.ts`

- [ ] **Step 1: Add the new types to `src/types.ts`**

Append after the existing `Player` interface (keep everything already in the file):

```typescript
export type Scoring = "ppr" | "half" | "standard";
export type Platform = "espn" | "yahoo" | "sleeper" | "underdog" | "other";

export interface RosterSettings {
  QB: number;
  RB: number;
  WR: number;
  TE: number;
  FLEX: number;
  SUPERFLEX: number;
  K: number;
  DST: number;
  bench: number;
  disabled: Position[]; // positions removed from this league entirely
}

export interface League {
  id: string;
  name: string;
  platform: Platform;
  scoring: Scoring;
  tePremium: boolean;
  teams: number; // 8–16
  roster: RosterSettings;
  board: Player[];
  updatedAt: number; // epoch ms; used by a later sync plan
}

export interface LeaguesState {
  currentId: string;
  leagues: League[]; // insertion-ordered
}
```

- [ ] **Step 2: Write the failing test**

Create `src/lib/league.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { defaultRoster, makeLeague } from "./league";
import type { Player } from "../types";

const player = (id: string): Player => ({
  id,
  name: `P${id}`,
  position: "RB",
  team: "ATL",
  overallRank: 1,
  byeWeek: null,
  tier: 1,
  adp: 1,
  notes: "",
  flag: "none",
  draftStatus: "available",
});

describe("defaultRoster", () => {
  it("returns the standard 1QB/2RB/2WR/1TE/1FLEX league shape", () => {
    expect(defaultRoster()).toEqual({
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
    });
  });

  it("returns a fresh object each call (no shared mutation)", () => {
    const a = defaultRoster();
    a.disabled.push("K");
    expect(defaultRoster().disabled).toEqual([]);
  });
});

describe("makeLeague", () => {
  it("builds a league with defaults and the given name + board", () => {
    const board = [player("1")];
    const lg = makeLeague({ name: "Money", board });
    expect(lg.name).toBe("Money");
    expect(lg.board).toBe(board);
    expect(lg.scoring).toBe("ppr");
    expect(lg.platform).toBe("other");
    expect(lg.teams).toBe(12);
    expect(lg.tePremium).toBe(false);
    expect(lg.roster).toEqual(defaultRoster());
    expect(typeof lg.id).toBe("string");
    expect(lg.id.length).toBeGreaterThan(0);
    expect(typeof lg.updatedAt).toBe("number");
  });

  it("honors overrides and defaults the board to empty", () => {
    const lg = makeLeague({
      name: "Dynasty",
      scoring: "half",
      teams: 10,
      platform: "sleeper",
    });
    expect(lg.scoring).toBe("half");
    expect(lg.teams).toBe(10);
    expect(lg.platform).toBe("sleeper");
    expect(lg.board).toEqual([]);
  });

  it("gives distinct ids to distinct leagues", () => {
    expect(makeLeague({ name: "A" }).id).not.toBe(makeLeague({ name: "B" }).id);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/league.test.ts`
Expected: FAIL — cannot import `defaultRoster` / `makeLeague` (module has no such exports).

- [ ] **Step 4: Write the minimal implementation**

Create `src/lib/league.ts`:

```typescript
import type {
  League,
  Platform,
  Player,
  RosterSettings,
  Scoring,
} from "../types";

export function defaultRoster(): RosterSettings {
  return {
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
}

export function makeLeague(opts: {
  name: string;
  board?: Player[];
  scoring?: Scoring;
  platform?: Platform;
  teams?: number;
}): League {
  return {
    id: crypto.randomUUID(),
    name: opts.name,
    platform: opts.platform ?? "other",
    scoring: opts.scoring ?? "ppr",
    tePremium: false,
    teams: opts.teams ?? 12,
    roster: defaultRoster(),
    board: opts.board ?? [],
    updatedAt: Date.now(),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/lib/league.test.ts`
Expected: PASS (all 6 assertions green).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/league.ts src/lib/league.test.ts
git commit -m "Add League/roster types and factories"
```

---

## Task 2: Migrate a named-lists Board into LeaguesState

**Files:**

- Modify: `src/lib/league.ts`
- Modify: `src/lib/league.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/league.test.ts`:

```typescript
import { migrateBoardToLeagues } from "./league";
import type { Board } from "../state/reducer";

describe("migrateBoardToLeagues", () => {
  it("creates one league per named list, preserving boards", () => {
    const board: Board = {
      current: "Dynasty",
      lists: { PPR: [player("1")], Dynasty: [player("2")] },
    };
    const state = migrateBoardToLeagues(board);
    expect(state.leagues.map((l) => l.name)).toEqual(["PPR", "Dynasty"]);
    expect(state.leagues[0].board).toEqual([player("1")]);
    expect(state.leagues[1].board).toEqual([player("2")]);
  });

  it("sets currentId to the league matching board.current", () => {
    const board: Board = {
      current: "Dynasty",
      lists: { PPR: [player("1")], Dynasty: [player("2")] },
    };
    const state = migrateBoardToLeagues(board);
    const current = state.leagues.find((l) => l.id === state.currentId);
    expect(current?.name).toBe("Dynasty");
  });

  it("falls back to the first league when current name is missing", () => {
    const board: Board = { current: "Ghost", lists: { PPR: [player("1")] } };
    const state = migrateBoardToLeagues(board);
    expect(state.currentId).toBe(state.leagues[0].id);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/league.test.ts`
Expected: FAIL — `migrateBoardToLeagues` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `src/lib/league.ts`:

```typescript
import type { Board } from "../state/reducer";
import type { LeaguesState } from "../types";

export function migrateBoardToLeagues(board: Board): LeaguesState {
  const leagues = Object.keys(board.lists).map((name) =>
    makeLeague({ name, board: board.lists[name] }),
  );
  const current = leagues.find((l) => l.name === board.current) ?? leagues[0];
  return { currentId: current.id, leagues };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/league.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/league.ts src/lib/league.test.ts
git commit -m "Add Board to LeaguesState migration"
```

---

## Task 3: leaguesReducer — CRUD, settings, and delegation

**Files:**

- Modify: `src/state/reducer.ts`
- Modify: `src/state/reducer.test.ts`

The reducer delegates player/tier actions (the existing `Action` union) to `rankingReducer` on the active league's board and bumps that league's `updatedAt`. League-level actions manage the league list and settings.

- [ ] **Step 1: Write the failing test**

Append to `src/state/reducer.test.ts`:

```typescript
import { leaguesReducer } from "./reducer";
import { makeLeague, defaultRoster } from "../lib/league";
import type { LeaguesState, Player } from "../types";

const mkPlayer = (id: string, rank: number): Player => ({
  id,
  name: `P${id}`,
  position: "RB",
  team: "ATL",
  overallRank: rank,
  byeWeek: null,
  tier: 1,
  adp: rank,
  notes: "",
  flag: "none",
  draftStatus: "available",
});

function twoLeagues(): LeaguesState {
  const a = makeLeague({ name: "Money", board: [mkPlayer("1", 1)] });
  const b = makeLeague({ name: "Dynasty", board: [mkPlayer("2", 1)] });
  return { currentId: a.id, leagues: [a, b] };
}

describe("leaguesReducer — league actions", () => {
  it("switchLeague changes currentId", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, {
      type: "switchLeague",
      id: s.leagues[1].id,
    });
    expect(next.currentId).toBe(s.leagues[1].id);
  });

  it("switchLeague ignores unknown ids", () => {
    const s = twoLeagues();
    expect(leaguesReducer(s, { type: "switchLeague", id: "nope" })).toBe(s);
  });

  it("addLeague appends an empty-board league and makes it current", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, { type: "addLeague", name: "Best Ball" });
    expect(next.leagues).toHaveLength(3);
    expect(next.leagues[2].name).toBe("Best Ball");
    expect(next.leagues[2].roster).toEqual(defaultRoster());
    expect(next.currentId).toBe(next.leagues[2].id);
  });

  it("addLeague ignores blank names", () => {
    const s = twoLeagues();
    expect(leaguesReducer(s, { type: "addLeague", name: "  " })).toBe(s);
  });

  it("renameLeague renames the targeted league", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, {
      type: "renameLeague",
      id: s.leagues[0].id,
      name: "Big Money",
    });
    expect(next.leagues[0].name).toBe("Big Money");
  });

  it("deleteLeague removes it and repoints current when needed", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, { type: "deleteLeague", id: s.currentId });
    expect(next.leagues).toHaveLength(1);
    expect(next.leagues[0].name).toBe("Dynasty");
    expect(next.currentId).toBe(next.leagues[0].id);
  });

  it("deleteLeague refuses to remove the last league", () => {
    const a = makeLeague({ name: "Solo", board: [] });
    const s: LeaguesState = { currentId: a.id, leagues: [a] };
    expect(leaguesReducer(s, { type: "deleteLeague", id: a.id })).toBe(s);
  });

  it("updateLeagueSettings patches scoring/teams/roster", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, {
      type: "updateLeagueSettings",
      id: s.leagues[0].id,
      patch: { scoring: "half", teams: 14, tePremium: true },
    });
    expect(next.leagues[0].scoring).toBe("half");
    expect(next.leagues[0].teams).toBe(14);
    expect(next.leagues[0].tePremium).toBe(true);
  });
});

describe("leaguesReducer — delegated player actions", () => {
  it("routes 'update' to the active league's board only", () => {
    const s = twoLeagues();
    const next = leaguesReducer(s, {
      type: "update",
      id: "1",
      patch: { notes: "stud" },
    });
    expect(next.leagues[0].board[0].notes).toBe("stud");
    expect(next.leagues[1].board[0].notes).toBe(""); // other league untouched
  });

  it("bumps updatedAt on the active league when its board changes", () => {
    const s = twoLeagues();
    s.leagues[0].updatedAt = 1; // force an old timestamp
    const next = leaguesReducer(s, {
      type: "update",
      id: "1",
      patch: { notes: "x" },
    });
    expect(next.leagues[0].updatedAt).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/state/reducer.test.ts`
Expected: FAIL — `leaguesReducer` is not exported.

- [ ] **Step 3: Write the minimal implementation**

Append to `src/state/reducer.ts` (keep the existing `rankingReducer`, `Board`, `boardReducer` untouched):

```typescript
import type { League, LeaguesState } from "../types";
import { makeLeague } from "../lib/league";

export type LeagueAction =
  | { type: "switchLeague"; id: string }
  | { type: "addLeague"; name: string }
  | { type: "deleteLeague"; id: string }
  | { type: "renameLeague"; id: string; name: string }
  | {
      type: "updateLeagueSettings";
      id: string;
      patch: Partial<
        Pick<League, "platform" | "scoring" | "tePremium" | "teams" | "roster">
      >;
    };

function mapLeague(
  state: LeaguesState,
  id: string,
  fn: (l: League) => League,
): LeaguesState {
  return {
    ...state,
    leagues: state.leagues.map((l) => (l.id === id ? fn(l) : l)),
  };
}

export function leaguesReducer(
  state: LeaguesState,
  action: Action | LeagueAction,
): LeaguesState {
  switch (action.type) {
    case "switchLeague":
      if (!state.leagues.some((l) => l.id === action.id)) return state;
      return { ...state, currentId: action.id };
    case "addLeague": {
      const name = action.name.trim();
      if (!name) return state;
      const lg = makeLeague({ name });
      return { currentId: lg.id, leagues: [...state.leagues, lg] };
    }
    case "deleteLeague": {
      if (state.leagues.length <= 1) return state;
      const leagues = state.leagues.filter((l) => l.id !== action.id);
      const currentId =
        action.id === state.currentId ? leagues[0].id : state.currentId;
      return { currentId, leagues };
    }
    case "renameLeague": {
      const name = action.name.trim();
      if (!name) return state;
      return mapLeague(state, action.id, (l) => ({ ...l, name }));
    }
    case "updateLeagueSettings":
      return mapLeague(state, action.id, (l) => ({ ...l, ...action.patch }));
    default: {
      // a player/tier Action — delegate to the active league's board
      return mapLeague(state, state.currentId, (l) => ({
        ...l,
        board: rankingReducer(l.board, action),
        updatedAt: Date.now(),
      }));
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/state/reducer.test.ts`
Expected: PASS (existing `boardReducer`/`rankingReducer` tests stay green; new `leaguesReducer` tests pass).

- [ ] **Step 5: Commit**

```bash
git add src/state/reducer.ts src/state/reducer.test.ts
git commit -m "Add leaguesReducer with CRUD, settings, and delegation"
```

---

## Task 4: Storage — load/save leagues with migration chain

**Files:**

- Modify: `src/lib/storage.ts`
- Modify: `src/lib/storage.test.ts`

Load order: `leagues:v1` (current) → migrate `lists:v1` (named-lists Board) → migrate old single board → fresh seed.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/storage.test.ts`:

```typescript
import { loadLeagues, saveLeagues } from "./storage";
import type { LeaguesState } from "../types";

const LISTS_KEY = "ff-cheat-sheet:lists:v1";
const LEAGUES_KEY = "ff-cheat-sheet:leagues:v1";

describe("league storage", () => {
  beforeEach(() => localStorage.clear());

  it("round-trips a saved LeaguesState", () => {
    saveLeagues({ currentId: "x", leagues: [] } as unknown as LeaguesState);
    expect(localStorage.getItem(LEAGUES_KEY)).toContain('"currentId":"x"');
  });

  it("migrates a named-lists board when no leagues key exists", () => {
    localStorage.setItem(
      LISTS_KEY,
      JSON.stringify({ current: "PPR", lists: { PPR: [], Dynasty: [] } }),
    );
    const state = loadLeagues();
    expect(state.leagues.map((l) => l.name)).toEqual(["PPR", "Dynasty"]);
    const current = state.leagues.find((l) => l.id === state.currentId);
    expect(current?.name).toBe("PPR");
  });

  it("seeds a single league when storage is empty", () => {
    const state = loadLeagues();
    expect(state.leagues).toHaveLength(1);
    expect(state.leagues[0].board.length).toBeGreaterThan(0);
  });

  it("prefers an existing leagues key over older shapes", () => {
    const saved: LeaguesState = {
      currentId: "keep",
      leagues: [
        {
          id: "keep",
          name: "Saved",
          platform: "other",
          scoring: "ppr",
          tePremium: false,
          teams: 12,
          roster: {
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
          },
          board: [],
          updatedAt: 1,
        },
      ],
    };
    localStorage.setItem(LEAGUES_KEY, JSON.stringify(saved));
    localStorage.setItem(
      LISTS_KEY,
      JSON.stringify({ current: "PPR", lists: { PPR: [] } }),
    );
    expect(loadLeagues().leagues[0].name).toBe("Saved");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `loadLeagues` / `saveLeagues` are not exported.

- [ ] **Step 3: Write the minimal implementation**

In `src/lib/storage.ts`, add imports at the top (alongside the existing imports):

```typescript
import type { LeaguesState } from "../types";
import { makeLeague, migrateBoardToLeagues } from "./league";
```

Then append these exports at the end of the file (leave the existing `Board`-based functions in place — `readBoard` is reused):

```typescript
const LEAGUES_KEY = "ff-cheat-sheet:leagues:v1";

export function saveLeagues(state: LeaguesState): void {
  try {
    localStorage.setItem(LEAGUES_KEY, JSON.stringify(state));
  } catch {
    // storage full / unavailable — ignore
  }
}

function readLeagues(): LeaguesState | null {
  try {
    const raw = localStorage.getItem(LEAGUES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.currentId === "string" &&
        Array.isArray(parsed.leagues)
      ) {
        return parsed as LeaguesState;
      }
    }
  } catch {
    // corrupt JSON — fall through
  }
  return null;
}

export function loadLeagues(): LeaguesState {
  const existing = readLeagues();
  const state = existing ?? migrateBoardToLeagues(readBoard());
  // normalize the active league's board (tiers + bye weeks) for immediate use
  const currentId =
    state.leagues.find((l) => l.id === state.currentId)?.id ??
    state.leagues[0].id;
  return {
    currentId,
    leagues: state.leagues.map((l) =>
      l.id === currentId
        ? { ...l, board: normalizeTiers(withByeWeeks(l.board)) }
        : l,
    ),
  };
}
```

Note: `readBoard()`, `normalizeTiers`, and `withByeWeeks` already exist in this file's scope/imports. When storage is empty, `readBoard()` returns the fresh seed Board (`{ current: "My Board", lists: { "My Board": orderByAdp(seed) } }`), which `migrateBoardToLeagues` turns into one seeded league. `makeLeague` import is not strictly needed here but is harmless; remove it if your linter flags an unused import.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS (existing `loadBoard`/`saveBoard` tests stay green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "Add league storage with migration chain"
```

---

## Task 5: Drive the app from leaguesReducer

**Files:**

- Modify: `src/state/useRankings.ts`

- [ ] **Step 1: Replace the hook body**

Rewrite `src/state/useRankings.ts` in full:

```typescript
import { useEffect, useReducer } from "react";
import { leaguesReducer } from "./reducer";
import { loadLeagues, saveLeagues } from "../lib/storage";

export function useRankings() {
  const [state, dispatch] = useReducer(leaguesReducer, undefined, loadLeagues);
  useEffect(() => {
    saveLeagues(state);
  }, [state]);
  const current =
    state.leagues.find((l) => l.id === state.currentId) ?? state.leagues[0];
  return {
    players: current.board,
    dispatch,
    currentLeague: current,
    leagues: state.leagues,
  };
}
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: errors ONLY in `src/App.tsx` (it still references the old `currentList` / `listNames` shape). Those are fixed in Task 6. No errors in `useRankings.ts`, `reducer.ts`, `storage.ts`, or `league.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/state/useRankings.ts
git commit -m "Drive useRankings from leaguesReducer"
```

---

## Task 6: Wire App + Toolbar to leagues (with scoring selector)

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/components/Toolbar.tsx`

Goal: the cog menu's "Lists" section becomes "Leagues" (switch/add/rename/delete by id), plus a scoring `<select>` that patches the current league. Player/tier behavior is unchanged.

- [ ] **Step 1: Update Toolbar props and the menu**

In `src/components/Toolbar.tsx`, replace the list-related prop types (lines around 17–22):

```typescript
  currentLeagueId: string;
  leagues: { id: string; name: string; scoring: "ppr" | "half" | "standard" }[];
  onSwitchLeague: (id: string) => void;
  onAddLeague: () => void;
  onRenameLeague: () => void;
  onDeleteLeague: () => void;
  onScoringChange: (scoring: "ppr" | "half" | "standard") => void;
```

Replace the menu's list block (the `props.listNames.map(...)` section and its Save/Rename/Delete buttons) with:

```tsx
            {props.leagues.map((lg) => (
              <button
                key={lg.id}
                className={
                  lg.id === props.currentLeagueId
                    ? "menu-item current"
                    : "menu-item"
                }
                onClick={() => {
                  if (lg.id !== props.currentLeagueId)
                    props.onSwitchLeague(lg.id);
                }}
              >
                {lg.id === props.currentLeagueId ? "✓ " : "  "}
                {lg.name}
              </button>
            ))}
            <button className="menu-item" onClick={props.onAddLeague}>
              + New league…
            </button>
            <button className="menu-item" onClick={props.onRenameLeague}>
              Rename current…
            </button>
            <button
              className="menu-item"
              disabled={props.leagues.length <= 1}
              onClick={props.onDeleteLeague}
            >
              Delete current
            </button>
            <div className="menu-sep" />
            <label className="menu-label">Scoring</label>
            <select
              className="menu-item"
              value={
                props.leagues.find((l) => l.id === props.currentLeagueId)
                  ?.scoring ?? "ppr"
              }
              onChange={(e) =>
                props.onScoringChange(
                  e.target.value as "ppr" | "half" | "standard",
                )
              }
            >
              <option value="ppr">PPR</option>
              <option value="half">Half-PPR</option>
              <option value="standard">Standard</option>
            </select>
```

- [ ] **Step 2: Update App.tsx hook usage and handlers**

In `src/App.tsx`, change the hook destructure (line ~34):

```typescript
const { players, dispatch, currentLeague, leagues } = useRankings();
```

Replace the list handlers (the `onSaveListAs` / `onRenameList` / `onDeleteList` block ~243–254) with:

```typescript
const onAddLeague = () => {
  const name = prompt("New league name:")?.trim();
  if (name) dispatch({ type: "addLeague", name });
};
const onRenameLeague = () => {
  const name = prompt("Rename this league:", currentLeague.name)?.trim();
  if (name) dispatch({ type: "renameLeague", id: currentLeague.id, name });
};
const onDeleteLeague = () => {
  if (leagues.length <= 1) return;
  if (
    confirm(`Delete the league "${currentLeague.name}"? This can't be undone.`)
  )
    dispatch({ type: "deleteLeague", id: currentLeague.id });
};
```

- [ ] **Step 3: Update the Toolbar props passed from App.tsx**

Replace the old `currentList` / `listNames` / `onSwitchList` / `onSaveListAs` / `onRenameList` / `onDeleteList` props (lines ~281–286) with:

```tsx
        currentLeagueId={currentLeague.id}
        leagues={leagues.map((l) => ({ id: l.id, name: l.name, scoring: l.scoring }))}
        onSwitchLeague={(id) => dispatch({ type: "switchLeague", id })}
        onAddLeague={onAddLeague}
        onRenameLeague={onRenameLeague}
        onDeleteLeague={onDeleteLeague}
        onScoringChange={(scoring) =>
          dispatch({ type: "updateLeagueSettings", id: currentLeague.id, patch: { scoring } })
        }
```

- [ ] **Step 4: Type-check and run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: zero type errors; all tests pass (existing + new league tests).

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`, open the app. Verify: the cog menu lists the league(s); "+ New league…" creates one and switches to it; the scoring dropdown changes and persists across reload; switching leagues swaps the board; existing tier/draft editing still works.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Toolbar.tsx
git commit -m "Wire App and Toolbar to the league model"
```

---

## Self-Review

**Spec coverage (this plan's slice — League data model + scoring):**

- League-as-top-level object with id/name/platform/scoring/teams/roster/board/updatedAt → Tasks 1, 3. ✓
- Per-league scoring (ppr/half/standard) editable; tePremium field present → Tasks 1, 3, 6. ✓
- 8–16 team count + roster (incl. SUPERFLEX, per-position disable, IDP-ready via `disabled`/extensible roster) → Task 1 types; editing UI for roster deferred (default roster applied) — noted in File Structure. ✓ (roster-editing form belongs to the next plan)
- Migration from `lists:v1` named lists with no data loss → Tasks 2, 4. ✓
- `updatedAt` per league for the later sync plan → Tasks 1, 3. ✓
- Blended/scoring-weighted ADP and multi-source fetch → **NOT this plan** (ADP plan, by design). The `scoring` field is stored here so the ADP plan can consume it.

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `League`, `LeaguesState`, `RosterSettings`, `Scoring`, `Platform` defined in Task 1 and used identically in Tasks 2–6. `leaguesReducer` signature `(LeaguesState, Action | LeagueAction) => LeaguesState` consistent across Tasks 3, 5. Hook returns `{ players, dispatch, currentLeague, leagues }` (Task 5), consumed exactly in Task 6. `updateLeagueSettings` patch shape matches between reducer (Task 3) and call sites (Task 6). ✓

**Deliberately retained:** `Board`, `boardReducer`, `ListAction`, `loadBoard`, `saveBoard` stay in the codebase (the migration reads `Board`; their tests stay green). A later cleanup plan can remove the now-unused `boardReducer`/`ListAction` once nothing imports them.
