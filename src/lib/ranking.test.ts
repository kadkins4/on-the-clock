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
  defaultSortAsc,
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

  it("dragging DOWN onto a player lands directly above it, joining its tier", () => {
    const players = [
      mk({ id: "a", tier: 1, overallRank: 1 }),
      mk({ id: "b", tier: 1, overallRank: 2 }),
      mk({ id: "c", tier: 2, overallRank: 3 }),
      mk({ id: "d", tier: 2, overallRank: 4 }),
    ];
    // drag a down onto c (top of tier 2): a lands ABOVE c (no swap), tier 2
    const out = moveAndRetier(players, "a", "c");
    expect(out.map((p) => p.id)).toEqual(["b", "a", "c", "d"]);
    expect(out.find((p) => p.id === "a")!.tier).toBe(2);
    expect(out.map((p) => p.tier)).toEqual([1, 2, 2, 2]);
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

describe("sortPlayers vor", () => {
  const base = {
    position: "RB" as const,
    team: "FA",
    byeWeek: null,
    tier: null,
    adp: null,
    notes: "",
    flag: "none" as const,
    draftStatus: "available" as const,
  };
  it("sorts by VOR descending with nulls last", () => {
    const players = [
      { ...base, id: "a", name: "A", overallRank: 1 },
      { ...base, id: "b", name: "B", overallRank: 2 },
      { ...base, id: "c", name: "C", overallRank: 3 },
    ];
    const vor = { a: 10, b: 50, c: null };
    // descending = the default (asc=false) for value-better columns; nulls last
    const out = sortPlayers(players, "vor", false, { vor }).map((p) => p.id);
    expect(out).toEqual(["b", "a", "c"]);
  });

  it("sorts by proj higher-is-better; nulls last", () => {
    const players = [
      { ...base, id: "a", name: "A", overallRank: 1 },
      { ...base, id: "b", name: "B", overallRank: 2 },
      { ...base, id: "c", name: "C", overallRank: 3 },
    ];
    const proj = { a: 100, b: 250, c: null };
    expect(
      sortPlayers(players, "proj", false, { proj }).map((p) => p.id),
    ).toEqual(["b", "a", "c"]);
  });

  it("sorts by last higher-is-better", () => {
    const players = [
      { ...base, id: "a", name: "A", overallRank: 1 },
      { ...base, id: "b", name: "B", overallRank: 2 },
    ];
    const last = { a: 50, b: 300 };
    expect(
      sortPlayers(players, "last", false, { last }).map((p) => p.id),
    ).toEqual(["b", "a"]);
  });

  it("proj and last default to descending", () => {
    expect(defaultSortAsc("proj")).toBe(false);
    expect(defaultSortAsc("last")).toBe(false);
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
