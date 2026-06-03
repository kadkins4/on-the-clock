# Board Redesign — Column Registry, Filters, Stats & Dev Visibility

**Date:** 2026-06-02
**Status:** Design approved (grill-me session); pending spec review → implementation plan.

## Summary

A ground-up refresh of the main draft board, built on one architectural move:
the table becomes **driven by a column registry** instead of hardcoded `<thead>`

- `<td>` markup. Sortable headers, full-width tier rows, zebra striping, two new
  stat columns, and full user column customization (show/hide/reorder) all derive
  from that single model. Alongside it: cumulative position filtering with
  FLEX/SFLEX, a restyled search reused in the mock draft, a tier-safe data refetch
  with an ESPN-shape guard, and a gated `/dev` panel so issues are visible during
  alpha.

This is the v1 board polish bucket maturing past "shipped" into a customizable,
diagnosable sheet.

## Goals

- Replace hardcoded table columns with a data-driven **column registry**.
- Let users **show/hide and reorder** columns; persist per-league with a global default.
- **Sortable column headers** (asc/desc) replacing the Sort `<select>`; tier
  grouping remains the default, reachable via a **↩ Tiers** button.
- **Cumulative position filters** with FLEX/SFLEX/ALL override semantics.
- **Restyled search** (pill + icon), reused verbatim in the mock draft.
- Two new columns: **Proj** (already-available data) and **'24** (last-season
  actual, scoring-aware).
- Full-width **accent-bar tier rows** and **subtle per-tier zebra striping**.
- **⟳ Refetch data** (tier-safe) with an **ESPN-shape guard**; **⤺ Reset board**
  (destructive, gated).
- A gated **`/dev` panel** surfacing shape-guard status, data-quality issues, and
  a buffered runtime-error log.

## Non-Goals (backlog)

- Player-detail panel on name-click (last-yr + projected stat lines + ESPN link).
- IDP positions + IDP filter chip.
- Remote/phone-home error reporting (Formspree sink or Sentry).
- Pre-release audit to ensure no dev affordance leaks to normal users.

---

## 1. Column registry (architecture)

The table renders from a single ordered array. Each column is self-describing:

```ts
interface Column {
  id: ColumnId; // 'mover' | 'draft' | 'flag' | 'rank' | 'name' |
  // 'pos' | 'team' | 'adp' | 'vor' | 'proj' | 'last' |
  // 'bye' | 'tier' | 'notes'
  label: string; // header text
  locked?: boolean; // un-hideable & un-movable (mover, name)
  sortable: boolean;
  align: "l" | "c" | "r";
  width: string; // CSS width
  render: (p: Player, ctx: RenderCtx) => ReactNode; // the <td> body
}
```

- `<thead>`, the rows, sort handling, the hide/show state, and the reorder UI all
  read this one array — no field is expressed twice. The prototype
  (`board-mock.html`) proves the rendering model end-to-end.
- `RenderCtx` carries the per-row derived values the renderers need
  (positional rank, VOR, scored Proj, scored last-yr, etc.) so renderers stay pure.

### Locked vs customizable

- **Locked:** `mover` (pinned far-left) and `name`. Un-hideable, un-movable.
- **Everything else** — including `draft` — is hideable and reorderable. We do not
  box users in; a user may hide the Draft button if they want.

### Default visible set

Visible by default: `mover, draft, flag, rank, name, pos, team, adp, vor, proj,
last, bye`. Hidden by default: `tier` (per-row tier number), `notes` stays
visible to match today's board. (Open to flipping `notes` to hidden-by-default
if the row feels too wide once Proj/'24 land.)

---

## 2. Column customization & persistence

### Manager UI

- Trigger: a **⚙ Columns** button at the **far right** of the toolbar (next to the
  existing settings cog) — deliberately out of the scanning path, so changing
  layout is an intentional action, not visual noise.
- Opens a popover listing every column in current order. Each row: a drag handle,
  a show/hide checkbox, the label. Locked columns show a 🔒 and disable
  drag/checkbox. A **Reset to default** action restores the default order + visibility.
- Show/hide = checkbox; add a hidden column = check it; reorder = drag. All three
  asks ("remove, add, move around") collapse into this one panel.

### Persistence model

```
otc:columns           → global/default layout: { order: ColumnId[], hidden: ColumnId[] }
league.columnsOverride → optional per-league override (null = inherit global)
otc:columnScopePref    → 'ask' | 'all' | 'this'   (default 'ask')
```

On any column change:

- `pref === 'all'` → write the **global** layout and clear this league's override
  (so it inherits).
- `pref === 'this'` → write `league.columnsOverride`.
- `pref === 'ask'` → show a prompt:
  - **Apply to all leagues** / **Just this league** buttons.
  - A **☐ Don't ask again** checkbox; checking it sets `pref` to whichever button
    was clicked.
- The settings menu gains a **"When I change columns"** control (Ask each time /
  Always all leagues / Always this league) that flips `pref` back at will.

---

## 3. Sorting & tier view

- Every `sortable` header is clickable: first click sorts; clicking the active
  header toggles asc↔desc. Value-better numeric columns (`vor`, `proj`, `last`)
  default to **descending**; identity/ordinal columns (`name`, `pos`, `rank`,
  `adp`, `bye`, `tier`) default to **ascending**.
- Sorting **pauses tier grouping** (today's `sortKey === null` ⇒ grouped rule).
- The old Sort `<select>` is **removed**. A **↩ Tiers** button in the toolbar
  returns to the default tier-grouped view; it reads as active while grouped.
- **Tier editing (drag-to-retier) stays locked** in any partial/sorted view —
  i.e. only available in pure tier view with no position filter, no search, no
  bye filter (extends today's `reorderable` rule unchanged).
- Sorting/grouping is **non-destructive** — it never rewrites stored order; tier
  structure is restored intact when returning to the Tiers view.

---

## 4. Cumulative position filters

Replaces the single-select `Position | 'All'` with a multi-select chip bar.

### Semantics

- Individual chips (QB/RB/WR/TE/K/DST) are **cumulative** — clicking RB then WR
  shows both. Clicking an already-active chip **removes** it.
- **Macros override** the individual set:
  - `FLEX` → `{RB, WR, TE}`
  - `SFLEX` → `{QB, RB, WR, TE}`
  - `ALL` → clears all (no filter)
  - Clicking an active macro again clears the filter.
- An empty active set is equivalent to **ALL**.
- A macro chip highlights only when the active set **exactly equals** its set.

### Chip presence is league-driven

Chips render from the league's rostered positions, not the view toggles:

- A position chip appears only if the league rosters that position (e.g. K/DST
  chips drop out for a league that doesn't use them / has them disabled).
- **SFLEX** appears only when the league has a SUPERFLEX slot (`roster.SUPERFLEX > 0`).
- FLEX appears for any league with a FLEX-eligible roster (the common case).
- (Future IDP positions slot in by the same rule — see backlog.)

Any active position filter is a partial view and disables drag-to-retier (§3).

---

## 5. Search restyle

- A **pill** input with an inset magnifier, an orange focus ring
  (`box-shadow: 0 0 0 3px #ff6b4a22`), and a clear-✕ that appears when non-empty.
- Extracted as a reusable component and dropped **verbatim into the mock draft**
  (replacing/adding search there).
- Search behavior unchanged (`searchPlayers` scoring); this is presentation only.

---

## 6. New stat columns

Both reuse the existing scoring pipeline so they stay scoring-aware.

**Small refactor:** today `projectedPoints(player, scoring, tePremium)`
(`src/lib/projection.ts`) reads `player.projStats` directly. Extract its math into
a pure `scoreStatLine(stats, position, scoring, tePremium)` core so the same
scorer can be applied to either `projStats` (Proj) or `lastStats` ('24).
`projectedPoints` keeps its signature and delegates to the core (with the
`projPoints` K/DST fallback) — no behavior change for existing callers (VOR).

### Proj

- Projected points = `projectedPoints(player, league.scoring, tePremium)` (the
  same derivation VOR already uses). Data already present in the seed/fetch.
- Right-aligned, tabular numerals, `–` when no projection line.

### '24 (last-season actual)

- Store each player's **raw 2024 actual stat line** as `lastStats` (same shape as
  `projStats`). Score it with the **same core**:
  `scoreStatLine(player.lastStats, player.position, league.scoring, tePremium)`.
  Flipping PPR↔half↔standard re-scores Proj **and** '24 in lockstep — consistent
  by construction (one scorer).
- ESPN exposes prior-season actuals on the same player endpoint
  (`statSourceId === 0` = actual, keyed by `seasonId`); see §7.
- Empty cell rendering, **fixed/tabular width so the column never jitters**:
  - **rookie** (no NFL season yet) → `R`
  - **missing/unmatched/DNP** → `–`
- (We fetch the full raw last-season line because the backlog player-detail panel
  will want it — without pulling extra data we don't yet use.)

---

## 7. Data refetch + ESPN-shape guard

### ⟳ Refetch data (user-facing)

- Lives in the toolbar's existing **⚙ settings menu** beside _Fetch players_ /
  _Refresh ADP_, labeled to promise **"keeps your tiers."**
- Behavior already exists: `mergeFetched` (`src/lib/fetchEspn.ts`) keeps each
  existing player's order, tier, flag, draft status, and notes; refreshes only
  objective fields (name/team/ADP/proj/injury); inserts brand-new players at their
  ESPN-rank slot adopting the tier above. Refetch **surfaces** this, folds in the
  last-season line, and re-blends ADP.
- **Cost:** a single client-side `fetch()` straight to ESPN's public endpoint
  (CORS-open, no auth) — ~500 players, ~1–2 MB JSON, sub-second. **$0 infra** (no
  serverless invocation; browser ↔ ESPN directly). Last-yr actuals are at most one
  additional equivalent request (free if they ride the same payload).

### ESPN-shape guard

A response-shape change must **never corrupt the board** — worst case is a no-op
with a clear message. Implemented as validate-at-the-boundary, **commit only on
success**:

- `mergeFetched` returns a new array; we don't write to state/localStorage until
  validation passes. A malformed response leaves the board exactly as-is + a toast
  ("Couldn't refresh — ESPN's data may have changed").
- A hand-rolled `validateEspnShape()` (no new dependency):
  - response has a `players` array;
  - **sanity-count threshold** — expect ≥ ~200 ranked players; far fewer ⇒ bail;
  - **spot-check mapped rows** — first N must have non-empty `id`, `name`, a known
    `position`, numeric rank; high failure fraction ⇒ treat as shape change;
  - **range sanity** — ADP ~0–400, ranks contiguous from 1.
- **Captured-fixture regression test** — a saved ESPN JSON sample feeds
  `mapEspnPlayers` in a unit test so _our_ mapping regressions are caught in CI.
- During alpha, **fail loud**: `console.warn` a fingerprint (counts, first failing
  row) and record it for the `/dev` panel (§9).

### ⤺ Reset board (destructive)

- Wipes curation → fresh seed, re-orders by ADP, default tiers. Asks
  "Reset everything?" first.
- **Gated** behind the `/dev` panel (`?dev=1`) from day one, so a normal user
  can't nuke their board.

---

## 8. Visual details

- **Tier rows:** full-width banner spanning all columns — panel background, a 3px
  orange (`--otc-accent`) left edge, uppercase "Tier N", and a muted
  "· N players" count.
- **Zebra striping:** subtle. The alternation **restarts at every tier**, and the
  **first row under each banner is the dark base** (`--bg`), with even rows lifting
  to `#13161c`. (Dark-first keeps the first row from blending into the brighter
  tier banner.) Hover overrides to `#1e2330`.

---

## 9. Dev visibility — gated `/dev` panel

Mirrors the Valorant tracker's `/dev/issues` pattern (compute-and-list
diagnostics), with one change: gate on **`?dev=1`** (reachable on the live alpha
by URL, hidden from normal users) rather than `NODE_ENV` (local-only), since the
point is to see issues that arise in real use.

The panel surfaces, for **the device that opens it** (no backend):

1. **Last refetch / shape-guard result** — ok/failed, counts, and the failure
   fingerprint when the guard trips.
2. **Data-quality issues** — computed on view from the current board: players
   missing ADP / projStats / lastStats / bye, unmatched players, low ranked counts.
3. **Runtime-error log** — an error boundary + `window.onerror` /
   `unhandledrejection` handler buffers caught errors to localStorage; the panel
   lists them (newest first) with a clear action.
4. **⤺ Reset board** lives here (its gated home).

Remote/phone-home reporting (to see _others'_ errors) is **backlog** — reuse the
existing Formspree endpoint as a sink or add Sentry's free tier.

---

## Suggested build order

1. **Column-registry refactor** — convert the table to render from `COLUMNS`.
   Delivers sortable headers, full-width tier rows, and zebra striping as it lands.
2. **Cumulative filters + restyled search** — new position-bar semantics; extract
   the search component and reuse it in the mock draft.
3. **Proj + '24 columns** — extract `scoreStatLine`; add `lastStats` to the data
   model + fetch; the ESPN-shape guard + fixture test ship with this fetch work.
4. **Column manager** — show/hide/reorder UI, per-league persistence, the
   apply-scope prompt + settings pref.
5. **Refetch / Reset surfacing + `/dev` panel** — settings-menu Refetch, error
   boundary + buffer, the gated `/dev` diagnostics panel.

Each step is independently shippable on top of the registry foundation.

## Testing

- Headless registry helpers (visible-columns, reorder, persistence
  resolve-with-override) — unit-tested, TDD where practical.
- Cumulative-filter reducer (toggle, macro override, league-driven chip set) — unit-tested.
- Last-yr scoring parity with Proj across PPR/half/standard — unit-tested via `scoreStatLine`.
- `validateEspnShape` + captured ESPN fixture — unit-tested.
- Non-destructiveness: sorting/filtering/refetch never mutate stored tier
  structure — assertion tests.
