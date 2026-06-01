# Mock Draft Board Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a running mock draft readable — an always-on pick strip centered on the current pick, plus a toggleable teams×rounds draft board that slides up as a bottom sheet.

**Architecture:** Pure derive-and-render from `MockState` (no engine changes, non-destructive). New helpers in `src/lib/mock/board.ts` (TDD); two presentational components in `src/components/mock/` (build + live-verify); `MockDraft.tsx` wires them and slows the bot delay.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest (jsdom). Tests run with `npx vitest run <file>`; full build/typecheck with `npm run build`.

---

## File Structure

- `src/lib/mock/board.ts` (create) — pure helpers + `PickCell` type: `formatPick`, `buildPickCells`, `userColumnIndex`, `buildBoardGrid`.
- `src/lib/mock/board.test.ts` (create) — unit tests for the above.
- `src/components/mock/PickStrip.tsx` (create) — always-on horizontal strip.
- `src/components/mock/DraftBoardGrid.tsx` (create) — slide-up bottom sheet (grid + peeking available list).
- `src/components/mock/MockDraft.tsx` (modify) — wire both in, add toggle state, bump bot delay 350→800ms.
- `src/index.css` (modify) — position color tokens + `.mock-strip` / `.mock-board-sheet` styles.

The existing engine in `src/lib/mock/engine.ts` already exposes everything the helpers need (`MockState.order`, `.picks`, `.pool`, `.settings`; `available(state)`). Do not modify it.

---

## Task 1: `formatPick` helper

**Files:**

- Create: `src/lib/mock/board.ts`
- Test: `src/lib/mock/board.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/mock/board.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { formatPick } from "./board";

describe("formatPick", () => {
  it("formats round and 2-digit slot within the round", () => {
    expect(formatPick(1, 12)).toBe("1.01");
    expect(formatPick(4, 12)).toBe("1.04");
    expect(formatPick(12, 12)).toBe("1.12");
  });

  it("rolls over to the next round", () => {
    expect(formatPick(13, 12)).toBe("2.01");
    expect(formatPick(25, 12)).toBe("3.01");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/mock/board.test.ts`
Expected: FAIL — `formatPick` is not exported / module not found.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/mock/board.ts`:

```typescript
import type { MockState } from "./types";
import type { Player, Position } from "../../types";

export type CellKind = "done" | "current" | "upcoming";

export interface PickCell {
  overall: number; // 1-based overall pick
  round: number; // 1-based
  teamIndex: number; // 0-based team/column
  label: string; // e.g. "1.04"
  teamLabel: string; // e.g. "Team 7"
  kind: CellKind;
  playerId?: string;
  name?: string;
  position?: Position;
}

export function formatPick(overall: number, teams: number): string {
  const round = Math.floor((overall - 1) / teams) + 1;
  const slot = ((overall - 1) % teams) + 1;
  return `${round}.${String(slot).padStart(2, "0")}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/mock/board.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/board.ts src/lib/mock/board.test.ts
git commit -m "Add formatPick draft-board helper"
```

---

## Task 2: `buildPickCells` + `userColumnIndex`

**Files:**

- Modify: `src/lib/mock/board.ts`
- Test: `src/lib/mock/board.test.ts`

This task needs a `MockState` fixture. Reuse the engine's public API to build realistic state.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/mock/board.test.ts` (add the imports at the top of the file alongside the existing `formatPick` import):

```typescript
import { createMock, draftPlayer } from "./engine";
import type { League, Player } from "../../types";
import { buildPickCells, userColumnIndex } from "./board";

const p = (id: string, pos: Player["position"], adp: number): Player => ({
  id,
  name: id.toUpperCase(),
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

// 2 teams, roster = QB1/RB1/WR1 (rest disabled) => 3 rounds => 6 picks.
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

describe("buildPickCells", () => {
  it("marks the first pick current and the rest upcoming at draft start", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    const cells = buildPickCells(m);
    expect(cells).toHaveLength(6); // order length
    expect(cells[0].kind).toBe("current");
    expect(cells[0].label).toBe("1.01");
    expect(cells[0].teamLabel).toBe("Team 1");
    expect(cells[1].kind).toBe("upcoming");
  });

  it("fills completed picks with player name/position and advances current", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    m = draftPlayer(m, "a"); // overall 1, team 0
    const cells = buildPickCells(m);
    expect(cells[0].kind).toBe("done");
    expect(cells[0].name).toBe("A");
    expect(cells[0].position).toBe("RB");
    expect(cells[1].kind).toBe("current");
  });
});

describe("userColumnIndex", () => {
  it("is the 0-based user slot", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 2, thirdRoundReversal: false },
      1,
    );
    expect(userColumnIndex(m)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/mock/board.test.ts`
Expected: FAIL — `buildPickCells` / `userColumnIndex` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/mock/board.ts`:

```typescript
function poolMap(pool: Player[]): Map<string, Player> {
  const m = new Map<string, Player>();
  for (const pl of pool) m.set(pl.id, pl);
  return m;
}

export function buildPickCells(state: MockState): PickCell[] {
  const { order, picks, settings } = state;
  const teams = settings.teams;
  const byId = poolMap(state.pool);
  const made = picks.length;
  return order.map((teamIndex, i) => {
    const overall = i + 1;
    const round = Math.floor((overall - 1) / teams) + 1;
    const base = {
      overall,
      round,
      teamIndex,
      label: formatPick(overall, teams),
      teamLabel: `Team ${teamIndex + 1}`,
    };
    if (overall <= made) {
      const pick = picks[overall - 1];
      const pl = byId.get(pick.playerId);
      return {
        ...base,
        kind: "done" as const,
        playerId: pick.playerId,
        name: pl?.name,
        position: pl?.position,
      };
    }
    return {
      ...base,
      kind: overall === made + 1 ? ("current" as const) : ("upcoming" as const),
    };
  });
}

export function userColumnIndex(state: MockState): number {
  return state.settings.userSlot - 1;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/mock/board.test.ts`
Expected: PASS (all `formatPick` + `buildPickCells` + `userColumnIndex` tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock/board.ts src/lib/mock/board.test.ts
git commit -m "Add buildPickCells and userColumnIndex helpers"
```

---

## Task 3: `buildBoardGrid`

**Files:**

- Modify: `src/lib/mock/board.ts`
- Test: `src/lib/mock/board.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/mock/board.test.ts` (add `buildBoardGrid` to the existing `./board` import):

```typescript
import { buildBoardGrid } from "./board";

describe("buildBoardGrid", () => {
  it("is a rounds x teams matrix, null where unpicked", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    const grid = buildBoardGrid(m);
    expect(grid).toHaveLength(3); // 3 rounds
    expect(grid[0]).toHaveLength(2); // 2 teams
    expect(grid[0][0]).toBeNull();
  });

  it("places picks by team column and honors snake order across rounds", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    m = draftPlayer(m, "a"); // overall 1 -> round 1, team 0
    m = draftPlayer(m, "b"); // overall 2 -> round 1, team 1
    m = draftPlayer(m, "c"); // overall 3 -> round 2, team 1 (snake reverses)
    const grid = buildBoardGrid(m);
    expect(grid[0][0]?.name).toBe("A");
    expect(grid[0][1]?.name).toBe("B");
    // round 2 first sequential pick ("2.01") belongs to team 1's column
    expect(grid[1][1]?.name).toBe("C");
    expect(grid[1][1]?.label).toBe("2.01");
    expect(grid[1][0]).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/mock/board.test.ts`
Expected: FAIL — `buildBoardGrid` not exported.

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/mock/board.ts`:

```typescript
export function buildBoardGrid(state: MockState): (PickCell | null)[][] {
  const { rounds, teams } = state.settings;
  const grid: (PickCell | null)[][] = Array.from({ length: rounds }, () =>
    Array.from({ length: teams }, () => null as PickCell | null),
  );
  for (const cell of buildPickCells(state)) {
    if (cell.kind === "done") {
      grid[cell.round - 1][cell.teamIndex] = cell;
    }
  }
  return grid;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/mock/board.test.ts`
Expected: PASS (all board tests).

- [ ] **Step 5: Run the full suite + typecheck**

Run: `npm run build`
Expected: tsc clean, vite build succeeds. (Confirms no type regressions before touching UI.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/mock/board.ts src/lib/mock/board.test.ts
git commit -m "Add buildBoardGrid matrix helper"
```

---

## Task 4: Pick strip component + position colors + wire-in + slower bots

Presentational — verified by typecheck/build now and live in the browser in Task 6.

**Files:**

- Create: `src/components/mock/PickStrip.tsx`
- Modify: `src/components/mock/MockDraft.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Create the PickStrip component**

Create `src/components/mock/PickStrip.tsx`:

```tsx
import { useEffect, useRef } from "react";
import type { MockState } from "../../lib/mock/types";
import { buildPickCells } from "../../lib/mock/board";

interface Props {
  state: MockState;
}

export function PickStrip({ state }: Props) {
  const cells = buildPickCells(state);
  const made = state.picks.length;
  const currentRef = useRef<HTMLDivElement | null>(null);

  // Auto-recenter on the current pick whenever the draft advances.
  useEffect(() => {
    currentRef.current?.scrollIntoView({
      behavior: "smooth",
      inline: "center",
      block: "nearest",
    });
  }, [made]);

  return (
    <div className="mock-strip" aria-label="pick strip">
      {cells.map((c) => (
        <div
          key={c.overall}
          ref={c.kind === "current" ? currentRef : undefined}
          className={`strip-card ${c.kind} ${c.position ? `pos-${c.position}` : ""}`}
        >
          <span className="strip-pick">{c.label}</span>
          {c.kind === "done" ? (
            <>
              <span className="strip-name">{c.name}</span>
              <span className="strip-pos">{c.position}</span>
            </>
          ) : (
            <span className="strip-team">{c.teamLabel}</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add position color tokens + strip styles**

Append to `src/index.css`:

```css
/* --- Mock draft board: position colors (shared by strip + grid) --- */
.pos-QB {
  background: #e3574033;
  border-color: #e35740;
}
.pos-RB {
  background: #2faa6e33;
  border-color: #2faa6e;
}
.pos-WR {
  background: #3b82c433;
  border-color: #3b82c4;
}
.pos-TE {
  background: #d9882233;
  border-color: #d98822;
}
.pos-K {
  background: #8b5cf633;
  border-color: #8b5cf6;
}
.pos-DST {
  background: #64748b33;
  border-color: #64748b;
}

/* --- Pick strip --- */
.mock-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 8px 4px;
  scroll-padding-inline: 50%;
}
.mock-strip .strip-card {
  flex: 0 0 auto;
  min-width: 86px;
  border: 1px solid #888;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.mock-strip .strip-card.current {
  outline: 2px solid #f0c000;
  outline-offset: 1px;
  font-weight: 700;
}
.mock-strip .strip-card.upcoming {
  opacity: 0.6;
}
.mock-strip .strip-pick {
  font-variant-numeric: tabular-nums;
  opacity: 0.75;
}
.mock-strip .strip-name {
  font-weight: 600;
  white-space: nowrap;
}
.mock-strip .strip-pos {
  opacity: 0.8;
}
```

- [ ] **Step 3: Wire the strip in + slow the bots**

In `src/components/mock/MockDraft.tsx`:

(a) Add the import near the top with the other imports:

```tsx
import { PickStrip } from "./PickStrip";
```

(b) Change the bot delay from `350` to `800` in the auto-pick effect:

```tsx
const t = setTimeout(onBotTick, 800);
```

(c) Render the strip just above the closing `</div>` of the `mock-draft` container (after the `ul.mock-available` list):

```tsx
      <PickStrip state={state} />
    </div>
  );
}
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run build`
Expected: tsc clean, vite build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/mock/PickStrip.tsx src/components/mock/MockDraft.tsx src/index.css
git commit -m "Add always-on pick strip and slow bot pace to 800ms"
```

---

## Task 5: Draft board overlay (slide-up bottom sheet)

**Files:**

- Create: `src/components/mock/DraftBoardGrid.tsx`
- Modify: `src/components/mock/MockDraft.tsx`
- Modify: `src/index.css`

- [ ] **Step 1: Create the DraftBoardGrid component**

Create `src/components/mock/DraftBoardGrid.tsx`:

```tsx
import type { MockState } from "../../lib/mock/types";
import { buildBoardGrid, userColumnIndex } from "../../lib/mock/board";
import { available } from "../../lib/mock/engine";

interface Props {
  state: MockState;
  open: boolean;
  onClose: () => void;
  canDraft: boolean; // user is on the clock
  onDraft: (playerId: string) => void;
}

export function DraftBoardGrid({
  state,
  open,
  onClose,
  canDraft,
  onDraft,
}: Props) {
  const grid = buildBoardGrid(state);
  const userCol = userColumnIndex(state);
  const teams = state.settings.teams;
  const peek = available(state).slice(0, 30);

  return (
    <div
      className={`mock-board-sheet ${open ? "open" : ""}`}
      aria-hidden={!open}
    >
      <div className="board-peek" aria-label="available players">
        {peek.map((pl, i) => (
          <button
            key={pl.id}
            className={`peek-row pos-${pl.position}`}
            disabled={!canDraft}
            onClick={() => onDraft(pl.id)}
          >
            <span className="peek-rank">{i + 1}</span>
            <span className="peek-name">{pl.name}</span>
            <span className="peek-pos">{pl.position}</span>
            <span className="peek-team">{pl.team}</span>
            <span className="peek-adp">
              {pl.adp == null ? "" : Number(pl.adp.toFixed(1))}
            </span>
          </button>
        ))}
      </div>

      <div className="board-head">
        <strong>Draft board</strong>
        <button className="secondary" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="board-scroll">
        <table className="board-grid">
          <thead>
            <tr>
              <th></th>
              {Array.from({ length: teams }, (_, t) => (
                <th key={t} className={t === userCol ? "user-col" : ""}>
                  {t === userCol ? "You" : `T${t + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                <th className="round-label">R{r + 1}</th>
                {row.map((cell, t) => (
                  <td
                    key={t}
                    className={`board-cell ${t === userCol ? "user-col" : ""} ${
                      cell ? `pos-${cell.position}` : "empty"
                    }`}
                  >
                    {cell && (
                      <>
                        <span className="cell-pick">{cell.label}</span>
                        <span className="cell-name">{cell.name}</span>
                        <span className="cell-pos">{cell.position}</span>
                      </>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add bottom-sheet + grid styles**

Append to `src/index.css`:

```css
/* --- Draft board bottom sheet --- */
.mock-board-sheet {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  height: 85vh;
  background: var(--bg, #1b1b1b);
  border-top: 1px solid #555;
  border-radius: 12px 12px 0 0;
  box-shadow: 0 -8px 24px #0006;
  transform: translateY(100%);
  transition: transform 280ms ease;
  display: flex;
  flex-direction: column;
  z-index: 50;
}
.mock-board-sheet.open {
  transform: translateY(0);
}
.mock-board-sheet .board-peek {
  max-height: 132px;
  overflow-y: auto;
  border-bottom: 1px solid #444;
  padding: 4px;
}
.mock-board-sheet .peek-row {
  display: grid;
  grid-template-columns: 28px 1fr 40px 48px 44px;
  gap: 8px;
  width: 100%;
  text-align: left;
  align-items: center;
  border: 1px solid transparent;
  border-left-width: 4px;
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 13px;
  background: none;
  cursor: pointer;
}
.mock-board-sheet .peek-row:disabled {
  cursor: default;
  opacity: 0.85;
}
.mock-board-sheet .peek-adp {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.mock-board-sheet .board-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
}
.mock-board-sheet .board-scroll {
  overflow: auto;
  flex: 1;
}
.board-grid {
  border-collapse: collapse;
  font-size: 11px;
}
.board-grid th,
.board-grid .board-cell {
  border: 1px solid #3a3a3a;
  padding: 2px 4px;
  min-width: 74px;
  vertical-align: top;
}
.board-grid .round-label {
  position: sticky;
  left: 0;
  background: #222;
}
.board-grid thead th {
  position: sticky;
  top: 0;
  background: #222;
}
.board-grid .user-col {
  outline: 2px solid #f0c000;
  outline-offset: -2px;
}
.board-grid .board-cell.empty {
  background: #00000022;
}
.board-grid .cell-pick {
  display: block;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.board-grid .cell-name {
  display: block;
  font-weight: 600;
  white-space: nowrap;
}
.board-grid .cell-pos {
  display: block;
  opacity: 0.8;
}
```

- [ ] **Step 3: Wire the overlay + toggle into MockDraft**

In `src/components/mock/MockDraft.tsx`:

(a) Add to the existing `react` import so it includes `useState` (it is already imported — confirm `useState` is in the import list; it is used for `posFilter`). Add the component import near the top:

```tsx
import { DraftBoardGrid } from "./DraftBoardGrid";
```

(b) Add board-open state alongside the existing `posFilter` state:

```tsx
const [boardOpen, setBoardOpen] = useState(false);
```

(c) Add a "Draft board" toggle button inside the `mock-controls` div, before the Undo button:

```tsx
<button
  className={boardOpen ? "active" : ""}
  onClick={() => setBoardOpen((v) => !v)}
>
  {boardOpen ? "Hide board" : "Draft board"}
</button>
```

(d) Render the overlay just before the `<PickStrip ... />` line added in Task 4:

```tsx
      <DraftBoardGrid
        state={state}
        open={boardOpen}
        onClose={() => setBoardOpen(false)}
        canDraft={isUser}
        onDraft={onDraft}
      />
      <PickStrip state={state} />
```

- [ ] **Step 4: Typecheck + build**

Run: `npm run build`
Expected: tsc clean, vite build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/components/mock/DraftBoardGrid.tsx src/components/mock/MockDraft.tsx src/index.css
git commit -m "Add slide-up draft board overlay with peeking available list"
```

---

## Task 6: Live verification

No code changes unless a defect surfaces. Confirm the feature end-to-end in the browser.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (note the local URL).

- [ ] **Step 2: Drive it with Playwright (or manually) and confirm:**

1. ⚙ → 🏈 Mock draft… → Start (try 12 teams, your slot 6).
2. **Pick strip** shows along the bottom: current pick outlined, prior picks colored by position, upcoming cards show team labels. It auto-recenters as picks are made.
3. Bots visibly pause (~800ms) between picks — the board no longer "flies by."
4. **Draft board** button slides the grid up; the top available players peek above it and scroll; the grid shows teams across the top (your column highlighted "You"), rounds down the side, color-coded cards with pick numbers.
5. When you're on the clock, drafting from the peek list removes the player and advances the draft.
6. **Hide board** slides it back down.
7. Exit the mock → open your real board → confirm it is untouched (order, tiers, drafted marks).

- [ ] **Step 3: Final full check**

Run: `npm run test` (full suite) and `npm run build`
Expected: all tests pass, build clean.

- [ ] **Step 4: Finish the branch**

Use the **superpowers:finishing-a-development-branch** skill (merge `ff-draft-board` → `main`), then update the Built section of `WeDev/FF Draft Helper.md` in Obsidian.

---

## Notes for the implementer

- **Non-destructive contract:** these components only read `MockState` and call existing engine selectors (`available`, `buildPickCells`, `buildBoardGrid`). Never call into the real `rankingReducer`, `localStorage`, or mutate the league board.
- **Snake order:** `buildBoardGrid` places each pick by `teamIndex` (column) and `round` (row); the pick _number_ on each card conveys the snake sequence. Don't try to reorder columns per round.
- **Animation is prototype-and-revisit:** the CSS `transform`/`transition` slide is intentionally simple. If it feels off in Task 6, tune timing/height there rather than re-architecting.
