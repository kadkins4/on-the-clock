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
  it("is the full registry order with VOR and last-season hidden by default", () => {
    expect(DEFAULT_LAYOUT.order).toEqual(DEFAULT_COLUMN_ORDER);
    // Extra/advanced columns ship off by default; toggle on via ⚙ Columns.
    expect([...DEFAULT_LAYOUT.hidden].sort()).toEqual(["last", "vor"]);
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
    // "bye" is visible by default, so toggling adds then removes it.
    const a = toggleHidden(DEFAULT_LAYOUT, "bye");
    expect(a.hidden).toContain("bye");
    expect(toggleHidden(a, "bye").hidden).not.toContain("bye");
  });
  it("refuses to hide a locked column", () => {
    expect(toggleHidden(DEFAULT_LAYOUT, "name").hidden).not.toContain("name");
  });
});

describe("reorder", () => {
  it("moves a column before a target", () => {
    const out = reorder(DEFAULT_LAYOUT, "bye", "adp"); // bye lands before adp
    const i = out.order.indexOf("bye");
    const j = out.order.indexOf("adp");
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
    expect(folded.order).toContain("proj"); // registry column missing from order
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
