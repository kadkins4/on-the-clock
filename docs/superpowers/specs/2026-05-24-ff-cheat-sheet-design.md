# FF Cheat Sheet — Design

**Date:** 2026-05-24
**Status:** Approved (pending spec review)

## Purpose

A local, single-page web app that serves as a draft-day fantasy football cheat
sheet. The owner maintains one ranking list, re-ranks players over time, and uses
it live during a draft to cross off players as they are taken. Rankings persist
in the browser and can be backed up / moved via JSON & CSV export/import. The app
ships pre-seeded with ESPN's current rankings.

## Scope

**In scope (v1):**

- Single ranking list of players.
- In-app editing of all player fields.
- Drag-to-reorder (sets overall rank; positional rank auto-computed).
- Tier grouping with visual dividers.
- Position filter, name search, "hide drafted" toggle, column sorting.
- Draft mode: mark a player drafted (dim + strikethrough), optionally hide.
- Import (CSV / JSON) and export (CSV / JSON). Import replaces the list.
- Pre-seeded data from ESPN, regenerable via a script.
- localStorage persistence (autosave on every change).

**Out of scope (v1):**

- Multiple ranking profiles (PPR vs Standard, per-league). Single list only.
- Live data feeds / auto-refresh inside the app.
- Auth, cloud sync, multi-user.
- Bye weeks are seeded as blank (not in ESPN's feed yet); filled manually or by
  a later re-fetch.

## Tech Stack

- **Vite + React + TypeScript.** Run with `npm install` then `npm run dev`.
- **@dnd-kit** for drag-to-reorder.
- **Vitest** for unit-testing the pure logic modules.
- No backend. All state is client-side.

## Data Model

```ts
type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";
type Flag = "none" | "target" | "avoid";

type Player = {
  id: string; // stable id (ESPN id for seeded rows, uuid for new)
  name: string;
  position: Position;
  team: string; // abbreviation, e.g. "SF"; "FA" if none
  overallRank: number; // 1-based, derived from list order
  byeWeek: number | null;
  tier: number | null; // null = "Untiered" group (rendered last)
  adp: number | null; // average draft position
  notes: string;
  flag: Flag;
  drafted: boolean;
};
```

- `positionalRank` (e.g. "RB1") is **never stored** — always computed from
  `position` + `overallRank` ordering.

## UI Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [ Search… ]  Pos: [All][QB][RB][WR][TE][K][DST]  ☐ Hide drafted  Sort: [▾]   │
│  [Add player]                                   [Import ▾]  [Export ▾]         │
├─────────────────────────────────────────────────────────────────────────────┤
│ ─── TIER 1 ───────────────────────────────────────────────────────────────── │
│ #  ★/⚑  Player              Pos  Team  Bye  ADP   Notes                drafted │
│ 1   ★   Bijan Robinson      RB1  ATL   —    2.2   workhorse              ⬚     │
│ 2       Jahmyr Gibbs        RB2  DET   —    2.3   —                      ⬚     │
│ ─── TIER 2 ───────────────────────────────────────────────────────────────── │
│ 3   ⚑   Some Player         WR2  CIN   —    3.1   avoid: OL concerns     ⬚     │
│ 4       ̶D̶r̶a̶f̶t̶e̶d̶ ̶G̶u̶y̶        WR3  LAR   —    2.9   (dimmed + struck)        ☑     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### View behavior

- **Default:** grouped by tier (dividers), ordered by `overallRank` within each
  tier. "Untiered" group rendered last.
- **Column sort** (overall / ADP / name / bye): switches to a flat sorted list;
  tier shown as a column. Clearing sort returns to grouped view.
- **Filter:** position chips (single position or All), name search (substring,
  case-insensitive), "Hide drafted" toggle.
- **Target/Avoid:** leftmost column — green ★ for target, red ⚑ for avoid.
- **Draft mode:** clicking the drafted checkbox dims + strikes the row; row is
  hidden when "Hide drafted" is on.

### Editing

- Inline edit of fields per row.
- "Add player" form for manual entries.
- Drag-to-reorder updates `overallRank`; positional ranks recompute. Dragging a
  row across a tier divider reassigns its `tier`.
- Autosave to localStorage on every change.

### Import / Export

- **Export:** download current list as JSON (full fidelity) or CSV.
- **Import:** JSON (round-trips all fields) or CSV. Import **replaces** the
  current list after a confirmation dialog.
- **Canonical CSV columns:** `rank,name,position,team,bye,tier,adp,notes,flag`.
  `overallRank` taken from the `rank` column if present, else from row order.
  `positionalRank` always recomputed.

## Architecture

Pure, testable core + thin React UI.

| Module                     | Responsibility                                                                 | Tested                   |
| -------------------------- | ------------------------------------------------------------------------------ | ------------------------ |
| `src/types.ts`             | `Player`, `Position`, `Flag` types                                             | —                        |
| `src/lib/ranking.ts`       | `computePositionalRanks`, `groupByTier`, `sortPlayers`, `reassignOverallRanks` | Vitest                   |
| `src/lib/csv.ts`           | `parseCsv` → `Player[]`, `toCsv(Player[])`                                     | Vitest                   |
| `src/lib/storage.ts`       | localStorage load/save; JSON import/export; seed fallback                      | Vitest (parse/serialize) |
| `src/state/useRankings.ts` | `useReducer` store + localStorage persistence effect                           | —                        |
| `src/data/seed.json`       | ESPN-seeded initial players (generated)                                        | —                        |
| `src/components/*`         | `App`, `Toolbar`, `PlayerTable`, `TierGroup`, `PlayerRow`, `AddPlayerForm`     | manual                   |
| `scripts/fetch-espn.mjs`   | Re-pull ESPN, regenerate `src/data/seed.json`                                  | —                        |

### State flow

1. On load, `useRankings` reads localStorage. If empty, falls back to
   `seed.json`.
2. Every mutation (edit, reorder, draft toggle, import) updates the reducer
   state; an effect persists the full list to localStorage.
3. Derived data (positional ranks, tier groups, filtered/sorted view) is computed
   from state in selectors — never stored.

## Seed Data (ESPN)

- Source: ESPN fantasy API
  `lm-api-reads.fantasy.espn.com/.../seasons/2026/...?view=kona_player_info`,
  sorted by PPR draft rank.
- `scripts/fetch-espn.mjs` fetches the top ~300 ranked players and maps:
  - position from `defaultPositionId` (1=QB, 2=RB, 3=WR, 4=TE, 5=K, 16=DST)
  - team from `proTeamId` (ESPN NFL id → abbreviation table in the script)
  - `adp` from `ownership.averageDraftPosition`
  - `overallRank` from PPR rank order
  - `tier` auto-assigned in blocks of 12 (≈ draft round); user re-tiers
  - `byeWeek` = null (not yet in feed)
  - `notes` = "", `flag` = "none", `drafted` = false
- Output committed as `src/data/seed.json`. Re-running the script refreshes it.
- **Caveat:** 2026 ranks are currently preseason/unpublished and will shift.

## Testing

- Unit tests (Vitest) for the pure modules: positional-rank computation, tier
  grouping, sorting, and CSV parse/serialize round-trips.
- UI verified manually via `npm run dev`.

## Open Confirmations (from brainstorming, accepted)

- Import **replaces** the whole list (vs merge) — accepted.
- Target/Avoid shown as green ★ / red ⚑ — accepted.
