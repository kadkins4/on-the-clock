# VOR Column + Mock Polish — Design

Date: 2026-06-02
Status: Approved (design); ready for implementation plan.

Two loosely-coupled parts. **Part A** is data + board. **Parts B–D** are all mock
draft. Implementation plan should phase A → D so each lands independently testable.

> Deferred (not in this spec): **Apply-to-board / writeback.** Kendall wants to
> think through what live-draft writeback should look like first. Tracked in the
> coachmark/backlog memory family, to be brainstormed on its own later.

---

## Part A — VOR column (board)

**Goal:** Add a Value Over Replacement number per player, derived from this-season
projected fantasy points, surfaced as a sortable column on the board.

### Data

The app currently has no points data — `Player` carries rank/ADP/bye only. ESPN's
`kona_player_info` payload we already fetch in `src/lib/fetchEspn.ts` includes a
per-player `stats` array we currently discard. It contains both last-season actual
and this-season projected season totals.

- Parse the **2026 projected season total**: the `stats` entry with
  `statSourceId === 1` (projected), `statSplitTypeId === 0` (season),
  `seasonId === 2026` → `appliedTotal`.
- Add `projPoints?: number | null` to `Player` (`src/types.ts`).
- Map it through `FetchedPlayer` + `mergeFetched` in `fetchEspn.ts` (refresh it on
  existing players, set it on newcomers).
- Update `scripts/fetch-espn.mjs` and regenerate the seeded board JSON so VOR works
  out-of-the-box. Players on already-saved boards show "—" until the user runs
  **Fetch players** (no storage migration needed; `projPoints` is just absent →
  treated as null).

**REVISED during implementation (2026-06-02):** ESPN's precomputed `appliedTotal`
turned out to be populated for only ~8% of players, so it cannot feed the column.
Instead we parse the **raw** projected stat line (present for ~all offensive
players) into `Player.projStats` and score it at the league's `ppr`/`half`/`standard`
(plus TE premium) via `src/lib/projection.ts`. This **resolves** the scoring caveat
below — VOR now honors league scoring rather than ESPN default. `projPoints` is kept
as the K/DST fallback (ESPN's total, null today, fills in nearer the season). Stat
ids validated against ESPN's PPR totals (skill players within ~1%). See the plan's
"Revision" banner for details.

~~**Scoring caveat (documented, accepted):** `appliedTotal` reflects ESPN's default
scoring, not the league's `ppr`/`half`/`standard` setting.~~ (Superseded — we compute
league-scored points from the raw stat line, see revision above.)

### Compute — `src/lib/vor.ts` (pure, unit-tested)

Replacement level per position = the projected points of the player at the
league's last _starting_ slot for that position.

- Base starters per position: `N_pos = teams × roster[pos]`.
- Distribute `teams × roster.FLEX` across RB/WR/TE, and `teams × roster.SUPERFLEX`
  across QB/RB/WR/TE, each proportional to that position's base starter count,
  rounded to whole slots.
- For each position, sort its players by `projPoints` desc; baseline =
  `projPoints` of the `N_pos`-th player (clamp to list length; if fewer players
  than slots, use the last available).
- `VOR(player) = player.projPoints − baseline[player.position]`.
- `projPoints == null` → `VOR == null`.

Disabled positions (`roster.disabled`) are skipped. K/DST with no FLEX/SUPERFLEX
share just use their base starters.

`useRankings` exposes a memoized `vorById: Record<string, number | null>` computed
from the active board + the current league's roster, so editing roster settings
(superflex/bench/teams) updates VOR live.

### UI

- New **VOR** column: `<th>` in `PlayerTable` header + `<td>` in `PlayerRow`
  (formatted as a signed integer, e.g. `+42`, `−7`, `—` when null).
- Add `"vor"` to `SortKey` (`src/types.ts`) and the sort control in `Toolbar.tsx`;
  sort descending-by-default semantics handled in the existing sort comparator
  (`src/lib/search.ts` or wherever `SortKey` is applied — confirm during planning).

---

## Part B — Pick timer (mock)

User-only countdown, rendered in the on-the-clock banner (Part D).

- Duration selector: **30 / 60 / 90s / Off**, default **60s**. Stored in mock-local
  state (not persisted with the league).
- Runs only when: it's the user's pick, not paused, draft not complete, and not Off.
- Pausing the draft pauses the timer; Resume restarts the countdown from full for the
  current pick (simpler and matches "fresh clock on the clock").
- Visual: normal styling; switches to a red/urgent state under 10s.
- **At zero → auto-pick best available**: the highest-ranked still-available player in
  the user's _active tier-list_ order, then advance. Reuses the same draft path a
  manual pick takes.

Edge: opening a pick popover does not stop the timer (only Pause does). The auto-pick
at zero respects the same "already complete / no available" guards as bot ticks.

---

## Part C — Bot run-chasing (mock)

Make bots react to positional runs while staying deterministic.

- Thread the **last K = 6 pick positions** into `botPick`
  (`src/lib/mock/bot.ts`), passed down from `botPickId` in `engine.ts`.
- Compute a per-position **run bonus**: positions appearing in the recent window
  above a baseline expectation get an additive bonus to their in-window weight
  (tunable constant `RUN_BONUS`). A WR/RB run nudges bots toward that position
  without overriding roster-need logic.
- Determinism preserved: uses the same seeded `rng`; given the same picks the
  output is unchanged run-to-run. Existing window-size and `servesNeed` filtering
  are untouched except for the added weight term.
- Unit tests: a constructed run produces a higher selection probability for the
  running position than the no-run baseline (assert via fixed seed).

---

## Part D — On-the-clock banner (mock)

Consolidate scattered mock status into one header strip above the available list.

Contents:

- **Round.Pick** indicator (e.g. `R3 · Pick 28`).
- Whose turn: **"You're on the clock"** vs **"Team N is picking"**.
- The **pick timer** (Part B) when it's the user's pick.
- A **recent-picks ticker**: last ~5 picks as `name (POS)`, most-recent first.
- **Pause/Resume** and **Undo** controls relocated here (today they live inline).

This is presentation only — it reads existing mock state (`picks`, `order`,
`settings`, user team index) and the timer state; no new engine concepts. The
docked mini board (PickStrip) stays as-is at the bottom.

---

## Testing

- `vor.ts`: replacement-slot math (incl. FLEX/SUPERFLEX distribution, disabled
  positions, fewer-players-than-slots clamp), VOR sign, null handling.
- `fetchEspn.ts`: `projPoints` parsed from a fixture `stats` array; survives
  `mergeFetched` for existing + new players.
- `bot.ts`: run bonus shifts probability toward the running position under a fixed
  seed; no-run behavior unchanged.
- Timer auto-pick: at-zero picks the top available active-list player and advances
  (engine-level test of the auto-pick selection helper).
- Banner: light render test (whose-turn text + recent-picks order).

## Out of scope / later

- Apply-to-board writeback (deferred by request).
- Visible timer on bot picks / full live-clock pacing.

### 🔖 Revisit: VOR column (post-ship)

We ship VOR on ESPN **default-scoring** projections in this pass. Come back and
reconsider the column once it's in real use:

- **Per-league scoring accuracy** — recompute applied totals from raw stat lines so
  VOR respects the league's `ppr` / `half` / `standard` (and TE-premium) settings,
  instead of ESPN's default.
- **Projection source** — sanity-check ESPN projections vs. how they feel at the
  draft table; consider blending a second source or letting last-season actuals
  inform it.
- **Presentation** — is a raw VOR number the most useful surface, or do we also want
  positional VOR rank / tiering off VOR / a value-vs-ADP delta? Decide after seeing
  it live.
