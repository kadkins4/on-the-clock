import { describe, it, expect } from "vitest";
import {
  reassignOverallRanks,
  computePositionalRanks,
  groupByTier,
  sortPlayers,
  moveAndRetier,
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
});
