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
    const order = ["name", "bogus" as ColumnId] as ColumnId[];
    expect(orderedColumns(order).map((c) => c.id)).toEqual(["name"]);
  });

  it("every sortable column declares a sortKey", () => {
    for (const c of COLUMN_DEFS) {
      if (c.sortable) expect(c.sortKey).toBeTruthy();
    }
  });
});
