import { describe, it, expect } from "vitest";
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
} from "./ranking";
import type { Player } from "../types";

function mk(partial: Partial<Player> & { id: string }): Player {
  return {
    id: partial.id,
    name: partial.name ?? partial.id,
    position: partial.position ?? "RB",
    team: partial.team ?? "FA",
    overallRank: partial.overallRank ?? 0,
    byeWeek: partial.byeWeek ?? null,
    tier: partial.tier ?? null,
    adp: partial.adp ?? null,
    notes: partial.notes ?? "",
    flag: partial.flag ?? "none",
    draftStatus: partial.draftStatus ?? "available",
  };
}

describe("reassignOverallRanks", () => {
  it("sets 1-based ranks from array order", () => {
    const out = reassignOverallRanks([
      mk({ id: "a" }),
      mk({ id: "b" }),
      mk({ id: "c" }),
    ]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2, 3]);
  });
});

describe("computePositionalRanks", () => {
  it("numbers each position by overall-rank order", () => {
    const players = [
      mk({ id: "rb1", position: "RB", overallRank: 1 }),
      mk({ id: "wr1", position: "WR", overallRank: 2 }),
      mk({ id: "rb2", position: "RB", overallRank: 3 }),
    ];
    const r = computePositionalRanks(players);
    expect(r["rb1"]).toBe(1);
    expect(r["rb2"]).toBe(2);
    expect(r["wr1"]).toBe(1);
  });
});

describe("groupByTier", () => {
  it("groups by tier ascending with untiered last", () => {
    const players = [
      mk({ id: "a", tier: 2, overallRank: 3 }),
      mk({ id: "b", tier: 1, overallRank: 1 }),
      mk({ id: "c", tier: null, overallRank: 2 }),
    ];
    const g = groupByTier(players);
    expect(g.map((x) => x.tier)).toEqual([1, 2, null]);
    expect(g[0].players[0].id).toBe("b");
  });
});

describe("sortPlayers", () => {
  it("sorts by name ascending", () => {
    const players = [
      mk({ id: "1", name: "Zeb" }),
      mk({ id: "2", name: "Abe" }),
    ];
    expect(sortPlayers(players, "name").map((p) => p.name)).toEqual([
      "Abe",
      "Zeb",
    ]);
  });
  it("puts null adp last", () => {
    const players = [mk({ id: "1", adp: null }), mk({ id: "2", adp: 5 })];
    expect(sortPlayers(players, "adp").map((p) => p.id)).toEqual(["2", "1"]);
  });
  it("keeps null adp last even when descending", () => {
    const players = [
      mk({ id: "1", adp: null }),
      mk({ id: "2", adp: 5 }),
      mk({ id: "3", adp: 10 }),
    ];
    expect(sortPlayers(players, "adp", false).map((p) => p.id)).toEqual([
      "3",
      "2",
      "1",
    ]);
  });
});

describe("moveAndRetier", () => {
  it("moves a player and adopts the tier of its new neighbor", () => {
    const players = [
      mk({ id: "a", tier: 1, overallRank: 1 }),
      mk({ id: "b", tier: 1, overallRank: 2 }),
      mk({ id: "c", tier: 2, overallRank: 3 }),
    ];
    const out = moveAndRetier(players, "c", "a");
    expect(out.map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(out.find((p) => p.id === "c")!.tier).toBe(1);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2, 3]);
  });

  it("renumbers tiers contiguously when a move empties a tier", () => {
    const players = [
      mk({ id: "a", tier: 1, overallRank: 1 }),
      mk({ id: "b", tier: 2, overallRank: 2 }),
      mk({ id: "c", tier: 3, overallRank: 3 }),
    ];
    // drag the only tier-2 player up onto a; tier 2 empties, tier 3 becomes 2
    const out = moveAndRetier(players, "b", "a");
    expect(out.map((p) => p.id)).toEqual(["b", "a", "c"]);
    expect(out.map((p) => p.tier)).toEqual([1, 1, 2]);
  });
});

describe("normalizeTiers", () => {
  it("fills missing tiers from the player above and renumbers contiguously", () => {
    const players = [
      mk({ id: "a", tier: null, overallRank: 1 }),
      mk({ id: "b", tier: null, overallRank: 2 }),
      mk({ id: "c", tier: 3, overallRank: 3 }),
      mk({ id: "d", tier: null, overallRank: 4 }),
    ];
    expect(normalizeTiers(players).map((p) => p.tier)).toEqual([1, 1, 2, 2]);
  });

  it("defaults the top player to tier 1 when it has none", () => {
    const out = normalizeTiers([mk({ id: "a", tier: null, overallRank: 1 })]);
    expect(out[0].tier).toBe(1);
  });
});

describe("moveTier", () => {
  it("moves a whole tier block to a new position and renumbers", () => {
    const players = [
      mk({ id: "p1", tier: 1, overallRank: 1 }),
      mk({ id: "p2", tier: 1, overallRank: 2 }),
      mk({ id: "p3", tier: 2, overallRank: 3 }),
      mk({ id: "p4", tier: 2, overallRank: 4 }),
      mk({ id: "p5", tier: 3, overallRank: 5 }),
      mk({ id: "p6", tier: 3, overallRank: 6 }),
    ];
    const out = moveTier(players, 3, 1); // tier 3 to the front
    expect(out.map((p) => p.id)).toEqual(["p5", "p6", "p1", "p2", "p3", "p4"]);
    expect(out.map((p) => p.tier)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2, 3, 4, 5, 6]);
  });
});

describe("splitTierAt", () => {
  it("starts a new tier at the given player", () => {
    const players = [
      mk({ id: "a", tier: 1, overallRank: 1 }),
      mk({ id: "b", tier: 1, overallRank: 2 }),
      mk({ id: "c", tier: 1, overallRank: 3 }),
    ];
    expect(splitTierAt(players, "b").map((p) => p.tier)).toEqual([1, 2, 2]);
  });

  it("is a no-op when the player already starts its tier", () => {
    const players = [
      mk({ id: "a", tier: 1, overallRank: 1 }),
      mk({ id: "b", tier: 1, overallRank: 2 }),
      mk({ id: "c", tier: 2, overallRank: 3 }),
      mk({ id: "d", tier: 2, overallRank: 4 }),
    ];
    expect(splitTierAt(players, "c").map((p) => p.tier)).toEqual([1, 1, 2, 2]);
  });
});

describe("removeTier", () => {
  it("merges a tier up into the one above and renumbers", () => {
    const players = [
      mk({ id: "p1", tier: 1, overallRank: 1 }),
      mk({ id: "p2", tier: 1, overallRank: 2 }),
      mk({ id: "p3", tier: 2, overallRank: 3 }),
      mk({ id: "p4", tier: 2, overallRank: 4 }),
      mk({ id: "p5", tier: 3, overallRank: 5 }),
    ];
    expect(removeTier(players, 2).map((p) => p.tier)).toEqual([1, 1, 1, 1, 2]);
  });

  it("merges the top tier down when nothing is above it", () => {
    const players = [
      mk({ id: "p1", tier: 1, overallRank: 1 }),
      mk({ id: "p2", tier: 2, overallRank: 2 }),
      mk({ id: "p3", tier: 2, overallRank: 3 }),
    ];
    expect(removeTier(players, 1).map((p) => p.tier)).toEqual([1, 1, 1]);
  });
});

describe("moveIntoNewTier", () => {
  it("moves a player to a boundary as its own new tier", () => {
    const players = [
      mk({ id: "a", tier: 1, overallRank: 1 }),
      mk({ id: "b", tier: 1, overallRank: 2 }),
      mk({ id: "c", tier: 2, overallRank: 3 }),
      mk({ id: "d", tier: 2, overallRank: 4 }),
    ];
    const out = moveIntoNewTier(players, "d", "c"); // d alone, before c
    expect(out.map((p) => p.id)).toEqual(["a", "b", "d", "c"]);
    expect(out.map((p) => p.tier)).toEqual([1, 1, 2, 3]);
  });

  it("moves a player into a new tier at the very end when beforeId is null", () => {
    const players = [
      mk({ id: "a", tier: 1, overallRank: 1 }),
      mk({ id: "b", tier: 1, overallRank: 2 }),
    ];
    const out = moveIntoNewTier(players, "a", null);
    expect(out.map((p) => p.id)).toEqual(["b", "a"]);
    expect(out.map((p) => p.tier)).toEqual([1, 2]);
  });
});

describe("orderByAdp", () => {
  it("orders by ADP ascending with nulls last, reranking and re-tiering", () => {
    const players = [
      mk({ id: "a", adp: null, overallRank: 1 }),
      mk({ id: "b", adp: 5, overallRank: 2 }),
      mk({ id: "c", adp: 1, overallRank: 3 }),
    ];
    const out = orderByAdp(players, 2); // tier size 2
    expect(out.map((p) => p.id)).toEqual(["c", "b", "a"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2, 3]);
    expect(out.map((p) => p.tier)).toEqual([1, 1, 2]);
  });
});
