# Multi-Source ADP Blend — Design (v2)

**Date:** 2026-06-04
**Status:** Approved (design); implementation pending
**Branch:** `multi-source-adp`

> **v2 note:** The original draft assumed a greenfield, single-source ESPN seed.
> Inspecting the repo revealed an existing **runtime** ESPN+FFC blend (matching,
> server-side fetch, a "Refresh ADP" button, and a source-breakdown tooltip).
> This version reframes the work as _extending_ that infrastructure plus adding a
> **build-time bake**, per the decision below.

## Problem

Bots in the mock draft, and the ADP shown to users, ride ESPN's
`averageDraftPosition`, which skews kickers and defenses far too early — Brandon
Aubrey at 83.3 and Texans D/ST at 81.6 land K/DST around **round 7** in a 12-team
league, where real-world consensus puts them round 10+. (FFC consensus puts the
first defense at ~102.7 and lists no kickers in its top 171 this time of year.)

Critically, **`seed.json` ships raw ESPN ADP** (no `adpSources`). The existing
ESPN+FFC blend only runs when a user clicks **Refresh ADP**, so a fresh mock
draft's bots read the unblended seed — K/DST stay at round 7 by default.

The goal is **ADP that reflects real-world consensus across the whole board**,
with K/DST timing falling out as a side effect — fixed **by default**, not only
after a manual refresh.

## Decision (locked)

**Bake into seed + extend runtime.** Add a build-time bake so `seed.json` ships a
blended `adp` (fixes the default K/DST bug with no user action), AND extend the
existing runtime Refresh from ESPN+FFC to all four sources for freshness. Both
layers share one core (matching + blend).

## Sources

Investigated 2026-06-04:

| Source          | Access                                                                       | Layer                                          |
| --------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| **ESPN**        | Clean JSON API (in use; build-time universe + baseline ADP)                  | build + (baseline already on board at runtime) |
| **FFC**         | Clean JSON API, no key; real-draft consensus (in use, server-side)           | build + runtime                                |
| **FantasyPros** | Official API key-walled (403); ADP **page** loads with an embedded JSON blob | build + runtime (scrape, server-side)          |
| **Yahoo**       | Free, but OAuth app + refresh-token flow                                     | build + runtime (server-side)                  |

Rejected as direct sources: **CBS** (scrape-only page, no open API), **NFL.com**
(old API dead — 404), **RTSports** (no public feed — 404), **Sleeper** (no
published ADP endpoint), **Underdog** (no free API). FantasyPros' consensus
already folds in CBS/NFL/Sleeper/RTSports, so one scrape covers them.

## Existing infrastructure (reuse, do not rebuild)

- **`src/lib/ffcAdp.ts`** — `normalizeName()` (lowercases, strips Jr/Sr/II–V and
  punctuation), `adpMatchKey(position, name, team)` (DST by team, others by
  position+name), `NormalizedAdp` type, `mapFfcAdp()`, `ffcFormat()`.
- **`src/lib/blendAdp.ts`** — `AdpSources` (`{ espn?, ffc? }`), `blendAdp()`
  (currently a plain **mean**), `applyFfcAdp(board, ffc)` (non-destructive merge +
  reblend by `adpMatchKey`; treats a seed player's existing `adp` as the ESPN
  baseline).
- **`api/adp.ts`** — edge handler `handleAdp({scoring,teams,season})` fetching FFC
  server-side (FFC sends no CORS header) with a 3-season fallback; returns
  `AdpResponse { players: NormalizedAdp[], meta }`. Mirrored by a dev proxy in
  `vite.config.ts`.
- **`src/lib/fetchAdp.ts`** — client `fetchAdp(scoring, teams)` → `/api/adp`.
- **`src/state/reducer.ts`** — `applyAdp` action → `applyFfcAdp(players, action.ffc)`.
- **`src/components/Toolbar.tsx`** — "Refresh ADP (ESPN + FFC)" button, `adpStatus`.
- **`src/components/board/cells.tsx`** — tooltip rendering `adpSources.espn`/`.ffc`.
- **`src/types.ts`** — `Player.adp: number | null`, `adpSources?: { espn?, ffc? }`.

## Architecture

One shared core, consumed by two layers.

```
src/lib/
  ffcAdp.ts            # (existing) normalizeName, adpMatchKey, NormalizedAdp
  adpSources/
    fantasypros.ts     # parseFantasyPros(html) -> NormalizedAdp[]
    yahoo.ts           # mapYahooAdp(json) -> NormalizedAdp[]; refreshAccessToken()
  blendAdp.ts          # (rewritten) weighted blend + coverage guard; applyAdp()
api/
  adp.ts               # (extended) fetch FFC + FantasyPros + Yahoo server-side
scripts/
  fetch-adp.ts         # (new) build-time orchestrator (run via vite-node)
  yahoo-auth.ts        # (new) one-time: mint Yahoo refresh token into .env.local
  adp/README.md        # per-source access notes + yearly fragility checklist
```

`scripts/fetch-espn.mjs` is superseded by `scripts/fetch-adp.ts` (ESPN universe
pull + the three ADP sources + blend, written to `seed.json`). `npm run
fetch-espn` → `npm run fetch-adp`. The build script runs under **vite-node** (ships
with vitest) so it can import the TS shared core — no duplicated fetch/blend logic.

### Component contracts

- **Source normalizers** (`fantasypros.ts`, `yahoo.ts`): pure transforms from a
  raw payload to `NormalizedAdp[]`. No network in the pure parts (testable against
  fixtures). Network/auth lives in `api/adp.ts` and the build script.
- **`blendAdp(sources, position)`** → `number | null`. Pure.
- **`applyAdp(board, { ffc?, fantasypros?, yahoo? })`** → `Player[]`. Generalizes
  `applyFfcAdp`; merges every provided source onto the board by `adpMatchKey`,
  recomputes `adp` via `blendAdp`. ESPN baseline already lives on the board.

## Blend (weighted average + coverage guard)

`blendAdp.ts`, pure and unit-tested. **Breaking change:** mean → weighted average.

- **Weights** (tunable constants): `FantasyPros 3, FFC 2, Yahoo 2, ESPN 1`.
- **Formula:** `adp = Σ(wᵢ·adpᵢ) / Σ(wᵢ)` over sources present.
- **Coverage guard:** if a `K`/`DST` is priced by **ESPN only**, clamp blended ADP
  to ≥ `KDST_ADP_FLOOR` (default **100**). Narrow safety net for early-season when
  FFC/FP have not priced kickers; offense is never floored.
- No sources present → `adp = null` (sorts last, unchanged).

Signature changes from `blendAdp(sources)` to `blendAdp(sources, position)`; all
callers (`applyAdp`, build script) pass the player's position.

## Source normalizers

- **FantasyPros** (`parseFantasyPros(html)`): extract the JSON the ADP page embeds
  in a `<script>` (e.g. `ecrData` / `adpData`), map its position codes and
  team/name to `NormalizedAdp`. Tested against a saved page fixture so a markup
  change fails loudly. (Scrape — the fragile one.)
- **Yahoo** (`mapYahooAdp(json)`): map `draft_analysis.average_pick` +
  player metadata to `NormalizedAdp`. `refreshAccessToken(refreshToken)` exchanges
  the stored refresh token for a short-lived access token (used by `api/adp.ts`
  and the build script). Position/team code maps included.

## Server-side `api/adp.ts`

Extend `handleAdp` to fetch FFC + FantasyPros + Yahoo concurrently, each guarded
(a thrown/failed source contributes nothing; FFC failure still throws as today
since it is the primary). New response shape:

```ts
interface AdpResponse {
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
```

Yahoo creds read from env (`YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`,
`YAHOO_REFRESH_TOKEN`); absent → Yahoo skipped. The dev proxy in `vite.config.ts`
updates in lockstep.

## Client wiring

- `fetchAdp` returns the new multi-source `AdpResponse`.
- `applyAdp` reducer action carries `{ ffc, fantasypros, yahoo }`; calls `applyAdp`.
- Toolbar label → "Refresh ADP" (sources listed in the hint/tooltip).
- `cells.tsx` tooltip lists every present source (ESPN / FFC / FP / Yahoo).

## Data shape

`Player.adpSources` widens to `{ espn?, ffc?, fantasypros?, yahoo? }`. `seed.json`
players gain populated `adpSources` and a blended `adp` (build-time). Example:

```jsonc
{
  // ...existing ESPN fields...
  "adp": 121.3,
  "adpSources": {
    "espn": 83.3,
    "ffc": null,
    "fantasypros": 130.0,
    "yahoo": 128.5,
  },
}
```

`overallRank`/`tier` remain ESPN's expert rank — Rank ("should go") stays distinct
from ADP ("actually goes").

## Yahoo OAuth (one-time user setup)

- **Prerequisite (Kenny, once):** register a free Yahoo developer app for a
  `client_id` / `client_secret`.
- `scripts/yahoo-auth.ts` prints an authorize URL; Kenny logs in + approves, pastes
  the code back; the script exchanges it for a **refresh token** written to
  **`.env.local`** (`YAHOO_REFRESH_TOKEN`, `YAHOO_CLIENT_ID`, `YAHOO_CLIENT_SECRET`).
  > Secrets go in `.env.local` (gitignored). The tracked `.env` holds only the
  > public Formspree endpoint — never put secrets there.
- For the hosted runtime, the same three vars are set in Vercel project env.
- Absent creds anywhere → Yahoo is skipped; the other sources still blend.

## Error handling

- Any single non-primary source failing logs a warning and contributes nothing.
- FFC remains primary at runtime (its failure still surfaces, as today).
- Build script refuses to overwrite `seed.json` on an empty/failed ESPN universe.
- Unmatched source rows are logged at the end of a build run.

## Testing

- **blendAdp.test.ts** (extend): weighted-average math; missing sources excluded;
  coverage guard fires for ESPN-only K/DST and not for offense; ESPN-outlier lands
  late; all-null → null. Update existing mean-based assertions.
- **applyAdp**: merges multiple sources; preserves order/tiers/flags/notes.
- **fantasypros.ts / yahoo.ts**: parse tests against saved fixtures.
- **api/adp.ts** (extend): multi-source response; a failing non-primary source is
  omitted, not fatal.
- **reducer + fetchEspn**: update for widened `adpSources` and new action payload.

## Fragility note

`scripts/adp/README.md` documents each source's access method, flags FantasyPros
(scrape) and Yahoo (OAuth) as maintenance-heavy, and carries a yearly "verify
these still parse" checklist. A memory note records the same. (Per Kenny: fine to
revisit ~once a year.)

## Caveat

FFC `year=2026` data currently traces to preseason windows (Sept 2025); 2026
consensus fills in closer to the season. Re-running `fetch-adp` later refreshes it.
