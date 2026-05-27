import { describe, it, expect } from "vitest";
import { searchPlayers } from "./search";
import type { Player } from "../types";

function mk(
  id: string,
  name: string,
  pos: Player["position"],
  team: string,
): Player {
  return {
    id,
    name,
    position: pos,
    team,
    overallRank: Number(id),
    byeWeek: null,
    tier: 1,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  };
}

const players = [
  mk("1", "Najee Harris", "RB", "PIT"),
  mk("2", "Steelers D/ST", "DST", "PIT"),
  mk("3", "George Pickens", "WR", "PIT"),
  mk("4", "Bijan Robinson", "RB", "ATL"),
];

describe("searchPlayers", () => {
  it("returns all players for an empty query", () => {
    expect(searchPlayers(players, "")).toHaveLength(4);
  });

  it("matches by player name", () => {
    expect(searchPlayers(players, "bijan").map((p) => p.id)).toEqual(["4"]);
  });

  it("team-nickname query surfaces the D/ST first, then team players", () => {
    const ids = searchPlayers(players, "steelers").map((p) => p.id);
    expect(ids[0]).toBe("2"); // Steelers D/ST
    expect(ids).toEqual(expect.arrayContaining(["1", "3"]));
    expect(ids).not.toContain("4"); // ATL excluded
  });

  it("ranks exact before partial", () => {
    const ps = [
      mk("1", "Chase", "WR", "CIN"),
      mk("2", "Chase Brown", "RB", "CIN"),
    ];
    expect(searchPlayers(ps, "chase").map((p) => p.id)).toEqual(["1", "2"]);
  });
});
