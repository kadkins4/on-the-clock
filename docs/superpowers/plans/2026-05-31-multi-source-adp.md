# Multi-source ADP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blend a free consensus ADP source (Fantasy Football Calculator) with ESPN's ADP into each league's board, so the ADP column reflects more than one opinion and is scoring-aware — without losing the user's tiers, order, flags, or notes.

**Architecture:** A serverless-style `/api/adp` proxy (Vite dev middleware now, Vercel function later) fetches FFC consensus ADP **server-side** (FFC sends no CORS header, so the browser can't call it directly) and returns it normalized. The client identity-matches FFC entries to board players (normalized name + position; DST by team), stores each source's number in `Player.adpSources`, and recomputes `Player.adp` as the blend of available sources. A non-destructive "Refresh ADP" action triggers the fetch + blend; the ADP cell exposes the per-source breakdown on hover.

**Tech Stack:** React 19 + TS + Vite + Vitest. New: a `vite.config.ts` dev-server middleware + a `api/adp.ts` handler (framework-agnostic core, Vercel-compatible default export). No new runtime dependencies.

---

## Design notes (read before starting)

**Why FFC, not Sleeper:** Sleeper's public API exposes only `search_rank` (a popularity ordering, not true ADP) and no scoring split. FFC's public API (`https://fantasyfootballcalculator.com/api/v1/adp/{format}?teams={n}&year={y}`) returns real consensus ADP in **ppr / half-ppr / standard** (matching our `Scoring` type), with `high`/`low`/`stdev`/`times_drafted`. Confirmed live. Sleeper's own ADP defers to v1.5.

**Confirmed FFC response shape** (one entry):

```json
{
  "player_id": 2749,
  "name": "Christian McCaffrey",
  "position": "RB",
  "team": "SF",
  "adp": 1.4,
  "adp_formatted": "1.01",
  "times_drafted": 1300,
  "high": 1,
  "low": 5,
  "stdev": 0.6,
  "bye": 8
}
```

Top-level: `{ "status": "Success", "players": [...], "meta": { "type", "teams", "rounds", "total_drafts", "start_date", "end_date" } }`. On no data: `{ "status": "Error", "errors": "No ADP data found." }`.

**Confirmed FFC positions:** `QB`, `RB`, `WR`, `TE`, `PK` (→ our `K`), `DEF` (→ our `DST`). DST names look like `"Baltimore Defense"` with `team: "BAL"` — so **DST must match by team abbreviation, not name**.

**Year availability:** the upcoming season's ADP only populates once preseason drafts run (~August). Requesting a year with no data returns the `"No ADP data found."` error. The handler therefore tries the requested season, then falls back year-by-year (season → season-1 → season-2) and reports which year it used so the UI can label stale data honestly.

**Blending rule (v1):** `blended = mean of available source ADPs` (ESPN + FFC). Single-source players → blended = that one source unchanged. No rounding inside the blend (display rounds), so a single-ESPN-source value stays byte-identical to today's behavior. Scoring-weighting between sources is a deliberate v1.5 follow-up (the open question in the spec) — `blendAdp` takes the two numbers, nothing fancier.

**Non-destructive:** applying ADP updates `adp` + `adpSources` only. It never reorders the board, re-tiers, or touches flags/notes/draft status — same ethos as today's "Fetch players" merge.

**Idempotent:** ESPN's raw number is stored in `adpSources.espn` (set during the ESPN merge), FFC's in `adpSources.ffc` (set during ADP refresh). `adp` is always recomputed from `adpSources`, so refreshing either source repeatedly never compounds.

## Scope

Plan 2 is **multi-source ADP only**. Roster-settings editing UI (superflex, teams count, enable/disable positions) is **not** in this plan — it belongs with the mock-draft engine (Plan 4) that actually consumes it, and FFC's `teams` param defaults safely to 12 / `league.teams` without an editor. Cloud sync, mobile cards, and the per-source breakdown _card_ (vs. the desktop hover shipped here) stay in their later phases.

## File structure

- Create `src/lib/ffcAdp.ts` — FFC types, `ffcFormat()`, `mapFfcAdp()`, `normalizeName()`, `adpMatchKey()`. Pure, fully tested.
- Create `src/lib/blendAdp.ts` — `blendAdp()`, `applyFfcAdp()`. Pure, fully tested.
- Create `src/lib/fetchAdp.ts` — client wrapper calling `/api/adp`. Thin; tested with an injected fetch.
- Create `api/adp.ts` — `handleAdp()` core (injected fetch, year fallback) + Vercel default export. Core tested; HTTP glue verified live.
- Modify `src/types.ts` — add `Player.adpSources`.
- Modify `src/lib/fetchEspn.ts` — `mergeFetched` records `adpSources.espn` and blends.
- Modify `src/state/reducer.ts` — add `applyAdp` action.
- Modify `vite.config.ts` — dev-server middleware routing `/api/adp` to `handleAdp`.
- Modify `src/App.tsx` — `onRefreshAdp` handler + state.
- Modify `src/components/Toolbar.tsx` — "Refresh ADP" menu item + source/year note.
- Modify `src/components/PlayerRow.tsx` — ADP-cell per-source hover.
- Tests: co-located `*.test.ts` per the existing convention.

---

### Task 1: Extend the Player type with per-source ADP

**Files:**

- Modify: `src/types.ts:8-21`

- [ ] **Step 1: Add the optional field to `Player`**

In `src/types.ts`, inside `interface Player`, add after the `adp` line:

```typescript
  adp: number | null; // blended (mean of available sources); board sorts on this
  adpSources?: { espn?: number | null; ffc?: number | null };
```

- [ ] **Step 2: Verify the project still type-checks**

Run: `npx tsc --noEmit`
Expected: no errors (the field is optional; nothing else changes yet).

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "Add per-source adp breakdown to Player"
```

---

### Task 2: FFC normalization (`mapFfcAdp`, `normalizeName`, `adpMatchKey`)

**Files:**

- Create: `src/lib/ffcAdp.ts`
- Test: `src/lib/ffcAdp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/ffcAdp.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  ffcFormat,
  mapFfcAdp,
  normalizeName,
  adpMatchKey,
  type FfcRaw,
} from "./ffcAdp";

describe("ffcFormat", () => {
  it("maps scoring to FFC's format slug", () => {
    expect(ffcFormat("ppr")).toBe("ppr");
    expect(ffcFormat("half")).toBe("half-ppr");
    expect(ffcFormat("standard")).toBe("standard");
  });
});

describe("normalizeName", () => {
  it("lowercases, strips punctuation and generational suffixes", () => {
    expect(normalizeName("A.J. Brown")).toBe("aj brown");
    expect(normalizeName("Marvin Harrison Jr.")).toBe("marvin harrison");
    expect(normalizeName("Amon-Ra St. Brown")).toBe("amonra st brown");
    expect(normalizeName("Ja'Marr Chase")).toBe("jamarr chase");
  });
});

describe("mapFfcAdp", () => {
  const raw: FfcRaw[] = [
    { name: "Christian McCaffrey", position: "RB", team: "SF", adp: 1.4 },
    { name: "Justin Tucker", position: "PK", team: "BAL", adp: 140.9 },
    { name: "Baltimore Defense", position: "DEF", team: "BAL", adp: 131.2 },
    { name: "Bench Warmer", position: "OL", team: "SF", adp: 300 }, // unknown pos
  ];

  it("maps PK->K, DEF->DST, keeps known positions, drops unknown", () => {
    const out = mapFfcAdp(raw);
    expect(out.map((p) => p.position)).toEqual(["RB", "K", "DST"]);
  });

  it("carries name, team and adp through", () => {
    const out = mapFfcAdp(raw);
    expect(out[0]).toEqual({
      name: "Christian McCaffrey",
      position: "RB",
      team: "SF",
      adp: 1.4,
    });
  });
});

describe("adpMatchKey", () => {
  it("keys DST by team, everyone else by position + normalized name", () => {
    expect(adpMatchKey("DST", "Baltimore Defense", "BAL")).toBe("dst:BAL");
    expect(adpMatchKey("RB", "Christian McCaffrey", "SF")).toBe(
      "RB:christian mccaffrey",
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/ffcAdp.test.ts`
Expected: FAIL — `Cannot find module './ffcAdp'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/ffcAdp.ts`:

```typescript
import type { Position, Scoring } from "../types";

export interface FfcRaw {
  name: string;
  position: string; // QB RB WR TE PK DEF
  team: string;
  adp: number;
}

export interface NormalizedAdp {
  name: string;
  position: Position;
  team: string;
  adp: number;
}

export function ffcFormat(scoring: Scoring): string {
  return scoring === "half" ? "half-ppr" : scoring; // ppr | half-ppr | standard
}

const FFC_POS: Record<string, Position> = {
  QB: "QB",
  RB: "RB",
  WR: "WR",
  TE: "TE",
  PK: "K",
  DEF: "DST",
};

export function mapFfcAdp(raw: FfcRaw[]): NormalizedAdp[] {
  const out: NormalizedAdp[] = [];
  for (const r of raw) {
    const position = FFC_POS[r.position];
    if (!position) continue;
    out.push({ name: r.name, position, team: r.team, adp: r.adp });
  }
  return out;
}

// Lowercase, drop generational suffixes, strip . ' ` - so name spellings line
// up across sources (e.g. "A.J. Brown" vs "AJ Brown").
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\.?\b/g, "")
    .replace(/[.'`-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Defenses name inconsistently across sources but share a team abbreviation, so
// match DST by team; everyone else by position + normalized name.
export function adpMatchKey(
  position: Position,
  name: string,
  team: string,
): string {
  return position === "DST"
    ? `dst:${team}`
    : `${position}:${normalizeName(name)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/lib/ffcAdp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ffcAdp.ts src/lib/ffcAdp.test.ts
git commit -m "Add FFC ADP normalization helpers"
```

---

### Task 3: Blend + apply ADP to a board (`blendAdp`, `applyFfcAdp`)

**Files:**

- Create: `src/lib/blendAdp.ts`
- Test: `src/lib/blendAdp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/blendAdp.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { blendAdp, applyFfcAdp } from "./blendAdp";
import type { Player } from "../types";
import type { NormalizedAdp } from "./ffcAdp";

const player = (over: Partial<Player>): Player => ({
  id: "x",
  name: "Test Player",
  position: "RB",
  team: "SF",
  overallRank: 1,
  byeWeek: null,
  tier: 1,
  adp: null,
  notes: "",
  flag: "none",
  draftStatus: "available",
  ...over,
});

describe("blendAdp", () => {
  it("averages available sources", () => {
    expect(blendAdp({ espn: 10, ffc: 20 })).toBe(15);
  });
  it("returns the single available source unchanged", () => {
    expect(blendAdp({ espn: 12.34 })).toBe(12.34);
    expect(blendAdp({ ffc: 8.5 })).toBe(8.5);
  });
  it("returns null when nothing is available", () => {
    expect(blendAdp({})).toBeNull();
    expect(blendAdp({ espn: null, ffc: null })).toBeNull();
  });
});

describe("applyFfcAdp", () => {
  it("matches by name+position, stores ffc, and reblends adp", () => {
    const board: Player[] = [
      player({ id: "1", name: "A.J. Brown", position: "WR", adp: 14 }),
    ];
    board[0].adpSources = { espn: 14 };
    const ffc: NormalizedAdp[] = [
      { name: "AJ Brown", position: "WR", team: "PHI", adp: 20 },
    ];
    const out = applyFfcAdp(board, ffc);
    expect(out[0].adpSources).toEqual({ espn: 14, ffc: 20 });
    expect(out[0].adp).toBe(17);
  });

  it("matches DST by team, ignoring name spelling", () => {
    const board: Player[] = [
      player({ id: "d", name: "Ravens D/ST", position: "DST", team: "BAL" }),
    ];
    board[0].adpSources = { espn: 130 };
    const ffc: NormalizedAdp[] = [
      { name: "Baltimore Defense", position: "DST", team: "BAL", adp: 132 },
    ];
    const out = applyFfcAdp(board, ffc);
    expect(out[0].adpSources?.ffc).toBe(132);
    expect(out[0].adp).toBe(131);
  });

  it("leaves unmatched players' ffc unset and blend on espn only", () => {
    const board: Player[] = [player({ id: "1", name: "Nobody Here", adp: 9 })];
    board[0].adpSources = { espn: 9 };
    const out = applyFfcAdp(board, []);
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
    const out = applyFfcAdp(board, []);
    expect(out.map((p) => p.id)).toEqual(["1", "2"]);
    expect(out[1].flag).toBe("target");
    expect(out[1].tier).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/blendAdp.test.ts`
Expected: FAIL — `Cannot find module './blendAdp'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/blendAdp.ts`:

```typescript
import type { Player } from "../types";
import { adpMatchKey, type NormalizedAdp } from "./ffcAdp";

export interface AdpSources {
  espn?: number | null;
  ffc?: number | null;
}

// Mean of available sources. Single source passes through unrounded so an
// ESPN-only value stays identical to pre-blend behavior. (Scoring-weighting is
// a deliberate v1.5 follow-up.)
export function blendAdp(sources: AdpSources): number | null {
  const vals = [sources.espn, sources.ffc].filter(
    (v): v is number => v != null,
  );
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Non-destructive: match FFC ADP onto existing board players (by name+position,
// DST by team), record it in adpSources.ffc, and recompute adp. Order, tiers,
// flags, notes and draft status are untouched.
export function applyFfcAdp(board: Player[], ffc: NormalizedAdp[]): Player[] {
  const byKey = new Map<string, NormalizedAdp>();
  for (const f of ffc) {
    const key = adpMatchKey(f.position, f.name, f.team);
    if (!byKey.has(key)) byKey.set(key, f); // first match wins on rare collisions
  }
  return board.map((p) => {
    const match = byKey.get(adpMatchKey(p.position, p.name, p.team));
    const sources: AdpSources = {
      ...p.adpSources,
      ffc: match ? match.adp : (p.adpSources?.ffc ?? undefined),
    };
    if (sources.ffc == null) delete sources.ffc;
    return { ...p, adpSources: sources, adp: blendAdp(sources) };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/lib/blendAdp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blendAdp.ts src/lib/blendAdp.test.ts
git commit -m "Add ADP blend + non-destructive apply"
```

---

### Task 4: ESPN merge records its source number and blends

**Files:**

- Modify: `src/lib/fetchEspn.ts:114-161`
- Test: `src/lib/fetchEspn.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/lib/fetchEspn.test.ts`:

```typescript
import { blendAdp } from "./blendAdp";

describe("mergeFetched + adpSources", () => {
  it("stores espn adp in adpSources and reblends, keeping ffc if present", () => {
    const current = [
      {
        id: "1",
        name: "Keep Me",
        position: "RB" as const,
        team: "SF",
        overallRank: 1,
        byeWeek: 8,
        tier: 1,
        adp: 5,
        adpSources: { espn: 5, ffc: 7 },
        notes: "mine",
        flag: "target" as const,
        draftStatus: "available" as const,
      },
    ];
    const fetched = [
      {
        id: "1",
        name: "Keep Me",
        position: "RB" as const,
        team: "SF",
        overallRank: 1,
        adp: 9,
      },
    ];
    const out = mergeFetched(current, fetched);
    expect(out[0].adpSources).toEqual({ espn: 9, ffc: 7 });
    expect(out[0].adp).toBe(blendAdp({ espn: 9, ffc: 7 })); // 8
    expect(out[0].notes).toBe("mine"); // curation preserved
  });

  it("seeds adpSources.espn for newcomers", () => {
    const fetched = [
      {
        id: "9",
        name: "New Guy",
        position: "WR" as const,
        team: "MIA",
        overallRank: 1,
        adp: 30,
      },
    ];
    const out = mergeFetched([], fetched);
    expect(out[0].adpSources).toEqual({ espn: 30 });
    expect(out[0].adp).toBe(30);
  });
});
```

(Use the file's existing import style; `mergeFetched` is already imported there.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/fetchEspn.test.ts`
Expected: FAIL — `adpSources` is `undefined` on merged players.

- [ ] **Step 3: Update `mergeFetched`**

In `src/lib/fetchEspn.ts`, add the import at the top:

```typescript
import { blendAdp } from "./blendAdp";
```

In the `updated` map, replace the matched-player return:

```typescript
const f = fetchedById.get(p.id);
if (!f) return p;
const sources = { ...p.adpSources, espn: f.adp };
return {
  ...p,
  name: f.name,
  position: f.position,
  team: f.team,
  adp: blendAdp(sources),
  adpSources: sources,
  injuryStatus: f.injuryStatus,
};
```

In the newcomer `list.splice(...)` object, replace `adp: f.adp,` with:

```typescript
      adp: blendAdp({ espn: f.adp }),
      adpSources: { espn: f.adp },
```

- [ ] **Step 4: Run the full lib suite to verify green (and no regression)**

Run: `npm test src/lib/fetchEspn.test.ts`
Expected: PASS, including the pre-existing merge tests (single-source blend is unrounded, so `adp` equals `f.adp` as before).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchEspn.ts src/lib/fetchEspn.test.ts
git commit -m "Record ESPN adp as a source and blend on merge"
```

---

### Task 5: `/api/adp` handler core with year fallback

**Files:**

- Create: `api/adp.ts`
- Test: `api/adp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `api/adp.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { handleAdp } from "./adp";

const ok = (players: unknown[], meta: object = {}) =>
  ({
    ok: true,
    json: async () => ({ status: "Success", players, meta }),
  }) as Response;
const noData = () =>
  ({
    ok: true,
    json: async () => ({ status: "Error", errors: "No ADP data found." }),
  }) as Response;

describe("handleAdp", () => {
  it("requests the FFC format for the scoring + teams and normalizes", async () => {
    const fetchImpl = vi.fn(async () =>
      ok([{ name: "CMC", position: "RB", team: "SF", adp: 1.4 }], {
        type: "PPR",
        total_drafts: 100,
      }),
    );
    const res = await handleAdp(
      { scoring: "ppr", teams: 12, season: 2026 },
      fetchImpl,
    );
    expect(fetchImpl.mock.calls[0][0]).toContain("/adp/ppr?teams=12&year=2026");
    expect(res.players).toEqual([
      { name: "CMC", position: "RB", team: "SF", adp: 1.4 },
    ]);
    expect(res.meta.year).toBe(2026);
  });

  it("falls back to an earlier season when the requested one has no data", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(noData()) // 2026
      .mockResolvedValueOnce(
        ok([{ name: "CMC", position: "RB", team: "SF", adp: 1.4 }], {
          type: "PPR",
        }),
      ); // 2025
    const res = await handleAdp(
      { scoring: "ppr", teams: 12, season: 2026 },
      fetchImpl,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(res.meta.year).toBe(2025);
    expect(res.players).toHaveLength(1);
  });

  it("maps half scoring to the half-ppr slug", async () => {
    const fetchImpl = vi.fn(async () => ok([]));
    await handleAdp({ scoring: "half", teams: 10, season: 2026 }, fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toContain(
      "/adp/half-ppr?teams=10&year=2026",
    );
  });

  it("throws when no season has data within the fallback window", async () => {
    const fetchImpl = vi.fn(async () => noData());
    await expect(
      handleAdp({ scoring: "ppr", teams: 12, season: 2026 }, fetchImpl),
    ).rejects.toThrow(/no ADP/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test api/adp.test.ts`
Expected: FAIL — `Cannot find module './adp'`.

- [ ] **Step 3: Write the implementation**

Create `api/adp.ts`:

```typescript
import {
  ffcFormat,
  mapFfcAdp,
  type FfcRaw,
  type NormalizedAdp,
} from "../src/lib/ffcAdp";
import type { Scoring } from "../src/types";

export interface AdpParams {
  scoring: Scoring;
  teams: number;
  season: number;
}

export interface AdpResponse {
  players: NormalizedAdp[];
  meta: { year: number; type?: string; total_drafts?: number };
}

const FALLBACK_YEARS = 3; // try season, season-1, season-2

interface FfcPayload {
  status: string;
  players?: FfcRaw[];
  meta?: { type?: string; total_drafts?: number };
}

// FFC has no CORS header, so this runs server-side only.
export async function handleAdp(
  { scoring, teams, season }: AdpParams,
  fetchImpl: typeof fetch = fetch,
): Promise<AdpResponse> {
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
        meta: {
          year,
          type: data.meta?.type,
          total_drafts: data.meta?.total_drafts,
        },
      };
    }
  }
  throw new Error(
    `FFC returned no ADP for ${format} within ${FALLBACK_YEARS} seasons of ${season}`,
  );
}

// Vercel-compatible default export (used when the app is hosted; the Vite dev
// middleware calls handleAdp directly).
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

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test api/adp.test.ts`
Expected: PASS.

- [ ] **Step 5: Confirm Vitest includes the `api/` folder**

Run: `npm test api/adp.test.ts`
If Vitest reports "No test files found", widen the config in `vite.config.ts` `test` block:

```typescript
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "api/**/*.test.ts"],
  },
```

Re-run and confirm PASS.

- [ ] **Step 6: Commit**

```bash
git add api/adp.ts api/adp.test.ts vite.config.ts
git commit -m "Add /api/adp handler with FFC year fallback"
```

---

### Task 6: Wire `/api/adp` into the Vite dev server

**Files:**

- Modify: `vite.config.ts`

This is I/O glue — verified live in the browser, not unit-tested.

- [ ] **Step 1: Add the dev middleware plugin**

In `vite.config.ts`, import the handler and register a `configureServer` plugin:

```typescript
/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import handleAdpDefault, { handleAdp } from "./api/adp";
import type { Scoring } from "./src/types";

function adpDevApi(): Plugin {
  return {
    name: "dev-api-adp",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/adp", async (req, res) => {
        try {
          const url = new URL(req.url ?? "", "http://localhost");
          const scoring = (url.searchParams.get("scoring") ?? "ppr") as Scoring;
          const teams = Number(url.searchParams.get("teams") ?? "12");
          const season = Number(
            url.searchParams.get("season") ?? new Date().getFullYear(),
          );
          const body = await handleAdp({ scoring, teams, season });
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify(body));
        } catch (err) {
          res.statusCode = 502;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: (err as Error).message }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), adpDevApi()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}", "api/**/*.test.ts"],
  },
});
```

(`handleAdpDefault` stays imported for the future Vercel path; if the linter flags it as unused, drop that import — the default export still ships in `api/adp.ts`.)

- [ ] **Step 2: Verify it serves live**

Run the dev server (the executing human starts it): `npm run dev`
Then in another shell: `curl -s "http://localhost:5173/api/adp?scoring=ppr&teams=12&season=2026" | head -c 300`
Expected: JSON `{"players":[...],"meta":{"year":...}}` (year likely an earlier season until the upcoming season's drafts populate). If you see a `502` with `"no ADP"`, the fallback window may need the current real season — confirm by curling FFC directly for a known-good year.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "Serve /api/adp from the Vite dev server"
```

---

### Task 7: Client fetch wrapper (`fetchAdp`)

**Files:**

- Create: `src/lib/fetchAdp.ts`
- Test: `src/lib/fetchAdp.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/fetchAdp.test.ts`:

```typescript
import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchAdp } from "./fetchAdp";

afterEach(() => vi.restoreAllMocks());

describe("fetchAdp", () => {
  it("calls /api/adp with scoring + teams and returns players + meta", async () => {
    const players = [{ name: "CMC", position: "RB", team: "SF", adp: 1.4 }];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ players, meta: { year: 2025, type: "PPR" } }),
      })),
    );
    const res = await fetchAdp("ppr", 12);
    expect(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0],
    ).toBe("/api/adp?scoring=ppr&teams=12");
    expect(res.players).toEqual(players);
    expect(res.meta.year).toBe(2025);
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 502,
        json: async () => ({ error: "no ADP" }),
      })),
    );
    await expect(fetchAdp("ppr", 12)).rejects.toThrow(/ADP/i);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/lib/fetchAdp.test.ts`
Expected: FAIL — `Cannot find module './fetchAdp'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/fetchAdp.ts`:

```typescript
import type { Scoring } from "../types";
import type { NormalizedAdp } from "./ffcAdp";
import type { AdpResponse } from "../../api/adp";

export async function fetchAdp(
  scoring: Scoring,
  teams: number,
): Promise<AdpResponse> {
  const res = await fetch(`/api/adp?scoring=${scoring}&teams=${teams}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(`ADP fetch failed: ${body.error ?? res.status}`);
  }
  return (await res.json()) as AdpResponse;
}

export type { NormalizedAdp };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/lib/fetchAdp.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fetchAdp.ts src/lib/fetchAdp.test.ts
git commit -m "Add client fetchAdp wrapper"
```

---

### Task 8: `applyAdp` reducer action

**Files:**

- Modify: `src/state/reducer.ts:15-29` (Action union) and `:31-63` (rankingReducer)
- Test: `src/state/reducer.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `src/state/reducer.test.ts`:

```typescript
import type { NormalizedAdp } from "../lib/ffcAdp";

describe("applyAdp action", () => {
  it("blends FFC adp into the active league's board, preserving order", () => {
    // Build a minimal leagues state with one league + one player. Mirror the
    // construction the duplicate/switch tests in this file already use.
    const lg = makeLeague({
      name: "Test",
      board: [
        {
          id: "1",
          name: "A.J. Brown",
          position: "WR",
          team: "PHI",
          overallRank: 1,
          byeWeek: null,
          tier: 1,
          adp: 10,
          adpSources: { espn: 10 },
          notes: "",
          flag: "none",
          draftStatus: "available",
        },
      ],
    });
    const base = { currentId: lg.id, leagues: [lg] };
    const ffc: NormalizedAdp[] = [
      { name: "AJ Brown", position: "WR", team: "PHI", adp: 20 },
    ];
    const next = leaguesReducer(base, { type: "applyAdp", ffc });
    const updated = next.leagues[0].board[0];
    expect(updated.adpSources).toEqual({ espn: 10, ffc: 20 });
    expect(updated.adp).toBe(15);
    expect(updated.id).toBe("1");
  });
});
```

> `makeLeague` and `leaguesReducer` are already imported in this test file (used by the leagues tests). If not, add `import { makeLeague } from "../lib/league";`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test src/state/reducer.test.ts`
Expected: FAIL — `applyAdp` is unhandled, so `adpSources.ffc` is never set.

- [ ] **Step 3: Add the action**

In `src/state/reducer.ts`, add the imports:

```typescript
import { applyFfcAdp } from "../lib/blendAdp";
import type { NormalizedAdp } from "../lib/ffcAdp";
```

Add to the `Action` union (after the `merge` case):

```typescript
  | { type: "merge"; fetched: FetchedPlayer[] }
  | { type: "applyAdp"; ffc: NormalizedAdp[] };
```

Add the case in `rankingReducer` (after `case "merge":`):

```typescript
    case "applyAdp":
      return applyFfcAdp(state, action.ffc);
```

(The `leaguesReducer` default branch already delegates unknown actions to `rankingReducer` on the active board and bumps `updatedAt` only on change — no change needed there.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test src/state/reducer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/state/reducer.ts src/state/reducer.test.ts
git commit -m "Add applyAdp reducer action"
```

---

### Task 9: "Refresh ADP" UI + per-source hover

**Files:**

- Modify: `src/App.tsx` (handler + Toolbar props)
- Modify: `src/components/Toolbar.tsx` (menu item + source note)
- Modify: `src/components/PlayerRow.tsx` (ADP cell hover)

UI wiring — verified live in the browser.

- [ ] **Step 1: Add the refresh handler in `App.tsx`**

Import at top:

```typescript
import { fetchAdp } from "./lib/fetchAdp";
```

Add state near the other `useState` calls:

```typescript
const [adpStatus, setAdpStatus] = useState<string | null>(null);
```

Add the handler near `onFetch`:

```typescript
const onRefreshAdp = async () => {
  setAdpStatus("Loading ADP…");
  try {
    const { players: ffc, meta } = await fetchAdp(
      currentLeague.scoring,
      currentLeague.teams,
    );
    dispatch({ type: "applyAdp", ffc });
    setAdpStatus(`ADP: ESPN + FFC ${meta.type ?? ""} (${meta.year})`.trim());
  } catch (err) {
    setAdpStatus("ADP refresh failed");
    alert("ADP refresh failed: " + (err as Error).message);
  }
};
```

Pass to `<Toolbar>`:

```typescript
onRefreshAdp = { onRefreshAdp };
adpStatus = { adpStatus };
```

- [ ] **Step 2: Add the menu item + note in `Toolbar.tsx`**

Add to the Toolbar props type:

```typescript
  onRefreshAdp: () => void;
  adpStatus: string | null;
```

In the ⚙ menu, beside the existing "Fetch players" item, add:

```tsx
<button type="button" onClick={onRefreshAdp}>
  Refresh ADP (ESPN + FFC)
</button>;
{
  adpStatus && <div className="menu-hint">{adpStatus}</div>;
}
```

- [ ] **Step 3: Show the per-source breakdown on the ADP cell in `PlayerRow.tsx`**

Find the cell rendering `player.adp`. Add a `title` describing the sources (route it onto the same `<td>` that already renders ADP, keeping that cell's current value formatting):

```tsx
<td
  className="num"
  title={
    player.adpSources
      ? [
          player.adpSources.espn != null &&
            `ESPN ${player.adpSources.espn.toFixed(1)}`,
          player.adpSources.ffc != null &&
            `FFC ${player.adpSources.ffc.toFixed(1)}`,
        ]
          .filter(Boolean)
          .join(" · ") || undefined
      : undefined
  }
>
  {player.adp == null ? "" : player.adp.toFixed(1)}
</td>
```

- [ ] **Step 4: Verify the whole suite is green**

Run: `npm test`
Expected: all suites PASS (the new ones plus the prior 88).

- [ ] **Step 5: Verify live in the browser**

With `npm run dev` running:

1. Open the app, open the ⚙ menu, click **Refresh ADP (ESPN + FFC)**.
2. Confirm the status note appears (e.g. "ADP: ESPN + FFC PPR (2024)").
3. Hover a top player's ADP cell → tooltip shows `ESPN x · FFC y`.
4. Confirm tiers/order/flags are unchanged (non-destructive).
5. Switch a league's scoring to Standard, Refresh ADP again, confirm the note shows the standard format and some ADP values shift.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Toolbar.tsx src/components/PlayerRow.tsx
git commit -m "Add Refresh ADP action and per-source hover"
```

---

## Finishing

After all tasks pass and the live checks are clean:

- **REQUIRED SUB-SKILL:** Use superpowers:finishing-a-development-branch — verify the full suite, then present merge/PR/keep/discard options.

## Self-review (done while writing)

- **Spec coverage:** `/api/adp` proxy ✓ (Tasks 5–6); ESPN + second-source normalization + identity matching ✓ (Tasks 2–4); per-source storage + scoring-weighted blend ✓ (Task 3; equal-weight v1, weighting flagged as v1.5); breakdown surfaced ✓ (Task 9 desktop hover; mobile card is Phase 5). Divergence: second source is **FFC**, not Sleeper — decided with the user; Sleeper ADP → v1.5.
- **Out of this plan (intentional):** roster-settings editing UI (moved to Plan 4 where the mock engine consumes it), cloud sync (Plan 3), mobile card breakdown (Plan 5).
- **Type consistency:** `NormalizedAdp` defined once in `ffcAdp.ts`, reused by `blendAdp.ts`, `api/adp.ts`, `fetchAdp.ts`, and the reducer. `AdpSources { espn?, ffc? }` shared by `blendAdp` and `Player.adpSources`. `ffcFormat`/`mapFfcAdp`/`adpMatchKey` names stable across tasks.
- **Open follow-up (unchanged from spec):** scoring-weight specifics for the blend; identity-match override UX for the unmatched handful (first-match-wins for now, documented).
