# Live Reach/Value Draft Cues — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show live reach/value cues during the draft — numbered dots on made picks (vs ADP) and on still-available fallers (vs ADP _and_ the user's rank) — driven by a per-tier-list, tunable threshold, with the logic kept mock-free for a future ESPN sync.

**Architecture:** A pure `draftValue.ts` (`pickSignal`, `fallenBy`) holds the rule. A per-list `valueFlags` setting (default `teams + 2`) flows into `MockState.settings`. `buildPickCells` attaches a signal to made picks; `MockDraft` computes faller dots from the current pick; `MockSummary` reuses the same rule. UI is dots in fixed-width slots so names never shift.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest. Reuses existing mock engine + reducer patterns.

**Spec:** `docs/superpowers/specs/2026-06-02-draft-value-reach-cues-design.md`

---

## File Structure

- `src/lib/draftValue.ts` (new) — `PickSignal`, `pickSignal`, `fallenBy`. Pure, tested.
- `src/types.ts` — `TierList.valueFlags?`.
- `src/lib/league.ts` — `valueThreshold`, `valueFlagsEnabled` accessors.
- `src/lib/mock/types.ts` — `MockSettings.valueThreshold?` / `.valueFlagsEnabled?`.
- `src/lib/mock/board.ts` — `PickCell.signal?`; `buildPickCells` attaches it.
- `src/lib/mock/summary.ts` — replace `adpFlag` with `pickSignal` + per-list threshold.
- `src/state/reducer.ts` — `setListValueFlags` action.
- `src/components/mock/PickStrip.tsx` — made-pick dot.
- `src/components/mock/MockDraft.tsx` — available-list dual dots + legend.
- `src/components/mock/MockSetup.tsx` — threshold/enable control.
- `src/components/mock/MockMode.tsx`, `src/App.tsx` — thread the persist callback.
- `src/index.css` — dot + slot + legend styles.

---

## Task 1: `draftValue.ts` — the rule

**Files:**

- Create: `src/lib/draftValue.ts`
- Test: `src/lib/draftValue.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/draftValue.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickSignal, fallenBy } from "./draftValue";

describe("pickSignal", () => {
  it("flags a reach when taken earlier than baseline by >= threshold", () => {
    // baseline (adp) 40, drafted at pick 26 -> 14 early -> reach 14
    expect(pickSignal(40, 26, 14)).toEqual({ kind: "reach", amount: 14 });
  });
  it("flags a value when taken later than baseline by >= threshold", () => {
    // baseline 26, drafted at pick 40 -> 14 late -> value 14
    expect(pickSignal(26, 40, 14)).toEqual({ kind: "value", amount: 14 });
  });
  it("is null within the threshold and for a null baseline", () => {
    expect(pickSignal(30, 26, 14)).toBeNull(); // only 4 off
    expect(pickSignal(null, 26, 14)).toBeNull();
  });
  it("includes the exact-threshold boundary", () => {
    expect(pickSignal(40, 26, 14)).not.toBeNull(); // exactly 14
  });
});

describe("fallenBy", () => {
  it("returns picks fallen when at/over threshold, else null", () => {
    expect(fallenBy(22, 40, 14)).toBe(18); // current pick 40, baseline 22
    expect(fallenBy(33, 40, 14)).toBeNull(); // only 7 fallen
    expect(fallenBy(26, 40, 14)).toBe(14); // exactly threshold
    expect(fallenBy(null, 40, 14)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it; expect failure**

Run: `npx vitest run src/lib/draftValue.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/draftValue.ts`:

```ts
// Reach/value rule, deliberately free of any mock/draft types so a mock OR a
// synced ESPN live draft can feed it the same way.
export interface PickSignal {
  kind: "reach" | "value";
  amount: number; // picks off the baseline, >= 0
}

// A *made* pick vs one baseline (ADP for v1). reach = earlier than baseline,
// value = later. null when no baseline or within the threshold.
export function pickSignal(
  baseline: number | null,
  overallPick: number,
  threshold: number,
): PickSignal | null {
  if (baseline == null) return null;
  const delta = baseline - overallPick;
  if (Math.abs(delta) < threshold) return null;
  return {
    kind: delta > 0 ? "reach" : "value",
    amount: Math.round(Math.abs(delta)),
  };
}

// How far an *undrafted* player has fallen past a baseline (ADP or the user's
// rank), relative to the current pick. Returns the fall when >= threshold, else
// null. Value-only — an available player can't be a reach.
export function fallenBy(
  baseline: number | null,
  currentPick: number,
  threshold: number,
): number | null {
  if (baseline == null) return null;
  const fall = currentPick - baseline;
  if (fall < threshold) return null;
  return Math.round(fall);
}
```

- [ ] **Step 4: Run it; expect pass**

Run: `npx vitest run src/lib/draftValue.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/draftValue.ts src/lib/draftValue.test.ts
git commit -m "Add pure reach/value draft rule (pickSignal, fallenBy)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Per-list `valueFlags` setting + accessors

**Files:**

- Modify: `src/types.ts`
- Modify: `src/lib/league.ts`
- Test: `src/lib/league.test.ts`

- [ ] **Step 1: Add the field**

In `src/types.ts`, in `interface TierList`, after `board: Player[];` add:

```ts
  // Reach/value cue config for this list. Absent => enabled, auto threshold.
  valueFlags?: { enabled: boolean; threshold: number | null };
```

- [ ] **Step 2: Write the failing test**

Append to `src/lib/league.test.ts` (match existing import style; `makeLeague` is already imported there — reuse it):

```ts
import { valueThreshold, valueFlagsEnabled } from "./league";

describe("value-flag settings", () => {
  it("defaults the threshold to teams + 2 and enabled to true", () => {
    const l = makeLeague({ name: "L", teams: 12 });
    const list = l.tierLists[0];
    expect(valueThreshold(l, list)).toBe(14);
    expect(valueFlagsEnabled(list)).toBe(true);
  });
  it("honors an explicit override and disabled flag", () => {
    const l = makeLeague({ name: "L", teams: 10 });
    const list = {
      ...l.tierLists[0],
      valueFlags: { enabled: false, threshold: 8 },
    };
    expect(valueThreshold(l, list)).toBe(8);
    expect(valueFlagsEnabled(list)).toBe(false);
  });
  it("auto threshold when override is null", () => {
    const l = makeLeague({ name: "L", teams: 8 });
    const list = {
      ...l.tierLists[0],
      valueFlags: { enabled: true, threshold: null },
    };
    expect(valueThreshold(l, list)).toBe(10);
  });
});
```

- [ ] **Step 3: Run it; expect failure**

Run: `npx vitest run src/lib/league.test.ts`
Expected: FAIL — accessors not exported.

- [ ] **Step 4: Implement the accessors**

In `src/lib/league.ts`, after the existing `defaultBoard` accessor, add:

```ts
// Reach/value threshold for a list: explicit override, else teams + 2.
export function valueThreshold(league: League, list: TierList): number {
  return list.valueFlags?.threshold ?? league.teams + 2;
}

export function valueFlagsEnabled(list: TierList): boolean {
  return list.valueFlags?.enabled ?? true;
}
```

(`League` and `TierList` are already imported at the top of the file.)

- [ ] **Step 5: Run it; expect pass + typecheck**

Run: `npx vitest run src/lib/league.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/lib/league.ts src/lib/league.test.ts
git commit -m "Add per-list valueFlags setting + threshold accessors

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Carry the resolved threshold into `MockState`

**Files:**

- Modify: `src/lib/mock/types.ts`
- Test: `src/lib/mock/engine.test.ts`

- [ ] **Step 1: Add optional fields to `MockSettings`**

In `src/lib/mock/types.ts`, in `interface MockSettings`, after `thirdRoundReversal: boolean;` add:

```ts
  // resolved reach/value config for the mock (from the seeding list). Optional
  // so existing fixtures keep working; read sites default threshold to teams+2.
  valueThreshold?: number;
  valueFlagsEnabled?: boolean;
```

- [ ] **Step 2: Write the failing test**

Append to `src/lib/mock/engine.test.ts`. Build the league with the real
`makeLeague` factory (from `../league`) so the test depends on nothing internal to
the file:

```ts
import { createMock } from "./engine";
import { makeLeague } from "../league";

describe("createMock value config", () => {
  it("carries valueThreshold/enabled from the start settings", () => {
    const l = makeLeague({ name: "T", teams: 10, board: [] });
    const m = createMock(
      l,
      {
        teams: 10,
        userSlot: 1,
        thirdRoundReversal: false,
        valueThreshold: 12,
        valueFlagsEnabled: false,
      },
      1,
    );
    expect(m.settings.valueThreshold).toBe(12);
    expect(m.settings.valueFlagsEnabled).toBe(false);
  });
});
```

NOTE: `makeLeague` already imports/`createMock` may already be imported at the top
of the file — merge the imports rather than duplicating them. `makeLeague` seeds a
single default tier list (empty board here is fine; this test only checks the
settings carry through).

- [ ] **Step 3: Run it; expect failure**

Run: `npx vitest run src/lib/mock/engine.test.ts`
Expected: FAIL — `m.settings.valueThreshold` is `undefined` only if not carried. (createMock spreads `settings`, so this may already pass once the type compiles; if it passes immediately, that's fine — the test still locks the behavior.)

- [ ] **Step 4: Confirm createMock carries the fields**

Open `src/lib/mock/engine.ts`, find `createMock`. It builds `settings: { ...settings, rounds }`. The spread already carries the two new optional fields — **no code change needed**. If for any reason the object is built field-by-field instead of spread, add `valueThreshold: settings.valueThreshold` and `valueFlagsEnabled: settings.valueFlagsEnabled`.

- [ ] **Step 5: Run it; expect pass**

Run: `npx vitest run src/lib/mock/engine.test.ts && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/mock/types.ts src/lib/mock/engine.test.ts src/lib/mock/engine.ts
git commit -m "Carry resolved value threshold into MockState

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Made-pick signal on strip cells

**Files:**

- Modify: `src/lib/mock/board.ts`
- Test: `src/lib/mock/board.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/mock/board.test.ts` (reuse the file's existing mock-state/`buildPickCells` setup; build a state where the user/bot drafts a player whose ADP is far from the pick):

```ts
import { buildPickCells } from "./board";

describe("buildPickCells value signal", () => {
  it("flags a made pick that cleared the threshold vs ADP", () => {
    // Construct a minimal MockState: one made pick of a player with adp 1
    // at overall pick 1 -> 0 off -> no signal; and adp 20 at pick 1 -> reach 19.
    const player = (id: string, adp: number) => ({
      id,
      name: id,
      position: "RB" as const,
      team: "FA",
      overallRank: 1,
      byeWeek: null,
      tier: null,
      adp,
      notes: "",
      flag: "none" as const,
      draftStatus: "available" as const,
    });
    const m = {
      pool: [player("a", 20)],
      order: [0, 1],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "a" }],
      draftedIds: new Set(["a"]),
      settings: {
        teams: 2,
        userSlot: 1,
        rounds: 1,
        thirdRoundReversal: false,
        valueThreshold: 14,
        valueFlagsEnabled: true,
      },
    } as unknown as Parameters<typeof buildPickCells>[0];
    const done = buildPickCells(m).find((c) => c.kind === "done")!;
    expect(done.signal).toEqual({ kind: "reach", amount: 19 });
  });

  it("attaches no signal when value flags are disabled", () => {
    const player = {
      id: "a",
      name: "a",
      position: "RB" as const,
      team: "FA",
      overallRank: 1,
      byeWeek: null,
      tier: null,
      adp: 20,
      notes: "",
      flag: "none" as const,
      draftStatus: "available" as const,
    };
    const m = {
      pool: [player],
      order: [0, 1],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "a" }],
      draftedIds: new Set(["a"]),
      settings: {
        teams: 2,
        userSlot: 1,
        rounds: 1,
        thirdRoundReversal: false,
        valueThreshold: 14,
        valueFlagsEnabled: false,
      },
    } as unknown as Parameters<typeof buildPickCells>[0];
    expect(
      buildPickCells(m).find((c) => c.kind === "done")!.signal,
    ).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it; expect failure**

Run: `npx vitest run src/lib/mock/board.test.ts`
Expected: FAIL — `signal` is undefined / not on type.

- [ ] **Step 3: Implement**

In `src/lib/mock/board.ts`:

Add the import at the top:

```ts
import { pickSignal, type PickSignal } from "../draftValue";
```

In `interface PickCell`, after `position?: Position;` add:

```ts
  signal?: PickSignal; // reach/value vs ADP for a made pick
```

In `buildPickCells`, inside the `if (overall <= made)` branch, compute the signal and add it to the returned object. Replace that branch's return with:

```ts
if (overall <= made) {
  const pick = picks[overall - 1];
  const pl = byId.get(pick.playerId);
  const threshold = settings.valueThreshold ?? teams + 2;
  const enabled = settings.valueFlagsEnabled ?? true;
  const signal = enabled
    ? (pickSignal(pl?.adp ?? null, overall, threshold) ?? undefined)
    : undefined;
  return {
    ...base,
    kind: "done" as const,
    playerId: pick.playerId,
    name: pl?.name,
    position: pl?.position,
    signal,
  };
}
```

- [ ] **Step 4: Run it; expect pass**

Run: `npx vitest run src/lib/mock/board.test.ts && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/board.ts src/lib/mock/board.test.ts
git commit -m "Attach reach/value signal to made-pick cells

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Retrofit the summary to the shared rule

**Files:**

- Modify: `src/lib/mock/summary.ts`
- Modify: `src/lib/mock/summary.test.ts`

- [ ] **Step 1: Replace `adpFlag` with `pickSignal`**

In `src/lib/mock/summary.ts`:

- Add the import: `import { pickSignal } from "../draftValue";`
- Remove the existing exported `adpFlag` function entirely.
- In `mockSummary`, compute the threshold once and use `pickSignal`. Replace the
  `.map((pk) => { ... })` body so each player is:

```ts
    .map((pk) => {
      const pl = byId.get(pk.playerId) as Player;
      const threshold = m.settings.valueThreshold ?? m.settings.teams + 2;
      const sig = pickSignal(pl.adp, pk.overall, threshold);
      return {
        id: pl.id,
        name: pl.name,
        position: pl.position,
        team: pl.team,
        overallPick: pk.overall,
        adp: pl.adp,
        adpDelta: pl.adp == null ? null : pl.adp - pk.overall,
        adpFlag: sig?.kind ?? null,
      };
    });
```

(The `SummaryPlayer` interface and `MockSummary.tsx` are unchanged — `adpFlag` is
still `"reach" | "value" | null`, `adpDelta` still drives the magnitude shown.)

- [ ] **Step 2: Update the summary tests**

In `src/lib/mock/summary.test.ts`:

- Remove the `import { ... adpFlag } from "./summary"` reference (import only
  `mockSummary`), and **delete the entire `describe("adpFlag", ...)` block** — that
  rule now lives in `draftValue.test.ts`.
- The existing "flags value/reach" test drafts a player at a `+2` delta with
  `teams: 2`. The threshold is now `teams + 2 = 4`, so `+2` no longer flags. Make
  the reach unambiguous: in that test's `createMock` settings add
  `valueThreshold: 2` so the `+2` reach still triggers, OR draft a bigger gap.
  Use the explicit threshold — change the `createMock(..., { teams: 2, userSlot: 1,
thirdRoundReversal: false }, 1)` call to include `valueThreshold: 2`:

```ts
let m = createMock(
  league(board),
  { teams: 2, userSlot: 1, thirdRoundReversal: false, valueThreshold: 2 },
  1,
);
```

Keep the assertions `expect(c.adpDelta).toBe(2)` and `expect(c.adpFlag).toBe("reach")`.

- [ ] **Step 3: Run it; expect pass**

Run: `npx vitest run src/lib/mock/summary.test.ts && npx tsc --noEmit`
Expected: PASS, clean.

- [ ] **Step 4: Commit**

```bash
git add src/lib/mock/summary.ts src/lib/mock/summary.test.ts
git commit -m "Summary reach/value uses shared pickSignal + per-list threshold

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Made-pick dot on the strip (UI)

**Files:**

- Modify: `src/components/mock/PickStrip.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Render the dot**

In `src/components/mock/PickStrip.tsx`, inside the `cells.map((c) => ...)` card,
within the `c.kind === "done"` block (where `strip-name`/`strip-pos` render), add a
dot when `c.signal` exists. Change that block to:

```tsx
{
  c.kind === "done" ? (
    <>
      {c.signal && (
        <span className={`num-dot ${c.signal.kind}`}>{c.signal.amount}</span>
      )}
      <span className="strip-name" title={c.name}>
        {c.name}
      </span>
      <span className="strip-pos">{c.position}</span>
    </>
  ) : (
    <span className="strip-team">{c.teamLabel}</span>
  );
}
```

- [ ] **Step 2: Add CSS**

In `src/index.css`, add (the strip card must be a positioning context — the rule
below adds `position: relative` via a dedicated selector so it doesn't disturb the
existing `.strip-card` block):

```css
.mock-strip .strip-card {
  position: relative;
}
.num-dot {
  min-width: 22px;
  height: 22px;
  border-radius: 11px;
  padding: 0 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 800;
  color: #0c0f15;
  font-variant-numeric: tabular-nums;
}
.num-dot.reach {
  background: #e0894b;
}
.num-dot.value {
  background: #3fbf6e;
}
.num-dot.adp {
  background: #3fbf6e;
}
.num-dot.rank {
  background: #6f8cf0;
}
.mock-strip .strip-card .num-dot {
  position: absolute;
  top: 6px;
  right: 7px;
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean; all tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/components/mock/PickStrip.tsx src/index.css
git commit -m "Show reach/value dot on made-pick strip cards

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Available-player dual dots (UI)

**Files:**

- Modify: `src/components/mock/MockDraft.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Compute + render the dots**

In `src/components/mock/MockDraft.tsx`:

Add the import:

```ts
import { fallenBy } from "../../lib/draftValue";
```

Near the top of the component (where `overall`/`round` are derived), add:

```ts
const valThreshold = state.settings.valueThreshold ?? state.settings.teams + 2;
const valEnabled = state.settings.valueFlagsEnabled ?? true;
```

In the available-list render, find the player `<li>` (the `row.kind === "player"`
branch) that currently starts with `<span className="mock-name">{row.p.name}</span>`.
Replace the `mock-name` span with a name wrapper that has a fixed-width dot slot:

```tsx
<span className="mock-name-wrap">
  <span className="val-dots">
    {valEnabled &&
      (() => {
        const adpFell = fallenBy(row.p.adp, overall, valThreshold);
        const rankFell = fallenBy(row.p.overallRank, overall, valThreshold);
        return (
          <>
            {adpFell != null && (
              <span className="num-dot adp" title={`Fell ${adpFell} past ADP`}>
                {adpFell}
              </span>
            )}
            {rankFell != null && (
              <span
                className="num-dot rank"
                title={`Fell ${rankFell} past your rank`}
              >
                {rankFell}
              </span>
            )}
          </>
        );
      })()}
  </span>
  <span className="mock-name">{row.p.name}</span>
</span>
```

(`overall` = `state.picks.length + 1`, the pick on the clock; it's already computed
in this component.)

- [ ] **Step 2: Add a one-line legend above the list**

Just before the `<ul className="mock-available">`, add (only when enabled):

```tsx
{
  valEnabled && (
    <div className="val-legend">
      <span className="num-dot adp">#</span> fell past ADP ·{" "}
      <span className="num-dot rank">#</span> fell past your rank
    </div>
  );
}
```

- [ ] **Step 3: Add CSS**

In `src/index.css`, add:

```css
.mock-name-wrap {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.val-dots {
  flex: 0 0 56px;
  width: 56px;
  display: inline-flex;
  gap: 3px;
  justify-content: flex-start;
}
.mock-available li .mock-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.val-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #9aa4b2;
  padding: 4px 2px;
}
.val-legend .num-dot {
  min-width: 18px;
  height: 18px;
  font-size: 10px;
}
```

NOTE: the available `<li>` is a CSS grid (`1fr auto auto auto auto`). The dots live
_inside_ the first (name) cell via `.mock-name-wrap`, so the grid columns are
unchanged and the name still ellipsizes.

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean; tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/mock/MockDraft.tsx src/index.css
git commit -m "Flag fallen available players (ADP + rank dots)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Threshold setting — persist + edit in setup

**Files:**

- Modify: `src/state/reducer.ts`
- Modify: `src/App.tsx`
- Modify: `src/components/mock/MockMode.tsx`
- Modify: `src/components/mock/MockSetup.tsx`

- [ ] **Step 1: Add the reducer action**

In `src/state/reducer.ts`, in the `TierListAction` union (the block with
`setDefaultTierList`), add:

```ts
  | {
      type: "setListValueFlags";
      listId: string;
      valueFlags: { enabled: boolean; threshold: number | null };
    };
```

Add the case alongside `setDefaultTierList`:

```ts
    case "setListValueFlags": {
      const current = state.leagues.find((l) => l.id === state.currentId);
      if (!current) return state;
      return mapLeague(state, current.id, (l) => ({
        ...l,
        tierLists: l.tierLists.map((t) =>
          t.id === action.listId ? { ...t, valueFlags: action.valueFlags } : t,
        ),
      }));
    }
```

- [ ] **Step 2: Expose a handler in `App.tsx` and pass it to `MockMode`**

In `src/App.tsx`, find where `<MockMode ... />` is rendered (the `if (mockMode)`
block) and add the prop:

```tsx
        onSetValueFlags={(listId, valueFlags) =>
          dispatch({ type: "setListValueFlags", listId, valueFlags })
        }
```

- [ ] **Step 3: Thread through `MockMode.tsx`**

In `src/components/mock/MockMode.tsx`:

Add to `interface Props`:

```ts
  onSetValueFlags: (
    listId: string,
    valueFlags: { enabled: boolean; threshold: number | null },
  ) => void;
```

Add `onSetValueFlags` to the destructured props. Pass it into `MockSetup`:

```tsx
return (
  <MockSetup
    league={league}
    onStart={start}
    onCancel={onExit}
    onSetValueFlags={onSetValueFlags}
  />
);
```

The `start` callback already forwards its settings to `createMock`; since
`MockSetup` now includes `valueThreshold`/`valueFlagsEnabled` in the settings it
passes to `onStart`, no change is needed inside `start`.

- [ ] **Step 4: Add the control to `MockSetup.tsx`**

In `src/components/mock/MockSetup.tsx`:

Update imports/props:

```ts
import { useState } from "react";
import type { League } from "../../types";
import type { MockSettings } from "../../lib/mock/types";
import { valueFlagsEnabled } from "../../lib/league";

interface Props {
  league: League;
  onStart: (settings: Omit<MockSettings, "rounds">) => void;
  onCancel: () => void;
  onSetValueFlags: (
    listId: string,
    valueFlags: { enabled: boolean; threshold: number | null },
  ) => void;
}
```

Inside the component, find the default list and seed local state (after the
existing `useState` calls):

```ts
const defaultList =
  league.tierLists.find((t) => t.id === league.defaultTierListId) ??
  league.tierLists[0];
const [vfEnabled, setVfEnabled] = useState(valueFlagsEnabled(defaultList));
const [vfThreshold, setVfThreshold] = useState<number | null>(
  defaultList.valueFlags?.threshold ?? null,
);
```

Add the control just before the `<div className="mock-actions">`:

```tsx
      <label>
        <input
          type="checkbox"
          checked={vfEnabled}
          onChange={(e) => setVfEnabled(e.target.checked)}
        />{" "}
        Highlight reaches &amp; values
      </label>
      <label>
        Threshold (picks off ADP/rank){" "}
        <input
          type="number"
          min={1}
          placeholder={`${teams + 2}`}
          value={vfThreshold ?? ""}
          disabled={!vfEnabled}
          onChange={(e) =>
            setVfThreshold(e.target.value === "" ? null : Number(e.target.value))
          }
        />
      </label>
```

Replace the Start button's `onClick` so it persists the per-list setting and passes
the resolved values into the mock:

```tsx
<button
  onClick={() => {
    onSetValueFlags(defaultList.id, {
      enabled: vfEnabled,
      threshold: vfThreshold,
    });
    onStart({
      teams,
      userSlot,
      thirdRoundReversal,
      valueThreshold: vfThreshold ?? teams + 2,
      valueFlagsEnabled: vfEnabled,
    });
  }}
>
  Start mock
</button>
```

- [ ] **Step 5: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean; all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/state/reducer.ts src/App.tsx src/components/mock/MockMode.tsx src/components/mock/MockSetup.tsx
git commit -m "Persist + edit per-list value threshold from mock setup

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full suite + typecheck + build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all green, no type errors, build succeeds.

- [ ] **Step 2: Live smoke test**

Run `npm run dev`, start a mock (clear localStorage first so the board has fresh
seed data with ADP), and verify:

- Made picks that land far from ADP show an orange (reach) / green (value) numbered
  dot on their strip card; near-ADP picks show none.
- In the available list, players who have fallen past ADP show a green dot and those
  fallen past your rank show a blue dot; names stay aligned; the legend shows.
- The mock-setup **Threshold** field changes how many picks/players get flagged;
  unchecking **Highlight reaches & values** removes all dots.
- The setting persists: exit the mock, start another — the threshold/enable stick.
- The post-draft summary still shows reach/value badges, now using the same threshold.

- [ ] **Step 3: Done** — report results; do not merge to `main` until the user approves.

---

## Notes for the implementer

- TDD: test → fail → implement → pass → commit. Don't batch.
- This worktree symlinks `node_modules` from the main checkout; run commands from the worktree root.
- Keep `draftValue.ts` free of mock imports (ESPN-readiness). It only takes plain numbers.
- Colors are fixed: reach `#e0894b`, ADP-value `#3fbf6e`, rank-value `#6f8cf0`.
- YAGNI: no rank signal on made picks, no ESPN wiring, no Variant 2 — all explicitly out of scope.
