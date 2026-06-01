import { describe, it, expect } from "vitest";
import { blendAdp, applyFfcAdp } from "./blendAdp";
import type { Player } from "../types";
import type { NormalizedAdp } from "./ffcAdp";

const player = (over: Partial<Player>): Player => ({
  id: "x",
  name: "Test Player",
  position: "RB",
  team: "SF",
  overallRank: 1,
  byeWeek: null,
  tier: 1,
  adp: null,
  notes: "",
  flag: "none",
  draftStatus: "available",
  ...over,
});

describe("blendAdp", () => {
  it("averages available sources", () => {
    expect(blendAdp({ espn: 10, ffc: 20 })).toBe(15);
  });
  it("returns the single available source unchanged", () => {
    expect(blendAdp({ espn: 12.34 })).toBe(12.34);
    expect(blendAdp({ ffc: 8.5 })).toBe(8.5);
  });
  it("returns null when nothing is available", () => {
    expect(blendAdp({})).toBeNull();
    expect(blendAdp({ espn: null, ffc: null })).toBeNull();
  });
});

describe("applyFfcAdp", () => {
  it("matches by name+position, stores ffc, and reblends adp", () => {
    const board: Player[] = [
      player({ id: "1", name: "A.J. Brown", position: "WR", adp: 14 }),
    ];
    board[0].adpSources = { espn: 14 };
    const ffc: NormalizedAdp[] = [
      { name: "AJ Brown", position: "WR", team: "PHI", adp: 20 },
    ];
    const out = applyFfcAdp(board, ffc);
    expect(out[0].adpSources).toEqual({ espn: 14, ffc: 20 });
    expect(out[0].adp).toBe(17);
  });

  it("matches DST by team, ignoring name spelling", () => {
    const board: Player[] = [
      player({ id: "d", name: "Ravens D/ST", position: "DST", team: "BAL" }),
    ];
    board[0].adpSources = { espn: 130 };
    const ffc: NormalizedAdp[] = [
      { name: "Baltimore Defense", position: "DST", team: "BAL", adp: 132 },
    ];
    const out = applyFfcAdp(board, ffc);
    expect(out[0].adpSources?.ffc).toBe(132);
    expect(out[0].adp).toBe(131);
  });

  it("leaves unmatched players' ffc unset and blend on espn only", () => {
    const board: Player[] = [player({ id: "1", name: "Nobody Here", adp: 9 })];
    board[0].adpSources = { espn: 9 };
    const out = applyFfcAdp(board, []);
    expect(out[0].adpSources).toEqual({ espn: 9 });
    expect(out[0].adp).toBe(9);
  });

  it("does not reorder or change tier/flag/notes", () => {
    const board: Player[] = [
      player({ id: "1", name: "First", overallRank: 1, tier: 1 }),
      player({
        id: "2",
        name: "Second",
        overallRank: 2,
        tier: 2,
        flag: "target",
      }),
    ];
    const out = applyFfcAdp(board, []);
    expect(out.map((p) => p.id)).toEqual(["1", "2"]);
    expect(out[1].flag).toBe("target");
    expect(out[1].tier).toBe(2);
  });
});
