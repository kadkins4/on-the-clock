# FF Cheat Sheet Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A local Vite + React + TypeScript single-page fantasy-football cheat sheet: one editable, drag-to-reorder ranking list, pre-seeded from ESPN, persisted to localStorage, with CSV/JSON import-export and draft-day cross-off.

**Architecture:** Pure, unit-tested core (`src/lib/*`, `src/state/reducer.ts`) holds all logic — ranking math, CSV, storage, the state reducer. A thin React UI (`src/components/*`, `src/App.tsx`) renders it and dispatches actions. A standalone Node script (`scripts/fetch-espn.mjs`) regenerates `src/data/seed.json` from ESPN's fantasy API.

**Tech Stack:** Vite, React 18, TypeScript, @dnd-kit (core/sortable/utilities) for drag-reorder, Vitest + jsdom for unit tests. No backend.

---

## Conventions

- **All commits** must end with this trailer (separate paragraph in the message):

  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

  Commit-message bodies below are shown short; append the trailer to every one, e.g.:

  ```bash
  git commit -m "$(printf 'Scaffold Vite + React + TS project\n\nCo-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>')"
  ```

- Run every command from the worktree root:
  `/Users/kendalladkins/Developer/ff-cheat-sheet/.claude/worktrees/ff-cheat-sheet-build`
- `.gitignore` already ignores `node_modules/`, `dist/`, `.DS_Store` (committed earlier).

---

## File Structure

| File                                                            | Responsibility                                                                                  |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html` | Project config + Vitest config                                                                  |
| `src/main.tsx`                                                  | React entry point                                                                               |
| `src/index.css`                                                 | Minimal styling                                                                                 |
| `src/types.ts`                                                  | `Player`, `Position`, `Flag`, `SortKey`, `POSITIONS`                                            |
| `src/lib/ranking.ts`                                            | `reassignOverallRanks`, `computePositionalRanks`, `groupByTier`, `sortPlayers`, `moveAndRetier` |
| `src/lib/csv.ts`                                                | `toCsv`, `parseCsv`, `parseCsvLine`                                                             |
| `src/lib/storage.ts`                                            | `savePlayers`, `loadPlayers`, `exportJson`, `importJson`                                        |
| `src/state/reducer.ts`                                          | `rankingReducer` + `Action` union                                                               |
| `src/state/useRankings.ts`                                      | `useReducer` + localStorage persistence hook                                                    |
| `src/data/seed.json`                                            | ESPN-seeded players (generated; starts as `[]`)                                                 |
| `src/components/Toolbar.tsx`                                    | Search, position chips, hide-drafted, sort, add/import/export buttons                           |
| `src/components/PlayerTable.tsx`                                | DnD context + grouped/flat table rendering                                                      |
| `src/components/TierGroup.tsx`                                  | Tier divider + its rows                                                                         |
| `src/components/PlayerRow.tsx`                                  | One sortable, inline-editable row                                                               |
| `src/components/AddPlayerForm.tsx`                              | Manual add-player form                                                                          |
| `src/App.tsx`                                                   | Top-level: view state, selectors, wiring                                                        |
| `scripts/fetch-espn.mjs`                                        | Re-pull ESPN, regenerate `seed.json`                                                            |

---

## Task 1: Scaffold the project

**Files:**

- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx` (placeholder), `src/index.css`, `src/data/seed.json`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ff-cheat-sheet",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "fetch-espn": "node scripts/fetch-espn.mjs"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FF Cheat Sheet</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/data/seed.json` (empty placeholder; populated in Task 8)**

```json
[]
```

- [ ] **Step 6: Create `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 7: Create placeholder `src/App.tsx` (replaced in Task 10)**

```tsx
export default function App() {
  return <h1>FF Cheat Sheet</h1>;
}
```

- [ ] **Step 8: Create minimal `src/index.css`**

```css
body {
  font-family: system-ui, sans-serif;
  margin: 1rem;
}
```

- [ ] **Step 9: Install dependencies**

```bash
npm install react react-dom @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest jsdom
```

- [ ] **Step 10: Verify the build compiles**

Run: `npm run build`
Expected: TypeScript passes and Vite writes `dist/` with no errors.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "Scaffold Vite + React + TS project"
```

---

## Task 2: Type definitions

**Files:**

- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
export type Flag = "none" | "target" | "avoid";
export type SortKey = "overall" | "adp" | "name" | "bye";

export const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export interface Player {
  id: string; // ESPN id for seeded rows, uuid for new
  name: string;
  position: Position;
  team: string; // abbreviation, "FA" if none
  overallRank: number; // 1-based, derived from list order
  byeWeek: number | null;
  tier: number | null; // null = "Untiered" group
  adp: number | null;
  notes: string;
  flag: Flag;
  drafted: boolean;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "Add Player data model types"
```

---

## Task 3: Ranking logic (`src/lib/ranking.ts`)

**Files:**

- Create: `src/lib/ranking.ts`
- Test: `src/lib/ranking.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/ranking.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  reassignOverallRanks,
  computePositionalRanks,
  groupByTier,
  sortPlayers,
  moveAndRetier,
} from "./ranking";
import type { Player } from "../types";

function mk(partial: Partial<Player> & { id: string }): Player {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    position: partial.position ?? "RB",
    team: partial.team ?? "FA",
    overallRank: partial.overallRank ?? 0,
    byeWeek: partial.byeWeek ?? null,
    tier: partial.tier ?? null,
    adp: partial.adp ?? null,
    notes: partial.notes ?? "",
    flag: partial.flag ?? "none",
    drafted: partial.drafted ?? false,
  };
}

describe("reassignOverallRanks", () => {
  it("sets 1-based ranks from array order", () => {
    const out = reassignOverallRanks([
      mk({ id: "a" }),
      mk({ id: "b" }),
      mk({ id: "c" }),
    ]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2, 3]);
  });
});

describe("computePositionalRanks", () => {
  it("numbers each position by overall-rank order", () => {
    const players = [
      mk({ id: "rb1", position: "RB", overallRank: 1 }),
      mk({ id: "wr1", position: "WR", overallRank: 2 }),
      mk({ id: "rb2", position: "RB", overallRank: 3 }),
    ];
    const r = computePositionalRanks(players);
    expect(r["rb1"]).toBe(1);
    expect(r["rb2"]).toBe(2);
    expect(r["wr1"]).toBe(1);
  });
});

describe("groupByTier", () => {
  it("groups by tier ascending with untiered last", () => {
    const players = [
      mk({ id: "a", tier: 2, overallRank: 3 }),
      mk({ id: "b", tier: 1, overallRank: 1 }),
      mk({ id: "c", tier: null, overallRank: 2 }),
    ];
    const g = groupByTier(players);
    expect(g.map((x) => x.tier)).toEqual([1, 2, null]);
    expect(g[0].players[0].id).toBe("b");
  });
});

describe("sortPlayers", () => {
  it("sorts by name ascending", () => {
    const players = [
      mk({ id: "1", name: "Zeb" }),
      mk({ id: "2", name: "Abe" }),
    ];
    expect(sortPlayers(players, "name").map((p) => p.name)).toEqual([
      "Abe",
      "Zeb",
    ]);
  });
  it("puts null adp last", () => {
    const players = [mk({ id: "1", adp: null }), mk({ id: "2", adp: 5 })];
    expect(sortPlayers(players, "adp").map((p) => p.id)).toEqual(["2", "1"]);
  });
});

describe("moveAndRetier", () => {
  it("moves a player and adopts the tier of its new neighbor", () => {
    const players = [
      mk({ id: "a", tier: 1, overallRank: 1 }),
      mk({ id: "b", tier: 1, overallRank: 2 }),
      mk({ id: "c", tier: 2, overallRank: 3 }),
    ];
    const out = moveAndRetier(players, "c", "a");
    expect(out.map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(out.find((p) => p.id === "c")!.tier).toBe(1);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/ranking.test.ts`
Expected: FAIL — `Failed to resolve import "./ranking"`.

- [ ] **Step 3: Implement `src/lib/ranking.ts`**

```ts
import type { Player, SortKey } from "../types";

export function reassignOverallRanks(players: Player[]): Player[] {
  return players.map((p, i) => ({ ...p, overallRank: i + 1 }));
}

export function computePositionalRanks(
  players: Player[],
): Record<string, number> {
  const byPos: Record<string, Player[]> = {};
  for (const p of players) (byPos[p.position] ??= []).push(p);
  const result: Record<string, number> = {};
  for (const pos of Object.keys(byPos)) {
    byPos[pos]
      .slice()
      .sort((a, b) => a.overallRank - b.overallRank)
      .forEach((p, i) => {
        result[p.id] = i + 1;
      });
  }
  return result;
}

export interface TierGroup {
  tier: number | null;
  players: Player[];
}

export function groupByTier(players: Player[]): TierGroup[] {
  const sorted = players.slice().sort((a, b) => a.overallRank - b.overallRank);
  const map = new Map<number | null, Player[]>();
  for (const p of sorted) {
    if (!map.has(p.tier)) map.set(p.tier, []);
    map.get(p.tier)!.push(p);
  }
  const numbered = [...map.keys()]
    .filter((t): t is number => t !== null)
    .sort((a, b) => a - b);
  const groups: TierGroup[] = numbered.map((t) => ({
    tier: t,
    players: map.get(t)!,
  }));
  if (map.has(null)) groups.push({ tier: null, players: map.get(null)! });
  return groups;
}

export function sortPlayers(
  players: Player[],
  key: SortKey,
  asc = true,
): Player[] {
  const dir = asc ? 1 : -1;
  const cmp = (a: Player, b: Player): number => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name);
      case "adp":
        return (a.adp ?? Infinity) - (b.adp ?? Infinity);
      case "bye":
        return (a.byeWeek ?? Infinity) - (b.byeWeek ?? Infinity);
      case "overall":
      default:
        return a.overallRank - b.overallRank;
    }
  };
  return players.slice().sort((a, b) => cmp(a, b) * dir);
}

// Reorder by dragging `activeId` onto `overId` in the overall-rank ordering.
// The moved player adopts the tier of its new upper neighbor (or lower neighbor
// if it lands first), giving "drag across a divider re-tiers" behavior.
export function moveAndRetier(
  players: Player[],
  activeId: string,
  overId: string,
): Player[] {
  const ordered = players.slice().sort((a, b) => a.overallRank - b.overallRank);
  const from = ordered.findIndex((p) => p.id === activeId);
  const to = ordered.findIndex((p) => p.id === overId);
  if (from === -1 || to === -1 || from === to) return players;
  const [moved] = ordered.splice(from, 1);
  ordered.splice(to, 0, moved);
  const idx = ordered.findIndex((p) => p.id === activeId);
  const neighbor = idx > 0 ? ordered[idx - 1] : ordered[idx + 1];
  const newTier = neighbor ? neighbor.tier : moved.tier;
  ordered[idx] = { ...moved, tier: newTier };
  return reassignOverallRanks(ordered);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/ranking.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ranking.ts src/lib/ranking.test.ts
git commit -m "Add ranking logic with tests"
```

---

## Task 4: CSV import/export (`src/lib/csv.ts`)

**Files:**

- Create: `src/lib/csv.ts`
- Test: `src/lib/csv.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/csv.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toCsv, parseCsv } from "./csv";
import type { Player } from "../types";

const sample: Player[] = [
  {
    id: "1",
    name: "Bijan Robinson",
    position: "RB",
    team: "ATL",
    overallRank: 1,
    byeWeek: null,
    tier: 1,
    adp: 2.2,
    notes: "workhorse, RB1",
    flag: "target",
    drafted: false,
  },
  {
    id: "2",
    name: 'Some "Guy"',
    position: "WR",
    team: "CIN",
    overallRank: 2,
    byeWeek: 12,
    tier: 2,
    adp: null,
    notes: "",
    flag: "none",
    drafted: false,
  },
];

describe("toCsv / parseCsv", () => {
  it("starts with the canonical header", () => {
    expect(toCsv(sample).split("\n")[0]).toBe(
      "rank,name,position,team,bye,tier,adp,notes,flag",
    );
  });

  it("round-trips field values (commas, quotes, nulls)", () => {
    const parsed = parseCsv(toCsv(sample));
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe("Bijan Robinson");
    expect(parsed[0].notes).toBe("workhorse, RB1");
    expect(parsed[0].adp).toBe(2.2);
    expect(parsed[0].tier).toBe(1);
    expect(parsed[0].flag).toBe("target");
    expect(parsed[0].drafted).toBe(false);
    expect(parsed[1].name).toBe('Some "Guy"');
    expect(parsed[1].byeWeek).toBe(12);
    expect(parsed[1].adp).toBeNull();
  });

  it("falls back to row order when rank column is absent", () => {
    const csv = "name,position,team\nAlice,RB,ATL\nBob,WR,CIN";
    const parsed = parseCsv(csv);
    expect(parsed.map((p) => p.overallRank)).toEqual([1, 2]);
    expect(parsed[1].team).toBe("CIN");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/csv.test.ts`
Expected: FAIL — `Failed to resolve import "./csv"`.

- [ ] **Step 3: Implement `src/lib/csv.ts`**

```ts
import type { Player, Position, Flag } from "../types";
import { POSITIONS } from "../types";

const HEADER = [
  "rank",
  "name",
  "position",
  "team",
  "bye",
  "tier",
  "adp",
  "notes",
  "flag",
];

function escapeField(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(players: Player[]): string {
  const rows = [HEADER.join(",")];
  for (const p of players) {
    rows.push(
      [
        String(p.overallRank),
        escapeField(p.name),
        p.position,
        escapeField(p.team),
        p.byeWeek == null ? "" : String(p.byeWeek),
        p.tier == null ? "" : String(p.tier),
        p.adp == null ? "" : String(p.adp),
        escapeField(p.notes),
        p.flag,
      ].join(","),
    );
  }
  return rows.join("\n");
}

export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function toPosition(v: string): Position {
  const up = v.toUpperCase();
  return (POSITIONS as string[]).includes(up) ? (up as Position) : "WR";
}

function toFlag(v: string): Flag {
  return v === "target" || v === "avoid" ? v : "none";
}

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function parseCsv(text: string): Player[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const col = (name: string) => header.indexOf(name);
  const ci = {
    rank: col("rank"),
    name: col("name"),
    position: col("position"),
    team: col("team"),
    bye: col("bye"),
    tier: col("tier"),
    adp: col("adp"),
    notes: col("notes"),
    flag: col("flag"),
  };
  const players: Player[] = [];
  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const get = (idx: number) => (idx >= 0 && idx < f.length ? f[idx] : "");
    const rankVal = numOrNull(get(ci.rank));
    players.push({
      id: crypto.randomUUID(),
      name: get(ci.name).trim(),
      position: toPosition(get(ci.position)),
      team: get(ci.team).trim() || "FA",
      overallRank: rankVal ?? i,
      byeWeek: numOrNull(get(ci.bye)),
      tier: numOrNull(get(ci.tier)),
      adp: numOrNull(get(ci.adp)),
      notes: get(ci.notes),
      flag: toFlag(get(ci.flag).trim()),
      drafted: false,
    });
  }
  return players;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/csv.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/csv.ts src/lib/csv.test.ts
git commit -m "Add CSV parse/serialize with tests"
```

---

## Task 5: Persistence (`src/lib/storage.ts`)

**Files:**

- Create: `src/lib/storage.ts`
- Test: `src/lib/storage.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/storage.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { savePlayers, loadPlayers, exportJson, importJson } from "./storage";
import seed from "../data/seed.json";
import type { Player } from "../types";

const players: Player[] = [
  {
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
    drafted: false,
  },
];

beforeEach(() => localStorage.clear());

describe("storage", () => {
  it("saves and loads players", () => {
    savePlayers(players);
    expect(loadPlayers()).toEqual(players);
  });

  it("falls back to the seed when nothing is stored", () => {
    expect(loadPlayers()).toEqual(seed);
  });

  it("round-trips JSON export/import", () => {
    expect(importJson(exportJson(players))).toEqual(players);
  });

  it("throws on non-array JSON import", () => {
    expect(() => importJson('{"foo":1}')).toThrow();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: FAIL — `Failed to resolve import "./storage"`.

- [ ] **Step 3: Implement `src/lib/storage.ts`**

```ts
import type { Player } from "../types";
import seed from "../data/seed.json";

const KEY = "ff-cheat-sheet:players:v1";

export function savePlayers(players: Player[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(players));
  } catch {
    // storage full / unavailable — ignore
  }
}

export function loadPlayers(): Player[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as Player[];
    }
  } catch {
    // corrupt JSON — fall through to seed
  }
  return seed as unknown as Player[];
}

export function exportJson(players: Player[]): string {
  return JSON.stringify(players, null, 2);
}

export function importJson(text: string): Player[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed))
    throw new Error("Expected a JSON array of players");
  return parsed as Player[];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/storage.test.ts`
Expected: PASS (4 tests). (`seed` is `[]` at this point, so the fallback test compares against `[]`; it stays correct after Task 8 because it compares against the imported seed, whatever it contains.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/storage.ts src/lib/storage.test.ts
git commit -m "Add localStorage persistence and JSON import/export"
```

---

## Task 6: State reducer (`src/state/reducer.ts`)

**Files:**

- Create: `src/state/reducer.ts`
- Test: `src/state/reducer.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/state/reducer.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { rankingReducer } from "./reducer";
import type { Player } from "../types";

function mk(id: string, over: number, tier: number | null = 1): Player {
  return {
    id,
    name: id,
    position: "RB",
    team: "FA",
    overallRank: over,
    byeWeek: null,
    tier,
    adp: null,
    notes: "",
    flag: "none",
    drafted: false,
  };
}

describe("rankingReducer", () => {
  const base = [mk("a", 1), mk("b", 2), mk("c", 3)];

  it("setAll sorts by rank and reassigns 1-based ranks", () => {
    const out = rankingReducer([], {
      type: "setAll",
      players: [mk("x", 5), mk("y", 1)],
    });
    expect(out.map((p) => p.id)).toEqual(["y", "x"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2]);
  });

  it("add appends and reassigns ranks", () => {
    const out = rankingReducer(base, { type: "add", player: mk("d", 0) });
    expect(out).toHaveLength(4);
    expect(out[3]).toMatchObject({ id: "d", overallRank: 4 });
  });

  it("update patches a single player", () => {
    const out = rankingReducer(base, {
      type: "update",
      id: "b",
      patch: { notes: "hi" },
    });
    expect(out.find((p) => p.id === "b")!.notes).toBe("hi");
  });

  it("remove drops the player and reassigns ranks", () => {
    const out = rankingReducer(base, { type: "remove", id: "a" });
    expect(out.map((p) => p.id)).toEqual(["b", "c"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2]);
  });

  it("toggleDrafted flips drafted", () => {
    const out = rankingReducer(base, { type: "toggleDrafted", id: "a" });
    expect(out.find((p) => p.id === "a")!.drafted).toBe(true);
  });

  it("move reorders and reassigns ranks", () => {
    const out = rankingReducer(base, {
      type: "move",
      activeId: "c",
      overId: "a",
    });
    expect(out.map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2, 3]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/state/reducer.test.ts`
Expected: FAIL — `Failed to resolve import "./reducer"`.

- [ ] **Step 3: Implement `src/state/reducer.ts`**

```ts
import type { Player } from "../types";
import { reassignOverallRanks, moveAndRetier } from "../lib/ranking";

export type Action =
  | { type: "setAll"; players: Player[] }
  | { type: "add"; player: Player }
  | { type: "update"; id: string; patch: Partial<Player> }
  | { type: "remove"; id: string }
  | { type: "toggleDrafted"; id: string }
  | { type: "move"; activeId: string; overId: string };

export function rankingReducer(state: Player[], action: Action): Player[] {
  switch (action.type) {
    case "setAll": {
      const sorted = action.players
        .slice()
        .sort((a, b) => a.overallRank - b.overallRank);
      return reassignOverallRanks(sorted);
    }
    case "add":
      return reassignOverallRanks([...state, action.player]);
    case "update":
      return state.map((p) =>
        p.id === action.id ? { ...p, ...action.patch } : p,
      );
    case "remove":
      return reassignOverallRanks(state.filter((p) => p.id !== action.id));
    case "toggleDrafted":
      return state.map((p) =>
        p.id === action.id ? { ...p, drafted: !p.drafted } : p,
      );
    case "move":
      return moveAndRetier(state, action.activeId, action.overId);
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/state/reducer.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/state/reducer.ts src/state/reducer.test.ts
git commit -m "Add ranking state reducer with tests"
```

---

## Task 7: Persistence hook (`src/state/useRankings.ts`)

**Files:**

- Create: `src/state/useRankings.ts`

- [ ] **Step 1: Create `src/state/useRankings.ts`**

```ts
import { useEffect, useReducer } from "react";
import { rankingReducer } from "./reducer";
import { loadPlayers, savePlayers } from "../lib/storage";

export function useRankings() {
  const [players, dispatch] = useReducer(
    rankingReducer,
    undefined,
    loadPlayers,
  );
  useEffect(() => {
    savePlayers(players);
  }, [players]);
  return { players, dispatch };
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/state/useRankings.ts
git commit -m "Add useRankings hook with autosave"
```

---

## Task 8: ESPN fetch script + seed generation

**Files:**

- Create: `scripts/fetch-espn.mjs`
- Modify (generated): `src/data/seed.json`

- [ ] **Step 1: Create `scripts/fetch-espn.mjs`**

```js
// Re-pull ESPN fantasy rankings and regenerate src/data/seed.json.
// Run: npm run fetch-espn
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SEASON = 2026;
const LIMIT = 300;
const TIER_SIZE = 12; // ~one draft round per tier

const POS = { 1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DST" };
const TEAM = {
  0: "FA",
  1: "ATL",
  2: "BUF",
  3: "CHI",
  4: "CIN",
  5: "CLE",
  6: "DAL",
  7: "DEN",
  8: "DET",
  9: "GB",
  10: "TEN",
  11: "IND",
  12: "KC",
  13: "LV",
  14: "LAR",
  15: "MIA",
  16: "MIN",
  17: "NE",
  18: "NO",
  19: "NYG",
  20: "NYJ",
  21: "PHI",
  22: "ARI",
  23: "PIT",
  24: "LAC",
  25: "SF",
  26: "SEA",
  27: "TB",
  28: "WSH",
  29: "CAR",
  30: "JAX",
  33: "BAL",
  34: "HOU",
};

const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${SEASON}/players?view=kona_player_info`;
const filter = {
  players: {
    limit: LIMIT,
    sortDraftRanks: { sortPriority: 100, sortAsc: true, value: "PPR" },
  },
};

const res = await fetch(url, {
  headers: {
    "x-fantasy-filter": JSON.stringify(filter),
    accept: "application/json",
  },
});
if (!res.ok) {
  console.error(`ESPN request failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}

const data = await res.json();
const raw = Array.isArray(data.players) ? data.players : data;

const players = [];
for (const entry of raw) {
  const p = entry.player ?? entry;
  const position = POS[p.defaultPositionId];
  if (!position) continue;
  const pprRank = p.draftRanksByRankType?.PPR?.rank;
  players.push({
    id: String(p.id),
    name: p.fullName ?? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(),
    position,
    team: TEAM[p.proTeamId] ?? "FA",
    overallRank: pprRank ?? players.length + 1,
    byeWeek: null,
    tier: null,
    adp: p.ownership?.averageDraftPosition ?? null,
    notes: "",
    flag: "none",
    drafted: false,
  });
}

players.sort((a, b) => a.overallRank - b.overallRank);
players.forEach((p, i) => {
  p.overallRank = i + 1;
  p.tier = Math.floor(i / TIER_SIZE) + 1;
});

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "..", "src", "data", "seed.json");
writeFileSync(out, JSON.stringify(players, null, 2) + "\n");
console.log(`Wrote ${players.length} players to ${out}`);
```

- [ ] **Step 2: Run the script to generate seed data**

Run: `npm run fetch-espn`
Expected: prints `Wrote <N> players to .../src/data/seed.json` with N in the ~250–300 range.

If the request fails (non-200) or writes 0 players, do NOT proceed — report the failure. The app still works with an empty seed, but the point of this task is the ESPN data. The 2026 ranks are preseason and may be sparse; if N is small but nonzero, that's expected for this time of year — note the count and continue.

- [ ] **Step 3: Sanity-check the generated file**

Run: `node -e "const s=require('./src/data/seed.json'); console.log(s.length, s[0])"`
Expected: a count and a first player object with non-empty `name`, a valid `position`, a team abbreviation, `overallRank: 1`, and `tier: 1`.

- [ ] **Step 4: Re-run the full test suite (seed is now populated)**

Run: `npm test`
Expected: all tests PASS. The storage fallback test compares against the imported seed, so it stays green with real data.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-espn.mjs src/data/seed.json
git commit -m "Add ESPN fetch script and seed data"
```

---

## Task 9: UI components

**Files:**

- Create: `src/components/PlayerRow.tsx`, `src/components/TierGroup.tsx`,
  `src/components/PlayerTable.tsx`, `src/components/Toolbar.tsx`,
  `src/components/AddPlayerForm.tsx`

- [ ] **Step 1: Create `src/components/PlayerRow.tsx`**

```tsx
import type { Dispatch, CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Player, Position, Flag } from "../types";
import { POSITIONS } from "../types";
import type { Action } from "../state/reducer";

interface Props {
  player: Player;
  positionalRank: number;
  draggable: boolean;
  dispatch: Dispatch<Action>;
}

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
    opacity: isDragging ? 0.5 : player.drafted ? 0.45 : 1,
  };

  const upd = (patch: Partial<Player>) =>
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

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={player.drafted ? "row drafted" : "row"}
    >
      <td
        className="drag"
        {...(draggable ? { ...attributes, ...listeners } : {})}
      >
        {draggable ? "⠿" : ""}
      </td>
      <td className="rank">{player.overallRank}</td>
      <td>
        <button
          className={`flag flag-${player.flag}`}
          onClick={cycleFlag}
          title={player.flag}
        >
          {player.flag === "target" ? "★" : player.flag === "avoid" ? "⚑" : "·"}
        </button>
      </td>
      <td>
        <input
          className="name"
          value={player.name}
          onChange={(e) => upd({ name: e.target.value })}
        />
      </td>
      <td className="pos">
        <select
          value={player.position}
          onChange={(e) => upd({ position: e.target.value as Position })}
        >
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <span className="posrank">
          {player.position}
          {positionalRank}
        </span>
      </td>
      <td>
        <input
          className="team"
          value={player.team}
          onChange={(e) => upd({ team: e.target.value.toUpperCase() })}
        />
      </td>
      <td>
        <input
          className="num"
          value={player.byeWeek ?? ""}
          onChange={(e) =>
            upd({
              byeWeek: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </td>
      <td>
        <input
          className="num"
          value={player.tier ?? ""}
          onChange={(e) =>
            upd({ tier: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </td>
      <td>
        <input
          className="num"
          value={player.adp ?? ""}
          onChange={(e) =>
            upd({ adp: e.target.value === "" ? null : Number(e.target.value) })
          }
        />
      </td>
      <td>
        <input
          className="notes"
          value={player.notes}
          onChange={(e) => upd({ notes: e.target.value })}
        />
      </td>
      <td className="drafted-cell">
        <input
          type="checkbox"
          checked={player.drafted}
          onChange={() => dispatch({ type: "toggleDrafted", id: player.id })}
        />
      </td>
      <td>
        <button
          className="del"
          onClick={() => dispatch({ type: "remove", id: player.id })}
        >
          ✕
        </button>
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Create `src/components/TierGroup.tsx`**

```tsx
import type { Dispatch } from "react";
import type { Player } from "../types";
import type { Action } from "../state/reducer";
import { PlayerRow } from "./PlayerRow";

interface Props {
  tier: number | null;
  players: Player[];
  positionalRanks: Record<string, number>;
  dispatch: Dispatch<Action>;
}

export function TierGroup({ tier, players, positionalRanks, dispatch }: Props) {
  return (
    <>
      <tr className="tier-divider">
        <td colSpan={12}>{tier == null ? "Untiered" : `Tier ${tier}`}</td>
      </tr>
      {players.map((p) => (
        <PlayerRow
          key={p.id}
          player={p}
          positionalRank={positionalRanks[p.id]}
          draggable
          dispatch={dispatch}
        />
      ))}
    </>
  );
}
```

- [ ] **Step 3: Create `src/components/PlayerTable.tsx`**

```tsx
import type { Dispatch } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Player } from "../types";
import type { TierGroup as TG } from "../lib/ranking";
import type { Action } from "../state/reducer";
import { PlayerRow } from "./PlayerRow";
import { TierGroup } from "./TierGroup";

interface Props {
  grouped: boolean;
  groups: TG[];
  flat: Player[];
  positionalRanks: Record<string, number>;
  dispatch: Dispatch<Action>;
}

export function PlayerTable({
  grouped,
  groups,
  flat,
  positionalRanks,
  dispatch,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );

  const orderedIds = grouped
    ? groups.flatMap((g) => g.players.map((p) => p.id))
    : flat.map((p) => p.id);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      dispatch({
        type: "move",
        activeId: String(active.id),
        overId: String(over.id),
      });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <table className="players">
        <thead>
          <tr>
            <th></th>
            <th>#</th>
            <th>★/⚑</th>
            <th>Player</th>
            <th>Pos</th>
            <th>Team</th>
            <th>Bye</th>
            <th>Tier</th>
            <th>ADP</th>
            <th>Notes</th>
            <th>Drafted</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <SortableContext
            items={orderedIds}
            strategy={verticalListSortingStrategy}
          >
            {grouped
              ? groups.map((g) => (
                  <TierGroup
                    key={String(g.tier)}
                    tier={g.tier}
                    players={g.players}
                    positionalRanks={positionalRanks}
                    dispatch={dispatch}
                  />
                ))
              : flat.map((p) => (
                  <PlayerRow
                    key={p.id}
                    player={p}
                    positionalRank={positionalRanks[p.id]}
                    draggable={false}
                    dispatch={dispatch}
                  />
                ))}
          </SortableContext>
        </tbody>
      </table>
    </DndContext>
  );
}
```

- [ ] **Step 4: Create `src/components/Toolbar.tsx`**

```tsx
import type { Position, SortKey } from "../types";
import { POSITIONS } from "../types";

interface Props {
  search: string;
  setSearch: (s: string) => void;
  posFilter: Position | "All";
  setPosFilter: (p: Position | "All") => void;
  hideDrafted: boolean;
  setHideDrafted: (b: boolean) => void;
  sortKey: SortKey | null;
  setSortKey: (k: SortKey | null) => void;
  onAdd: () => void;
  onImport: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}

export function Toolbar(props: Props) {
  return (
    <div className="toolbar">
      <input
        className="search"
        placeholder="Search…"
        value={props.search}
        onChange={(e) => props.setSearch(e.target.value)}
      />
      <div className="chips">
        {(["All", ...POSITIONS] as const).map((p) => (
          <button
            key={p}
            className={props.posFilter === p ? "chip active" : "chip"}
            onClick={() => props.setPosFilter(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <label className="hide-drafted">
        <input
          type="checkbox"
          checked={props.hideDrafted}
          onChange={(e) => props.setHideDrafted(e.target.checked)}
        />{" "}
        Hide drafted
      </label>
      <label>
        Sort:{" "}
        <select
          value={props.sortKey ?? "tier"}
          onChange={(e) =>
            props.setSortKey(
              e.target.value === "tier" ? null : (e.target.value as SortKey),
            )
          }
        >
          <option value="tier">Tier (grouped)</option>
          <option value="overall">Overall</option>
          <option value="adp">ADP</option>
          <option value="name">Name</option>
          <option value="bye">Bye</option>
        </select>
      </label>
      <button onClick={props.onAdd}>Add player</button>
      <button onClick={props.onImport}>Import</button>
      <button onClick={props.onExportJson}>Export JSON</button>
      <button onClick={props.onExportCsv}>Export CSV</button>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/components/AddPlayerForm.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import type { Player, Position } from "../types";
import { POSITIONS } from "../types";

interface Props {
  onAdd: (p: Player) => void;
  onClose: () => void;
}

export function AddPlayerForm({ onAdd, onClose }: Props) {
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("RB");
  const [team, setTeam] = useState("");

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      name: name.trim(),
      position,
      team: team.trim().toUpperCase() || "FA",
      overallRank: 0, // reassigned by the reducer
      byeWeek: null,
      tier: null,
      adp: null,
      notes: "",
      flag: "none",
      drafted: false,
    });
    onClose();
  };

  return (
    <form className="add-form" onSubmit={submit}>
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoFocus
      />
      <select
        value={position}
        onChange={(e) => setPosition(e.target.value as Position)}
      >
        {POSITIONS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <input
        placeholder="Team"
        value={team}
        onChange={(e) => setTeam(e.target.value)}
      />
      <button type="submit">Add</button>
      <button type="button" onClick={onClose}>
        Cancel
      </button>
    </form>
  );
}
```

- [ ] **Step 6: Verify everything compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (App still imports nothing new yet; components are self-consistent.)

- [ ] **Step 7: Commit**

```bash
git add src/components
git commit -m "Add UI components"
```

---

## Task 10: Wire up App + styling, manual verification

**Files:**

- Modify: `src/App.tsx` (replace placeholder)
- Modify: `src/index.css`

- [ ] **Step 1: Replace `src/App.tsx`**

```tsx
import { useMemo, useState } from "react";
import { useRankings } from "./state/useRankings";
import {
  computePositionalRanks,
  groupByTier,
  sortPlayers,
} from "./lib/ranking";
import { toCsv, parseCsv } from "./lib/csv";
import { exportJson, importJson } from "./lib/storage";
import type { Position, SortKey } from "./types";
import { Toolbar } from "./components/Toolbar";
import { PlayerTable } from "./components/PlayerTable";
import { AddPlayerForm } from "./components/AddPlayerForm";

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const { players, dispatch } = useRankings();
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<Position | "All">("All");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const positionalRanks = useMemo(
    () => computePositionalRanks(players),
    [players],
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter(
      (p) =>
        (posFilter === "All" || p.position === posFilter) &&
        (q === "" || p.name.toLowerCase().includes(q)) &&
        (!hideDrafted || !p.drafted),
    );
  }, [players, search, posFilter, hideDrafted]);

  const grouped = sortKey === null;
  const groups = useMemo(
    () => (grouped ? groupByTier(visible) : []),
    [grouped, visible],
  );
  const flat = useMemo(
    () => (grouped ? [] : sortPlayers(visible, sortKey!, true)),
    [grouped, visible, sortKey],
  );

  const onImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      if (!confirm("Importing will REPLACE your current list. Continue?"))
        return;
      try {
        const parsed = file.name.toLowerCase().endsWith(".csv")
          ? parseCsv(text)
          : importJson(text);
        dispatch({ type: "setAll", players: parsed });
      } catch (err) {
        alert("Import failed: " + (err as Error).message);
      }
    };
    input.click();
  };

  return (
    <div className="app">
      <h1>FF Cheat Sheet</h1>
      <Toolbar
        search={search}
        setSearch={setSearch}
        posFilter={posFilter}
        setPosFilter={setPosFilter}
        hideDrafted={hideDrafted}
        setHideDrafted={setHideDrafted}
        sortKey={sortKey}
        setSortKey={setSortKey}
        onAdd={() => setShowAdd(true)}
        onImport={onImport}
        onExportJson={() =>
          download("rankings.json", exportJson(players), "application/json")
        }
        onExportCsv={() => download("rankings.csv", toCsv(players), "text/csv")}
      />
      {showAdd && (
        <AddPlayerForm
          onAdd={(p) => dispatch({ type: "add", player: p })}
          onClose={() => setShowAdd(false)}
        />
      )}
      <PlayerTable
        grouped={grouped}
        groups={groups}
        flat={flat}
        positionalRanks={positionalRanks}
        dispatch={dispatch}
      />
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/index.css`**

```css
:root {
  font-family: system-ui, sans-serif;
  font-size: 14px;
}
body {
  margin: 1rem;
  color: #1a1a1a;
}
.app h1 {
  font-size: 1.25rem;
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
}
.chips {
  display: flex;
  gap: 0.25rem;
}
.chip {
  padding: 0.2rem 0.6rem;
  border: 1px solid #ccc;
  background: #fff;
  border-radius: 999px;
  cursor: pointer;
}
.chip.active {
  background: #1a1a1a;
  color: #fff;
  border-color: #1a1a1a;
}
table.players {
  border-collapse: collapse;
  width: 100%;
}
table.players th,
table.players td {
  padding: 0.25rem 0.4rem;
  text-align: left;
  border-bottom: 1px solid #eee;
  white-space: nowrap;
}
.tier-divider td {
  background: #f3f4f6;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  font-size: 0.75rem;
}
.row.drafted .name {
  text-decoration: line-through;
}
.drag {
  cursor: grab;
  color: #aaa;
  user-select: none;
}
.flag {
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1rem;
}
.flag-target {
  color: #16a34a;
}
.flag-avoid {
  color: #dc2626;
}
.posrank {
  margin-left: 0.3rem;
  color: #888;
  font-size: 0.8rem;
}
input.name {
  width: 12rem;
}
input.notes {
  width: 14rem;
}
input.num {
  width: 3rem;
}
input.team {
  width: 3.5rem;
}
.del {
  border: none;
  background: none;
  color: #dc2626;
  cursor: pointer;
}
.add-form {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
  padding: 0.5rem;
  background: #f9fafb;
  border: 1px solid #eee;
}
```

- [ ] **Step 3: Verify build + full test suite**

Run: `npm run build && npm test`
Expected: build succeeds; all tests PASS.

- [ ] **Step 4: Manual smoke test in the browser**

Run: `npm run dev` (then open the printed localhost URL).
Verify:

- Players load grouped by tier, ordered by rank, with positional ranks (e.g. `RB1`).
- Drag a row across a tier divider → its tier and rank update; reload the page → change persisted.
- Toggle a "Drafted" checkbox → row dims + name strikes; "Hide drafted" removes it.
- Position chips + search filter the list; the Sort dropdown switches to a flat sorted list (drag handle disappears).
- Click a flag cell → cycles ·→★→⚑; ★ is green, ⚑ is red.
- "Add player" adds a row at the end; "✕" removes a row.
- "Export CSV"/"Export JSON" download files; "Import" prompts to replace and loads a file.

Stop the dev server when done (Ctrl-C).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/index.css
git commit -m "Wire up App and styling"
```

---

## Done

After Task 10, the app is feature-complete per the spec: seeded ranking list, inline editing, drag-reorder with tier divider re-tiering, tier grouping, position/search/hide-drafted filters, column sort, draft cross-off, CSV/JSON import (replace) & export, localStorage autosave, and a re-runnable ESPN seed script. Pure logic (ranking, csv, storage, reducer) is covered by Vitest; the UI is verified manually.
