import { describe, it, expect } from "vitest";
import { rankingReducer } from "./reducer";
import type { Player } from "../types";

function mk(id: string, over: number, tier: number | null = 1): Player {
  return {
    id,
    name: id,
    position: "RB",
    team: "FA",
    overallRank: over,
    byeWeek: null,
    tier,
    adp: null,
    notes: "",
    flag: "none",
    drafted: false,
  };
}

describe("rankingReducer", () => {
  const base = [mk("a", 1), mk("b", 2), mk("c", 3)];

  it("setAll sorts by rank and reassigns 1-based ranks", () => {
    const out = rankingReducer([], {
      type: "setAll",
      players: [mk("x", 5), mk("y", 1)],
    });
    expect(out.map((p) => p.id)).toEqual(["y", "x"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2]);
  });

  it("add appends and reassigns ranks", () => {
    const out = rankingReducer(base, { type: "add", player: mk("d", 0) });
    expect(out).toHaveLength(4);
    expect(out[3]).toMatchObject({ id: "d", overallRank: 4 });
  });

  it("update patches a single player", () => {
    const out = rankingReducer(base, {
      type: "update",
      id: "b",
      patch: { notes: "hi" },
    });
    expect(out.find((p) => p.id === "b")!.notes).toBe("hi");
  });

  it("remove drops the player and reassigns ranks", () => {
    const out = rankingReducer(base, { type: "remove", id: "a" });
    expect(out.map((p) => p.id)).toEqual(["b", "c"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2]);
  });

  it("toggleDrafted flips drafted", () => {
    const out = rankingReducer(base, { type: "toggleDrafted", id: "a" });
    expect(out.find((p) => p.id === "a")!.drafted).toBe(true);
  });

  it("move reorders and reassigns ranks", () => {
    const out = rankingReducer(base, {
      type: "move",
      activeId: "c",
      overId: "a",
    });
    expect(out.map((p) => p.id)).toEqual(["c", "a", "b"]);
    expect(out.map((p) => p.overallRank)).toEqual([1, 2, 3]);
  });
});
