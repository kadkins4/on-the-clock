# Draggable Tier Break (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user grab a tier break (the "Tier N" bar) and drag it through the player list; only the bar moves and the players it crosses change tier.

**Architecture:** Phase 1 already made breaks first-class sortable items and made `applyDrag(players, breaks, activeId, overId)` symmetric (it `arrayMove`s over the interleaved player+break list and recomputes each break's `above`). So a break-as-active drag already produces the right state. The only code change is making `TierBreakRow` grabbable: attach the `useSortable` `attributes`/`listeners` to a `⠿` grip in the bar and apply the dragging style. Tasks 1–2 lock the existing data behavior with tests; Task 3 wires the UI; Task 4 verifies live.

**Tech Stack:** React 19 + TypeScript, dnd-kit (`@dnd-kit/core`, `@dnd-kit/sortable`), Vitest 4, Vite.

**Spec:** `docs/superpowers/specs/2026-06-04-draggable-tier-break-design.md`

---

## Conventions

- Single test file: `npx vitest run src/lib/tierBreaks.test.ts`
- Whole suite: `npx vitest run`
- Typecheck: `npx tsc --noEmit`
- Commit trailer:
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```

---

## File Structure

- **Modify** `src/lib/tierBreaks.test.ts` — add `applyDrag` cases with a break as the active item (characterization of existing behavior).
- **Modify** `src/state/reducer.test.ts` — add a `move` test whose `activeId` is a break id.
- **Modify** `src/components/TierGroup.tsx` — `TierBreakRow` attaches drag listeners to a grip + dragging style.
- **Modify** `src/index.css` — minor grip spacing.

No new files; no reducer/`applyDrag`/`PlayerTable` changes.

---

## Task 1: Lock break-as-active drag behavior (`tierBreaks.test.ts`)

These exercise the existing symmetric `applyDrag` with a break as `activeId`. They are expected to PASS against current code — they pin the behavior so a future change can't silently break it. If any test is RED, `applyDrag` has a real gap: STOP and report rather than editing the test.

**Files:**

- Test: `src/lib/tierBreaks.test.ts`

- [ ] **Step 1: Add the test block**

The file already has the `P(id, rank, tier)` helper and imports `applyDrag`. Append:

```typescript
describe("applyDrag — dragging a BREAK (Phase 2)", () => {
  // players a..e; one break with 3 players above it (between c and d)
  const players = () => [
    P("a", 1, 1),
    P("b", 2, 1),
    P("c", 3, 1),
    P("d", 4, 2),
    P("e", 5, 2),
  ];

  it("dragging a break up onto a player drops its `above`; players don't reorder", () => {
    // drag break x (above 3) onto player b => break lands above b => above 1
    const out = applyDrag(players(), [{ id: "x", above: 3 }], "x", "b");
    expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(out.breaks).toEqual([{ id: "x", above: 1 }]);
    // a stays tier 1; b and c (the crossed players) are now tier 2
    expect(out.players.map((p) => p.tier)).toEqual([1, 2, 2, 2, 2]);
  });

  it("dragging a break onto the first player makes an empty top tier (above 0)", () => {
    const out = applyDrag(players(), [{ id: "x", above: 3 }], "x", "a");
    expect(out.breaks).toEqual([{ id: "x", above: 0 }]);
    expect(out.players.map((p) => p.tier)).toEqual([2, 2, 2, 2, 2]);
  });

  it("dragging a break onto another break leaves an empty tier (adjacent breaks)", () => {
    // breaks x(above 2) and y(above 3); drag x onto y
    const four = [P("a", 1, 1), P("b", 2, 1), P("c", 3, 2), P("d", 4, 3)];
    const out = applyDrag(
      four,
      [
        { id: "x", above: 2 },
        { id: "y", above: 3 },
      ],
      "x",
      "y",
    );
    expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(out.breaks.map((b) => b.above).sort((m, n) => m - n)).toEqual([
      3, 3,
    ]);
    expect(out.players.map((p) => p.tier)).toEqual([1, 1, 1, 3]);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx vitest run src/lib/tierBreaks.test.ts`
Expected: PASS (all, including the new block). If RED, STOP and report — do not modify `applyDrag` or the expectations without escalating.

- [ ] **Step 3: Commit**

```bash
git add src/lib/tierBreaks.test.ts
git commit -m "Test break-as-active drag (Phase 2 behavior lock)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Reducer routes a break drag through `move` (`reducer.test.ts`)

**Files:**

- Test: `src/state/reducer.test.ts`

- [ ] **Step 1: Add a test to the `boardReducer` describe block**

The file already imports `boardReducer` and has `mk(id, over, tier)`. Add inside `describe("boardReducer", …)`:

```typescript
it("move with a break id as activeId re-tiers without reordering players", () => {
  const out = boardReducer(
    {
      players: [mk("a", 1), mk("b", 2), mk("c", 3)],
      breaks: [{ id: "br1", above: 2 }],
    },
    { type: "move", activeId: "br1", overId: "a" },
  );
  expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c"]);
  expect(out.breaks).toEqual([{ id: "br1", above: 0 }]);
});
```

- [ ] **Step 2: Run**

Run: `npx vitest run src/state/reducer.test.ts`
Expected: PASS. If RED, STOP and report.

- [ ] **Step 3: Commit**

```bash
git add src/state/reducer.test.ts
git commit -m "Test move action with a break id

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Make the tier break grabbable (`TierGroup.tsx` + `index.css`)

**Files:**

- Modify: `src/components/TierGroup.tsx` (the `TierBreakRow` component)
- Modify: `src/index.css`

- [ ] **Step 1: Attach drag listeners + dragging style in `TierBreakRow`**

In `src/components/TierGroup.tsx`, replace the entire `TierBreakRow` function (currently lines ~47–97, the version whose comment says "Phase 1: it shifts … no drag handle") with:

```tsx
interface TierBreakRowProps {
  breakId: string;
  displayTier: number;
  count: number; // players in the tier BELOW this break
  colSpan: number;
  editable: boolean;
  onRemove: (breakId: string) => void;
}

// A tier boundary that participates in the sortable list. When editable, it can
// be grabbed by its ⠿ handle and dragged through the player list — only the
// break moves, re-tiering the players it crosses (players never reorder).
export function TierBreakRow({
  breakId,
  displayTier,
  count,
  colSpan,
  editable,
  onRemove,
}: TierBreakRowProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: breakId, disabled: !editable });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <tr ref={setNodeRef} style={style} className="tier-divider">
      <td colSpan={colSpan}>
        <div className="tier-banner">
          {editable && (
            <span
              className="tier-grip drag-handle"
              title="Drag to move this tier break"
              {...attributes}
              {...listeners}
            >
              ⠿
            </span>
          )}
          <span className="tier-label">Tier {displayTier}</span>
          <span className="tier-count">
            {count > 0
              ? ` · ${count} player${count === 1 ? "" : "s"}`
              : " · empty"}
          </span>
          {editable && (
            <span className="tier-tools">
              <button
                className="tier-remove"
                title="Remove this tier break"
                onClick={() => onRemove(breakId)}
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
```

Notes: `disabled: !editable` means the break is only draggable when the board is editable (grouped + reorderable), matching player rows. The `✕` button stays outside the grip so clicking it doesn't start a drag.

- [ ] **Step 2: Add grip spacing CSS**

In `src/index.css`, immediately after the `.drag-handle` rule (ends ~line 601), add:

```css
.tier-grip {
  margin-right: 0.15rem;
  font-size: 0.8rem;
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS. (`attributes`, `listeners`, `isDragging` are now read from `useSortable`; `CSSProperties` is already imported.)

- [ ] **Step 4: Run the whole suite**

Run: `npx vitest run`
Expected: PASS (no logic changed; component still renders).

- [ ] **Step 5: Commit**

```bash
git add src/components/TierGroup.tsx src/index.css
git commit -m "Make tier breaks draggable by their grip handle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Manual browser verification

**Files:** none.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (note the localhost URL).

- [ ] **Step 2: Drag a tier bar up**

Grab a Tier bar by its `⠿` grip and drag it up past one or two players. Expected:
the bar moves, the crossed players do NOT move but join the lower tier; the
players above the new bar position stay in the upper tier. No player reorders.

- [ ] **Step 3: Edge cases**

- Drag a bar to the very top → an empty Tier 1 appears (allowed).
- Drag a bar down past players → the upper tier grows.
- Confirm the `✕` still removes a break and `+` still splits, and that clicking
  `✕` does not initiate a drag.

- [ ] **Step 4: Persistence**

Reload the page; the moved boundary persists (breaks are saved).

- [ ] **Step 5: Report results** in the conversation.

---

## Self-Review (plan author)

- **Spec coverage:** grabbable bar via grip + listeners + dragging style (Task 3) · no reducer/`applyDrag`/`onDragEnd` change, verified by tests (Tasks 1–2) · break-active edges: up-past-players, to-top empty tier, onto-another-break empty tier (Task 1) · reducer `move` with break id (Task 2) · Tier 1 top label non-draggable (unchanged `topHeader`; `TierBreakRow` only renders for real breaks) · persistence (Task 4). Out-of-scope whole-tier swap is not included. All spec items covered.
- **Placeholder scan:** none — every code/test step has complete code and exact commands.
- **Type consistency:** `Break = {id, above}`, `applyDrag` signature, `BoardState`, `move` action, and `TierBreakRowProps` match Phase 1 definitions and the current source. The grip reuses the existing `.drag-handle` class plus a new `.tier-grip`.
- **Note:** Tasks 1–2 assert PASS against existing code (behavior lock), which is intentional and called out; a RED result there is a signal to stop, not to edit expectations.
