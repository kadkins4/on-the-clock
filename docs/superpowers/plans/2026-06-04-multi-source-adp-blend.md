# Multi-Source ADP Blend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-source ESPN ADP with a weighted blend of ESPN + FFC + FantasyPros + Yahoo, baked into `seed.json` at build time and refreshable at runtime, so K/DST land at realistic rounds by default.

**Architecture:** One shared core (matching in `ffcAdp.ts`, blend in `blendAdp.ts`, new per-source normalizers) consumed by two layers — a build-time orchestrator (`scripts/fetch-adp.ts`, run via `tsx`) that bakes blended ADP into `seed.json`, and the existing runtime path (`api/adp.ts` edge fetch → `applyAdp` reducer) extended from 2 to 4 sources.

**Tech Stack:** TypeScript, React 19, Vite 8, Vitest 4, Node 22, `tsx` (new dev dep) for the TS build script.

---

## Pre-flight

- [ ] **Step 0: Install deps in the worktree**

The worktree has a partial `node_modules` (no `vite`/`vitest` bins). Run:

```bash
npm install
```

Expected: completes; `node_modules/.bin/vitest` and `node_modules/.bin/vite` now exist.

- [ ] **Step 0b: Confirm the baseline is green**

```bash
npm test
```

Expected: all existing tests PASS (this is the pre-change baseline).

---

## File Structure

- `src/types.ts` — widen `Player.adpSources` to 4 sources (modify).
- `src/lib/blendAdp.ts` — weighted blend + coverage guard; `applyFfcAdp` → `applyAdp` (rewrite).
- `src/lib/blendAdp.test.ts` — update + extend (rewrite).
- `src/lib/adpSources/fantasypros.ts` — `parseFantasyPros(html)` + `DEF_NAME_TO_ABBR` (create).
- `src/lib/adpSources/fantasypros.test.ts` — fixture-based parse test (create).
- `src/lib/adpSources/yahoo.ts` — `mapYahooAdp`, `refreshAccessToken`, `fetchYahooAdp` (create).
- `src/lib/adpSources/yahoo.test.ts` — fixture-based parse test (create).
- `api/adp.ts` — multi-source response (modify).
- `api/adp.test.ts` — extend if present, else create (modify/create).
- `vite.config.ts` — dev proxy returns multi-source shape (modify).
- `src/lib/fetchAdp.ts` — return widened `AdpResponse` (modify).
- `src/state/reducer.ts` — `applyAdp` action carries all sources (modify).
- `src/state/reducer.test.ts` — update payload (modify).
- `src/App.tsx` — dispatch all sources, status label (modify).
- `src/components/Toolbar.tsx` — button label (modify).
- `src/components/board/cells.tsx` — tooltip lists 4 sources (modify).
- `scripts/adp/sources/espn.mjs` — `fetchEspnUniverse()` (created from `fetch-espn.mjs`).
- `scripts/fetch-adp.ts` — build orchestrator (create).
- `scripts/yahoo-auth.ts` — one-time Yahoo refresh-token helper (create).
- `scripts/adp/README.md` — source notes + yearly checklist (create).
- `package.json` — `tsx` dep, `fetch-adp` script (modify).

---

## Task 1: Widen `adpSources` to four sources

**Files:**

- Modify: `src/types.ts` (the `adpSources?` line, ~26)
- Modify: `src/lib/blendAdp.ts` (`AdpSources` interface, lines 4-7)

- [ ] **Step 1: Widen the `Player.adpSources` type**

In `src/types.ts`, replace:

```ts
  adpSources?: { espn?: number | null; ffc?: number | null };
```

with:

```ts
  adpSources?: {
    espn?: number | null;
    ffc?: number | null;
    fantasypros?: number | null;
    yahoo?: number | null;
  };
```

- [ ] **Step 2: Widen the `AdpSources` interface**

In `src/lib/blendAdp.ts`, replace the interface (lines 4-7):

```ts
export interface AdpSources {
  espn?: number | null;
  ffc?: number | null;
  fantasypros?: number | null;
  yahoo?: number | null;
}
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (no usages broken yet; widening is additive).

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/lib/blendAdp.ts
git commit -m "Widen adpSources to espn/ffc/fantasypros/yahoo"
```

---

## Task 2: Weighted blend + coverage guard

**Files:**

- Modify: `src/lib/blendAdp.ts` (`blendAdp`, lines 9-18)
- Modify: `src/lib/blendAdp.test.ts` (the `describe("blendAdp")` block, lines 21-33)

- [ ] **Step 1: Rewrite the blend tests (failing)**

In `src/lib/blendAdp.test.ts`, replace the entire `describe("blendAdp", ...)` block (lines 21-33) with:

```ts
describe("blendAdp", () => {
  it("weights consensus sources above single platforms", () => {
    // fantasypros 3, ffc 2, yahoo 2, espn 1
    // (100*1 + 130*2 + 140*3 + 128*2) / (1+2+3+2)
    expect(
      blendAdp({ espn: 100, ffc: 130, fantasypros: 140, yahoo: 128 }, "WR"),
    ).toBeCloseTo((100 * 1 + 130 * 2 + 140 * 3 + 128 * 2) / 8, 5);
  });
  it("weights espn below ffc for a two-source blend", () => {
    // (10*1 + 20*2) / (1+2) = 50/3
    expect(blendAdp({ espn: 10, ffc: 20 }, "RB")).toBeCloseTo(50 / 3, 5);
  });
  it("returns the single available source unchanged", () => {
    expect(blendAdp({ ffc: 8.5 }, "RB")).toBe(8.5);
  });
  it("returns null when nothing is available", () => {
    expect(blendAdp({}, "RB")).toBeNull();
    expect(blendAdp({ espn: null, ffc: null }, "RB")).toBeNull();
  });
  it("floors a K/DST priced by espn only", () => {
    expect(blendAdp({ espn: 83 }, "K")).toBe(100);
    expect(blendAdp({ espn: 81 }, "DST")).toBe(100);
  });
  it("does NOT floor a K/DST once a consensus source agrees", () => {
    // (83*1 + 140*2) / 3 = 121 — already late, no floor needed
    expect(blendAdp({ espn: 83, ffc: 140 }, "DST")).toBeCloseTo(
      (83 + 280) / 3,
      5,
    );
  });
  it("never floors offense", () => {
    expect(blendAdp({ espn: 5 }, "RB")).toBe(5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/blendAdp.test.ts`
Expected: FAIL — `blendAdp` still averages and takes one argument.

- [ ] **Step 3: Rewrite `blendAdp`**

In `src/lib/blendAdp.ts`, replace the current `blendAdp` (lines 9-18) with:

```ts
import type { Player, Position } from "../types";

// Weighted blend. Consensus aggregates (FantasyPros, FFC) outrank single
// platforms; ESPN is weighted lowest because it skews K/DST early.
const WEIGHTS: Record<keyof AdpSources, number> = {
  fantasypros: 3,
  ffc: 2,
  yahoo: 2,
  espn: 1,
};

// K/DST priced by ESPN alone can't sort earlier than this (round ~9). Narrow
// safety net for early-season before consensus sources price kickers.
export const KDST_ADP_FLOOR = 100;

export function blendAdp(
  sources: AdpSources,
  position: Position,
): number | null {
  let weight = 0;
  let weighted = 0;
  let consensusPresent = false; // any non-ESPN source
  for (const key of [
    "fantasypros",
    "ffc",
    "yahoo",
    "espn",
  ] as (keyof AdpSources)[]) {
    const v = sources[key];
    if (v == null) continue;
    weighted += v * WEIGHTS[key];
    weight += WEIGHTS[key];
    if (key !== "espn") consensusPresent = true;
  }
  if (weight === 0) return null;
  const adp = weighted / weight;
  if ((position === "K" || position === "DST") && !consensusPresent) {
    return Math.max(adp, KDST_ADP_FLOOR);
  }
  return adp;
}
```

Note: line 1 of the file currently is `import type { Player } from "../types";` — replace it with the `import type { Player, Position }` line shown above (do not duplicate the import).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/blendAdp.test.ts`
Expected: the `describe("blendAdp")` tests PASS. (The `applyFfcAdp` block still references the old 1-arg call and will fail — fixed in Task 3.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/blendAdp.ts src/lib/blendAdp.test.ts
git commit -m "Make ADP blend a weighted average with a K/DST floor"
```

---

## Task 3: Generalize `applyFfcAdp` → `applyAdp`

**Files:**

- Modify: `src/lib/blendAdp.ts` (`applyFfcAdp`, lines 20-42)
- Modify: `src/lib/blendAdp.test.ts` (the `describe("applyFfcAdp")` block)
- Modify: `src/state/reducer.ts` (import + `applyAdp` case, lines 21 & 87-90)

- [ ] **Step 1: Rewrite the apply tests (failing)**

In `src/lib/blendAdp.test.ts`, change the import on line 2 to:

```ts
import { blendAdp, applyAdp } from "./blendAdp";
```

Replace the whole `describe("applyFfcAdp", ...)` block with:

```ts
describe("applyAdp", () => {
  it("matches by name+position, stores ffc, and reblends (weighted)", () => {
    const board: Player[] = [
      player({ id: "1", name: "A.J. Brown", position: "WR", adp: 14 }),
    ];
    board[0].adpSources = { espn: 14 };
    const ffc: NormalizedAdp[] = [
      { name: "AJ Brown", position: "WR", team: "PHI", adp: 20 },
    ];
    const out = applyAdp(board, { ffc });
    expect(out[0].adpSources).toEqual({ espn: 14, ffc: 20 });
    expect(out[0].adp).toBeCloseTo((14 * 1 + 20 * 2) / 3, 5);
  });

  it("merges fantasypros and yahoo alongside ffc", () => {
    const board: Player[] = [
      player({ id: "1", name: "Bijan Robinson", position: "RB", adp: 2 }),
    ];
    const out = applyAdp(board, {
      ffc: [{ name: "Bijan Robinson", position: "RB", team: "ATL", adp: 3 }],
      fantasypros: [
        { name: "Bijan Robinson", position: "RB", team: "ATL", adp: 4 },
      ],
      yahoo: [{ name: "Bijan Robinson", position: "RB", team: "ATL", adp: 5 }],
    });
    expect(out[0].adpSources).toEqual({
      espn: 2,
      ffc: 3,
      fantasypros: 4,
      yahoo: 5,
    });
    // (2*1 + 3*2 + 4*3 + 5*2) / 8
    expect(out[0].adp).toBeCloseTo((2 + 6 + 12 + 10) / 8, 5);
  });

  it("matches DST by team, ignoring name spelling", () => {
    const board: Player[] = [
      player({ id: "d", name: "Ravens D/ST", position: "DST", team: "BAL" }),
    ];
    board[0].adpSources = { espn: 130 };
    const out = applyAdp(board, {
      ffc: [
        { name: "Baltimore Defense", position: "DST", team: "BAL", adp: 132 },
      ],
    });
    expect(out[0].adpSources?.ffc).toBe(132);
    expect(out[0].adp).toBeCloseTo((130 * 1 + 132 * 2) / 3, 5);
  });

  it("treats an existing adp as the espn baseline when adpSources is absent", () => {
    const board: Player[] = [
      player({ id: "1", name: "Bijan Robinson", position: "RB", adp: 2.3 }),
    ];
    const out = applyAdp(board, {
      ffc: [{ name: "Bijan Robinson", position: "RB", team: "ATL", adp: 1.7 }],
    });
    expect(out[0].adpSources).toEqual({ espn: 2.3, ffc: 1.7 });
    expect(out[0].adp).toBeCloseTo((2.3 * 1 + 1.7 * 2) / 3, 5);
  });

  it("leaves unmatched players on espn only", () => {
    const board: Player[] = [player({ id: "1", name: "Nobody Here", adp: 9 })];
    board[0].adpSources = { espn: 9 };
    const out = applyAdp(board, { ffc: [] });
    expect(out[0].adpSources).toEqual({ espn: 9 });
    expect(out[0].adp).toBe(9);
  });

  it("does not reorder or change tier/flag/notes", () => {
    const board: Player[] = [
      player({ id: "1", name: "First", overallRank: 1, tier: 1 }),
      player({
        id: "2",
        name: "Second",
        overallRank: 2,
        tier: 2,
        flag: "target",
      }),
    ];
    const out = applyAdp(board, { ffc: [] });
    expect(out.map((p) => p.id)).toEqual(["1", "2"]);
    expect(out[1].flag).toBe("target");
    expect(out[1].tier).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/blendAdp.test.ts`
Expected: FAIL — `applyAdp` is not exported yet.

- [ ] **Step 3: Rewrite `applyFfcAdp` as `applyAdp`**

In `src/lib/blendAdp.ts`, replace `applyFfcAdp` (lines 20-42) with:

```ts
export interface AdpInputs {
  ffc?: NormalizedAdp[];
  fantasypros?: NormalizedAdp[];
  yahoo?: NormalizedAdp[];
}

function indexByKey(list?: NormalizedAdp[]): Map<string, NormalizedAdp> {
  const m = new Map<string, NormalizedAdp>();
  for (const a of list ?? []) {
    const key = adpMatchKey(a.position, a.name, a.team);
    if (!m.has(key)) m.set(key, a); // first match wins on rare collisions
  }
  return m;
}

// Non-destructive: match each source's ADP onto board players (by name+position,
// DST by team), record per-source values in adpSources, and recompute the
// weighted adp. Order, tiers, flags, notes and draft status are untouched.
export function applyAdp(board: Player[], inputs: AdpInputs): Player[] {
  const ffcM = indexByKey(inputs.ffc);
  const fpM = indexByKey(inputs.fantasypros);
  const yM = indexByKey(inputs.yahoo);
  return board.map((p) => {
    const key = adpMatchKey(p.position, p.name, p.team);
    // Seed players carry `adp` but no adpSources yet — treat the existing number
    // as the ESPN baseline so a first apply blends rather than discards it.
    const espn = p.adpSources?.espn ?? p.adp;
    const ffc = ffcM.get(key)?.adp ?? p.adpSources?.ffc;
    const fantasypros = fpM.get(key)?.adp ?? p.adpSources?.fantasypros;
    const yahoo = yM.get(key)?.adp ?? p.adpSources?.yahoo;
    const sources: AdpSources = {};
    if (espn != null) sources.espn = espn;
    if (ffc != null) sources.ffc = ffc;
    if (fantasypros != null) sources.fantasypros = fantasypros;
    if (yahoo != null) sources.yahoo = yahoo;
    return { ...p, adpSources: sources, adp: blendAdp(sources, p.position) };
  });
}
```

- [ ] **Step 4: Update the reducer to call `applyAdp`**

In `src/state/reducer.ts`, change the import on line 21:

```ts
import { applyAdp } from "../lib/blendAdp";
```

Replace the `applyAdp` case body (lines 87-90) with:

```ts
    case "applyAdp": {
      const next = applyAdp(players, action.ffc);
      return { players: next, breaks: breaksFromTiers(next) };
    }
```

Note: `action.ffc` here is still `NormalizedAdp[]`; we wrap it. The action shape changes to carry all sources in Task 7 — for now wrap the single list:

```ts
    case "applyAdp": {
      const next = applyAdp(players, { ffc: action.ffc });
      return { players: next, breaks: breaksFromTiers(next) };
    }
```

(Use this second version — it passes the `AdpInputs` object `applyAdp` expects.)

- [ ] **Step 5: Run blend + reducer tests**

Run: `npx vitest run src/lib/blendAdp.test.ts src/state/reducer.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/blendAdp.ts src/lib/blendAdp.test.ts src/state/reducer.ts
git commit -m "Generalize applyFfcAdp into applyAdp for multiple sources"
```

---

## Task 4: FantasyPros normalizer

FantasyPros' ADP page is a server-rendered HTML table: columns `Rank`,
`Player <small>TEAM (BYE)</small>`, `POS` (e.g. `RB1`, `DST1`), `AVG` (the ADP).
Defenses render as full team names ("Houston Texans") with no `<small>` team, so
they need a name→abbr map.

**Files:**

- Create: `src/lib/adpSources/fantasypros.ts`
- Create: `src/lib/adpSources/fantasypros.test.ts`

- [ ] **Step 1: Write the failing parser test**

Create `src/lib/adpSources/fantasypros.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseFantasyPros } from "./fantasypros";

// Minimal fixture mirroring the real FantasyPros ADP table row shape.
const HTML = `
<table><tbody>
<tr><th>Rank</th><th>Player</th><th>POS</th><th>AVG</th></tr>
<tr>
  <td>1</td>
  <td class="player-label player-label-report-page">
    <a class="player-name fp-player-link fp-id-22968" fp-player-name="Jahmyr Gibbs" href="/nfl/players/jahmyr-gibbs.php">Jahmyr Gibbs</a> <small>DET (8)</small>
  </td>
  <td>RB1</td>
  <td>1.5</td>
</tr>
<tr>
  <td>199</td>
  <td class="player-label">
    <a class="player-name fp-player-link fp-id-8120" fp-player-name="Houston Texans" href="/nfl/teams/houston-defense.php">Houston Texans</a>
  </td>
  <td>DST1</td>
  <td>141.0</td>
</tr>
</tbody></table>
`;

describe("parseFantasyPros", () => {
  it("parses an offensive player with team from <small>", () => {
    const out = parseFantasyPros(HTML);
    const gibbs = out.find((p) => p.name === "Jahmyr Gibbs");
    expect(gibbs).toEqual({
      name: "Jahmyr Gibbs",
      position: "RB",
      team: "DET",
      adp: 1.5,
    });
  });
  it("parses a defense, mapping full name to a team abbr", () => {
    const out = parseFantasyPros(HTML);
    const def = out.find((p) => p.position === "DST");
    expect(def).toEqual({
      name: "Houston Texans",
      position: "DST",
      team: "HOU",
      adp: 141,
    });
  });
  it("skips the header row", () => {
    expect(parseFantasyPros(HTML)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/adpSources/fantasypros.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the parser**

Create `src/lib/adpSources/fantasypros.ts`:

```ts
import type { Position } from "../../types";
import type { NormalizedAdp } from "../ffcAdp";

const FP_POS: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DST: "DST",
};

// FantasyPros lists defenses by full team name with no abbreviation; map them.
const DEF_NAME_TO_ABBR: Record<string, string> = {
  "Arizona Cardinals": "ARI",
  "Atlanta Falcons": "ATL",
  "Baltimore Ravens": "BAL",
  "Buffalo Bills": "BUF",
  "Carolina Panthers": "CAR",
  "Chicago Bears": "CHI",
  "Cincinnati Bengals": "CIN",
  "Cleveland Browns": "CLE",
  "Dallas Cowboys": "DAL",
  "Denver Broncos": "DEN",
  "Detroit Lions": "DET",
  "Green Bay Packers": "GB",
  "Houston Texans": "HOU",
  "Indianapolis Colts": "IND",
  "Jacksonville Jaguars": "JAX",
  "Kansas City Chiefs": "KC",
  "Las Vegas Raiders": "LV",
  "Los Angeles Chargers": "LAC",
  "Los Angeles Rams": "LAR",
  "Miami Dolphins": "MIA",
  "Minnesota Vikings": "MIN",
  "New England Patriots": "NE",
  "New Orleans Saints": "NO",
  "New York Giants": "NYG",
  "New York Jets": "NYJ",
  "Philadelphia Eagles": "PHI",
  "Pittsburgh Steelers": "PIT",
  "San Francisco 49ers": "SF",
  "Seattle Seahawks": "SEA",
  "Tampa Bay Buccaneers": "TB",
  "Tennessee Titans": "TEN",
  "Washington Commanders": "WSH",
};

// Parse the FantasyPros ADP page (server-rendered table) into NormalizedAdp.
export function parseFantasyPros(html: string): NormalizedAdp[] {
  const out: NormalizedAdp[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html)) !== null) {
    const inner = row[1];
    if (!/fp-player-name/.test(inner)) continue; // skip header/empty rows
    const name = inner.match(/fp-player-name="([^"]+)"/)?.[1];
    const posCode = inner.match(/<td[^>]*>(QB|RB|WR|TE|K|DST)\d*<\/td>/)?.[1];
    const tds = [...inner.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (m) => m[1],
    );
    const adp = Number(tds[tds.length - 1]?.replace(/<[^>]+>/g, "").trim());
    if (!name || !posCode || !Number.isFinite(adp)) continue;
    const position = FP_POS[posCode];
    const team =
      position === "DST"
        ? (DEF_NAME_TO_ABBR[name] ?? "")
        : (inner.match(/<small>([A-Z]{2,3})/)?.[1] ?? "");
    out.push({ name, position, team, adp });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/adpSources/fantasypros.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/adpSources/fantasypros.ts src/lib/adpSources/fantasypros.test.ts
git commit -m "Add FantasyPros ADP page parser"
```

---

## Task 5: Yahoo normalizer + token refresh

Yahoo's Fantasy API returns deeply nested JSON (mixed arrays/objects). The pure
mapper is tested against a fixture; live fetch + OAuth refresh are thin wrappers
validated during the auth-setup step (Task 9).

**Files:**

- Create: `src/lib/adpSources/yahoo.ts`
- Create: `src/lib/adpSources/yahoo.test.ts`

- [ ] **Step 1: Write the failing mapper test**

Create `src/lib/adpSources/yahoo.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapYahooAdp } from "./yahoo";

// Trimmed shape of Yahoo's players;out=draft_analysis JSON. Each player is a
// 2-element array: [ metadata-array, { draft_analysis: [...] } ]. The metadata
// array is itself a list of single-key objects.
const JSON_FIXTURE = {
  fantasy_content: {
    game: [
      { code: "nfl" },
      {
        players: {
          "0": {
            player: [
              [
                { player_key: "461.p.100" },
                { player_id: "100" },
                { name: { full: "Jahmyr Gibbs" } },
                { editorial_team_abbr: "DET" },
                { display_position: "RB" },
              ],
              { draft_analysis: [{ average_pick: "5.3" }] },
            ],
          },
          "1": {
            player: [
              [
                { name: { full: "Houston Texans" } },
                { editorial_team_abbr: "Hou" },
                { display_position: "DEF" },
              ],
              { draft_analysis: [{ average_pick: "141.0" }] },
            ],
          },
          count: 2,
        },
      },
    ],
  },
};

describe("mapYahooAdp", () => {
  it("maps an offensive player", () => {
    const out = mapYahooAdp(JSON_FIXTURE);
    expect(out).toContainEqual({
      name: "Jahmyr Gibbs",
      position: "RB",
      team: "DET",
      adp: 5.3,
    });
  });
  it("maps a defense to DST with an uppercased team", () => {
    const out = mapYahooAdp(JSON_FIXTURE);
    expect(out).toContainEqual({
      name: "Houston Texans",
      position: "DST",
      team: "HOU",
      adp: 141,
    });
  });
  it("ignores the numeric count key", () => {
    expect(mapYahooAdp(JSON_FIXTURE)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/adpSources/yahoo.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mapper + fetch/refresh helpers**

Create `src/lib/adpSources/yahoo.ts`:

```ts
import type { Position } from "../../types";
import type { NormalizedAdp } from "../ffcAdp";

const YAHOO_POS: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  K: "K",
  DEF: "DST",
};

// Yahoo's player metadata is a list of single-key objects; pull one key out.
function field<T = string>(
  meta: Record<string, unknown>[],
  key: string,
): T | undefined {
  for (const obj of meta) {
    if (obj && typeof obj === "object" && key in obj) {
      return (obj as Record<string, T>)[key];
    }
  }
  return undefined;
}

// Map Yahoo's players;out=draft_analysis JSON into NormalizedAdp rows.
export function mapYahooAdp(json: unknown): NormalizedAdp[] {
  const out: NormalizedAdp[] = [];
  const game = (json as any)?.fantasy_content?.game;
  const players = Array.isArray(game) ? game[1]?.players : undefined;
  if (!players) return out;
  for (const key of Object.keys(players)) {
    if (key === "count") continue;
    const entry = players[key]?.player;
    if (!Array.isArray(entry)) continue;
    const meta = entry[0] as Record<string, unknown>[];
    const analysis = entry[1]?.draft_analysis as
      | Record<string, unknown>[]
      | undefined;
    const full = (field<{ full?: string }>(meta, "name") as any)?.full;
    const posCode = field<string>(meta, "display_position");
    const teamRaw = field<string>(meta, "editorial_team_abbr");
    const avg = Number(field<string>(analysis ?? [], "average_pick"));
    const position = posCode ? YAHOO_POS[posCode] : undefined;
    if (!full || !position || !Number.isFinite(avg) || avg <= 0) continue;
    out.push({
      name: full,
      position,
      team: (teamRaw ?? "").toUpperCase(),
      adp: avg,
    });
  }
  return out;
}

const TOKEN_URL = "https://api.login.yahoo.com/oauth2/get_token";

// Exchange a stored refresh token for a short-lived access token.
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    redirect_uri: "oob",
    refresh_token: refreshToken,
  });
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      authorization: `Basic ${auth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Yahoo token refresh failed: ${res.status}`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token)
    throw new Error("Yahoo token refresh returned no access_token");
  return data.access_token;
}

const PLAYERS_URL =
  "https://fantasysports.yahooapis.com/fantasy/v2/game/nfl/players;sort=AR;out=draft_analysis";

// Page through Yahoo's player list (25 at a time) collecting draft-analysis ADP.
export async function fetchYahooAdp(
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
  maxPlayers = 300,
): Promise<NormalizedAdp[]> {
  const all: NormalizedAdp[] = [];
  for (let start = 0; start < maxPlayers; start += 25) {
    const url = `${PLAYERS_URL};start=${start};count=25?format=json`;
    const res = await fetchImpl(url, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`Yahoo players fetch failed: ${res.status}`);
    const page = mapYahooAdp(await res.json());
    if (page.length === 0) break;
    all.push(...page);
  }
  return all;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/adpSources/yahoo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/adpSources/yahoo.ts src/lib/adpSources/yahoo.test.ts
git commit -m "Add Yahoo ADP mapper and OAuth token/fetch helpers"
```

---

## Task 6: Extend `api/adp.ts` to multiple sources

**Files:**

- Modify: `api/adp.ts`
- Modify: `vite.config.ts` (dev proxy still calls `handleAdp`; no shape change needed there beyond passing through — verify)
- Create/Modify: `api/adp.test.ts`

- [ ] **Step 1: Write the failing handler test**

Create `api/adp.test.ts` (or extend if it exists):

```ts
import { describe, it, expect } from "vitest";
import { handleAdp } from "./adp";

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
    text: async () => "",
  } as unknown as Response;
}

describe("handleAdp multi-source", () => {
  it("returns ffc, fantasypros and yahoo arrays", async () => {
    const fakeFetch = (async (url: string) => {
      if (String(url).includes("fantasyfootballcalculator")) {
        return jsonResponse({
          status: "Success",
          meta: { type: "PPR", total_drafts: 100 },
          players: [{ name: "AJ Brown", position: "WR", team: "PHI", adp: 20 }],
        });
      }
      if (String(url).includes("fantasypros")) {
        return {
          ok: true,
          status: 200,
          text: async () =>
            `<tr><td>1</td><td><a fp-player-name="AJ Brown">AJ Brown</a> <small>PHI</small></td><td>WR1</td><td>21</td></tr>`,
          json: async () => ({}),
        } as unknown as Response;
      }
      // yahoo creds absent in test env → yahoo source skipped
      return jsonResponse({}, false);
    }) as unknown as typeof fetch;

    const out = await handleAdp(
      { scoring: "ppr", teams: 12, season: 2026 },
      fakeFetch,
    );
    expect(out.ffc.length).toBe(1);
    expect(out.fantasypros.length).toBe(1);
    expect(Array.isArray(out.yahoo)).toBe(true);
    expect(out.meta.sources).toContain("ffc");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run api/adp.test.ts`
Expected: FAIL — response has no `fantasypros`/`yahoo`/`meta.sources`.

- [ ] **Step 3: Extend `handleAdp`**

Rewrite `api/adp.ts` so `AdpResponse` and `handleAdp` carry all sources:

```ts
import {
  ffcFormat,
  mapFfcAdp,
  type FfcRaw,
  type NormalizedAdp,
} from "../src/lib/ffcAdp";
import { parseFantasyPros } from "../src/lib/adpSources/fantasypros";
import { mapYahooAdp, refreshAccessToken } from "../src/lib/adpSources/yahoo";
import type { Scoring } from "../src/types";

export const config = { runtime: "edge" };

export interface AdpParams {
  scoring: Scoring;
  teams: number;
  season: number;
}

export interface AdpResponse {
  ffc: NormalizedAdp[];
  fantasypros: NormalizedAdp[];
  yahoo: NormalizedAdp[];
  meta: {
    year: number;
    type?: string;
    total_drafts?: number;
    sources: string[];
  };
}

const FALLBACK_YEARS = 3;

interface FfcPayload {
  status: string;
  players?: FfcRaw[];
  meta?: { type?: string; total_drafts?: number };
}

async function fetchFfc(
  { scoring, teams, season }: AdpParams,
  fetchImpl: typeof fetch,
): Promise<{
  players: NormalizedAdp[];
  year: number;
  type?: string;
  total_drafts?: number;
}> {
  const format = ffcFormat(scoring);
  for (let i = 0; i < FALLBACK_YEARS; i++) {
    const year = season - i;
    const url = `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${teams}&year=${year}`;
    const res = await fetchImpl(url);
    if (!res.ok) continue;
    const data = (await res.json()) as FfcPayload;
    if (data.status === "Success" && data.players?.length) {
      return {
        players: mapFfcAdp(data.players),
        year,
        type: data.meta?.type,
        total_drafts: data.meta?.total_drafts,
      };
    }
  }
  throw new Error(
    `FFC returned no ADP for ${format} within ${FALLBACK_YEARS} seasons of ${season}`,
  );
}

async function fetchFantasyPros(
  scoring: Scoring,
  fetchImpl: typeof fetch,
): Promise<NormalizedAdp[]> {
  const slug =
    scoring === "standard" ? "overall" : `${ffcFormat(scoring)}-overall`;
  const res = await fetchImpl(
    `https://www.fantasypros.com/nfl/adp/${slug}.php`,
    {
      headers: { "user-agent": "Mozilla/5.0" },
    },
  );
  if (!res.ok) throw new Error(`FantasyPros fetch failed: ${res.status}`);
  return parseFantasyPros(await res.text());
}

async function fetchYahoo(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<NormalizedAdp[]> {
  const { YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, YAHOO_REFRESH_TOKEN } = env;
  if (!YAHOO_CLIENT_ID || !YAHOO_CLIENT_SECRET || !YAHOO_REFRESH_TOKEN)
    return [];
  const token = await refreshAccessToken(
    YAHOO_REFRESH_TOKEN,
    YAHOO_CLIENT_ID,
    YAHOO_CLIENT_SECRET,
    fetchImpl,
  );
  const url =
    "https://fantasysports.yahooapis.com/fantasy/v2/game/nfl/players;sort=AR;out=draft_analysis;start=0;count=25?format=json";
  const res = await fetchImpl(url, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Yahoo fetch failed: ${res.status}`);
  return mapYahooAdp(await res.json());
}

// Each non-primary source is best-effort: a failure logs and contributes [].
async function settle<T>(p: Promise<T[]>, label: string): Promise<T[]> {
  try {
    return await p;
  } catch (err) {
    console.warn(`[adp] ${label} skipped: ${(err as Error).message}`);
    return [];
  }
}

export async function handleAdp(
  params: AdpParams,
  fetchImpl: typeof fetch = fetch,
  env: Record<string, string | undefined> = (globalThis as any).process?.env ??
    {},
): Promise<AdpResponse> {
  const ffc = await fetchFfc(params, fetchImpl); // primary — may throw
  const [fantasypros, yahoo] = await Promise.all([
    settle(fetchFantasyPros(params.scoring, fetchImpl), "fantasypros"),
    settle(fetchYahoo(env, fetchImpl), "yahoo"),
  ]);
  const sources = ["ffc"];
  if (fantasypros.length) sources.push("fantasypros");
  if (yahoo.length) sources.push("yahoo");
  return {
    ffc: ffc.players,
    fantasypros,
    yahoo,
    meta: {
      year: ffc.year,
      type: ffc.type,
      total_drafts: ffc.total_drafts,
      sources,
    },
  };
}

export default async function (req: Request): Promise<Response> {
  const url = new URL(req.url);
  const scoring = (url.searchParams.get("scoring") ?? "ppr") as Scoring;
  const teams = Number(url.searchParams.get("teams") ?? "12");
  const season = Number(
    url.searchParams.get("season") ?? new Date().getFullYear(),
  );
  try {
    const body = await handleAdp({ scoring, teams, season });
    return new Response(JSON.stringify(body), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run api/adp.test.ts`
Expected: PASS.

- [ ] **Step 5: Verify the dev proxy still type-checks**

The `vite.config.ts` middleware calls `handleAdp({scoring,teams,season})` and
JSON-stringifies the result — the widened shape flows through unchanged. Confirm:

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add api/adp.ts api/adp.test.ts
git commit -m "Fetch FantasyPros and Yahoo alongside FFC in the ADP endpoint"
```

---

## Task 7: Wire the 4-source response through the client

**Files:**

- Modify: `src/lib/fetchAdp.ts`
- Modify: `src/state/reducer.ts` (action type line 38; case body)
- Modify: `src/state/reducer.test.ts` (action payload ~334)
- Modify: `src/App.tsx` (lines 392-405)
- Modify: `src/components/Toolbar.tsx` (line ~341 label)
- Modify: `src/components/board/cells.tsx` (`adpTitle`, lines 39-49)

- [ ] **Step 1: Update `fetchAdp` return type**

`src/lib/fetchAdp.ts` already returns `AdpResponse` (now widened). No change to
the call, but the destructure in `App.tsx` changes. Confirm `fetchAdp` still
compiles:

Run: `npx tsc --noEmit`
Expected: errors only in `App.tsx`/`reducer.ts` (fixed below), not `fetchAdp.ts`.

- [ ] **Step 2: Widen the reducer action and case**

In `src/state/reducer.ts`, change the action union member (line 38):

```ts
  | {
      type: "applyAdp";
      ffc: NormalizedAdp[];
      fantasypros: NormalizedAdp[];
      yahoo: NormalizedAdp[];
    };
```

Change the case body to pass all three:

```ts
    case "applyAdp": {
      const next = applyAdp(players, {
        ffc: action.ffc,
        fantasypros: action.fantasypros,
        yahoo: action.yahoo,
      });
      return { players: next, breaks: breaksFromTiers(next) };
    }
```

- [ ] **Step 3: Update the reducer test payload**

In `src/state/reducer.test.ts` (~line 334), update the dispatched action to
include the new arrays and assert all sources blend. Replace the action object:

```ts
const updated = boardReducer(state, {
  type: "applyAdp",
  ffc: [{ name: "AJ Brown", position: "WR", team: "PHI", adp: 20 }],
  fantasypros: [],
  yahoo: [],
}).players[0];
// espn 10 (w1) + ffc 20 (w2) = 50/3
expect(updated.adpSources).toEqual({ espn: 10, ffc: 20 });
expect(updated.adp).toBeCloseTo(50 / 3, 5);
```

(Adjust surrounding lines to match the existing test's variable names; the key
changes are the two new arrays and the weighted `adp` assertion.)

- [ ] **Step 4: Update the `App.tsx` dispatch**

In `src/App.tsx`, replace `onRefreshAdp` (lines 392-405) with:

```ts
const onRefreshAdp = async () => {
  setAdpStatus("Loading ADP…");
  try {
    const { ffc, fantasypros, yahoo, meta } = await fetchAdp(
      currentLeague.scoring,
      currentLeague.teams,
    );
    dispatch({ type: "applyAdp", ffc, fantasypros, yahoo });
    setAdpStatus(
      `ADP: ${meta.sources.join(" + ")} ${meta.type ?? ""} (${meta.year})`.trim(),
    );
  } catch (err) {
    setAdpStatus("ADP refresh failed");
    alert("ADP refresh failed: " + (err as Error).message);
  }
};
```

- [ ] **Step 5: Update the Toolbar button label**

In `src/components/Toolbar.tsx` (~line 341), change the label text:

```tsx
              Refresh ADP
```

(Drop the hard-coded "(ESPN + FFC)" — the live source list now shows in `adpStatus`.)

- [ ] **Step 6: Update the source tooltip**

In `src/components/board/cells.tsx`, replace `adpTitle` (lines 39-49):

```ts
function adpTitle(p: Player): string | undefined {
  if (!p.adpSources) return undefined;
  const s = p.adpSources;
  return (
    [
      s.espn != null && `ESPN ${s.espn.toFixed(1)}`,
      s.ffc != null && `FFC ${s.ffc.toFixed(1)}`,
      s.fantasypros != null && `FP ${s.fantasypros.toFixed(1)}`,
      s.yahoo != null && `Yahoo ${s.yahoo.toFixed(1)}`,
    ]
      .filter(Boolean)
      .join(" · ") || undefined
  );
}
```

- [ ] **Step 7: Full test + typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/fetchAdp.ts src/state/reducer.ts src/state/reducer.test.ts src/App.tsx src/components/Toolbar.tsx src/components/board/cells.tsx
git commit -m "Wire FantasyPros + Yahoo through refresh, status, and tooltip"
```

---

## Task 8: Build-time bake into `seed.json`

**Files:**

- Create: `scripts/adp/sources/espn.mjs` (from `scripts/fetch-espn.mjs`)
- Create: `scripts/fetch-adp.ts`
- Modify: `package.json` (add `tsx` dev dep + `fetch-adp` script; drop `fetch-espn`)

- [ ] **Step 1: Add the TS runner**

```bash
npm install -D tsx
```

Expected: `tsx` appears in `devDependencies`; `node_modules/.bin/tsx` exists.

- [ ] **Step 2: Refactor ESPN fetch into an importable function**

Create `scripts/adp/sources/espn.mjs` by moving the body of
`scripts/fetch-espn.mjs` into an exported function that **returns** the universe
records instead of writing a file. Keep all existing constants (`SEASON`, `POS`,
`TEAM`, stat maps, `extractProjStats`, `extractLastStats`, the fetch + ranking
logic). Wrap the build like so:

```js
// scripts/adp/sources/espn.mjs
// (all existing constants + extract* helpers from fetch-espn.mjs go here)

// Returns the ESPN player universe (Player-shaped, adp = ESPN value, no
// adpSources). The orchestrator blends other sources onto these.
export async function fetchEspnUniverse() {
  // ...existing fetch + parse + sort + rank/tier assignment...
  // instead of writeFileSync(...), return the array:
  return top;
}
```

Delete `scripts/fetch-espn.mjs`.

- [ ] **Step 3: Write the orchestrator**

Create `scripts/fetch-adp.ts`:

```ts
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { fetchEspnUniverse } from "./adp/sources/espn.mjs";
import { ffcFormat, mapFfcAdp } from "../src/lib/ffcAdp";
import { parseFantasyPros } from "../src/lib/adpSources/fantasypros";
import {
  mapYahooAdp,
  refreshAccessToken,
  fetchYahooAdp,
} from "../src/lib/adpSources/yahoo";
import { applyAdp } from "../src/lib/blendAdp";
import type { NormalizedAdp } from "../src/lib/ffcAdp";

const SEASON = 2026;
const TEAMS = 12;

async function getFfc(): Promise<NormalizedAdp[]> {
  const format = ffcFormat("ppr");
  for (let i = 0; i < 3; i++) {
    const year = SEASON - i;
    const res = await fetch(
      `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${TEAMS}&year=${year}`,
    );
    if (!res.ok) continue;
    const data = (await res.json()) as { status: string; players?: any[] };
    if (data.status === "Success" && data.players?.length)
      return mapFfcAdp(data.players as any);
  }
  console.warn("[adp] FFC returned nothing");
  return [];
}

async function getFantasyPros(): Promise<NormalizedAdp[]> {
  try {
    const res = await fetch(
      "https://www.fantasypros.com/nfl/adp/ppr-overall.php",
      {
        headers: { "user-agent": "Mozilla/5.0" },
      },
    );
    if (!res.ok) throw new Error(String(res.status));
    return parseFantasyPros(await res.text());
  } catch (err) {
    console.warn(`[adp] FantasyPros skipped: ${(err as Error).message}`);
    return [];
  }
}

async function getYahoo(): Promise<NormalizedAdp[]> {
  const { YAHOO_CLIENT_ID, YAHOO_CLIENT_SECRET, YAHOO_REFRESH_TOKEN } =
    process.env;
  if (!YAHOO_CLIENT_ID || !YAHOO_CLIENT_SECRET || !YAHOO_REFRESH_TOKEN) {
    console.warn("[adp] Yahoo creds absent — skipping Yahoo");
    return [];
  }
  try {
    const token = await refreshAccessToken(
      YAHOO_REFRESH_TOKEN,
      YAHOO_CLIENT_ID,
      YAHOO_CLIENT_SECRET,
    );
    return await fetchYahooAdp(token);
  } catch (err) {
    console.warn(`[adp] Yahoo skipped: ${(err as Error).message}`);
    return [];
  }
}

async function main() {
  const universe = await fetchEspnUniverse();
  if (!universe.length) {
    console.error("ESPN universe empty — refusing to write seed.json");
    process.exit(1);
  }
  const [ffc, fantasypros, yahoo] = await Promise.all([
    getFfc(),
    getFantasyPros(),
    getYahoo(),
  ]);
  const blended = applyAdp(universe as any, { ffc, fantasypros, yahoo });
  const here = dirname(fileURLToPath(import.meta.url));
  const out = join(here, "..", "src", "data", "seed.json");
  writeFileSync(out, JSON.stringify(blended, null, 2) + "\n");
  console.log(
    `Wrote ${blended.length} players (ffc ${ffc.length}, fp ${fantasypros.length}, yahoo ${yahoo.length}) to ${out}`,
  );
}

main();
```

- [ ] **Step 4: Update `package.json` scripts**

Replace the `"fetch-espn"` script line:

```json
    "fetch-adp": "tsx scripts/fetch-adp.ts",
```

- [ ] **Step 5: Run the build to regenerate the seed (Yahoo will be skipped until Task 9)**

Run: `npm run fetch-adp`
Expected: prints `Wrote 500 players (ffc N, fp M, yahoo 0) ...`; `git diff --stat` shows `src/data/seed.json` changed.

- [ ] **Step 6: Sanity-check K/DST landed later**

Run:

```bash
node -e "const p=require('./src/data/seed.json'); const kd=p.filter(x=>x.position==='K'||x.position==='DST').filter(x=>x.adp!=null).sort((a,b)=>a.adp-b.adp).slice(0,5); console.log(kd.map(x=>x.position+' '+x.name+' '+x.adp.toFixed(1)+' src='+JSON.stringify(x.adpSources)))"
```

Expected: the earliest K/DST now sit ≥ ~100 (round 9+), each with an `adpSources`
object — not the old ~81-83.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts/adp/sources/espn.mjs scripts/fetch-adp.ts src/data/seed.json
git rm scripts/fetch-espn.mjs
git commit -m "Bake multi-source blended ADP into seed.json at build time"
```

---

## Task 9: Yahoo one-time auth helper

**Files:**

- Create: `scripts/yahoo-auth.ts`
- Verify: `.gitignore` already ignores `.env.local`

- [ ] **Step 1: Write the auth helper**

Create `scripts/yahoo-auth.ts`:

```ts
import { createInterface } from "node:readline/promises";
import { appendFileSync } from "node:fs";
import { refreshAccessToken } from "../src/lib/adpSources/yahoo";

// One-time: exchange a Yahoo authorization code for a refresh token and append
// the creds to .env.local. Set YAHOO_CLIENT_ID / YAHOO_CLIENT_SECRET first.
const CLIENT_ID = process.env.YAHOO_CLIENT_ID;
const CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET;

async function main() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error(
      "Set YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET env vars first.",
    );
    process.exit(1);
  }
  const authUrl =
    `https://api.login.yahoo.com/oauth2/request_auth?client_id=${CLIENT_ID}` +
    `&redirect_uri=oob&response_type=code&language=en-us`;
  console.log("\n1. Open this URL, sign in, and approve:\n\n" + authUrl + "\n");

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const code = (await rl.question("2. Paste the code shown by Yahoo: ")).trim();
  rl.close();

  const tokenRes = await fetch("https://api.login.yahoo.com/oauth2/get_token", {
    method: "POST",
    headers: {
      authorization:
        "Basic " +
        Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      redirect_uri: "oob",
      code,
    }).toString(),
  });
  if (!tokenRes.ok) {
    console.error(
      "Token exchange failed:",
      tokenRes.status,
      await tokenRes.text(),
    );
    process.exit(1);
  }
  const data = (await tokenRes.json()) as { refresh_token?: string };
  if (!data.refresh_token) {
    console.error("No refresh_token returned.");
    process.exit(1);
  }
  const lines =
    `\nYAHOO_CLIENT_ID=${CLIENT_ID}\nYAHOO_CLIENT_SECRET=${CLIENT_SECRET}\n` +
    `YAHOO_REFRESH_TOKEN=${data.refresh_token}\n`;
  appendFileSync(".env.local", lines);
  console.log("\n✅ Wrote YAHOO_* to .env.local. Re-run `npm run fetch-adp`.");

  // Smoke-test the refresh immediately.
  const access = await refreshAccessToken(
    data.refresh_token,
    CLIENT_ID,
    CLIENT_SECRET,
  );
  console.log(
    "Refresh token works (got an access token:",
    access.slice(0, 8) + "…).",
  );
}

main();
```

- [ ] **Step 2: Add a convenience script (optional)**

In `package.json` scripts, add:

```json
    "yahoo-auth": "tsx scripts/yahoo-auth.ts",
```

- [ ] **Step 3: Verify `.env.local` is gitignored**

Run: `git check-ignore .env.local`
Expected: prints `.env.local` (it is ignored). If not, STOP and add it.

- [ ] **Step 4: Commit (helper only — no secrets)**

```bash
git add scripts/yahoo-auth.ts package.json
git commit -m "Add one-time Yahoo OAuth refresh-token helper"
```

> **User action (Kenny, during execution):** register a Yahoo developer app (see
> the plan's closing "Yahoo credentials" note), export `YAHOO_CLIENT_ID` /
> `YAHOO_CLIENT_SECRET`, run `npm run yahoo-auth`, then re-run `npm run fetch-adp`
> to fold Yahoo into the seed. Set the same three vars in Vercel for the live
> Refresh button.

---

## Task 10: Docs, memory, and final verification

**Files:**

- Create: `scripts/adp/README.md`

- [ ] **Step 1: Write the source/fragility doc**

Create `scripts/adp/README.md`:

```markdown
# ADP sources

`npm run fetch-adp` builds `src/data/seed.json` from a weighted blend of:

| Source      | Access                                                                | Fragility                        |
| ----------- | --------------------------------------------------------------------- | -------------------------------- |
| ESPN        | JSON API (`scripts/adp/sources/espn.mjs`)                             | stable                           |
| FFC         | JSON API (`src/lib/ffcAdp.ts`)                                        | stable                           |
| FantasyPros | **HTML scrape** of the ADP page (`src/lib/adpSources/fantasypros.ts`) | breaks if they restyle the table |
| Yahoo       | **OAuth** (`src/lib/adpSources/yahoo.ts`); creds in `.env.local`      | token/app must stay valid        |

Weights: FantasyPros 3, FFC 2, Yahoo 2, ESPN 1 (`src/lib/blendAdp.ts`).
K/DST priced by ESPN alone are floored to round ~9 (`KDST_ADP_FLOOR`).

## Yearly checklist (preseason)

1. `npm run fetch-adp` and confirm non-zero counts for each source in the log.
2. If FantasyPros count is 0, the page markup changed — fix `parseFantasyPros`
   and its fixture test.
3. If Yahoo count is 0, re-run `npm run yahoo-auth` (token likely expired).
4. Spot-check the K/DST sanity command in the plan (earliest K/DST ≥ ~round 9).
```

- [ ] **Step 2: Full verification**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: all tests PASS, no type errors, production build succeeds.

- [ ] **Step 3: Commit**

```bash
git add scripts/adp/README.md
git commit -m "Document ADP sources and yearly refresh checklist"
```

- [ ] **Step 4: Update memory**

Update `ff_kdst_adp_issue.md` (and its `MEMORY.md` line) to reflect the fix:
multi-source weighted blend (ESPN+FFC+FantasyPros+Yahoo) baked into seed + runtime
Refresh; FantasyPros is a scrape and Yahoo is OAuth, both flagged for a yearly
re-check (`scripts/adp/README.md`).

---

## Self-Review Notes

- **Spec coverage:** widen types (T1), weighted blend + guard (T2), generalized
  apply (T3), FantasyPros (T4), Yahoo (T5), server multi-source (T6), client
  wiring (T7), build-time bake (T8), Yahoo auth (T9), docs/memory (T10). All spec
  sections map to a task.
- **Breaking change handled:** `blendAdp` signature gains `position`; every caller
  (`applyAdp`, tests, build) updated in the same or a later task before `npm test`
  is expected to pass again.
- **Secrets:** Yahoo creds go only to `.env.local` (gitignored); commits in T9
  contain code, never tokens.
- **DRY:** the build orchestrator reuses `applyAdp` + the normalizers rather than
  re-implementing blending.
