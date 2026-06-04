# Multi-Source ADP Blend — Design

**Date:** 2026-06-04
**Status:** Approved (design); implementation pending
**Branch:** `multi-source-adp`

## Problem

On The Clock sources all player data from a single ESPN pull (`scripts/fetch-espn.mjs`).
Bots in the mock draft, and the ADP shown to users, both ride ESPN's
`averageDraftPosition`. ESPN's ADP skews kickers and defenses far too early —
Brandon Aubrey at 83.3 and Texans D/ST at 81.6 land K/DST around **round 7** in a
12-team league, where real-world consensus puts them round 10+. (For reference,
FantasyFootballCalculator's consensus puts the first defense at ~102.7 and lists
no kickers at all in its top 171 this time of year.)

The deeper goal is not a K/DST band-aid: it is **ADP that reflects real-world
consensus across the whole board**, with the K/DST timing falling out naturally
as a side effect.

## Goal

Replace the single-source ESPN ADP with a **weighted blend of multiple real-world
ADP sources**, computed at build time and baked into `seed.json`. Keep each
source's contribution visible for transparency and a future UI. Fix K/DST timing
as a consequence of getting consensus right, not via a special-case hack.

## Non-Goals

- No runtime API calls. The browser keeps reading a static `seed.json`.
- No change to how the app _consumes_ ADP. Components, bots, and the cheat sheet
  read `adp` exactly as they do today.
- No re-ranking of the cheat sheet. `overallRank`/`tier` stay ESPN's expert rank
  (a deliberate "Rank vs ADP" distinction — see §5).
- No automation/scheduling of the refresh. It stays a manual script run.

## Sources

Investigated 2026-06-04. Verdicts reflect what is freely/realistically obtainable:

| Source                              | Access                                                                                | Role                  |
| ----------------------------------- | ------------------------------------------------------------------------------------- | --------------------- |
| **ESPN**                            | Clean JSON API (already in use)                                                       | Player universe + ADP |
| **FFC** (FantasyFootballCalculator) | Clean JSON API, no key; real-draft consensus                                          | ADP                   |
| **FantasyPros**                     | Official API is key-walled (403); ADP **page** loads (200) with an embedded JSON blob | ADP (scrape)          |
| **Yahoo**                           | Free, but OAuth app + refresh-token flow                                              | ADP                   |

Rejected as direct sources: **CBS** (no open API; scrape-only page), **NFL.com**
(old `api.fantasy.nfl.com` endpoints are dead — 404), **RTSports** (no usable
public feed — 404), **Sleeper** (player metadata only; no published ADP endpoint),
**Underdog** (no free public API). FantasyPros' consensus already folds in
CBS/NFL/Sleeper/RTSports, so one FantasyPros scrape covers them as a blend rather
than maintaining a scraper per site.

## Architecture

All work is **build-time**. A single orchestrator pulls every source, matches
players, blends ADP, and rewrites `seed.json` with ESPN as the player universe.

```
scripts/
  fetch-adp.mjs              # orchestrator: fetch all → match → blend → write seed.json
  yahoo-auth.mjs             # one-time helper: mint a Yahoo refresh token into .env
  adp/
    sources/
      espn.mjs               # async fetch() -> [{ name, position, team, adp }]
      ffc.mjs                # "
      fantasypros.mjs        # parses embedded JSON from the ADP page
      yahoo.mjs              # uses access token (refreshed from YAHOO_REFRESH_TOKEN)
    match.mjs                # canonical key + TEAM_ALIASES; joins sources to ESPN universe
    blend.mjs                # weighted average + coverage guard
    README.md                # per-source access notes + yearly fragility checklist
```

`scripts/fetch-espn.mjs` is folded into `adp/sources/espn.mjs` (which now also
yields the full universe record set used as the base). `npm run fetch-espn` is
replaced by `npm run fetch-adp`.

### Component contracts

- **Source adapter** (`sources/*.mjs`): `async fetch(): Promise<RawAdp[]>` where
  `RawAdp = { name, position, team, adp }`. ESPN additionally returns the full
  universe records (everything `seed.json` needs today). A source that errors or
  is unconfigured (e.g. no Yahoo creds) logs a warning and returns `[]` — it never
  hard-fails the build.
- **match.mjs**: `canonicalKey({ name, position, team }) -> string` and
  `joinSources(universe, sourceLists) -> Map<key, { espn?, ffc?, fantasypros?, yahoo? }>`.
  Unmatched source rows are collected and logged, not dropped silently.
- **blend.mjs**: `blendAdp(sources: { espn?, ffc?, fantasypros?, yahoo? }, position) -> number | null`.

## Matching / canonicalization

Joining four naming schemes is the main engineering risk, so it is isolated in
`match.mjs`:

- **Canonical key** = `normalize(name) + "|" + position`, where `normalize`
  lowercases, strips punctuation/apostrophes, and removes name suffixes
  (`Jr`, `Sr`, `II`, `III`, `IV`, `V`).
- **Defenses** match by **team abbreviation**, not name — sources spell them
  differently ("Texans D/ST", "Denver Defense", "DEN DST"). A shared
  `TEAM_ALIASES` map collapses every source's team codes to one canonical set.
- The ESPN universe is the spine; each other source is joined onto it. Source
  rows that match nothing are pushed to an `unmatched` log printed at the end of a
  run so gaps are visible each season.

## Blend (weighted average + coverage guard)

`blend.mjs`, pure and unit-tested.

- **Weights** (tunable constants): `FantasyPros 3, FFC 2, Yahoo 2, ESPN 1`.
  Consensus aggregates outrank single platforms; ESPN is weighted lowest because
  it is the K/DST skewer.
- **Formula:** `adp = Σ(wᵢ · adpᵢ) / Σ(wᵢ)` over sources present for that player.
- **Coverage guard:** if a `K`/`DST` is priced by **ESPN only** (no consensus
  source agrees), clamp its blended ADP to no earlier than a positional floor
  (`KDST_ADP_FLOOR ≈ 100`). This is a narrow safety net for the early-season case
  where FFC/FantasyPros have not yet priced kickers; it rarely fires once Yahoo
  (which does price kickers) is present. It is _not_ a blanket engine-side hack —
  offense is never floored.
- A player with no source ADP at all keeps `adp = null` (sorts last, as today).

## Data shape

Each player in `seed.json` gains an `adpSources` object; `adp` becomes the blend.

```jsonc
{
  // ...existing ESPN fields (id, name, position, team, overallRank, tier,
  //    byeWeek, projStats, lastStats, projPoints, notes, flag, draftStatus)...
  "adp": 121.3, // blended (was raw ESPN)
  "adpSources": {
    // null where a source lacks the player
    "espn": 83.3,
    "ffc": null,
    "fantasypros": 130.0,
    "yahoo": 128.5,
  },
}
```

`overallRank` and `tier` remain ESPN's expert rank — Rank ("where a player
_should_ go") stays distinct from ADP ("where they _actually_ go"). `adpSources`
is the foundation for a future "ADP from N sources" tooltip. No runtime code
changes: the app still reads `adp`.

## Yahoo OAuth (one-time user setup)

- **Prerequisite (Kenny, once):** register a free Yahoo developer app to get a
  `client_id` / `client_secret`.
- `scripts/yahoo-auth.mjs` prints an authorize URL; Kenny logs in + approves,
  pastes the returned code back, and the script exchanges it for a **refresh
  token** written to `.env` as `YAHOO_REFRESH_TOKEN` (alongside
  `YAHOO_CLIENT_ID` / `YAHOO_CLIENT_SECRET`).
- On each `fetch-adp` run, `sources/yahoo.mjs` silently exchanges the refresh
  token for a short-lived access token and reads `draft_analysis.average_pick`.
- `.env` stays gitignored. Absent creds → Yahoo is skipped, other three blend.

## Error handling

- Any single source failing (network, shape change, missing creds) logs a warning
  and contributes nothing; the build proceeds with whatever sources succeeded.
- The orchestrator refuses to overwrite `seed.json` if the resulting set is empty
  or the ESPN universe pull failed (same guard the current script has).
- Unmatched source rows are surfaced in the run log.

## Testing

Pure pieces get unit tests (Vitest):

- **blend.mjs:** weights applied correctly; missing sources excluded; coverage
  guard fires for ESPN-only K/DST and not for offense; ESPN-outlier case lands
  late; all-null → null.
- **match.mjs:** suffix stripping, punctuation, D/ST team-alias matching, and a
  near-miss that should _not_ match.
- **Each adapter:** a parse test against a saved fixture of that source's real
  response, so an upstream shape change fails loudly rather than poisoning
  `seed.json`.

## Fragility note

`scripts/adp/README.md` documents each source's access method, flags FantasyPros
(scrape) and Yahoo (OAuth) as the fragile/maintenance-heavy ones, and carries a
yearly "verify these still parse" checklist. A memory note records the same so it
resurfaces in future sessions. (Per Kenny: fine to revisit ~once a year.)

## Caveat

FFC's `year=2026` data currently traces to preseason draft windows (Sept 2025),
since 2026 drafts have not yet ramped in June. Ordering is still realistic; the
freshest 2026 consensus fills in closer to the season. Re-running `fetch-adp`
later in the summer refreshes it.
