# Board Redesign — Phase 4: Column Manager + Persistence

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Let users show/hide and drag-reorder board columns via a ⚙ Columns popover, persisted with a global default + optional per-league override and an ask/all/this scope preference.

**Architecture:** A pure `columnLayout` module resolves a stored `{ order, hidden }` layout against the live `COLUMN_DEFS` registry (locked columns can't move/hide; new registry columns are folded in; stale ids dropped). Persistence: `otc:columns` (global), `league.columnsOverride` (per-league, null = inherit), `otc:columnScopePref` (ask|all|this). App holds the global layout in state, resolves the effective layout (`override ?? global`), and on any change routes the write per the scope pref — prompting when `ask`. The popover reuses dnd-kit (already used by the player table).

**Tech Stack:** React 19 + TS, Vitest + RTL, dnd-kit/sortable.

**Spec:** `docs/superpowers/specs/2026-06-02-board-redesign-columns-filters-design.md` §2.

---

## File Structure

- **Create** `src/lib/columnLayout.ts` — pure: `ColumnLayout` type, `DEFAULT_LAYOUT`, `resolveColumns`, `toggleHidden`, `reorder`, `foldRegistry`, `sanitizeLayout`, `layoutsEqual`.
- **Create** `src/lib/columnLayout.test.ts`.
- **Modify** `src/lib/storage.ts` — `loadColumnLayout`/`saveColumnLayout` (`otc:columns`), `loadColumnScopePref`/`saveColumnScopePref` (`otc:columnScopePref`).
- **Modify** `src/types.ts` — `League.columnsOverride?: ColumnLayout | null`; export `ColumnLayout` (or import from columns).
- **Modify** `src/state/reducer.ts` — `setLeagueColumns` action (sets `columnsOverride`).
- **Create** `src/components/board/ColumnManager.tsx` — the popover (dnd-kit reorder + checkboxes + locked + reset). Test `ColumnManager.test.tsx`.
- **Create** `src/components/board/ColumnScopePrompt.tsx` — the "Apply to all / Just this league" prompt.
- **Modify** `src/components/Toolbar.tsx` — ⚙ Columns trigger (far right) + a "When I change columns" control in the settings menu.
- **Modify** `src/App.tsx` — global-layout state, effective columns, change router (scope logic).
- **Modify** `src/index.css` — popover + manager-row styles.

---

## Task 1: Pure `columnLayout` module

**Files:** Create `src/lib/columnLayout.ts`, `src/lib/columnLayout.test.ts`.

Design:

- `ColumnLayout = { order: ColumnId[]; hidden: ColumnId[] }`.
- Locked columns (`COLUMN_DEFS` with `locked`) are **always visible** and **keep their registry index** — `reorder`/`toggleHidden` refuse to act on them, and `resolveColumns` never drops them.
- `foldRegistry(layout)` reconciles a stored layout with the current registry: drop ids no longer in `COLUMN_DEFS`; append registry ids missing from `order` at their default position (so new columns like a future `tier` appear); ensure every locked id is present + not hidden.
- `resolveColumns(layout)` → ordered **visible** `ColumnDef[]` for the board (folds first, then removes hidden).

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import {
  DEFAULT_LAYOUT,
  resolveColumns,
  toggleHidden,
  reorder,
  foldRegistry,
  sanitizeLayout,
  layoutsEqual,
} from "./columnLayout";
import { DEFAULT_COLUMN_ORDER } from "./columns";

describe("DEFAULT_LAYOUT", () => {
  it("is the full registry order, nothing hidden", () => {
    expect(DEFAULT_LAYOUT.order).toEqual(DEFAULT_COLUMN_ORDER);
    expect(DEFAULT_LAYOUT.hidden).toEqual([]);
  });
});

describe("resolveColumns", () => {
  it("returns visible columns in order", () => {
    const ids = resolveColumns({
      order: DEFAULT_COLUMN_ORDER,
      hidden: ["bye"],
    }).map((c) => c.id);
    expect(ids).not.toContain("bye");
    expect(ids[0]).toBe("mover");
  });
  it("never hides locked columns even if asked", () => {
    const ids = resolveColumns({
      order: DEFAULT_COLUMN_ORDER,
      hidden: ["name", "mover"],
    }).map((c) => c.id);
    expect(ids).toContain("name");
    expect(ids).toContain("mover");
  });
});

describe("toggleHidden", () => {
  it("hides then shows a non-locked column", () => {
    const a = toggleHidden(DEFAULT_LAYOUT, "vor");
    expect(a.hidden).toContain("vor");
    expect(toggleHidden(a, "vor").hidden).not.toContain("vor");
  });
  it("refuses to hide a locked column", () => {
    expect(toggleHidden(DEFAULT_LAYOUT, "name").hidden).not.toContain("name");
  });
});

describe("reorder", () => {
  it("moves a column before a target", () => {
    const out = reorder(DEFAULT_LAYOUT, "bye", "adp"); // bye lands before adp
    const i = out.order.indexOf("bye"),
      j = out.order.indexOf("adp");
    expect(i).toBe(j - 1);
  });
  it("refuses to move a locked column", () => {
    expect(reorder(DEFAULT_LAYOUT, "name", "rank")).toEqual(DEFAULT_LAYOUT);
  });
});

describe("foldRegistry", () => {
  it("drops unknown ids and appends missing registry ids", () => {
    const folded = foldRegistry({
      order: ["name", "zzz" as never, "rank"],
      hidden: [],
    });
    expect(folded.order).not.toContain("zzz");
    expect(folded.order).toContain("proj"); // registry column missing from stored order
    expect(folded.order).toContain("mover"); // locked always present
  });
});

describe("sanitizeLayout", () => {
  it("falls back to default for malformed input", () => {
    expect(sanitizeLayout(null)).toEqual(DEFAULT_LAYOUT);
    expect(sanitizeLayout({ order: "nope" })).toEqual(DEFAULT_LAYOUT);
  });
});

describe("layoutsEqual", () => {
  it("compares order + hidden", () => {
    expect(layoutsEqual(DEFAULT_LAYOUT, { ...DEFAULT_LAYOUT })).toBe(true);
    expect(
      layoutsEqual(DEFAULT_LAYOUT, toggleHidden(DEFAULT_LAYOUT, "vor")),
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect fail.** `npx vitest run src/lib/columnLayout.test.ts`

- [ ] **Step 3: Implement** `src/lib/columnLayout.ts`:

```ts
import {
  COLUMN_DEFS,
  DEFAULT_COLUMN_ORDER,
  orderedColumns,
  type ColumnDef,
  type ColumnId,
} from "./columns";

export interface ColumnLayout {
  order: ColumnId[];
  hidden: ColumnId[];
}

const VALID = new Set<ColumnId>(DEFAULT_COLUMN_ORDER);
const LOCKED = new Set<ColumnId>(
  COLUMN_DEFS.filter((c) => c.locked).map((c) => c.id),
);

export const DEFAULT_LAYOUT: ColumnLayout = {
  order: [...DEFAULT_COLUMN_ORDER],
  hidden: [],
};

const isId = (x: unknown): x is ColumnId => VALID.has(x as ColumnId);

// Reconcile a stored layout with the live registry: drop unknown ids, append
// any registry ids missing from order at their default index, force locked ids
// present + visible.
export function foldRegistry(layout: ColumnLayout): ColumnLayout {
  const order = layout.order.filter(isId);
  for (const id of DEFAULT_COLUMN_ORDER) {
    if (!order.includes(id)) {
      const at = DEFAULT_COLUMN_ORDER.indexOf(id);
      order.splice(Math.min(at, order.length), 0, id);
    }
  }
  const hidden = layout.hidden.filter((id) => isId(id) && !LOCKED.has(id));
  return { order, hidden };
}

export function resolveColumns(layout: ColumnLayout): ColumnDef[] {
  const { order, hidden } = foldRegistry(layout);
  const hide = new Set(hidden);
  return orderedColumns(order).filter((c) => c.locked || !hide.has(c.id));
}

export function toggleHidden(layout: ColumnLayout, id: ColumnId): ColumnLayout {
  if (LOCKED.has(id)) return layout;
  const hide = new Set(layout.hidden);
  if (hide.has(id)) hide.delete(id);
  else hide.add(id);
  return { ...layout, hidden: [...hide] };
}

// Move `id` to immediately before `beforeId` (both must be non-locked).
export function reorder(
  layout: ColumnLayout,
  id: ColumnId,
  beforeId: ColumnId,
): ColumnLayout {
  if (LOCKED.has(id) || LOCKED.has(beforeId) || id === beforeId) return layout;
  const order = layout.order.filter((x) => x !== id);
  const at = order.indexOf(beforeId);
  if (at < 0) return layout;
  order.splice(at, 0, id);
  return { ...layout, order };
}

export function layoutsEqual(a: ColumnLayout, b: ColumnLayout): boolean {
  return (
    a.order.length === b.order.length &&
    a.order.every((x, i) => x === b.order[i]) &&
    a.hidden.length === b.hidden.length &&
    [...a.hidden].sort().join() === [...b.hidden].sort().join()
  );
}

export function sanitizeLayout(raw: unknown): ColumnLayout {
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray((raw as ColumnLayout).order) ||
    !Array.isArray((raw as ColumnLayout).hidden)
  ) {
    return DEFAULT_LAYOUT;
  }
  return foldRegistry(raw as ColumnLayout);
}
```

- [ ] **Step 4: Run — expect pass.** `npx vitest run src/lib/columnLayout.test.ts`
- [ ] **Step 5: Commit.** `git commit -m "Add pure columnLayout module (resolve/reorder/hide/fold)"`

---

## Task 2: Persistence helpers

**Files:** Modify `src/lib/storage.ts`; Test `src/lib/storage` (add to its test if one exists, else create `columnLayout` persistence covered by a small new test file `src/lib/columnStore.test.ts`).

- [ ] **Step 1: Add helpers to `storage.ts`** (import `sanitizeLayout, DEFAULT_LAYOUT, type ColumnLayout` from `./columnLayout`):

```ts
const COLUMNS_KEY = "otc:columns";
const COL_SCOPE_KEY = "otc:columnScopePref";
export type ColumnScopePref = "ask" | "all" | "this";

export function loadColumnLayout(): ColumnLayout {
  try {
    const raw = localStorage.getItem(COLUMNS_KEY);
    return raw ? sanitizeLayout(JSON.parse(raw)) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}
export function saveColumnLayout(layout: ColumnLayout): void {
  try {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(layout));
  } catch {
    /* ignore quota/availability */
  }
}
export function loadColumnScopePref(): ColumnScopePref {
  const v = localStorage.getItem(COL_SCOPE_KEY);
  return v === "all" || v === "this" ? v : "ask";
}
export function saveColumnScopePref(p: ColumnScopePref): void {
  try {
    localStorage.setItem(COL_SCOPE_KEY, p);
  } catch {
    /* ignore */
  }
}
```

- [ ] **Step 2: Test** (`src/lib/columnStore.test.ts`) — round-trip + fallback, using jsdom localStorage:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  loadColumnLayout,
  saveColumnLayout,
  loadColumnScopePref,
  saveColumnScopePref,
} from "./storage";
import { DEFAULT_LAYOUT, toggleHidden } from "./columnLayout";

beforeEach(() => localStorage.clear());

describe("column persistence", () => {
  it("defaults when unset", () => {
    expect(loadColumnLayout()).toEqual(DEFAULT_LAYOUT);
    expect(loadColumnScopePref()).toBe("ask");
  });
  it("round-trips a layout", () => {
    const l = toggleHidden(DEFAULT_LAYOUT, "vor");
    saveColumnLayout(l);
    expect(loadColumnLayout().hidden).toContain("vor");
  });
  it("round-trips scope pref", () => {
    saveColumnScopePref("this");
    expect(loadColumnScopePref()).toBe("this");
  });
  it("sanitizes malformed stored layout", () => {
    localStorage.setItem("otc:columns", "{bad json");
    expect(loadColumnLayout()).toEqual(DEFAULT_LAYOUT);
  });
});
```

- [ ] **Step 3: Run — expect pass.** `npx vitest run src/lib/columnStore.test.ts`
- [ ] **Step 4: Commit.** `git commit -m "Persist column layout + scope pref (otc:columns, otc:columnScopePref)"`

---

## Task 3: League override field + reducer action

**Files:** Modify `src/types.ts`, `src/state/reducer.ts`; Test `src/state/reducer.test.ts` (append).

- [ ] **Step 1: Type** — in `types.ts`, import/define `ColumnLayout` and add to `League`:

```ts
import type { ColumnLayout } from "./lib/columnLayout";
// ...in League:
  columnsOverride?: ColumnLayout | null; // null/absent = inherit global layout
```

(If a circular import results — `columnLayout` imports `columns` which imports `types` for `SortKey` — define `ColumnLayout` in `columns.ts` instead and re-export; adjust imports. Verify with `npx tsc --noEmit`.)

- [ ] **Step 2: Action** — add to the league-action union and handler:

```ts
  | { type: "setLeagueColumns"; id: string; layout: ColumnLayout | null }
```

Handler (in the league reducer switch):

```ts
    case "setLeagueColumns":
      return mapLeague(state, action.id, (l) => ({
        ...l,
        columnsOverride: action.layout,
      }));
```

- [ ] **Step 3: Test** (append to `reducer.test.ts`):

```ts
it("setLeagueColumns sets and clears the per-league override", () => {
  const start = /* existing helper to build initial LeaguesState */;
  const id = start.currentId;
  const layout = { order: [], hidden: ["vor"] } as any;
  const set = leaguesReducer(start, { type: "setLeagueColumns", id, layout });
  expect(set.leagues.find((l) => l.id === id)!.columnsOverride).toEqual(layout);
  const cleared = leaguesReducer(set, { type: "setLeagueColumns", id, layout: null });
  expect(cleared.leagues.find((l) => l.id === id)!.columnsOverride).toBeNull();
});
```

(Read `reducer.test.ts` first to reuse its existing initial-state helper rather than hand-rolling one.)

- [ ] **Step 4: Run + typecheck.** `npx vitest run src/state/reducer.test.ts && npx tsc --noEmit`
- [ ] **Step 5: Commit.** `git commit -m "Add League.columnsOverride + setLeagueColumns reducer action"`

---

## Task 4: ColumnManager popover

**Files:** Create `src/components/board/ColumnManager.tsx`, `ColumnManager.test.tsx`.

Props:

```ts
interface Props {
  layout: ColumnLayout; // the effective layout
  onToggle: (id: ColumnId) => void;
  onReorder: (id: ColumnId, beforeId: ColumnId) => void;
  onReset: () => void;
  onClose: () => void;
}
```

Behavior:

- Renders `foldRegistry(layout).order` as rows in order. Each row: a dnd-kit drag handle, a checkbox (checked = visible = not in `hidden`), the column label (`COLUMN_DEFS` label; for empty-label columns like `mover`/`flag` show a friendly name map — `mover→"Reorder"`, `flag→"★/⚑"`).
- Locked rows: render 🔒, disable the checkbox + omit the drag handle.
- Reorder via `SortableContext` (vertical) → on drag end call `onReorder(activeId, overId)`.
- A **Reset to default** button calls `onReset`.
- Closes on outside-click / a Done button (mirror the `SettingsMenu` outside-click pattern already in `Toolbar.tsx`).

- [ ] **Step 1: Test** (`ColumnManager.test.tsx`) — RTL, `afterEach(cleanup)`:

```tsx
it("lists columns; toggling a checkbox calls onToggle", () => {
  const onToggle = vi.fn();
  render(
    <ColumnManager
      layout={DEFAULT_LAYOUT}
      onToggle={onToggle}
      onReorder={() => {}}
      onReset={() => {}}
      onClose={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("checkbox", { name: /VOR/i }));
  expect(onToggle).toHaveBeenCalledWith("vor");
});
it("locked columns show a checkbox that is checked and disabled", () => {
  render(
    <ColumnManager
      layout={DEFAULT_LAYOUT}
      onToggle={() => {}}
      onReorder={() => {}}
      onReset={() => {}}
      onClose={() => {}}
    />,
  );
  const cb = screen.getByRole("checkbox", {
    name: /Player/i,
  }) as HTMLInputElement;
  expect(cb.disabled).toBe(true);
  expect(cb.checked).toBe(true);
});
it("Reset to default calls onReset", () => {
  const onReset = vi.fn();
  render(
    <ColumnManager
      layout={DEFAULT_LAYOUT}
      onToggle={() => {}}
      onReorder={() => {}}
      onReset={onReset}
      onClose={() => {}}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /reset to default/i }));
  expect(onReset).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run — expect fail**, then implement the component (dnd-kit `DndContext`+`SortableContext`+`useSortable` per `PlayerTable`/`PlayerRow`; label map for empty-label columns; checkbox `aria-label` = the friendly label so the tests' name queries resolve). Run — expect pass.
- [ ] **Step 3: Commit.** `git commit -m "Add ColumnManager popover (reorder, show/hide, reset)"`

---

## Task 5: Scope prompt

**Files:** Create `src/components/board/ColumnScopePrompt.tsx`.

```ts
interface Props {
  onChoose: (scope: "all" | "this", remember: boolean) => void;
  onCancel: () => void;
}
```

- Small modal: text "Apply column changes to…", **Apply to all leagues** / **Just this league** buttons, a **☐ Don't ask again** checkbox; clicking a button calls `onChoose(scope, remember)`.
- [ ] **Step 1: Test** the two buttons + remember checkbox wiring (RTL). Implement. Run.
- [ ] **Step 2: Commit.** `git commit -m "Add ColumnScopePrompt (apply-to-all vs this-league)"`

---

## Task 6: App wiring — effective layout + change router

**Files:** Modify `src/App.tsx`, `src/components/Toolbar.tsx`.

- [ ] **Step 1: Global layout state + effective columns** in App:

```ts
const [globalLayout, setGlobalLayout] = useState(loadColumnLayout);
const effectiveLayout = currentLeague.columnsOverride ?? globalLayout;
const columns = useMemo(
  () => resolveColumns(effectiveLayout),
  [effectiveLayout],
);
const [scopePref, setScopePref] = useState(loadColumnScopePref);
const [pendingLayout, setPendingLayout] = useState<ColumnLayout | null>(null); // for the ask prompt
```

(Replace the existing `const columns = useMemo(() => orderedColumns(DEFAULT_COLUMN_ORDER), [])`.)

- [ ] **Step 2: Change router** — one function applies a new layout per scope:

```ts
const writeLayout = (layout: ColumnLayout, scope: "all" | "this") => {
  if (scope === "all") {
    setGlobalLayout(layout);
    saveColumnLayout(layout);
    dispatch({ type: "setLeagueColumns", id: currentLeague.id, layout: null });
  } else {
    dispatch({ type: "setLeagueColumns", id: currentLeague.id, layout });
  }
};

// Called by the manager on every edit. Routes by pref; 'ask' defers via pendingLayout.
const onLayoutChange = (layout: ColumnLayout) => {
  if (scopePref === "all") writeLayout(layout, "all");
  else if (scopePref === "this") writeLayout(layout, "this");
  else setPendingLayout(layout); // open the prompt
};

const onScopeChosen = (scope: "all" | "this", remember: boolean) => {
  if (pendingLayout) writeLayout(pendingLayout, scope);
  if (remember) {
    setScopePref(scope);
    saveColumnScopePref(scope);
  }
  setPendingLayout(null);
};
```

- [ ] **Step 3: Manager handlers** — wire `onToggle`/`onReorder`/`onReset` to compute the next layout from `effectiveLayout` and call `onLayoutChange`:

```ts
onToggle={(id) => onLayoutChange(toggleHidden(effectiveLayout, id))}
onReorder={(id, before) => onLayoutChange(reorder(effectiveLayout, id, before))}
onReset={() => onLayoutChange(DEFAULT_LAYOUT)}
```

Render `<ColumnManager>` from a ⚙ Columns toggle (state `columnsOpen`) and `<ColumnScopePrompt>` when `pendingLayout !== null`.

- [ ] **Step 4: Toolbar ⚙ Columns trigger** — add a button at the far right (after the existing settings cog) that calls an `onOpenColumns` prop. Keep it out of the scan path per spec. Add the prop to `Toolbar`'s `Props` and pass from App.

- [ ] **Step 5: Full suite + typecheck.** `npx vitest run && npx tsc --noEmit`
- [ ] **Step 6: Commit.** `git commit -m "Wire column manager + scope routing into App"`

---

## Task 7: Settings "When I change columns" control

**Files:** Modify `src/components/Toolbar.tsx` (settings menu), `src/App.tsx`.

- [ ] **Step 1:** In the ⚙ settings menu, add a labeled `<select>` "When I change columns" with options Ask each time / Always all leagues / Always this league, bound to a new prop `scopePref` + `onScopePrefChange`. App passes `scopePref` and `(p) => { setScopePref(p); saveColumnScopePref(p); }`.
- [ ] **Step 2: Typecheck + suite.** `npx tsc --noEmit && npx vitest run`
- [ ] **Step 3: Commit.** `git commit -m "Add 'When I change columns' scope-pref control"`

---

## Task 8: CSS + final verification

**Files:** Modify `src/index.css`.

- [ ] **Step 1:** Style `.column-manager` popover (reuse `.settings-menu` look), `.colman-row` (handle, checkbox, label; locked dimmed), and `.scope-prompt` modal. Grep `.settings-menu` for the existing popover treatment to match.
- [ ] **Step 2: Full gate.** `npx vitest run && npx tsc --noEmit && npm run build` — all green.
- [ ] **Step 3: Live smoke** (`npm run dev`): ⚙ Columns opens the popover; unchecking VOR removes it from the board; dragging a column reorders the board; Reset restores; with pref 'ask' a prompt appears and "Just this league" scopes to the current league only (switch leagues to confirm the other inherits global); the settings control flips the pref. Reload → layout persists.
- [ ] **Step 4: Update status doc** — Phase 4 "Built" bullet in `…/WeDev/On The Clock/FF Draft Helper.md`.

---

## Self-Review notes (author)

- **Spec §2 coverage:** manager popover with drag + checkbox + locked 🔒 + reset (Task 4); persistence model `otc:columns` / `league.columnsOverride` / `otc:columnScopePref` (Tasks 2–3, 6); scope routing all/this/ask incl. the prompt + remember (Tasks 5–6); "When I change columns" control (Task 7); ⚙ Columns trigger far-right (Task 6).
- **Forward-compat:** `foldRegistry` means a layout saved before Proj/'25 existed still surfaces them; stale ids are dropped (Task 1).
- **Locked invariants:** `mover`/`name` never hide or move — enforced in `toggleHidden`/`reorder`/`resolveColumns` (Task 1) and the UI (Task 4).
- **Risk:** possible import cycle (`columnLayout` ↔ `types` via `columns`); Task 3 Step 1 calls it out with the fix (define `ColumnLayout` in `columns.ts`). Verify with tsc.
- **Out of scope:** refetch + ESPN-shape guard + /dev panel = Phase 5.

```

```
