import { describe, it, expect } from "vitest";
import { draftedByPosition } from "./counts";
import type { Player } from "../types";
import type { DraftStatus } from "../types";

function mk(pos: Player["position"], status: DraftStatus): Player {
  return {
    id: Math.random().toString(),
    name: "x",
    position: pos,
    team: "FA",
    overallRank: 1,
    byeWeek: null,
    tier: 1,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: status,
  };
}

describe("draftedByPosition", () => {
  it("counts non-available players per position", () => {
    const out = draftedByPosition([
      mk("RB", "mine"),
      mk("RB", "taken"),
      mk("RB", "available"),
      mk("WR", "taken"),
    ]);
    expect(out.RB).toBe(2);
    expect(out.WR).toBe(1);
    expect(out.QB).toBe(0);
  });
});
