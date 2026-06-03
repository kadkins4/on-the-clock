# Board Column Registry (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the draft board's `<table>` from hardcoded markup to a data-driven **column registry**, and ship the three things that fall out of it immediately: clickable sortable headers (replacing the Sort `<select>`), full-width accent-bar tier rows, and subtle per-tier zebra striping.

**Architecture:** A pure `src/lib/columns.ts` module owns column _metadata_ + ordering. A `src/components/board/cells.tsx` module owns a `ColumnId → (player, ctx) => ReactNode` renderer map extracted from today's `PlayerRow`. `PlayerRow` and `PlayerTable` iterate the registry instead of hardcoding cells; the header becomes a `ColumnHeader` component that emits sort events. Sort state gains a direction (`sortAsc`) and a `pos` key; the ↩ Tiers button returns to the default grouped view (`sortKey === null`). No new columns, no customization UI, no filter changes — those are later phases. Behavior parity (dnd reorder, "+" add-tier, draft/flag/notes editing, injury badge, ADP tooltip, VOR) is preserved.

**Tech Stack:** React 19 + TypeScript + Vite, dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`), Vitest (`environment: jsdom`), `@testing-library/react`, Playwright MCP for the smoke check.

**Spec:** `docs/superpowers/specs/2026-06-02-board-redesign-columns-filters-design.md` (§1 registry, §3 sorting/tiers, §8 visuals).

---

## File Structure

- **Create `src/lib/columns.ts`** — `ColumnId` union, `ColumnDef` interface (metadata only: `id`, `label`, `locked`, `sortable`, `sortKey`, `align`, `width`), `COLUMN_DEFS` (the current 11 columns), `DEFAULT_COLUMN_ORDER`, and `orderedColumns()`. Pure; unit-tested. Render functions live in React, not here.
- **Create `src/lib/columns.test.ts`** — unit tests for the registry helpers.
- **Modify `src/lib/ranking.ts`** — add a `pos` case to `sortPlayers`; export `defaultSortAsc(key)`.
- **Modify `src/lib/ranking.test.ts`** — tests for the new sort behavior.
- **Modify `src/types.ts`** — add `"pos"` to `SortKey`.
- **Create `src/components/board/cells.tsx`** — `CellCtx` type + `CELL_RENDERERS: Record<ColumnId, (p, ctx) => ReactNode>`, extracted verbatim from today's `PlayerRow` cells.
- **Create `src/components/board/ColumnHeader.tsx`** — the `<thead>` row, driven by the registry, emitting `onSort(key)`.
- **Create `src/components/board/ColumnHeader.test.tsx`** — RTL anchor test (renders headers in order; click toggles sort).
- **Modify `src/components/PlayerRow.tsx`** — render cells by iterating the registry instead of hardcoded `<td>`s; add a `stripe` prop for zebra; rename row class to keep `row` + add `prow` + conditional `lite`.
- **Modify `src/components/PlayerTable.tsx`** — drive `<thead>` from `ColumnHeader`, pass sort props through, compute zebra parity per-tier, dynamic `colSpan`.
- **Modify `src/components/TierGroup.tsx`** — full-width accent-bar banner with a player count; `colSpan` derived from the visible-column count.
- **Modify `src/components/Toolbar.tsx`** — remove the Sort `<select>`; add a `↩ Tiers` button.
- **Modify `src/App.tsx`** — add `sortAsc` state; wire header `onSort`; pass column list + sort props down; `↩ Tiers` sets `sortKey = null`.
- **Modify `src/index.css`** — full-width tier banner, zebra rules, sortable-header styles, ↩ Tiers button.

---

## Task 1: Column registry module

**Files:**

- Create: `src/lib/columns.ts`
- Test: `src/lib/columns.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/columns.test.ts
import { describe, it, expect } from "vitest";
import {
  COLUMN_DEFS,
  DEFAULT_COLUMN_ORDER,
  orderedColumns,
  type ColumnId,
} from "./columns";

describe("column registry", () => {
  it("default order lists every defined column exactly once", () => {
    const defIds = COLUMN_DEFS.map((c) => c.id).sort();
    const orderIds = [...DEFAULT_COLUMN_ORDER].sort();
    expect(orderIds).toEqual(defIds);
  });

  it("mover and name are the only locked columns", () => {
    const locked = COLUMN_DEFS.filter((c) => c.locked)
      .map((c) => c.id)
      .sort();
    expect(locked).toEqual(["mover", "name"]);
  });

  it("orderedColumns returns defs in the given order", () => {
    const order: ColumnId[] = ["name", "adp", "mover"];
    expect(orderedColumns(order).map((c) => c.id)).toEqual([
      "name",
      "adp",
      "mover",
    ]);
  });

  it("orderedColumns ignores unknown ids", () => {
    const order = ["name", "bogus" as ColumnId];
    expect(orderedColumns(order).map((c) => c.id)).toEqual(["name"]);
  });

  it("every sortable column declares a sortKey", () => {
    for (const c of COLUMN_DEFS) {
      if (c.sortable) expect(c.sortKey).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/columns.test.ts`
Expected: FAIL — `Cannot find module './columns'`.

- [ ] **Step 3: Write the registry**

```ts
// src/lib/columns.ts
import type { SortKey } from "../types";

export type ColumnId =
  | "mover"
  | "draft"
  | "flag"
  | "rank"
  | "name"
  | "pos"
  | "team"
  | "adp"
  | "vor"
  | "bye"
  | "notes";

export interface ColumnDef {
  id: ColumnId;
  label: string; // header text (empty string => no header label)
  locked?: boolean; // un-hideable & un-movable (Phase 4 enforces; declared now)
  sortable: boolean;
  sortKey?: SortKey; // the key passed to sortPlayers; required when sortable
  align: "l" | "c" | "r";
  width: string; // CSS width applied to the column
}

// The current board, 1:1 with today's hardcoded <thead>/<td> order.
export const COLUMN_DEFS: ColumnDef[] = [
  {
    id: "mover",
    label: "",
    locked: true,
    sortable: false,
    align: "c",
    width: "1.7rem",
  },
  { id: "draft", label: "Draft", sortable: false, align: "c", width: "2.6rem" },
  { id: "flag", label: "★/⚑", sortable: false, align: "c", width: "2rem" },
  {
    id: "rank",
    label: "#",
    sortable: true,
    sortKey: "overall",
    align: "c",
    width: "2.2rem",
  },
  {
    id: "name",
    label: "Player",
    locked: true,
    sortable: true,
    sortKey: "name",
    align: "l",
    width: "16rem",
  },
  {
    id: "pos",
    label: "Pos",
    sortable: true,
    sortKey: "pos",
    align: "c",
    width: "4rem",
  },
  { id: "team", label: "Team", sortable: false, align: "c", width: "3rem" },
  {
    id: "adp",
    label: "ADP",
    sortable: true,
    sortKey: "adp",
    align: "c",
    width: "4.2rem",
  },
  {
    id: "vor",
    label: "VOR",
    sortable: true,
    sortKey: "vor",
    align: "r",
    width: "3.5rem",
  },
  {
    id: "bye",
    label: "Bye",
    sortable: true,
    sortKey: "bye",
    align: "c",
    width: "2.6rem",
  },
  { id: "notes", label: "Notes", sortable: false, align: "l", width: "auto" },
];

export const DEFAULT_COLUMN_ORDER: ColumnId[] = COLUMN_DEFS.map((c) => c.id);

const BY_ID = new Map<ColumnId, ColumnDef>(COLUMN_DEFS.map((c) => [c.id, c]));

// Resolve an ordered list of column ids to their defs, dropping unknown ids.
export function orderedColumns(order: ColumnId[]): ColumnDef[] {
  return order.map((id) => BY_ID.get(id)).filter((c): c is ColumnDef => !!c);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/columns.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/columns.ts src/lib/columns.test.ts
git commit -m "Add column registry (metadata + ordering helper)"
```

---

## Task 2: Sort by position + default direction

**Files:**

- Modify: `src/types.ts` (add `"pos"` to `SortKey`)
- Modify: `src/lib/ranking.ts` (add `pos` case; export `defaultSortAsc`)
- Test: `src/lib/ranking.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/ranking.test.ts` (the file already has the `mk()` factory and imports from `./ranking`):

```ts
describe("sort additions for clickable headers", () => {
  it("sorts by position, then overall rank within a position", () => {
    const players = [
      mk({ id: "wr1", position: "WR", overallRank: 3 }),
      mk({ id: "rb2", position: "RB", overallRank: 4 }),
      mk({ id: "rb1", position: "RB", overallRank: 1 }),
      mk({ id: "qb1", position: "QB", overallRank: 2 }),
    ];
    const ids = sortPlayers(players, "pos", true).map((p) => p.id);
    expect(ids).toEqual(["qb1", "rb1", "rb2", "wr1"]);
  });

  it("descending pos reverses the position groups", () => {
    const players = [
      mk({ id: "qb1", position: "QB", overallRank: 1 }),
      mk({ id: "wr1", position: "WR", overallRank: 2 }),
    ];
    const ids = sortPlayers(players, "pos", false).map((p) => p.id);
    expect(ids).toEqual(["wr1", "qb1"]);
  });

  it("defaultSortAsc: value columns default descending, others ascending", () => {
    expect(defaultSortAsc("vor")).toBe(false);
    expect(defaultSortAsc("name")).toBe(true);
    expect(defaultSortAsc("adp")).toBe(true);
    expect(defaultSortAsc("overall")).toBe(true);
    expect(defaultSortAsc("pos")).toBe(true);
  });
});
```

Add `defaultSortAsc` to the existing import block at the top of `src/lib/ranking.test.ts`:

```ts
import {
  reassignOverallRanks,
  computePositionalRanks,
  groupByTier,
  sortPlayers,
  moveAndRetier,
  normalizeTiers,
  moveTier,
  splitTierAt,
  removeTier,
  moveIntoNewTier,
  orderByAdp,
  defaultSortAsc,
} from "./ranking";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/ranking.test.ts`
Expected: FAIL — `defaultSortAsc` is not exported; `"pos"` not assignable to `SortKey`.

- [ ] **Step 3: Implement**

In `src/types.ts`, extend `SortKey`:

```ts
export type SortKey = "overall" | "adp" | "name" | "bye" | "vor" | "pos";
```

In `src/lib/ranking.ts`, add the `pos` case inside `sortPlayers`'s `switch (key)` (place it next to `"name"`):

```ts
      case "pos":
        return (
          a.position.localeCompare(b.position) * dir ||
          (a.overallRank - b.overallRank)
        );
```

Then append this exported helper at the end of `src/lib/ranking.ts`:

```ts
// Default sort direction for a freshly-clicked header. Value-better numeric
// columns (VOR) start descending; identity/ordinal columns start ascending.
export function defaultSortAsc(key: SortKey): boolean {
  return key !== "vor";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/ranking.test.ts`
Expected: PASS (existing tests + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/types.ts src/lib/ranking.ts src/lib/ranking.test.ts
git commit -m "Sort by position; defaultSortAsc helper"
```

---

## Task 3: Cell renderers extracted from PlayerRow

**Files:**

- Create: `src/components/board/cells.tsx`

This moves every `<td>` body out of `PlayerRow` into a renderer map keyed by `ColumnId`, with no behavior change. There is no standalone unit test here (the renderers need dnd/dispatch context); Task 4's RTL test and the existing suite cover it. The point of this task is the extraction.

- [ ] **Step 1: Create the renderer module**

```tsx
// src/components/board/cells.tsx
import type { Dispatch, ReactNode, CSSProperties } from "react";
import type { DraggableAttributes } from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import type { Player, Flag } from "../../types";
import type { Action } from "../../state/reducer";
import type { ColumnId } from "../../lib/columns";
import { nextDraftStatus } from "../../lib/draft";
import { injuryBadge } from "../../lib/injury";

// Everything a cell renderer might need beyond the player itself.
export interface CellCtx {
  positionalRank: number;
  vor: number | null;
  draggable: boolean;
  startsTier: boolean;
  onAddTier: (playerId: string, startsTier: boolean) => void;
  dispatch: Dispatch<Action>;
  dragAttributes: DraggableAttributes;
  dragListeners: SyntheticListenerMap | undefined;
}

const DRAFT_LABEL: Record<Player["draftStatus"], string> = {
  available: "·",
  mine: "✓",
  taken: "✕",
};

function upd(
  dispatch: Dispatch<Action>,
  id: string,
  patch: Partial<Omit<Player, "id" | "overallRank">>,
) {
  dispatch({ type: "update", id, patch });
}

function adpTitle(p: Player): string | undefined {
  if (!p.adpSources) return undefined;
  return (
    [
      p.adpSources.espn != null && `ESPN ${p.adpSources.espn.toFixed(1)}`,
      p.adpSources.ffc != null && `FFC ${p.adpSources.ffc.toFixed(1)}`,
    ]
      .filter(Boolean)
      .join(" · ") || undefined
  );
}

// One renderer per ColumnId. Each returns the <td> for that column.
export const CELL_RENDERERS: Record<
  ColumnId,
  (p: Player, ctx: CellCtx) => ReactNode
> = {
  mover: (p, ctx) => (
    <td className="mover">
      {ctx.draggable && (
        <>
          <button
            className="add-tier"
            title={
              ctx.startsTier
                ? "Add an empty tier above this player"
                : "Start a new tier here"
            }
            onClick={() => ctx.onAddTier(p.id, ctx.startsTier)}
          >
            ＋
          </button>
          <span
            className="drag-handle"
            {...ctx.dragAttributes}
            {...ctx.dragListeners}
          >
            ⠷
          </span>
        </>
      )}
    </td>
  ),
  draft: (p, ctx) => (
    <td className="draft-cell">
      <button
        className={`draft draft-${p.draftStatus}`}
        onClick={() =>
          upd(ctx.dispatch, p.id, {
            draftStatus: nextDraftStatus(p.draftStatus),
          })
        }
        title={p.draftStatus}
      >
        {DRAFT_LABEL[p.draftStatus]}
      </button>
    </td>
  ),
  flag: (p, ctx) => {
    const cycle = () => {
      const next: Flag =
        p.flag === "none" ? "target" : p.flag === "target" ? "avoid" : "none";
      upd(ctx.dispatch, p.id, { flag: next });
    };
    return (
      <td className="flag-cell">
        <button
          className={`flag flag-${p.flag}`}
          onClick={cycle}
          title={p.flag}
        >
          {p.flag === "target" ? "★" : p.flag === "avoid" ? "⚑" : "·"}
        </button>
      </td>
    );
  },
  rank: (p) => <td className="rank num">{p.overallRank}</td>,
  name: (p, ctx) => {
    const inj = injuryBadge(p.injuryStatus);
    return (
      <td className="name-cell" title={p.name}>
        {p.name}
        {inj && (
          <span
            className={`inj inj-${inj.severity}`}
            title={`${inj.label} — ${inj.description}`}
          >
            {inj.code}
          </span>
        )}
      </td>
    );
  },
  pos: (p, ctx) => (
    <td className="pos num">
      {p.position}
      {ctx.positionalRank}
    </td>
  ),
  team: (p) => <td className="team num">{p.team}</td>,
  adp: (p) => (
    <td className="adp num" title={adpTitle(p)}>
      {p.adp == null ? "" : Number(p.adp.toFixed(1))}
    </td>
  ),
  vor: (_p, ctx) => (
    <td className="vor num">
      {ctx.vor == null ? "—" : ctx.vor > 0 ? `+${ctx.vor}` : String(ctx.vor)}
    </td>
  ),
  bye: (p) => <td className="bye num">{p.byeWeek ?? ""}</td>,
  notes: (p, ctx) => (
    <td>
      <input
        className="notes"
        value={p.notes}
        onChange={(e) => upd(ctx.dispatch, p.id, { notes: e.target.value })}
      />
    </td>
  ),
};
```

> Note: the `SyntheticListenerMap` import path matches dnd-kit's published types. If TypeScript can't resolve it, fall back to `import type { SyntheticListenerMap } from "@dnd-kit/core";` — dnd-kit re-exports it from the package root.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors). If the `SyntheticListenerMap` import fails, apply the fallback in the note above and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/components/board/cells.tsx
git commit -m "Extract per-column cell renderers from PlayerRow"
```

---

## Task 4: Registry-driven PlayerRow + RTL anchor test

**Files:**

- Modify: `src/components/PlayerRow.tsx`
- Create: `src/components/board/ColumnHeader.tsx`
- Create: `src/components/board/ColumnHeader.test.tsx`

- [ ] **Step 1: Write the ColumnHeader component**

```tsx
// src/components/board/ColumnHeader.tsx
import type { ColumnDef } from "../../lib/columns";
import type { SortKey } from "../../types";

interface Props {
  columns: ColumnDef[];
  sortKey: SortKey | null; // null => grouped by tier
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
}

export function ColumnHeader({ columns, sortKey, sortAsc, onSort }: Props) {
  return (
    <tr>
      {columns.map((c) => {
        const sorted = c.sortable && c.sortKey === sortKey;
        const cls =
          `col-${c.id}` +
          (c.sortable ? " sortable" : "") +
          (sorted ? " sorted" : "");
        return (
          <th
            key={c.id}
            className={cls}
            onClick={
              c.sortable && c.sortKey ? () => onSort(c.sortKey!) : undefined
            }
            aria-sort={
              sorted ? (sortAsc ? "ascending" : "descending") : undefined
            }
          >
            {c.label}
            {c.sortable && (
              <span className="sort-arrow">
                {sorted ? (sortAsc ? " ▲" : " ▼") : ""}
              </span>
            )}
          </th>
        );
      })}
    </tr>
  );
}
```

- [ ] **Step 2: Write the failing RTL test**

```tsx
// src/components/board/ColumnHeader.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ColumnHeader } from "./ColumnHeader";
import { orderedColumns, DEFAULT_COLUMN_ORDER } from "../../lib/columns";

function renderHeader(props: Partial<Parameters<typeof ColumnHeader>[0]> = {}) {
  const onSort = vi.fn();
  render(
    <table>
      <thead>
        <ColumnHeader
          columns={orderedColumns(DEFAULT_COLUMN_ORDER)}
          sortKey={null}
          sortAsc={true}
          onSort={onSort}
          {...props}
        />
      </thead>
    </table>,
  );
  return { onSort };
}

describe("ColumnHeader", () => {
  it("renders the labelled headers in registry order", () => {
    renderHeader();
    const headers = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent?.trim());
    expect(headers).toEqual([
      "",
      "Draft",
      "★/⚑",
      "#",
      "Player",
      "Pos",
      "Team",
      "ADP",
      "VOR",
      "Bye",
      "Notes",
    ]);
  });

  it("clicking a sortable header fires onSort with its key", () => {
    const { onSort } = renderHeader();
    fireEvent.click(screen.getByText("ADP"));
    expect(onSort).toHaveBeenCalledWith("adp");
  });

  it("does not fire onSort for a non-sortable header", () => {
    const { onSort } = renderHeader();
    fireEvent.click(screen.getByText("Team"));
    expect(onSort).not.toHaveBeenCalled();
  });

  it("marks the active sorted header with a direction arrow", () => {
    renderHeader({ sortKey: "vor", sortAsc: false });
    expect(screen.getByText("VOR").closest("th")).toHaveClass("sorted");
    expect(screen.getByText("VOR").closest("th")?.textContent).toContain("▼");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/board/ColumnHeader.test.tsx`
Expected: FAIL — `toHaveClass` matcher unavailable (no jest-dom) OR assertions fail before component wired.

If `toHaveClass`/`toHaveAttribute` are unavailable, replace those two matchers with plain DOM checks (no new dependency):

```tsx
const th = screen.getByText("VOR").closest("th")!;
expect(th.className).toContain("sorted");
expect(th.textContent).toContain("▼");
```

Re-run; expected: now fails only if the component is wrong, not on matchers.

- [ ] **Step 4: Verify it passes**

Run: `npx vitest run src/components/board/ColumnHeader.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Rewrite PlayerRow to render cells from the registry**

Replace the body of `src/components/PlayerRow.tsx` with:

```tsx
import type { Dispatch } from "react";
import type { CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Player } from "../types";
import type { Action } from "../state/reducer";
import type { ColumnDef } from "../lib/columns";
import { rowState } from "../lib/rowState";
import { CELL_RENDERERS, type CellCtx } from "./board/cells";

interface Props {
  player: Player;
  columns: ColumnDef[];
  positionalRank: number;
  vor: number | null;
  draggable: boolean;
  startsTier: boolean;
  stripe: boolean; // zebra: true => the lighter band
  onAddTier: (playerId: string, startsTier: boolean) => void;
  dispatch: Dispatch<Action>;
}

export function PlayerRow({
  player,
  columns,
  positionalRank,
  vor,
  draggable,
  startsTier,
  stripe,
  onAddTier,
  dispatch,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id, disabled: !draggable });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const ctx: CellCtx = {
    positionalRank,
    vor,
    draggable,
    startsTier,
    onAddTier,
    dispatch,
    dragAttributes: attributes,
    dragListeners: listeners,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={
        `row prow state-${rowState(player.draftStatus, player.flag)}` +
        (stripe ? " lite" : "")
      }
    >
      {columns.map((c) => (
        <CellSlot key={c.id} id={c.id} player={player} ctx={ctx} />
      ))}
    </tr>
  );
}
```

`CELL_RENDERERS` is a map of _functions_ (not components), so wrap each call in a tiny `CellSlot` component to give React a keyable element. Add this `ColumnId` import to the import block at the top of the file:

```tsx
import type { ColumnId } from "../lib/columns";
```

and add this helper at the bottom of `src/components/PlayerRow.tsx`:

```tsx
function CellSlot({
  id,
  player,
  ctx,
}: {
  id: ColumnId;
  player: Player;
  ctx: CellCtx;
}) {
  return <>{CELL_RENDERERS[id](player, ctx)}</>;
}
```

- [ ] **Step 6: Type-check and run the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS. `PlayerTable` will still pass `PlayerRow` the old props until Task 5 — TypeScript will flag the missing `columns`/`stripe` props at the `PlayerTable` call site; that's expected and fixed in Task 5. If you want a green checkpoint now, proceed directly to Task 5 before committing (these two tasks land together).

- [ ] **Step 7: Commit (after Task 5 makes the tree compile)**

Deferred to Task 5's commit.

---

## Task 5: PlayerTable drives header + zebra + dynamic colSpan

**Files:**

- Modify: `src/components/PlayerTable.tsx`
- Modify: `src/components/TierGroup.tsx`

- [ ] **Step 1: Rewrite TierGroup's header as a full-width banner**

Replace `src/components/TierGroup.tsx` with:

```tsx
import { useDroppable } from "@dnd-kit/core";

interface TierHeaderProps {
  tier: number;
  displayTier: number;
  count: number; // players in this tier
  colSpan: number; // number of visible columns
  editable: boolean;
  onRemove: (tier: number) => void;
}

export function TierHeader({
  tier,
  displayTier,
  count,
  colSpan,
  editable,
  onRemove,
}: TierHeaderProps) {
  return (
    <tr className="tier-divider">
      <td colSpan={colSpan}>
        <div className="tier-banner">
          <span className="tier-label">Tier {displayTier}</span>
          <span className="tier-count">
            · {count} player{count === 1 ? "" : "s"}
          </span>
          {editable && tier !== 1 && (
            <span className="tier-tools">
              <button
                className="tier-remove"
                title="Remove tier — its players merge into the tier above"
                onClick={() => onRemove(tier)}
              >
                ✕
              </button>
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}

interface EmptyTierProps {
  anchorId: string;
  displayTier: number;
  colSpan: number;
  onRemove: (anchorId: string) => void;
}

export function EmptyTier({
  anchorId,
  displayTier,
  colSpan,
  onRemove,
}: EmptyTierProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `empty:${anchorId}` });
  return (
    <tr
      ref={setNodeRef}
      className={`tier-divider empty-tier${isOver ? " drop-over" : ""}`}
    >
      <td colSpan={colSpan}>
        <div className="tier-banner">
          <span className="tier-label">
            Tier {displayTier} · empty — drop a player here
          </span>
          <span className="tier-tools">
            <button
              className="tier-remove"
              title="Discard this empty tier"
              onClick={() => onRemove(anchorId)}
            >
              ✕
            </button>
          </span>
        </div>
      </td>
    </tr>
  );
}
```

- [ ] **Step 2: Rewrite PlayerTable to use the registry, header, and zebra**

Replace `src/components/PlayerTable.tsx` with:

```tsx
import type { Dispatch } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Player, SortKey } from "../types";
import type { Action } from "../state/reducer";
import type { ColumnDef } from "../lib/columns";
import { PlayerRow } from "./PlayerRow";
import { TierHeader, EmptyTier } from "./TierGroup";
import { ColumnHeader } from "./board/ColumnHeader";

export type DisplayGroup =
  | { kind: "tier"; tier: number; displayTier: number; players: Player[] }
  | { kind: "empty"; anchorId: string; displayTier: number };

interface Props {
  columns: ColumnDef[];
  grouped: boolean;
  display: DisplayGroup[];
  flat: Player[];
  positionalRanks: Record<string, number>;
  vorById: Record<string, number | null>;
  sortKey: SortKey | null;
  sortAsc: boolean;
  onSort: (key: SortKey) => void;
  dispatch: Dispatch<Action>;
  reorderable: boolean;
  onAddTier: (playerId: string, startsTier: boolean) => void;
  onRemoveEmpty: (anchorId: string) => void;
}

export function PlayerTable({
  columns,
  grouped,
  display,
  flat,
  positionalRanks,
  vorById,
  sortKey,
  sortAsc,
  onSort,
  dispatch,
  reorderable,
  onAddTier,
  onRemoveEmpty,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const colSpan = columns.length;

  const orderedIds: string[] = [];
  if (grouped) {
    for (const g of display) {
      if (g.kind === "tier") g.players.forEach((p) => orderedIds.push(p.id));
    }
  } else {
    flat.forEach((p) => orderedIds.push(p.id));
  }

  const onDragEnd = (e: DragEndEvent) => {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over || active === over) return;
    if (over.startsWith("empty:")) {
      const anchorId = over.slice(6);
      dispatch({
        type: "moveIntoNewTier",
        playerId: active,
        beforeId: anchorId,
      });
      onRemoveEmpty(anchorId);
      return;
    }
    dispatch({ type: "move", activeId: active, overId: over });
  };

  // stripe index resets per tier so the first row under each banner is dark.
  const renderRow = (p: Player, startsTier: boolean, stripe: boolean) => (
    <PlayerRow
      key={p.id}
      player={p}
      columns={columns}
      positionalRank={positionalRanks[p.id]}
      vor={vorById[p.id] ?? null}
      draggable={reorderable}
      startsTier={startsTier}
      stripe={stripe}
      onAddTier={onAddTier}
      dispatch={dispatch}
    />
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <table className="players">
        <thead>
          <ColumnHeader
            columns={columns}
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={onSort}
          />
        </thead>
        <tbody>
          <SortableContext
            items={orderedIds}
            strategy={verticalListSortingStrategy}
          >
            {grouped
              ? display.map((g) =>
                  g.kind === "empty" ? (
                    <EmptyTier
                      key={`empty:${g.anchorId}`}
                      anchorId={g.anchorId}
                      displayTier={g.displayTier}
                      colSpan={colSpan}
                      onRemove={onRemoveEmpty}
                    />
                  ) : (
                    <TierBlock
                      key={`tier:${g.tier}`}
                      group={g}
                      colSpan={colSpan}
                      editable={reorderable}
                      dispatch={dispatch}
                      renderRow={renderRow}
                    />
                  ),
                )
              : flat.map((p, i) => renderRow(p, false, i % 2 === 1))}
          </SortableContext>
        </tbody>
      </table>
    </DndContext>
  );
}

function TierBlock({
  group,
  colSpan,
  editable,
  dispatch,
  renderRow,
}: {
  group: Extract<DisplayGroup, { kind: "tier" }>;
  colSpan: number;
  editable: boolean;
  dispatch: Dispatch<Action>;
  renderRow: (
    p: Player,
    startsTier: boolean,
    stripe: boolean,
  ) => React.ReactNode;
}) {
  return (
    <>
      <TierHeader
        tier={group.tier}
        displayTier={group.displayTier}
        count={group.players.length}
        colSpan={colSpan}
        editable={editable}
        onRemove={(t) => dispatch({ type: "removeTier", tier: t })}
      />
      {group.players.map((p, i) => renderRow(p, i === 0, i % 2 === 1))}
    </>
  );
}
```

- [ ] **Step 3: Type-check (App call site will still error — fixed in Task 6)**

Run: `npx tsc --noEmit`
Expected: errors only at the `PlayerTable` usage in `src/App.tsx` (missing `columns`, `sortAsc`, `onSort`). That's wired in Task 6. No errors inside `PlayerTable.tsx`, `PlayerRow.tsx`, `TierGroup.tsx`, `cells.tsx`.

- [ ] **Step 4: Commit (Tasks 3–5 together)**

```bash
git add src/components/PlayerRow.tsx src/components/PlayerTable.tsx src/components/TierGroup.tsx src/components/board/
git commit -m "Render board table from the column registry; full-width tier banner"
```

---

## Task 6: App wiring — sort direction + ↩ Tiers + remove Sort select

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/components/Toolbar.tsx`

- [ ] **Step 1: Add sort-direction state and column list in App**

In `src/App.tsx`, add imports near the other lib imports:

```tsx
import { orderedColumns, DEFAULT_COLUMN_ORDER } from "./lib/columns";
import { defaultSortAsc } from "./lib/ranking";
```

Add state next to the existing `const [sortKey, setSortKey] = useState<SortKey | null>(null);`:

```tsx
const [sortAsc, setSortAsc] = useState(true);
const columns = useMemo(() => orderedColumns(DEFAULT_COLUMN_ORDER), []);

const onSort = (key: SortKey) => {
  if (sortKey === key) {
    setSortAsc((a) => !a);
  } else {
    setSortKey(key);
    setSortAsc(defaultSortAsc(key));
  }
};
const onBackToTiers = () => setSortKey(null);
```

Update the `flat` memo to honor direction (it currently hardcodes `true`):

```tsx
const flat = useMemo(
  () => (grouped ? [] : sortPlayers(renderPlayers, sortKey!, sortAsc, vorById)),
  [grouped, renderPlayers, sortKey, sortAsc, vorById],
);
```

- [ ] **Step 2: Pass new props to PlayerTable**

In `src/App.tsx`, find the `<PlayerTable ... />` usage and add `columns`, `sortKey`, `sortAsc`, `onSort` (keep all existing props):

```tsx
<PlayerTable
  columns={columns}
  grouped={grouped}
  display={display}
  flat={flat}
  positionalRanks={positionalRanks}
  vorById={vorById}
  sortKey={sortKey}
  sortAsc={sortAsc}
  onSort={onSort}
  dispatch={dispatch}
  reorderable={reorderable}
  onAddTier={onAddTier}
  onRemoveEmpty={onRemoveEmpty}
/>
```

(Match the exact existing prop names already passed for `display`, `onAddTier`, `onRemoveEmpty`, etc. — only `columns`, `sortKey`, `sortAsc`, `onSort` are new.)

- [ ] **Step 3: Replace the Sort `<select>` with a ↩ Tiers button in the Toolbar**

In `src/components/Toolbar.tsx`, delete the entire `<label>Sort: <select>…</select></label>` block (the one with options `tier/overall/adp/name/bye/vor`). In the `Props` interface, remove `sortKey` and `setSortKey`, and add:

```tsx
  grouped: boolean;
  onBackToTiers: () => void;
```

Where the Sort select used to be, insert:

```tsx
<button
  className={grouped ? "tiers-btn active" : "tiers-btn"}
  onClick={props.onBackToTiers}
  title="Group by tier (default view)"
>
  ↩ Tiers
</button>
```

- [ ] **Step 4: Update the Toolbar usage in App**

In `src/App.tsx`, in the `<Toolbar ... />` usage remove `sortKey={sortKey}` and `setSortKey={setSortKey}` and add:

```tsx
grouped = { grouped };
onBackToTiers = { onBackToTiers };
```

Also update the `filtersActive` computation in `App.tsx` — it references `sortKey`; keep that (sorting still counts as an active filter for the "Clear filters" button). No change needed there beyond confirming it still compiles. The `onClearFilters` handler should also reset direction; find where it sets `setSortKey(null)` and add `setSortAsc(true)` beside it.

- [ ] **Step 5: Type-check, full suite, build**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all PASS, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/components/Toolbar.tsx
git commit -m "Wire sortable headers + ↩ Tiers button; drop Sort select"
```

---

## Task 7: CSS — tier banner, zebra, sortable headers, ↩ Tiers

**Files:**

- Modify: `src/index.css`

- [ ] **Step 1: Replace the `.tier-divider td` block** (currently around the tier styles) so the banner spans the row with an accent bar. Replace the existing `.tier-divider td { … }` rule with:

```css
.tier-divider td {
  padding: 0;
  background: transparent;
}
.tier-banner {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.32rem 0.6rem;
  background: var(--panel);
  border-left: 3px solid var(--otc-accent);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  font-size: 0.75rem;
  color: var(--text);
}
.tier-banner .tier-count {
  color: var(--muted);
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}
.tier-banner .tier-tools {
  margin-left: auto;
  text-transform: none;
  letter-spacing: 0;
}
```

Keep the existing `.empty-tier td` striped-background rule, but move its background onto `.empty-tier .tier-banner` so the banner (not the bare cell) shows the hatch:

```css
.empty-tier .tier-banner {
  color: var(--accent, #3b82f6);
  font-style: italic;
  text-transform: none;
  letter-spacing: 0;
  border-left-color: var(--accent, #3b82f6);
  background: repeating-linear-gradient(
    45deg,
    var(--panel),
    var(--panel) 8px,
    #1b2030 8px,
    #1b2030 16px
  );
}
```

- [ ] **Step 2: Add zebra striping** (append near the `table.players` rules):

```css
/* Subtle zebra. Stripe parity resets per tier (PlayerTable passes `stripe`),
   and the first row under each banner is the dark base so it doesn't blend
   into the brighter tier banner. */
tr.prow td {
  background: var(--bg);
}
tr.prow.lite td {
  background: #13161c;
}
tr.row:hover td {
  background: #1e2330;
}
```

- [ ] **Step 3: Add sortable-header + ↩ Tiers styles** (append):

```css
table.players th.sortable {
  cursor: pointer;
  user-select: none;
}
table.players th.sortable:hover {
  color: var(--text);
}
table.players th.sorted {
  color: var(--otc-accent);
}
.sort-arrow {
  font-size: 0.7em;
}
.tiers-btn {
  cursor: pointer;
  white-space: nowrap;
}
.tiers-btn.active {
  background: var(--otc-accent);
  border-color: var(--otc-accent);
  color: #1a0e09;
  font-weight: 600;
}
```

- [ ] **Step 4: Verify build + visual**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/index.css
git commit -m "Style tier banner, zebra striping, sortable headers, Tiers button"
```

---

## Task 8: Playwright smoke + final verification

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (note the localhost URL, typically `http://localhost:5173`).

- [ ] **Step 2: Smoke-check via Playwright MCP**

Verify each of the following on the running app:

1. Board loads grouped by tier; each tier shows a full-width accent-bar banner with a "· N players" count.
2. Player rows show subtle zebra striping; the first row directly under each tier banner is the darker band.
3. Clicking the **ADP** header sorts ascending (arrow ▲) and ungroups; clicking it again flips to ▼; clicking **VOR** starts descending (▼).
4. The **↩ Tiers** button is highlighted while grouped; after sorting, clicking it returns to the grouped view and re-highlights.
5. Drag-to-reorder still works in the grouped view; the row "+" still inserts a tier; draft/flag toggles and the notes input still work; the injury badge and ADP hover tooltip still render.
6. The old "Sort:" dropdown is gone from the toolbar.

- [ ] **Step 3: Full check**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: all green.

- [ ] **Step 4: Update the project status note**

Add a "Built" bullet to `~/Library/Mobile Documents/iCloud~md~obsidian/Documents/MainVault/WeDev/On The Clock/FF Draft Helper.md` recording: column-registry refactor, sortable headers replacing the Sort select, ↩ Tiers button, full-width accent-bar tier rows, per-tier zebra striping. Reference the spec + this plan.

- [ ] **Step 5: Final commit (if the status note lives in-repo it doesn't; this is the Obsidian vault, edited directly — no repo commit needed). Confirm the branch is clean:**

```bash
git status
```

Expected: clean working tree; all Phase 1 commits present.

---

## Self-Review notes (author)

- **Spec coverage (Phase 1 slice):** registry (§1) → Tasks 1,3,4,5; sortable headers + asc/desc + default direction + ↩ Tiers + remove Sort select (§3) → Tasks 2,4,6; full-width accent-bar tier rows + per-tier dark-first zebra (§8) → Tasks 5,7. New columns (§6), customization/persistence (§2), filters (§4), search (§5), refetch/guard/dev panel (§7,§9) are **out of scope for Phase 1** and get their own plans.
- **Type consistency:** `ColumnId`/`ColumnDef`/`orderedColumns` (Task 1) are used identically in Tasks 3–6; `CellCtx` (Task 3) matches the `ctx` built in `PlayerRow` (Task 4); `sortKey: SortKey | null` + `sortAsc: boolean` + `onSort(key)` are threaded consistently App→PlayerTable→ColumnHeader; `defaultSortAsc` (Task 2) is the single source of initial direction.
- **Known intentional red-checkpoints:** Task 4 leaves the tree non-compiling at the App call site until Task 5/6; this is called out explicitly and the commit is deferred to Task 5. This keeps each commit a coherent unit.
- **No behavior removed:** the dnd reorder, empty-tier drop, add-tier "+", Tier-1 lock, draft/flag/notes editing, injury badge, and ADP tooltip are all preserved by moving (not deleting) their JSX into `cells.tsx`/`TierGroup.tsx`.

```

```
