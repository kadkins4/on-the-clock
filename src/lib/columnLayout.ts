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
// any registry ids missing from order at their default index, drop hidden ids
// that are unknown or locked (locked stay visible).
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
