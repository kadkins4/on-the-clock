# Live Reach/Value Cues in the Draft — Design

Date: 2026-06-02
Status: Approved (design); ready for implementation plan.

Extends the existing draft-summary reach/value badges into **live cues during the
draft**, comparing each pick/player to **both** the market ADP **and the user's own
rank**. Built draft-source-agnostic so a synced ESPN live draft can drive it later,
not just the mock.

Mockups (approved): served locally during brainstorming. Variant 1 (color-coded
dots) chosen for the available-list flag.

---

## Concepts

A pick or available player can be off-expectation against two baselines:

- **ADP** — market consensus draft position (`Player.adp`, shared across lists).
- **Your rank** — where _you_ ranked them in the active tier list
  (`Player.overallRank`, per-list).

Two kinds of signal:

- **reach** — a _made_ pick taken **earlier** than the baseline.
- **value** — a player taken **later** than baseline (a made pick), or **still
  available** well past baseline (an undrafted faller).

A signal is only shown when it clears the **threshold** (see Settings): default
`teams + 2` (e.g. 12-team → 14). Picks/players within the threshold are unmarked —
noise suppression.

Colors (reuse app palette): **reach = orange `#e0894b`**, **value = green
`#3fbf6e`**, **rank-based = blue `#6f8cf0`**.

---

## Surface 1 — Made-pick dots (mini-board strip)

Each completed pick card in the docked strip (`PickStrip` / `buildPickCells` in
`src/lib/mock/board.ts`) gets a **numbered dot** in the top-right corner when the
pick cleared the threshold **vs ADP**:

- orange dot = reach, green dot = value; the number = picks off ADP
  (`round(|adp − overallPick|)`).
- All teams' picks (the strip shows the whole board).
- ADP only here (single dot) — rank-based made-pick signal is out of scope for v1.

## Surface 2 — Available-player value flag (Variant 1)

In the draft's available-player list (`MockDraft` `availRows` → the `<li>` rows),
each **undrafted** player on the board that has **fallen** past a baseline by the
threshold gets a small numbered dot next to the name:

- **green dot** = fell past **ADP** by `round(currentPick − adp)` picks.
- **blue dot** = fell past **your rank** by `round(currentPick − overallRank)` picks.
- A player can show **one or both** dots; both-below-threshold shows none.
- "Fell" is only meaningful relative to a live draft position, so this uses the
  **current overall pick** (`picks.length + 1`) as the comparison point.
- **Non-shifting:** the dots live in a fixed-width (~56px) slot before the name, so
  player names stay perfectly aligned whether flagged or not. The flagged row also
  gets a faint highlight (`background:#ffffff08`).
- A small legend explains green = ADP, blue = rank (Variant 1).

Only **value** (fallen) applies to available players — an undrafted player can't be
a "reach."

## Surface 3 — Summary badges (retrofit)

`MockSummary` already shows `reach`/`value` text badges for the user's picks. Switch
its threshold from the current hard-coded `teams` to the shared per-list threshold
(default `teams + 2`) so all three surfaces agree. No visual redesign.

---

## Core logic — `src/lib/draftValue.ts` (new, pure, tested)

Source-agnostic helpers (no mock imports — so a future ESPN feed can call them):

```ts
export interface PickSignal {
  kind: "reach" | "value";
  amount: number;
} // amount ≥ 0

// A made pick vs one baseline (ADP for v1). reach = earlier, value = later.
export function pickSignal(
  baseline: number | null, // adp (or rank)
  overallPick: number,
  threshold: number,
): PickSignal | null;

// An undrafted player's fall vs one baseline, relative to the current pick.
// Returns picks-fallen when ≥ threshold, else null. (value-only)
export function fallenBy(
  baseline: number | null, // adp or overallRank
  currentPick: number,
  threshold: number,
): number | null;
```

- `pickSignal`: `delta = baseline − overallPick`; `null` if `baseline == null` or
  `|delta| < threshold`; else `{ kind: delta > 0 ? "reach" : "value",
amount: Math.round(Math.abs(delta)) }`.
- `fallenBy`: `fall = currentPick − baseline`; `null` if `baseline == null` or
  `fall < threshold`; else `Math.round(fall)`.

The existing `adpFlag` in `summary.ts` is replaced by `pickSignal` (or re-expressed
in terms of it) to avoid two copies of the rule.

---

## Settings — per-tier-list, default `teams + 2`

Stored on the tier list (the rank baseline is per-list), applied everywhere the
cues render.

- Add to `TierList` (`src/types.ts`): `valueFlags?: { enabled: boolean; threshold:
number | null }`. `enabled` default **true**; `threshold` `null` = **auto**
  (`teams + 2`, computed live from the league's `teams`); a number = explicit
  override. Optional field → absent means default; **no storage migration needed**
  (an accessor fills the default).
- Accessor in `src/lib/league.ts`: `valueThreshold(league, list)` →
  `list.valueFlags?.threshold ?? league.teams + 2`; `valueFlagsEnabled(list)` →
  `list.valueFlags?.enabled ?? true`.
- **Editing UI (v1):** a control on the **mock setup screen** (`MockSetup`) — an
  enable toggle + a number input (placeholder shows the auto default) — that
  reads/writes the **active/default list's** `valueFlags` and persists it (so it
  sticks across mocks and is ready for ESPN). Wording: "Highlight reaches & values
  ≥ N picks off." Located here for v1 because the draft is where it's used; a
  list-settings home can come later.

When `enabled` is false, none of the three surfaces render dots/badges.

---

## ESPN-draft readiness (forward-looking, not built now)

The cues are intentionally decoupled from the mock:

- `draftValue.ts` takes plain numbers (baseline, pick, threshold) — no `MockState`.
- The only mock-specific inputs are "current pick" and "who's drafted," which a
  future ESPN live-draft sync can supply identically.

No ESPN wiring in this spec — just keep the seam clean (don't bury the logic inside
mock components).

---

## Testing

- `draftValue.ts`: `pickSignal` (reach/value sign, threshold boundary at exactly
  `threshold`, null baseline) and `fallenBy` (≥ threshold, below, null).
- `league.ts`: `valueThreshold` auto (`teams + 2`) vs explicit override;
  `valueFlagsEnabled` default true.
- `summary.ts`: badges use the per-list threshold; existing tests updated.
- `board.ts` (`buildPickCells`): a made pick past threshold carries a reach/value +
  amount; within threshold carries none.
- Available-flag selection: pure helper picks the right green/blue dots for the four
  cases (ADP-only, rank-only, both, neither) — tested via `fallenBy`.

## Out of scope / later

- Rank-based signal on _made_ picks (v1 made-pick dots are ADP-only).
- Actual ESPN live-draft sync (this only prepares for it).
- Variant 2 (lettered dots) — may revisit when the mock draft UI is reworked.
- A dedicated list-settings panel (v1 edits the threshold from mock setup).
