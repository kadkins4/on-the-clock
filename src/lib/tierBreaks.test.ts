import { describe, it, expect } from "vitest";
import type { Player } from "../types";
import { breaksFromTiers, tiersFromBreaks } from "./tierBreaks";

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
