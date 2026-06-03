# Board Redesign — Phase 2: Cumulative Position Filters + Search Restyle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-select position filter with a cumulative chip bar (QB/RB/WR/TE/K/DST + FLEX/SFLEX/ALL macros), and extract the board search into a reusable pill component reused verbatim in the mock draft.

**Architecture:** All filter _logic_ lives in one pure, fully-unit-tested module (`src/lib/posFilter.ts`) — `App.tsx` holds a `Set<Position>` of active positions (empty = ALL) and delegates matching, toggling, macro application, and chip-presence derivation to that module. The `Toolbar` chip bar and a new `SearchPill` component are thin presentational layers. No persistence change: the active filter stays component state, exactly like today's `posFilter`.

**Tech Stack:** React 19 + TypeScript + Vite, Vitest + @testing-library/react, dnd-kit (unaffected).

**Spec:** `docs/superpowers/specs/2026-06-02-board-redesign-columns-filters-design.md` §4 (filters) + §5 (search).

---

## File Structure

- **Create** `src/lib/posFilter.ts` — pure filter logic: macro sets, `toggleChip`, `applyMacro`, `matchesPosFilter`, `setsEqual`, `rosteredPositions`, `chipConfig`. No React.
- **Create** `src/lib/posFilter.test.ts` — unit tests for the above.
- **Create** `src/components/SearchPill.tsx` — pill search input (magnifier + clear-✕). Presentational; reused by board + mock.
- **Create** `src/components/SearchPill.test.tsx` — RTL test for clear-✕ behavior.
- **Modify** `src/App.tsx` — `posFilter` state becomes `Set<Position>`; `visible`, `reorderable`, `filtersActive`, `onClearFilters`, and the hide-K/DST effects update to set semantics; pass chip config + handlers to `Toolbar`.
- **Modify** `src/components/Toolbar.tsx` — replace single-select chips with cumulative + macro chip bar; replace the raw `<input className="search">` with `<SearchPill>`.
- **Modify** `src/components/mock/MockDraft.tsx` — replace the raw `pickmenu-search` input with `<SearchPill>`.
- **Modify** `src/index.css` — `.search-pill` styles + macro-chip styles.

---

## Task 1: Pure position-filter module

**Files:**

- Create: `src/lib/posFilter.ts`
- Test: `src/lib/posFilter.test.ts`

Design notes (from spec §4):

- Active filter is a `Set<Position>`; **empty set = ALL** (no filter).
- Macros are literal sets: `FLEX = {RB,WR,TE}`, `SFLEX = {QB,RB,WR,TE}`.
- Clicking a chip toggles its membership. Clicking a macro sets the active set to that macro's set, unless it already exactly equals it (then clear). `ALL` always clears.
- A macro highlights only when the active set **exactly equals** its set.
- Chip presence is league-roster driven: a position chip shows when `roster[pos] > 0` and the position is not in `roster.disabled`. `SFLEX` shows when `roster.SUPERFLEX > 0`. `FLEX` shows when at least one of RB/WR/TE is rostered.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/posFilter.test.ts
import { describe, it, expect } from "vitest";
import {
  FLEX_SET,
  SFLEX_SET,
  toggleChip,
  applyMacro,
  matchesPosFilter,
  setsEqual,
  rosteredPositions,
  chipConfig,
} from "./posFilter";
import type { Position, RosterSettings } from "../types";

const roster = (over: Partial<RosterSettings> = {}): RosterSettings => ({
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  K: 1,
  DST: 1,
  bench: 6,
  disabled: [],
  ...over,
});

const set = (...p: Position[]) => new Set<Position>(p);

describe("matchesPosFilter", () => {
  it("empty set matches every position (ALL)", () => {
    expect(matchesPosFilter(set(), "QB")).toBe(true);
    expect(matchesPosFilter(set(), "DST")).toBe(true);
  });
  it("non-empty set matches only members", () => {
    const f = set("RB", "WR");
    expect(matchesPosFilter(f, "RB")).toBe(true);
    expect(matchesPosFilter(f, "WR")).toBe(true);
    expect(matchesPosFilter(f, "QB")).toBe(false);
  });
});

describe("toggleChip", () => {
  it("adds a position not present", () => {
    expect(setsEqual(toggleChip(set("RB"), "WR"), set("RB", "WR"))).toBe(true);
  });
  it("removes a position already present", () => {
    expect(setsEqual(toggleChip(set("RB", "WR"), "RB"), set("WR"))).toBe(true);
  });
  it("does not mutate the input set", () => {
    const a = set("RB");
    toggleChip(a, "WR");
    expect(setsEqual(a, set("RB"))).toBe(true);
  });
});

describe("applyMacro", () => {
  it("FLEX sets the active set to {RB,WR,TE}", () => {
    expect(setsEqual(applyMacro(set("QB"), "FLEX"), FLEX_SET)).toBe(true);
  });
  it("SFLEX sets the active set to {QB,RB,WR,TE}", () => {
    expect(setsEqual(applyMacro(set(), "SFLEX"), SFLEX_SET)).toBe(true);
  });
  it("clicking an active macro again clears the filter", () => {
    expect(setsEqual(applyMacro(new Set(FLEX_SET), "FLEX"), set())).toBe(true);
  });
  it("ALL clears the filter", () => {
    expect(setsEqual(applyMacro(set("RB", "WR"), "ALL"), set())).toBe(true);
  });
});

describe("rosteredPositions", () => {
  it("includes positions with count > 0, in canonical order", () => {
    expect(rosteredPositions(roster())).toEqual([
      "QB",
      "RB",
      "WR",
      "TE",
      "K",
      "DST",
    ]);
  });
  it("drops positions with zero count", () => {
    expect(rosteredPositions(roster({ K: 0, DST: 0 }))).toEqual([
      "QB",
      "RB",
      "WR",
      "TE",
    ]);
  });
  it("drops disabled positions even if count > 0", () => {
    expect(rosteredPositions(roster({ disabled: ["K"] }))).toEqual([
      "QB",
      "RB",
      "WR",
      "TE",
      "DST",
    ]);
  });
});

describe("chipConfig", () => {
  it("standard roster: positions + FLEX, no SFLEX", () => {
    const c = chipConfig(roster());
    expect(c.positions).toEqual(["QB", "RB", "WR", "TE", "K", "DST"]);
    expect(c.flex).toBe(true);
    expect(c.sflex).toBe(false);
  });
  it("superflex roster shows SFLEX", () => {
    expect(chipConfig(roster({ SUPERFLEX: 1 })).sflex).toBe(true);
  });
  it("no FLEX-eligible positions hides FLEX", () => {
    expect(chipConfig(roster({ RB: 0, WR: 0, TE: 0 })).flex).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/posFilter.test.ts`
Expected: FAIL — "Failed to resolve import './posFilter'".

- [ ] **Step 3: Write the module**

```ts
// src/lib/posFilter.ts
import type { Position, RosterSettings } from "../types";
import { POSITIONS } from "../types";

export const FLEX_SET: ReadonlySet<Position> = new Set<Position>([
  "RB",
  "WR",
  "TE",
]);
export const SFLEX_SET: ReadonlySet<Position> = new Set<Position>([
  "QB",
  "RB",
  "WR",
  "TE",
]);

export type Macro = "FLEX" | "SFLEX" | "ALL";

export function setsEqual(
  a: ReadonlySet<Position>,
  b: ReadonlySet<Position>,
): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/** Empty active set = ALL (no filter). */
export function matchesPosFilter(
  active: ReadonlySet<Position>,
  pos: Position,
): boolean {
  return active.size === 0 || active.has(pos);
}

/** Toggle a single position chip; returns a new set (never mutates input). */
export function toggleChip(
  active: ReadonlySet<Position>,
  pos: Position,
): Set<Position> {
  const next = new Set(active);
  if (next.has(pos)) next.delete(pos);
  else next.add(pos);
  return next;
}

/** Apply a macro chip. Clicking an active macro again clears; ALL always clears. */
export function applyMacro(
  active: ReadonlySet<Position>,
  macro: Macro,
): Set<Position> {
  if (macro === "ALL") return new Set();
  const target = macro === "FLEX" ? FLEX_SET : SFLEX_SET;
  if (setsEqual(active, target)) return new Set();
  return new Set(target);
}

/** Positions the league actually rosters, in canonical POSITIONS order. */
export function rosteredPositions(roster: RosterSettings): Position[] {
  return POSITIONS.filter((p) => roster[p] > 0 && !roster.disabled.includes(p));
}

export interface ChipConfig {
  positions: Position[];
  flex: boolean;
  sflex: boolean;
}

/** Which chips to render for a league's roster (spec §4 "chip presence"). */
export function chipConfig(roster: RosterSettings): ChipConfig {
  const positions = rosteredPositions(roster);
  const flex = positions.some((p) => FLEX_SET.has(p));
  return { positions, flex, sflex: roster.SUPERFLEX > 0 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/posFilter.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/posFilter.ts src/lib/posFilter.test.ts
git commit -m "Add pure position-filter module (cumulative + macros)"
```

---

## Task 2: Wire App.tsx to the cumulative filter

**Files:**

- Modify: `src/App.tsx` (state, `visible`, `reorderable`, `filtersActive`, `onClearFilters`, hide-K/DST effects, Toolbar props)

No new test here — `App.tsx` has no unit test today and the logic is covered by Task 1 + the Task 7 smoke. This task is mechanical wiring; verify via typecheck + existing suite.

- [ ] **Step 1: Import the module and the league roster**

Add to the imports near `import { searchPlayers } from "./lib/search";`:

```ts
import { matchesPosFilter, chipConfig } from "./lib/posFilter";
```

The active league's roster lives at `currentLeague.roster` (shape `RosterSettings`; verified — `League.roster` in `src/types.ts:78`). `currentLeague` is already in scope (used for `currentLeague.id`).

- [ ] **Step 2: Change the filter state to a Set**

Replace:

```ts
const [posFilter, setPosFilter] = useState<Position | "All">("All");
```

with:

```ts
// Active position chips; empty = ALL (no filter). See lib/posFilter.
const [posFilter, setPosFilter] = useState<Set<Position>>(() => new Set());
```

- [ ] **Step 3: Update the `visible` filter predicate**

In the `visible` useMemo, replace:

```ts
(posFilter === "All" || p.position === posFilter) &&
```

with:

```ts
matchesPosFilter(posFilter, p.position) &&
```

The `useMemo` dependency array already lists `posFilter`; leave it (the Set reference changes on every toggle, which is correct).

- [ ] **Step 4: Update `reorderable`**

Replace:

```ts
const reorderable =
  posFilter === "All" && search.trim() === "" && byeFilter === null;
```

with:

```ts
const reorderable =
  posFilter.size === 0 && search.trim() === "" && byeFilter === null;
```

- [ ] **Step 5: Update `filtersActive` and `onClearFilters`**

Find the `filtersActive` expression (around the `search !== "" || posFilter !== "All" ||` block). Replace `posFilter !== "All"` with `posFilter.size > 0`. In `onClearFilters`, replace `setPosFilter("All")` with `setPosFilter(new Set())`.

- [ ] **Step 6: Update the hide-K / hide-DST effects**

The two toggle handlers currently do `if (next && posFilter === "K") setPosFilter("All")` and the DST equivalent. Replace each with a set-aware removal so hiding a position also drops its active chip:

```ts
// hide-K handler:
if (next)
  setPosFilter((prev) => {
    const n = new Set(prev);
    n.delete("K");
    return n;
  });
// hide-DST handler:
if (next)
  setPosFilter((prev) => {
    const n = new Set(prev);
    n.delete("DST");
    return n;
  });
```

- [ ] **Step 7: Pass chip config + handlers to Toolbar**

Compute the chip config near `shownPositions`:

```ts
const chips = useMemo(
  () => chipConfig(currentLeague.roster),
  [currentLeague.roster],
);
```

In the `<Toolbar … />` JSX, replace the three position props (`positions={shownPositions}`, `posFilter={posFilter}`, `setPosFilter={setPosFilter}`) with:

```tsx
posChips={chips}
activePos={posFilter}
onToggleChip={(p) => setPosFilter((prev) => toggleChip(prev, p))}
onApplyMacro={(m) => setPosFilter((prev) => applyMacro(prev, m))}
```

Add `toggleChip, applyMacro` to the `posFilter` import from Step 1 (so it reads `import { matchesPosFilter, chipConfig, toggleChip, applyMacro } from "./lib/posFilter";`).

(`shownPositions` is still used by the drafted-summary header — keep it; only the Toolbar position props change.)

- [ ] **Step 8: Typecheck — expect Toolbar prop errors only**

Run: `npx tsc --noEmit`
Expected: errors confined to the `<Toolbar>` call site / `Toolbar` prop types (fixed in Task 3). No errors elsewhere in `App.tsx`.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "Wire App filter state to cumulative Set<Position>"
```

---

## Task 3: Cumulative + macro chip bar in Toolbar

**Files:**

- Modify: `src/components/Toolbar.tsx`
- Test: `src/components/Toolbar.test.tsx` (create)

- [ ] **Step 1: Update Toolbar props**

In the `Props` interface, remove:

```ts
positions: Position[];
posFilter: Position | "All";
setPosFilter: (p: Position | "All") => void;
```

and add (import the types at the top — `import type { ChipConfig, Macro } from "../lib/posFilter";`):

```ts
posChips: ChipConfig;
activePos: ReadonlySet<Position>;
onToggleChip: (p: Position) => void;
onApplyMacro: (m: Macro) => void;
```

- [ ] **Step 2: Replace the chip render block**

Replace the existing `<div className="chips">…</div>` block with macro + position chips. Macros first (ALL always shown; FLEX/SFLEX conditionally), then the rostered position chips:

```tsx
<div className="chips">
  <button
    className={props.activePos.size === 0 ? "chip macro active" : "chip macro"}
    onClick={() => props.onApplyMacro("ALL")}
  >
    All
  </button>
  {props.posChips.flex && (
    <button
      className={
        setsEqual(props.activePos, FLEX_SET)
          ? "chip macro active"
          : "chip macro"
      }
      onClick={() => props.onApplyMacro("FLEX")}
    >
      FLEX
    </button>
  )}
  {props.posChips.sflex && (
    <button
      className={
        setsEqual(props.activePos, SFLEX_SET)
          ? "chip macro active"
          : "chip macro"
      }
      onClick={() => props.onApplyMacro("SFLEX")}
    >
      SFLEX
    </button>
  )}
  {props.posChips.positions.map((p) => (
    <button
      key={p}
      className={props.activePos.has(p) ? "chip active" : "chip"}
      onClick={() => props.onToggleChip(p)}
    >
      {p}
    </button>
  ))}
</div>
```

Add to the imports at the top of `Toolbar.tsx`:

```ts
import { setsEqual, FLEX_SET, SFLEX_SET } from "../lib/posFilter";
```

- [ ] **Step 3: Write a component test**

```tsx
// src/components/Toolbar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Toolbar } from "./Toolbar";
import type { ChipConfig } from "../lib/posFilter";

const noop = () => {};
const baseChips: ChipConfig = {
  positions: ["QB", "RB", "WR", "TE"],
  flex: true,
  sflex: false,
};

// Minimal props; only the chip-related ones matter for these assertions.
function renderToolbar(
  over: Partial<React.ComponentProps<typeof Toolbar>> = {},
) {
  const props = {
    search: "",
    setSearch: noop,
    posChips: baseChips,
    activePos: new Set<"QB" | "RB" | "WR" | "TE" | "K" | "DST">(),
    onToggleChip: vi.fn(),
    onApplyMacro: vi.fn(),
    hideDrafted: false,
    setHideDrafted: noop,
    byeFilter: null,
    setByeFilter: noop,
    byeWeeks: [],
    grouped: true,
    onBackToTiers: noop,
    filtersActive: false,
    onClearFilters: noop,
    currentLeagueId: "l1",
    leagues: [{ id: "l1", name: "L", scoring: "ppr" as const }],
    onSwitchLeague: noop,
    onAddLeague: noop,
    onDuplicateLeague: noop,
    onRenameLeague: noop,
    onDeleteLeague: noop,
    tierLists: [{ id: "t1", name: "T" }],
    activeTierListId: "t1",
    defaultTierListId: "t1",
    onSwitchTierList: noop,
    onAddTierList: noop,
    onDuplicateTierList: noop,
    onRenameTierList: noop,
    onSetDefaultTierList: noop,
    onDeleteTierList: noop,
    onScoringChange: noop,
    hideK: false,
    onToggleK: noop,
    hideDst: false,
    onToggleDst: noop,
    onFetch: noop,
    fetching: false,
    onRefreshAdp: noop,
    adpStatus: null,
    onMock: noop,
    onImport: noop,
    onExportJson: noop,
    onExportCsv: noop,
    ...over,
  };
  return render(
    <Toolbar {...(props as React.ComponentProps<typeof Toolbar>)} />,
  );
}

describe("Toolbar chip bar", () => {
  it("renders All + FLEX + rostered positions; no SFLEX when sflex=false", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "FLEX" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "SFLEX" })).toBeNull();
    expect(screen.getByRole("button", { name: "QB" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "K" })).toBeNull();
  });
  it("shows SFLEX when sflex=true", () => {
    renderToolbar({ posChips: { ...baseChips, sflex: true } });
    expect(screen.getByRole("button", { name: "SFLEX" })).toBeTruthy();
  });
  it("All is active when no positions selected", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "All" }).className).toContain(
      "active",
    );
  });
});
```

- [ ] **Step 4: Run the Toolbar test**

Run: `npx vitest run src/components/Toolbar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Typecheck the whole app**

Run: `npx tsc --noEmit`
Expected: no errors (App ↔ Toolbar prop contract now matches).

- [ ] **Step 6: Commit**

```bash
git add src/components/Toolbar.tsx src/components/Toolbar.test.tsx
git commit -m "Cumulative + FLEX/SFLEX chip bar in Toolbar"
```

---

## Task 4: SearchPill component, used in Toolbar

**Files:**

- Create: `src/components/SearchPill.tsx`
- Test: `src/components/SearchPill.test.tsx`
- Modify: `src/components/Toolbar.tsx` (swap the raw input)

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/SearchPill.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SearchPill } from "./SearchPill";

describe("SearchPill", () => {
  it("shows no clear button when empty", () => {
    render(<SearchPill value="" onChange={() => {}} />);
    expect(screen.queryByRole("button", { name: /clear search/i })).toBeNull();
  });
  it("shows a clear button when non-empty and clears on click", () => {
    const onChange = vi.fn();
    render(<SearchPill value="josh" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });
  it("forwards typing to onChange", () => {
    const onChange = vi.fn();
    render(<SearchPill value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Search…"), {
      target: { value: "a" },
    });
    expect(onChange).toHaveBeenCalledWith("a");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/components/SearchPill.test.tsx`
Expected: FAIL — cannot resolve `./SearchPill`.

- [ ] **Step 3: Write the component**

```tsx
// src/components/SearchPill.tsx
interface Props {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}

export function SearchPill({
  value,
  onChange,
  placeholder = "Search…",
}: Props) {
  return (
    <div className="search-pill">
      <svg className="search-pill-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle
          cx="11"
          cy="11"
          r="7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <line
          x1="16.5"
          y1="16.5"
          x2="21"
          y2="21"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <input
        className="search-pill-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value !== "" && (
        <button
          className="search-pill-clear"
          aria-label="Clear search"
          onClick={() => onChange("")}
        >
          ✕
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/components/SearchPill.test.tsx`
Expected: PASS.

- [ ] **Step 5: Use it in the Toolbar**

In `Toolbar.tsx`, add `import { SearchPill } from "./SearchPill";` and replace the raw `<input className="search" … />` block with:

```tsx
<SearchPill value={props.search} onChange={props.setSearch} />
```

- [ ] **Step 6: Verify the suite + types**

Run: `npx vitest run src/components/SearchPill.test.tsx src/components/Toolbar.test.tsx && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/SearchPill.tsx src/components/SearchPill.test.tsx src/components/Toolbar.tsx
git commit -m "Add reusable SearchPill; use in Toolbar"
```

---

## Task 5: Reuse SearchPill in the mock draft

**Files:**

- Modify: `src/components/mock/MockDraft.tsx` (replace the `pickmenu-search` input)

- [ ] **Step 1: Swap the input**

Add `import { SearchPill } from "../SearchPill";` to `MockDraft.tsx`. Replace the raw input around line 371:

```tsx
<input
  className="pickmenu-search"
  placeholder="Search players…"
  value={replaceSearch}
  onChange={(e) => setReplaceSearch(e.target.value)}
/>
```

with:

```tsx
<SearchPill
  value={replaceSearch}
  onChange={setReplaceSearch}
  placeholder="Search players…"
/>
```

Leave the downstream `.filter(... replaceSearch ...)` logic untouched — behavior is unchanged, only the input chrome.

- [ ] **Step 2: Verify the full suite + types**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests PASS, no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/mock/MockDraft.tsx
git commit -m "Reuse SearchPill in mock draft replace-player menu"
```

---

## Task 6: CSS — pill + macro chips

**Files:**

- Modify: `src/index.css`

- [ ] **Step 1: Add styles**

Append to `src/index.css` (the orange accent matches the spec's `#ff6b4a`; if the codebase exposes an accent CSS var, prefer it):

```css
/* --- Search pill (board + mock) --- */
.search-pill {
  position: relative;
  display: inline-flex;
  align-items: center;
}
.search-pill-icon {
  position: absolute;
  left: 10px;
  width: 16px;
  height: 16px;
  color: #888;
  pointer-events: none;
}
.search-pill-input {
  padding: 6px 28px 6px 32px;
  border: 1px solid #3a3a3a;
  border-radius: 999px;
  background: #1c1c1c;
  color: inherit;
  outline: none;
}
.search-pill-input:focus {
  border-color: #ff6b4a;
  box-shadow: 0 0 0 3px #ff6b4a22;
}
.search-pill-clear {
  position: absolute;
  right: 8px;
  border: none;
  background: none;
  color: #888;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 2px;
}
.search-pill-clear:hover {
  color: #ddd;
}

/* --- Macro chips --- */
.chip.macro {
  font-weight: 600;
  letter-spacing: 0.02em;
}
.chip.macro.active {
  border-color: #ff6b4a;
  color: #ff6b4a;
}
```

If a `.search` rule still exists and is now unused (board + mock both moved to the pill), remove it in the same commit. The mock's `.pickmenu-search` rule may still style the surrounding container — only remove it if grep shows no remaining `pickmenu-search` className.

- [ ] **Step 2: Visual check via dev server**

Run: `npm run dev` and open the board. Confirm: chip bar shows All/FLEX/(SFLEX)/positions; clicking RB then WR keeps both active; clicking FLEX highlights it and selects RB+WR+TE; clicking All clears. Search pill shows magnifier + clear-✕ on input; same chrome in ⚙ → Mock draft → on-the-clock replace menu.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "Style search pill + macro chips"
```

---

## Task 7: Playwright smoke + final verification

**Files:**

- Reference: the Phase 1 Playwright smoke (`docs/superpowers/plans/2026-06-03-board-registry-phase1.md` Task 8) for the existing pattern.

- [ ] **Step 1: Full test suite**

Run: `npx vitest run`
Expected: all PASS (including `posFilter`, `Toolbar`, `SearchPill`).

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 3: Manual smoke (Playwright or by hand) against `npm run dev`**

Verify the spec §4/§5 acceptance:

- Cumulative: RB + WR both active shows both positions' players.
- Macro override: FLEX selects exactly RB/WR/TE and highlights; clicking FLEX again clears.
- Empty set = ALL: with nothing selected, all players show and All is highlighted.
- League-driven chips: a league without K/DST (or with them disabled) shows no K/DST chip; a superflex league shows SFLEX.
- Drag-to-retier disabled while any position chip is active; restored when cleared (All).
- Search pill clears via ✕; same component renders in the mock replace menu.

- [ ] **Step 4: Update the status doc**

Append a "Built" bullet to `…/MainVault/WeDev/On The Clock/FF Draft Helper.md` summarizing Phase 2 (cumulative chips + FLEX/SFLEX, league-driven presence, reusable SearchPill in board + mock), and tick Phase 2 off the Phases 2–5 list.

---

## Self-Review notes (author)

- **Spec §4 coverage:** cumulative chips (Task 3), FLEX/SFLEX/ALL macros + override + clear-on-repeat (Task 1 `applyMacro`, Task 3 render), empty=ALL (Task 1 `matchesPosFilter`), macro-highlight on exact equality (Task 3 `setsEqual`), league-driven chip presence incl. SUPERFLEX rule (Task 1 `chipConfig`), partial-view disables drag-to-retier (Task 2 `reorderable`).
- **Spec §5 coverage:** pill + magnifier + orange focus ring + clear-✕ (Task 4 + Task 6), reused verbatim in mock (Task 5).
- **Out of scope (later phases):** Proj/'24 columns (§6), refetch + /dev panel (§7), column manager (§2) — untouched here.
- **Type consistency:** `posFilter`/`activePos` are `Set<Position>` end-to-end; `ChipConfig`/`Macro` exported from `posFilter.ts` and consumed by `Toolbar`; `chipConfig` derives from `currentLeague.roster` (verified `League.roster` in `src/types.ts:78`).

```

```
