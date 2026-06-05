import { describe, it, expect } from "vitest";
import type { Player } from "../types";
import {
  breaksFromTiers,
  tiersFromBreaks,
  buildItems,
  applyDrag,
  moveToRank,
  insertBreak,
  removeBreak,
  type Item,
} from "./tierBreaks";

// Minimal players: only id/overallRank/tier matter here.
function P(id: string, rank: number, tier: number): Player {
  return {
    id,
    name: id,
    position: "RB",
    team: "FA",
    overallRank: rank,
    byeWeek: null,
    tier,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  } as Player;
}

describe("breaksFromTiers", () => {
  it("emits one break at each tier boundary (above = index of first player)", () => {
    const players = [P("a", 1, 1), P("b", 2, 1), P("c", 3, 2), P("d", 4, 3)];
    const breaks = breaksFromTiers(players);
    expect(breaks.map((b) => b.above)).toEqual([2, 3]);
    expect(breaks.every((b) => typeof b.id === "string" && b.id)).toBe(true);
  });

  it("returns no breaks for a single tier", () => {
    expect(breaksFromTiers([P("a", 1, 1), P("b", 2, 1)])).toEqual([]);
  });
});

describe("tiersFromBreaks", () => {
  it("derives tier = 1 + count(above <= index)", () => {
    const players = [P("a", 1, 9), P("b", 2, 9), P("c", 3, 9), P("d", 4, 9)];
    const breaks = [
      { id: "x", above: 2 },
      { id: "y", above: 3 },
    ];
    const out = tiersFromBreaks(players, breaks);
    expect(out.map((p) => p.tier)).toEqual([1, 1, 2, 3]);
  });

  it("counts empty tiers in the numbering (duplicate above)", () => {
    const players = [P("a", 1, 1), P("b", 2, 1)];
    const breaks = [
      { id: "x", above: 1 },
      { id: "y", above: 1 },
    ];
    // a is above both breaks (tier 1); b is below both (tier 3); tier 2 empty.
    expect(tiersFromBreaks(players, breaks).map((p) => p.tier)).toEqual([1, 3]);
  });

  it("round-trips: breaksFromTiers then tiersFromBreaks preserves contiguous tiers", () => {
    const players = [P("a", 1, 1), P("b", 2, 2), P("c", 3, 2), P("d", 4, 3)];
    const out = tiersFromBreaks(players, breaksFromTiers(players));
    expect(out.map((p) => p.tier)).toEqual([1, 2, 2, 3]);
  });
});

describe("buildItems", () => {
  const players = [P("a", 1, 1), P("b", 2, 1), P("c", 3, 2)];

  it("interleaves breaks before the player at their `above` index", () => {
    const items = buildItems(players, [{ id: "x", above: 2 }]);
    expect(items).toEqual<Item[]>([
      { kind: "player", id: "a" },
      { kind: "player", id: "b" },
      { kind: "break", id: "x" },
      { kind: "player", id: "c" },
    ]);
  });

  it("emits a top break (above 0) before all players", () => {
    const items = buildItems(players, [{ id: "t", above: 0 }]);
    expect(items[0]).toEqual({ kind: "break", id: "t" });
  });

  it("emits a trailing break (above = N) after all players", () => {
    const items = buildItems(players, [{ id: "z", above: 3 }]);
    expect(items[items.length - 1]).toEqual({ kind: "break", id: "z" });
  });

  it("keeps duplicate breaks adjacent (empty tier)", () => {
    const items = buildItems(players, [
      { id: "x", above: 2 },
      { id: "y", above: 2 },
    ]);
    const ids = items.map((i) => i.id);
    expect(ids).toEqual(["a", "b", "x", "y", "c"]);
  });
});

describe("applyDrag", () => {
  // [a b][break][c d]  (above=2)
  const players = [P("a", 1, 1), P("b", 2, 1), P("c", 3, 2), P("d", 4, 2)];
  const breaks = () => [{ id: "x", above: 2 }];

  it("dragging the last player of tier1 onto the break moves the BREAK up, not the player order", () => {
    const out = applyDrag(players, breaks(), "b", "x");
    expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(out.breaks.map((bk) => bk.above)).toEqual([1]);
    expect(out.players.map((p) => p.tier)).toEqual([1, 2, 2, 2]);
  });

  it("dragging the first player of tier2 onto the break moves the break DOWN, player order unchanged", () => {
    const out = applyDrag(players, breaks(), "c", "x");
    expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
    expect(out.breaks.map((bk) => bk.above)).toEqual([3]);
    expect(out.players.map((p) => p.tier)).toEqual([1, 1, 1, 2]);
  });

  it("dragging a player fully past a neighbor reorders the players", () => {
    const out = applyDrag(players, breaks(), "a", "c");
    expect(out.players.map((p) => p.id)).toEqual(["b", "c", "a", "d"]);
  });

  it("dragging the only player out of its tier leaves an empty tier (adjacent breaks)", () => {
    const three = [P("a", 1, 1), P("b", 2, 2), P("c", 3, 3)];
    const br = [
      { id: "x", above: 1 },
      { id: "y", above: 2 },
    ];
    const out = applyDrag(three, br, "b", "x");
    expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c"]);
    const aboves = out.breaks.map((bk) => bk.above).sort((m, n) => m - n);
    expect(aboves).toEqual([2, 2]);
  });

  it("is a no-op when active === over", () => {
    const out = applyDrag(players, breaks(), "a", "a");
    expect(out.players.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });
});

describe("insertBreak", () => {
  const players = [P("a", 1, 1), P("b", 2, 1), P("c", 3, 1)];

  it("inserts a break above the given player (splitting a tier)", () => {
    const out = insertBreak(players, [], "b"); // above index 1
    expect(out.breaks.map((bk) => bk.above)).toEqual([1]);
    expect(out.players.map((p) => p.tier)).toEqual([1, 2, 2]);
  });

  it("inserting above a player that already starts a tier creates an empty tier", () => {
    const withBreak = [{ id: "x", above: 1 }];
    const out = insertBreak(players, withBreak, "b"); // duplicate above=1
    expect(out.breaks.map((bk) => bk.above).sort()).toEqual([1, 1]);
    expect(out.players.map((p) => p.tier)).toEqual([1, 3, 3]);
  });
});

describe("removeBreak", () => {
  it("removes the break by id and re-derives tiers", () => {
    const players = [P("a", 1, 1), P("b", 2, 2)];
    const out = removeBreak(players, [{ id: "x", above: 1 }], "x");
    expect(out.breaks).toEqual([]);
    expect(out.players.map((p) => p.tier)).toEqual([1, 1]);
  });
});

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

describe("moveToRank", () => {
  // moveToRank returns players already in rank order, so .map(id) reads the order.
  const five = () => [
    P("a", 1, 1),
    P("b", 2, 1),
    P("c", 3, 2),
    P("d", 4, 2),
    P("e", 5, 3),
  ];
  const ids = (s: { players: Player[] }) => s.players.map((p) => p.id);

  it("moves a player down, shifting the rest up", () => {
    const out = moveToRank(five(), [], "a", 4);
    expect(ids(out)).toEqual(["b", "c", "d", "a", "e"]);
    expect(out.players.map((p) => p.overallRank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("moves a player up, shifting the rest down", () => {
    expect(ids(moveToRank(five(), [], "e", 1))).toEqual([
      "e",
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("clamps ranks above N and below 1", () => {
    expect(ids(moveToRank(five(), [], "a", 99))).toEqual([
      "b",
      "c",
      "d",
      "e",
      "a",
    ]);
    expect(ids(moveToRank(five(), [], "e", -3))).toEqual([
      "e",
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("is a no-op for the same rank or an unknown id", () => {
    expect(ids(moveToRank(five(), [], "a", 1))).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
    const same = five();
    expect(moveToRank(same, [], "zzz", 2).players).toBe(same);
  });

  it("keeps breaks fixed so a moved player adopts the destination tier", () => {
    const breaks = [{ id: "x", above: 2 }]; // tier 1 = ranks 1-2, tier 2 = 3..5
    const out = moveToRank(five(), breaks, "a", 4);
    expect(out.breaks.map((b) => b.above)).toEqual([2]); // unchanged
    const moved = out.players.find((p) => p.id === "a")!;
    expect(moved.overallRank).toBe(4);
    expect(moved.tier).toBe(2);
  });
});
