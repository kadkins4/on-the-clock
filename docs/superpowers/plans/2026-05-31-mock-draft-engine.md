# Mock-draft Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable, non-destructive mock draft you can run against any league's board — snake order (+ optional 3rd-round reversal), 8–16 teams, full roster construction, and bots whose **depth-scaled variance** makes ten mocks produce ten different teams (round 1 near-stable, spread widening each round).

**Architecture:** A pure, headless engine in `src/lib/mock/` (no React) owns draft order, the roster-need model, a seeded RNG, bot pick selection, the draft state machine, and the end summary — all fully unit-tested. A thin React layer (`src/components/mock/`) drives it: a setup panel, an on-the-clock screen (tap a player to make your pick; bots auto-advance), and a summary. A mock reads an immutable **snapshot** of the current league's board + settings and never writes back — the real board is untouched.

**Tech Stack:** React 19 + TS + Vite + Vitest. No new dependencies. Reuses `Player`, `League`, `RosterSettings`, `Position`, and `Player.adp` (the blended ADP from Plan 2) as bot value signal.

---

## Design notes (read before starting)

**Locked by the v2 design doc (Phase 4):**

- Snake; optional 3rd-round reversal (3RR). Auction deferred.
- Teams 8–16; user picks their draft slot.
- Scoring + roster come from the **League** (QB/RB/WR/TE/FLEX/SUPERFLEX/K/DST counts, bench, disabled positions).
- Bots: **depth-scaled variance** (key ask) + roster-need weighting.
- Mock is non-destructive; marking players drafted is mock-only.

**Scope for THIS plan (v1 playable):** order, roster-need model, seeded RNG, bot variance + need-weighting, the draft state machine (draft / auto-bot / undo / restart / complete), a live on-the-clock UI, and an end summary (roster by slot + reach/value vs blended ADP + positional counts).

**Deferred to a follow-up "mock polish" plan** (these are the spec's own cut-lines, in order): pick timer + auto-pick-on-timeout; bot run-chasing; previewable writeback diff to the real board; mobile on-the-clock ergonomics. v1 simply never writes back (safest default) and bots pick instantly with a short visual delay.

**Bot value signal:** blended `Player.adp` (nulls last). Bots prefer the best-available _that serves a roster need_, within a round-widening window, chosen by weighted-random (top of window most likely). Seeded RNG → deterministic in tests, fresh seed → varied play.

**Why component state, not the reducer:** a mock is ephemeral and must not touch persisted league state. The engine returns immutable `MockState`; the React layer holds it in `useState`. Nothing hits `localStorage` or `leaguesReducer`.

## File structure

Engine core (pure, headless, fully tested):

- Create `src/lib/mock/types.ts` — `MockSettings`, `MockTeam`, `DraftPick`, `MockState`.
- Create `src/lib/mock/order.ts` — `buildDraftOrder()`.
- Create `src/lib/mock/roster.ts` — `openNeeds()`, `servesNeed()`.
- Create `src/lib/mock/rng.ts` — `makeRng()` (seeded, deterministic).
- Create `src/lib/mock/bot.ts` — `pickWindowSize()`, `botPick()`.
- Create `src/lib/mock/engine.ts` — `createMock()`, `currentTeam()`, `available()`, `draftPlayer()`, `botPickId()`, `undoLastPick()`, `isComplete()`.
- Create `src/lib/mock/summary.ts` — `mockSummary()`.

UI (thin, drives the engine):

- Create `src/components/mock/MockSetup.tsx` — settings form.
- Create `src/components/mock/MockDraft.tsx` — on-the-clock screen.
- Create `src/components/mock/MockSummary.tsx` — end screen.
- Create `src/components/mock/MockMode.tsx` — owns mock lifecycle (setup → draft → summary), holds `MockState`.
- Modify `src/App.tsx` — a "Mock draft" toggle that swaps the main view for `MockMode`.
- Modify `src/index.css` — minimal mock styles.

Tests: co-located `*.test.ts` per existing convention. UI is verified live in the browser.

---

### Task 1: Mock types

**Files:**

- Create: `src/lib/mock/types.ts`

- [ ] **Step 1: Write the types**

Create `src/lib/mock/types.ts`:

```typescript
import type { Player, RosterSettings, Scoring } from "../../types";

export interface MockSettings {
  teams: number; // 8–16
  userSlot: number; // 1-based draft position
  rounds: number; // total roster size (starters + bench)
  thirdRoundReversal: boolean;
}

export interface DraftPick {
  overall: number; // 1-based overall pick number
  round: number; // 1-based
  teamIndex: number; // 0-based team
  playerId: string;
}

export interface MockState {
  // immutable snapshot of the league at draft start
  pool: Player[]; // all draftable players (disabled positions removed)
  scoring: Scoring;
  roster: RosterSettings;
  settings: MockSettings;
  order: number[]; // order[i] = teamIndex picking at overall pick (i+1)
  picks: DraftPick[]; // in pick order
  draftedIds: Set<string>;
  // RNG state is carried as a numeric seed advanced per bot pick (pure)
  seed: number;
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mock/types.ts
git commit -m "Add mock-draft types"
```

---

### Task 2: Draft order (snake + 3RR)

**Files:**

- Create: `src/lib/mock/order.ts`
- Test: `src/lib/mock/order.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mock/order.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildDraftOrder } from "./order";

describe("buildDraftOrder", () => {
  it("snakes: round 1 forward, round 2 reversed", () => {
    const order = buildDraftOrder(4, 3, false);
    // round1: 0 1 2 3 | round2: 3 2 1 0 | round3: 0 1 2 3
    expect(order).toEqual([0, 1, 2, 3, 3, 2, 1, 0, 0, 1, 2, 3]);
  });

  it("applies 3rd-round reversal: round 3 keeps round 2's direction", () => {
    const order = buildDraftOrder(4, 4, true);
    // r1: 0123 | r2: 3210 | r3 (3RR keeps reversed): 3210 | r4 back to forward: 0123
    expect(order).toEqual([0, 1, 2, 3, 3, 2, 1, 0, 3, 2, 1, 0, 0, 1, 2, 3]);
  });

  it("produces teams*rounds picks", () => {
    expect(buildDraftOrder(12, 15, false)).toHaveLength(180);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/mock/order.test.ts`
Expected: FAIL — `Cannot find module './order'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/mock/order.ts`:

```typescript
// Snake draft order as a flat array of team indices, one per overall pick.
// 3rd-round reversal (3RR): round 3 repeats round 2's direction instead of
// flipping, then normal snaking resumes from round 4.
export function buildDraftOrder(
  teams: number,
  rounds: number,
  thirdRoundReversal: boolean,
): number[] {
  const order: number[] = [];
  for (let round = 1; round <= rounds; round++) {
    let reversed = round % 2 === 0; // even rounds reverse in plain snake
    if (thirdRoundReversal && round === 3) reversed = true; // keep R2 direction
    const seq = Array.from({ length: teams }, (_, i) => i);
    order.push(...(reversed ? seq.reverse() : seq));
  }
  return order;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/lib/mock/order.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/order.ts src/lib/mock/order.test.ts
git commit -m "Add snake draft order with 3RR"
```

---

### Task 3: Roster-need model

**Files:**

- Create: `src/lib/mock/roster.ts`
- Test: `src/lib/mock/roster.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mock/roster.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { openNeeds, servesNeed } from "./roster";
import type { RosterSettings } from "../../types";

const roster = (over: Partial<RosterSettings> = {}): RosterSettings => ({
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
  ...over,
});

describe("openNeeds", () => {
  it("reports base starters still unfilled", () => {
    const n = openNeeds(["QB", "RB"], roster());
    expect(n.base.RB).toBe(1); // 2 needed, 1 drafted
    expect(n.base.WR).toBe(2);
    expect(n.base.QB).toBeUndefined(); // filled
    expect(n.flex).toBe(1);
  });

  it("spills extra RB/WR/TE into FLEX before reporting it open", () => {
    // 2 RB fills base RB; a 3rd RB spills to FLEX
    const n = openNeeds(["RB", "RB", "RB"], roster());
    expect(n.base.RB).toBeUndefined();
    expect(n.flex).toBe(0); // 3rd RB took the flex
  });

  it("honors disabled positions (no need for them)", () => {
    const n = openNeeds([], roster({ K: 1, DST: 1, disabled: ["K", "DST"] }));
    expect(n.base.K).toBeUndefined();
    expect(n.base.DST).toBeUndefined();
  });

  it("superflex accepts a QB", () => {
    const n = openNeeds(["QB"], roster({ SUPERFLEX: 1 }));
    // base QB filled by the one QB; superflex still open
    expect(n.superflex).toBe(1);
  });
});

describe("servesNeed", () => {
  it("true when the position fills a base slot", () => {
    const n = openNeeds(["QB"], roster());
    expect(servesNeed("RB", n)).toBe(true);
  });
  it("true when only FLEX is open and pos is flex-eligible", () => {
    const n = openNeeds(["QB", "RB", "RB", "WR", "WR", "TE"], roster());
    expect(servesNeed("RB", n)).toBe(true); // flex open, RB eligible
    expect(servesNeed("QB", n)).toBe(false); // QB not flex-eligible, no SF
  });
  it("false for everything when starters + flex are full", () => {
    const full = roster({ RB: 1, WR: 1, TE: 0, K: 0, DST: 0, FLEX: 0 });
    const n = openNeeds(["QB", "RB", "WR"], full);
    expect(servesNeed("RB", n)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/mock/roster.test.ts`
Expected: FAIL — `Cannot find module './roster'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/mock/roster.ts`:

```typescript
import type { Position, RosterSettings } from "../../types";

const FLEX_POOL: Position[] = ["RB", "WR", "TE"];
const SUPER_POOL: Position[] = ["QB", "RB", "WR", "TE"];
const BASE: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export interface Needs {
  base: Partial<Record<Position, number>>; // open base starter slots
  flex: number; // open FLEX slots
  superflex: number; // open SUPERFLEX slots
}

// Greedily place a team's drafted players into base slots, then spill the
// extras into FLEX, then SUPERFLEX, and report what's still open.
export function openNeeds(drafted: Position[], r: RosterSettings): Needs {
  const have: Record<string, number> = {};
  for (const p of drafted) have[p] = (have[p] ?? 0) + 1;

  const base: Partial<Record<Position, number>> = {};
  const leftover: Record<string, number> = {};
  for (const pos of BASE) {
    const need = r.disabled.includes(pos) ? 0 : r[pos];
    const has = have[pos] ?? 0;
    const used = Math.min(has, need);
    if (need - used > 0) base[pos] = need - used;
    leftover[pos] = has - used;
  }

  let flex = r.FLEX;
  for (const pos of FLEX_POOL) {
    const take = Math.min(flex, leftover[pos] ?? 0);
    flex -= take;
    leftover[pos] = (leftover[pos] ?? 0) - take;
  }

  let superflex = r.SUPERFLEX;
  for (const pos of SUPER_POOL) {
    const take = Math.min(superflex, leftover[pos] ?? 0);
    superflex -= take;
    leftover[pos] = (leftover[pos] ?? 0) - take;
  }

  return { base, flex, superflex };
}

export function servesNeed(pos: Position, needs: Needs): boolean {
  if (needs.base[pos]) return true;
  if (needs.flex > 0 && FLEX_POOL.includes(pos)) return true;
  if (needs.superflex > 0 && SUPER_POOL.includes(pos)) return true;
  return false;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/lib/mock/roster.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/roster.ts src/lib/mock/roster.test.ts
git commit -m "Add roster-need model for mock bots"
```

---

### Task 4: Seeded RNG

**Files:**

- Create: `src/lib/mock/rng.ts`
- Test: `src/lib/mock/rng.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mock/rng.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { makeRng } from "./rng";

describe("makeRng", () => {
  it("is deterministic for a given seed", () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = [a(), a(), a()];
    const seqB = [b(), b(), b()];
    expect(seqA).toEqual(seqB);
  });

  it("differs across seeds", () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(a()).not.toBe(b());
  });

  it("returns values in [0, 1)", () => {
    const r = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/mock/rng.test.ts`
Expected: FAIL — `Cannot find module './rng'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/mock/rng.ts`:

```typescript
// mulberry32: a tiny, fast, seedable PRNG. Deterministic per seed so mock
// drafts are reproducible in tests; seed from Date.now() in real play.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/lib/mock/rng.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/rng.ts src/lib/mock/rng.test.ts
git commit -m "Add seeded RNG for reproducible mocks"
```

---

### Task 5: Bot pick (depth-scaled variance + need-weighting)

**Files:**

- Create: `src/lib/mock/bot.ts`
- Test: `src/lib/mock/bot.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mock/bot.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { pickWindowSize, botPick } from "./bot";
import { makeRng } from "./rng";
import { openNeeds } from "./roster";
import type { Player, RosterSettings } from "../../types";

const roster = (): RosterSettings => ({
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

const p = (id: string, pos: Player["position"], adp: number): Player => ({
  id,
  name: id,
  position: pos,
  team: "FA",
  overallRank: adp,
  byeWeek: null,
  tier: 1,
  adp,
  notes: "",
  flag: "none",
  draftStatus: "available",
});

describe("pickWindowSize", () => {
  it("is 1 in round 1 and widens with round depth", () => {
    expect(pickWindowSize(1)).toBe(1);
    expect(pickWindowSize(2)).toBeGreaterThan(pickWindowSize(1));
    expect(pickWindowSize(8)).toBeGreaterThan(pickWindowSize(4));
  });
  it("caps at a maximum", () => {
    expect(pickWindowSize(100)).toBeLessThanOrEqual(12);
  });
});

describe("botPick", () => {
  const available = [
    p("rb1", "RB", 1),
    p("wr1", "WR", 2),
    p("rb2", "RB", 3),
    p("qb1", "QB", 4),
  ];

  it("round 1 takes the single best-available that serves a need", () => {
    const needs = openNeeds([], roster());
    const id = botPick(available, needs, 1, makeRng(1));
    expect(id).toBe("rb1");
  });

  it("is deterministic for a fixed seed", () => {
    const needs = openNeeds([], roster());
    const a = botPick(available, needs, 5, makeRng(99));
    const b = botPick(available, needs, 5, makeRng(99));
    expect(a).toBe(b);
  });

  it("skips positions that serve no need when others do", () => {
    // roster with only RB need open; QB/WR/TE/K/DST all full
    const fullExceptRb: RosterSettings = {
      ...roster(),
      QB: 0,
      WR: 0,
      TE: 0,
      K: 0,
      DST: 0,
      FLEX: 0,
      RB: 2,
    };
    const needs = openNeeds([], fullExceptRb);
    // window may be wide (late round) but only RBs serve the need
    const id = botPick(available, needs, 10, makeRng(3));
    expect(["rb1", "rb2"]).toContain(id);
  });

  it("falls back to best-available when nothing serves a need", () => {
    const noNeeds = openNeeds(["RB", "WR"], {
      ...roster(),
      QB: 0,
      RB: 1,
      WR: 1,
      TE: 0,
      K: 0,
      DST: 0,
      FLEX: 0,
    });
    const id = botPick(available, noNeeds, 1, makeRng(1));
    expect(id).toBe("rb1"); // window size 1 → best available overall
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/mock/bot.test.ts`
Expected: FAIL — `Cannot find module './bot'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/mock/bot.ts`:

```typescript
import type { Player } from "../../types";
import { servesNeed, type Needs } from "./roster";

const MAX_WINDOW = 12;

// Round 1 → window of 1 (near-deterministic); widens by 1 per round, capped.
export function pickWindowSize(round: number): number {
  return Math.min(MAX_WINDOW, round);
}

// Pick from the best-available players that serve a roster need, within a
// round-scaled window, weighted so the top of the window is most likely.
// `available` must be sorted best-first (by blended adp, nulls last).
export function botPick(
  available: Player[],
  needs: Needs,
  round: number,
  rng: () => number,
): string {
  if (available.length === 0) throw new Error("botPick: no players available");

  const needed = available.filter((pl) => servesNeed(pl.position, needs));
  const ranked = needed.length > 0 ? needed : available;

  const w = Math.min(pickWindowSize(round), ranked.length);
  const window = ranked.slice(0, w);

  // linear decay: index 0 weight w, index w-1 weight 1
  const weights = window.map((_, i) => w - i);
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < window.length; i++) {
    r -= weights[i];
    if (r < 0) return window[i].id;
  }
  return window[window.length - 1].id;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/lib/mock/bot.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/bot.ts src/lib/mock/bot.test.ts
git commit -m "Add depth-scaled bot pick with need-weighting"
```

---

### Task 6: Draft state machine

**Files:**

- Create: `src/lib/mock/engine.ts`
- Test: `src/lib/mock/engine.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mock/engine.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  createMock,
  currentTeamIndex,
  available,
  draftPlayer,
  botPickId,
  undoLastPick,
  isComplete,
  teamRosterPositions,
} from "./engine";
import type { League, Player } from "../../types";

const p = (id: string, pos: Player["position"], adp: number): Player => ({
  id,
  name: id,
  position: pos,
  team: "FA",
  overallRank: adp,
  byeWeek: null,
  tier: 1,
  adp,
  notes: "",
  flag: "none",
  draftStatus: "available",
});

const league = (board: Player[]): League => ({
  id: "L",
  name: "Test",
  platform: "espn",
  scoring: "ppr",
  tePremium: false,
  teams: 2,
  roster: {
    QB: 1,
    RB: 1,
    WR: 1,
    TE: 0,
    FLEX: 0,
    SUPERFLEX: 0,
    K: 0,
    DST: 0,
    bench: 0,
    disabled: ["TE", "K", "DST"],
  },
  board,
  updatedAt: 0,
});

const board = [
  p("a", "RB", 1),
  p("b", "WR", 2),
  p("c", "QB", 3),
  p("d", "RB", 4),
  p("e", "WR", 5),
  p("f", "QB", 6),
];

describe("createMock", () => {
  it("builds order for teams*rounds and removes disabled positions", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      123,
    );
    // roster size = QB1+RB1+WR1 = 3 rounds; 2 teams → 6 picks
    expect(m.order).toHaveLength(6);
    expect(m.pool.every((pl) => pl.position !== "TE")).toBe(true);
  });
});

describe("draftPlayer + available", () => {
  it("removes drafted players and advances the pick", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    expect(currentTeamIndex(m)).toBe(0);
    m = draftPlayer(m, "a");
    expect(available(m).find((pl) => pl.id === "a")).toBeUndefined();
    expect(m.picks).toHaveLength(1);
    expect(currentTeamIndex(m)).toBe(1); // snake R1: team 0 then team 1
  });

  it("ignores a draft of an already-taken or unknown player", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    m = draftPlayer(m, "a");
    const same = draftPlayer(m, "a");
    expect(same).toBe(m);
    expect(draftPlayer(m, "zzz")).toBe(m);
  });
});

describe("botPickId", () => {
  it("returns a valid available id for the current bot team", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 2, thirdRoundReversal: false },
      7,
    );
    // userSlot 2 → team index 1; team 0 (a bot) is on the clock first
    const id = botPickId(m);
    expect(available(m).some((pl) => pl.id === id)).toBe(true);
  });
});

describe("undoLastPick", () => {
  it("restores the previous state", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    const before = available(m).length;
    m = draftPlayer(m, "a");
    m = undoLastPick(m);
    expect(available(m).length).toBe(before);
    expect(m.picks).toHaveLength(0);
    expect(currentTeamIndex(m)).toBe(0);
  });

  it("is a no-op with no picks", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    expect(undoLastPick(m)).toBe(m);
  });
});

describe("isComplete + teamRosterPositions", () => {
  it("completes after all picks and tracks each team's positions", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    while (!isComplete(m)) m = draftPlayer(m, botPickId(m));
    expect(m.picks).toHaveLength(6);
    expect(teamRosterPositions(m, 0).length).toBe(3);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/mock/engine.test.ts`
Expected: FAIL — `Cannot find module './engine'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/mock/engine.ts`:

```typescript
import type { League, Player, Position } from "../../types";
import type { MockSettings, MockState } from "./types";
import { buildDraftOrder } from "./order";
import { openNeeds } from "./roster";
import { botPick } from "./bot";
import { makeRng } from "./rng";

function rosterSize(r: League["roster"]): number {
  return (
    r.QB + r.RB + r.WR + r.TE + r.FLEX + r.SUPERFLEX + r.K + r.DST + r.bench
  );
}

const byAdp = (a: Player, b: Player) => {
  if (a.adp == null && b.adp == null) return a.overallRank - b.overallRank;
  if (a.adp == null) return 1;
  if (b.adp == null) return -1;
  return a.adp - b.adp;
};

export function createMock(
  league: League,
  settings: Omit<MockSettings, "rounds">,
  seed: number,
): MockState {
  const rounds = rosterSize(league.roster);
  const pool = league.board
    .filter((pl) => !league.roster.disabled.includes(pl.position))
    .map((pl) => ({ ...pl }))
    .sort(byAdp);
  return {
    pool,
    scoring: league.scoring,
    roster: league.roster,
    settings: { ...settings, rounds },
    order: buildDraftOrder(settings.teams, rounds, settings.thirdRoundReversal),
    picks: [],
    draftedIds: new Set(),
    seed,
  };
}

export function isComplete(m: MockState): boolean {
  return m.picks.length >= m.order.length;
}

export function currentTeamIndex(m: MockState): number {
  return m.order[m.picks.length];
}

export function available(m: MockState): Player[] {
  return m.pool.filter((pl) => !m.draftedIds.has(pl.id));
}

export function teamRosterPositions(
  m: MockState,
  teamIndex: number,
): Position[] {
  const byId = new Map(m.pool.map((pl) => [pl.id, pl]));
  return m.picks
    .filter((pk) => pk.teamIndex === teamIndex)
    .map((pk) => byId.get(pk.playerId)!.position);
}

export function draftPlayer(m: MockState, playerId: string): MockState {
  if (isComplete(m)) return m;
  if (m.draftedIds.has(playerId)) return m;
  if (!m.pool.some((pl) => pl.id === playerId)) return m;
  const overall = m.picks.length + 1;
  const teamIndex = currentTeamIndex(m);
  const round = Math.floor((overall - 1) / m.settings.teams) + 1;
  const draftedIds = new Set(m.draftedIds);
  draftedIds.add(playerId);
  return {
    ...m,
    draftedIds,
    picks: [...m.picks, { overall, round, teamIndex, playerId }],
  };
}

// Compute the id a bot would draft for the current team (does not mutate).
export function botPickId(m: MockState): string {
  const teamIndex = currentTeamIndex(m);
  const round = Math.floor(m.picks.length / m.settings.teams) + 1;
  const needs = openNeeds(teamRosterPositions(m, teamIndex), m.roster);
  // advance the seed per pick so successive bot picks vary
  const rng = makeRng(m.seed + m.picks.length * 2654435761);
  return botPick(available(m), needs, round, rng);
}

export function undoLastPick(m: MockState): MockState {
  if (m.picks.length === 0) return m;
  const picks = m.picks.slice(0, -1);
  const removed = m.picks[m.picks.length - 1];
  const draftedIds = new Set(m.draftedIds);
  draftedIds.delete(removed.playerId);
  return { ...m, picks, draftedIds };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/lib/mock/engine.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/engine.ts src/lib/mock/engine.test.ts
git commit -m "Add mock draft state machine"
```

---

### Task 7: End summary

**Files:**

- Create: `src/lib/mock/summary.ts`
- Test: `src/lib/mock/summary.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mock/summary.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { mockSummary } from "./summary";
import { createMock, draftPlayer } from "./engine";
import type { League, Player } from "../../types";

const p = (id: string, pos: Player["position"], adp: number): Player => ({
  id,
  name: id,
  position: pos,
  team: "FA",
  overallRank: adp,
  byeWeek: null,
  tier: 1,
  adp,
  notes: "",
  flag: "none",
  draftStatus: "available",
});

const league = (board: Player[]): League => ({
  id: "L",
  name: "Test",
  platform: "espn",
  scoring: "ppr",
  tePremium: false,
  teams: 2,
  roster: {
    QB: 1,
    RB: 1,
    WR: 0,
    TE: 0,
    FLEX: 0,
    SUPERFLEX: 0,
    K: 0,
    DST: 0,
    bench: 0,
    disabled: ["WR", "TE", "K", "DST"],
  },
  board,
  updatedAt: 0,
});

const board = [
  p("a", "RB", 1),
  p("b", "QB", 2),
  p("c", "RB", 3),
  p("d", "QB", 4),
];

describe("mockSummary", () => {
  it("lists the user's picks and positional counts", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    // user is team 0; draft a (user), then b (bot), c (user), d (bot)
    m = draftPlayer(m, "a");
    m = draftPlayer(m, "b");
    m = draftPlayer(m, "c");
    m = draftPlayer(m, "d");
    const s = mockSummary(m, 0);
    expect(s.players.map((pl) => pl.id)).toEqual(["a", "c"]);
    expect(s.positionCounts.RB).toBe(2);
  });

  it("flags value (drafted later than ADP) and reach (earlier)", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    // user team 0 takes "c" (adp 3) at overall pick 1 → a reach of +2
    m = draftPlayer(m, "c");
    m = draftPlayer(m, "a");
    m = draftPlayer(m, "b");
    m = draftPlayer(m, "d");
    const s = mockSummary(m, 0);
    const c = s.players.find((pl) => pl.id === "c")!;
    expect(c.overallPick).toBe(1);
    expect(c.adpDelta).toBe(2); // adp 3 - pick 1 = +2 (reach)
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/mock/summary.test.ts`
Expected: FAIL — `Cannot find module './summary'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/mock/summary.ts`:

```typescript
import type { Player, Position } from "../../types";
import type { MockState } from "./types";

export interface SummaryPlayer {
  id: string;
  name: string;
  position: Position;
  team: string;
  overallPick: number;
  adp: number | null;
  adpDelta: number | null; // adp - overallPick; >0 reach, <0 value
}

export interface MockSummaryResult {
  players: SummaryPlayer[];
  positionCounts: Partial<Record<Position, number>>;
}

export function mockSummary(
  m: MockState,
  teamIndex: number,
): MockSummaryResult {
  const byId = new Map(m.pool.map((pl) => [pl.id, pl]));
  const players: SummaryPlayer[] = m.picks
    .filter((pk) => pk.teamIndex === teamIndex)
    .map((pk) => {
      const pl = byId.get(pk.playerId) as Player;
      return {
        id: pl.id,
        name: pl.name,
        position: pl.position,
        team: pl.team,
        overallPick: pk.overall,
        adp: pl.adp,
        adpDelta: pl.adp == null ? null : pl.adp - pk.overall,
      };
    });

  const positionCounts: Partial<Record<Position, number>> = {};
  for (const pl of players) {
    positionCounts[pl.position] = (positionCounts[pl.position] ?? 0) + 1;
  }
  return { players, positionCounts };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/lib/mock/summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/summary.ts src/lib/mock/summary.test.ts
git commit -m "Add mock draft end summary"
```

---

### Task 8: MockSetup component

**Files:**

- Create: `src/components/mock/MockSetup.tsx`

UI — verified live. The engine is fully tested; components are thin glue.

- [ ] **Step 1: Write the component**

Create `src/components/mock/MockSetup.tsx`:

```tsx
import { useState } from "react";
import type { League } from "../../types";
import type { MockSettings } from "../../lib/mock/types";

interface Props {
  league: League;
  onStart: (settings: Omit<MockSettings, "rounds">) => void;
  onCancel: () => void;
}

export function MockSetup({ league, onStart, onCancel }: Props) {
  const [teams, setTeams] = useState(league.teams);
  const [userSlot, setUserSlot] = useState(1);
  const [thirdRoundReversal, setThirdRoundReversal] = useState(false);

  return (
    <div className="mock-setup">
      <h2>Mock draft — {league.name}</h2>
      <p className="mock-sub">
        Scoring: {league.scoring.toUpperCase()} · bots use this league's roster
        settings
      </p>
      <label>
        Teams{" "}
        <select
          value={teams}
          onChange={(e) => {
            const t = Number(e.target.value);
            setTeams(t);
            if (userSlot > t) setUserSlot(t);
          }}
        >
          {Array.from({ length: 9 }, (_, i) => i + 8).map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label>
        Your slot{" "}
        <select
          value={userSlot}
          onChange={(e) => setUserSlot(Number(e.target.value))}
        >
          {Array.from({ length: teams }, (_, i) => i + 1).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          checked={thirdRoundReversal}
          onChange={(e) => setThirdRoundReversal(e.target.checked)}
        />{" "}
        3rd-round reversal
      </label>
      <div className="mock-actions">
        <button
          onClick={() => onStart({ teams, userSlot, thirdRoundReversal })}
        >
          Start mock
        </button>
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/mock/MockSetup.tsx
git commit -m "Add mock setup panel"
```

---

### Task 9: MockSummary component

**Files:**

- Create: `src/components/mock/MockSummary.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/mock/MockSummary.tsx`:

```tsx
import type { MockSummaryResult } from "../../lib/mock/summary";

interface Props {
  summary: MockSummaryResult;
  onRestart: () => void;
  onExit: () => void;
}

export function MockSummary({ summary, onRestart, onExit }: Props) {
  const counts = Object.entries(summary.positionCounts)
    .map(([pos, n]) => `${pos} ${n}`)
    .join(" · ");
  return (
    <div className="mock-summary">
      <h2>Your team</h2>
      <div className="mock-counts">{counts}</div>
      <ol className="mock-roster">
        {summary.players.map((p) => (
          <li key={p.id}>
            <span className="mock-pick">#{p.overallPick}</span>
            <span className="mock-name">{p.name}</span>
            <span className="mock-pos">{p.position}</span>
            <span className="mock-team">{p.team}</span>
            {p.adpDelta != null && (
              <span
                className={
                  p.adpDelta >= 0 ? "mock-delta value" : "mock-delta reach"
                }
                title="ADP minus your pick — positive = value, negative = reach"
              >
                {p.adpDelta >= 0
                  ? `+${p.adpDelta.toFixed(0)}`
                  : p.adpDelta.toFixed(0)}
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="mock-actions">
        <button onClick={onRestart}>New mock</button>
        <button className="secondary" onClick={onExit}>
          Back to board
        </button>
      </div>
    </div>
  );
}
```

> Note the sign convention: `adpDelta = adp - overallPick`. Positive means the player's ADP was later than where you took them — that reads as a **reach** in real drafting. Label accordingly in Step note: use "later than ADP = value" only if you flip the sign. To keep it intuitive, the className uses `>= 0 ? value : reach` **as a placeholder** — during live verification (Task 11) confirm the wording matches the math and adjust the labels/classes so "reach" = took earlier than ADP. (This is a labeling decision, not a logic change.)

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/mock/MockSummary.tsx
git commit -m "Add mock summary screen"
```

---

### Task 10: MockDraft on-the-clock screen

**Files:**

- Create: `src/components/mock/MockDraft.tsx`

- [ ] **Step 1: Write the component**

Create `src/components/mock/MockDraft.tsx`. It renders whose pick it is, your roster so far, and the available board (tap to draft when it's your pick). Bot picks auto-advance via an effect with a short delay so you can watch the board change.

```tsx
import { useEffect, useMemo, useState } from "react";
import type { MockState } from "../../lib/mock/types";
import type { Position } from "../../types";
import {
  available,
  currentTeamIndex,
  isComplete,
  teamRosterPositions,
} from "../../lib/mock/engine";

interface Props {
  state: MockState;
  userTeamIndex: number; // userSlot - 1
  onDraft: (playerId: string) => void; // user pick
  onBotTick: () => void; // advance one bot pick
  onUndo: () => void;
  onExit: () => void;
}

const POS_FILTERS: (Position | "All")[] = [
  "All",
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

export function MockDraft({
  state,
  userTeamIndex,
  onDraft,
  onBotTick,
  onUndo,
  onExit,
}: Props) {
  const [posFilter, setPosFilter] = useState<Position | "All">("All");
  const onClock = currentTeamIndex(state);
  const isUser = onClock === userTeamIndex && !isComplete(state);
  const overall = state.picks.length + 1;
  const round = Math.floor((overall - 1) / state.settings.teams) + 1;

  // Bots pick automatically (short delay so the board visibly updates).
  useEffect(() => {
    if (isComplete(state)) return;
    if (onClock === userTeamIndex) return;
    const t = setTimeout(onBotTick, 350);
    return () => clearTimeout(t);
  }, [state, onClock, userTeamIndex, onBotTick]);

  const avail = useMemo(
    () =>
      available(state).filter(
        (p) => posFilter === "All" || p.position === posFilter,
      ),
    [state, posFilter],
  );

  const myPositions = teamRosterPositions(state, userTeamIndex);

  return (
    <div className="mock-draft">
      <div className="mock-status">
        <strong>
          {isComplete(state)
            ? "Draft complete"
            : isUser
              ? "You're on the clock"
              : `Team ${onClock + 1} picking…`}
        </strong>
        <span>
          Round {round} · Pick {overall} of {state.order.length}
        </span>
        <div className="mock-controls">
          <button onClick={onUndo} disabled={state.picks.length === 0}>
            Undo
          </button>
          <button className="secondary" onClick={onExit}>
            Exit
          </button>
        </div>
      </div>

      <div className="mock-myroster">
        Your team ({myPositions.length}):{" "}
        {myPositions.length ? myPositions.join(" · ") : "—"}
      </div>

      <div className="chips">
        {POS_FILTERS.map((p) => (
          <button
            key={p}
            className={posFilter === p ? "chip active" : "chip"}
            onClick={() => setPosFilter(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <ul className="mock-available">
        {avail.slice(0, 100).map((p) => (
          <li key={p.id}>
            <span className="mock-name">{p.name}</span>
            <span className="mock-pos">{p.position}</span>
            <span className="mock-team">{p.team}</span>
            <span className="mock-adp num">
              {p.adp == null ? "" : Number(p.adp.toFixed(1))}
            </span>
            <button
              className="mock-draft-btn"
              disabled={!isUser}
              onClick={() => onDraft(p.id)}
            >
              Draft
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/mock/MockDraft.tsx
git commit -m "Add mock on-the-clock screen"
```

---

### Task 11: MockMode orchestrator + App toggle

**Files:**

- Create: `src/components/mock/MockMode.tsx`
- Modify: `src/App.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Write the orchestrator**

Create `src/components/mock/MockMode.tsx`. It owns the mock lifecycle and `MockState`, wiring the engine functions to the three screens.

```tsx
import { useCallback, useState } from "react";
import type { League } from "../../types";
import type { MockSettings, MockState } from "../../lib/mock/types";
import {
  createMock,
  draftPlayer,
  botPickId,
  undoLastPick,
  isComplete,
} from "../../lib/mock/engine";
import { mockSummary } from "../../lib/mock/summary";
import { MockSetup } from "./MockSetup";
import { MockDraft } from "./MockDraft";
import { MockSummary } from "./MockSummary";

interface Props {
  league: League;
  onExit: () => void;
}

type Phase = "setup" | "draft" | "summary";

export function MockMode({ league, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>("setup");
  const [state, setState] = useState<MockState | null>(null);
  const [userSlot, setUserSlot] = useState(1);

  const start = useCallback(
    (settings: Omit<MockSettings, "rounds">) => {
      setUserSlot(settings.userSlot);
      setState(createMock(league, settings, Date.now() >>> 0));
      setPhase("draft");
    },
    [league],
  );

  const userDraft = useCallback((id: string) => {
    setState((m) => {
      if (!m) return m;
      const next = draftPlayer(m, id);
      return next;
    });
  }, []);

  const botTick = useCallback(() => {
    setState((m) => (m ? draftPlayer(m, botPickId(m)) : m));
  }, []);

  const undo = useCallback(() => {
    setState((m) => (m ? undoLastPick(m) : m));
  }, []);

  // advance to summary when the board fills
  const goneToSummary =
    state && isComplete(state) && phase === "draft" ? true : false;
  if (goneToSummary) setPhase("summary");

  if (phase === "setup") {
    return <MockSetup league={league} onStart={start} onCancel={onExit} />;
  }
  if (phase === "draft" && state) {
    return (
      <MockDraft
        state={state}
        userTeamIndex={userSlot - 1}
        onDraft={userDraft}
        onBotTick={botTick}
        onUndo={undo}
        onExit={onExit}
      />
    );
  }
  if (phase === "summary" && state) {
    return (
      <MockSummary
        summary={mockSummary(state, userSlot - 1)}
        onRestart={() => setPhase("setup")}
        onExit={onExit}
      />
    );
  }
  return null;
}
```

> The `if (goneToSummary) setPhase(...)` set-during-render is intentional and safe (React bails out if state is unchanged), but if it trips the "cannot update during render" lint, move it into an effect: `useEffect(() => { if (state && isComplete(state) && phase === "draft") setPhase("summary"); }, [state, phase]);`. Prefer the effect form if unsure.

- [ ] **Step 2: Add the toggle in `App.tsx`**

Import and add a `mockMode` state plus a launch control. Near the other `useState` calls:

```typescript
import { MockMode } from "./components/mock/MockMode";
```

```typescript
const [mockMode, setMockMode] = useState(false);
```

Immediately inside the top-level `return (`, short-circuit to the mock when active (before the normal board markup):

```tsx
if (mockMode) {
  return (
    <div className="app">
      <MockMode league={currentLeague} onExit={() => setMockMode(false)} />
    </div>
  );
}
```

Add a launch button to the toolbar — extend `Toolbar` props with `onMock: () => void` and render a button beside the gear, or add a menu item in the ⚙ menu:

```tsx
            <div className="menu-sep" />
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onMock();
              }}
            >
              Mock draft…
            </button>
```

Wire it in `App.tsx`'s `<Toolbar ... onMock={() => setMockMode(true)} />` and add `onMock: () => void;` to the Toolbar `Props`.

- [ ] **Step 3: Add minimal styles in `index.css`**

Append:

```css
.mock-setup,
.mock-summary {
  max-width: 32rem;
  margin: 2rem auto;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.mock-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border, #ddd);
}
.mock-controls {
  margin-left: auto;
  display: flex;
  gap: 0.5rem;
}
.mock-myroster {
  padding: 0.5rem 0;
  font-size: 0.9rem;
  opacity: 0.85;
}
.mock-available {
  list-style: none;
  padding: 0;
  margin: 0;
}
.mock-available li {
  display: grid;
  grid-template-columns: 1fr auto auto auto auto;
  gap: 0.75rem;
  align-items: center;
  padding: 0.3rem 0;
  border-bottom: 1px solid var(--border, #eee);
}
.mock-roster {
  padding-left: 1.25rem;
}
.mock-roster li {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  padding: 0.2rem 0;
}
.mock-delta.value {
  color: #1a7f37;
}
.mock-delta.reach {
  color: #b35900;
}
.mock-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
```

- [ ] **Step 4: Type-check and run the full suite**

Run: `npx tsc --noEmit && npm test`
Expected: tsc clean; all suites pass (prior 110 + the new engine tests).

- [ ] **Step 5: Verify live in the browser**

With `npm run dev`:

1. Open ⚙ → **Mock draft…** → the setup panel appears with the current league's scoring.
2. Pick teams = 12, your slot = 6, start. The on-the-clock screen appears; bots auto-pick up to your turn.
3. On your pick, the Draft buttons enable; draft a player; confirm it leaves the board and your roster line updates.
4. Let it run to the end (or draft through) → the summary lists your team, positional counts, and ADP deltas.
5. **Run two full mocks from the same slot** and confirm your available board / bot behavior differs between runs (depth-scaled variance), while round-1 picks are stable.
6. Confirm the real board is untouched after exiting (tiers/flags intact).
7. Confirm the reach/value labels match the math (adjust labels per the Task 9 note if needed).

- [ ] **Step 6: Commit**

```bash
git add src/components/mock/MockMode.tsx src/App.tsx src/components/Toolbar.tsx src/index.css
git commit -m "Wire mock draft mode into the app"
```

---

## Finishing

After all tasks pass and the live checks are clean:

- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch — verify the full suite, then present merge options.

## Self-review (done while writing)

- **Spec coverage (Phase 4 v1):** snake + 3RR ✓ (Task 2); teams 8–16 + user slot ✓ (Tasks 8/11); roster construction incl. FLEX/SUPERFLEX/disabled ✓ (Task 3); scoring from league ✓ (engine reads `league.scoring`); depth-scaled bot variance + roster-need ✓ (Tasks 4–5); state machine with undo/restart/complete ✓ (Task 6); live board + on-the-clock ✓ (Task 10); end summary with reach/value ✓ (Tasks 7/9).
- **Deferred (documented, spec cut-line order):** pick timer + auto-pick-on-timeout; run-chasing; previewable writeback diff (v1 never writes back — real board untouched); mobile ergonomics. These become a "mock polish" plan.
- **Non-destructive:** the engine deep-copies the board into `pool` and only mutates local `MockState`; nothing touches `leaguesReducer` or `localStorage`.
- **Type consistency:** `MockState`/`MockSettings`/`DraftPick` defined once in `types.ts`; `Needs` once in `roster.ts`; engine/bot/summary import them. `botPickId` (engine) wraps `botPick` (bot) so the UI only ever calls engine functions.
- **Open follow-ups:** reach/value label wording (confirm in live verify); bench-need weighting is coarse (bots treat all positions equal once starters fill) — fine for v1, refine with run-chasing later.

```

```
