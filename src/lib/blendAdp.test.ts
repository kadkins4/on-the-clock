import { describe, it, expect } from "vitest";
import { blendAdp, applyAdp } from "./blendAdp";
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
  it("weights consensus sources above single platforms", () => {
    // fantasypros 3, ffc 2, yahoo 2, espn 1
    expect(
      blendAdp({ espn: 100, ffc: 130, fantasypros: 140, yahoo: 128 }, "WR"),
    ).toBeCloseTo((100 * 1 + 130 * 2 + 140 * 3 + 128 * 2) / 8, 5);
  });
  it("weights espn below ffc for a two-source blend", () => {
    expect(blendAdp({ espn: 10, ffc: 20 }, "RB")).toBeCloseTo(50 / 3, 5);
  });
  it("returns the single available source unchanged", () => {
    expect(blendAdp({ ffc: 8.5 }, "RB")).toBe(8.5);
  });
  it("returns null when nothing is available", () => {
    expect(blendAdp({}, "RB")).toBeNull();
    expect(blendAdp({ espn: null, ffc: null }, "RB")).toBeNull();
  });
  it("floors a K/DST priced by espn only", () => {
    expect(blendAdp({ espn: 83 }, "K")).toBe(100);
    expect(blendAdp({ espn: 81 }, "DST")).toBe(100);
  });
  it("does NOT floor a K/DST once a consensus source agrees", () => {
    expect(blendAdp({ espn: 83, ffc: 140 }, "DST")).toBeCloseTo(
      (83 + 280) / 3,
      5,
    );
  });
  it("never floors offense", () => {
    expect(blendAdp({ espn: 5 }, "RB")).toBe(5);
  });
  it("weights sleeper like ffc/yahoo (2) in the blend", () => {
    // espn 1, sleeper 2
    expect(blendAdp({ espn: 10, sleeper: 20 }, "RB")).toBeCloseTo(50 / 3, 5);
  });
  it("treats sleeper as a consensus source (no K/DST floor)", () => {
    expect(blendAdp({ espn: 83, sleeper: 140 }, "DST")).toBeCloseTo(
      (83 + 280) / 3,
      5,
    );
  });
});

describe("applyAdp", () => {
  it("matches by name+position, stores ffc, and reblends (weighted)", () => {
    const board: Player[] = [
      player({ id: "1", name: "A.J. Brown", position: "WR", adp: 14 }),
    ];
    board[0].adpSources = { espn: 14 };
    const ffc: NormalizedAdp[] = [
      { name: "AJ Brown", position: "WR", team: "PHI", adp: 20 },
    ];
    const out = applyAdp(board, { ffc });
    expect(out[0].adpSources).toEqual({ espn: 14, ffc: 20 });
    expect(out[0].adp).toBeCloseTo((14 * 1 + 20 * 2) / 3, 5);
  });

  it("merges fantasypros and yahoo alongside ffc", () => {
    const board: Player[] = [
      player({ id: "1", name: "Bijan Robinson", position: "RB", adp: 2 }),
    ];
    const out = applyAdp(board, {
      ffc: [{ name: "Bijan Robinson", position: "RB", team: "ATL", adp: 3 }],
      fantasypros: [
        { name: "Bijan Robinson", position: "RB", team: "ATL", adp: 4 },
      ],
      yahoo: [{ name: "Bijan Robinson", position: "RB", team: "ATL", adp: 5 }],
    });
    expect(out[0].adpSources).toEqual({
      espn: 2,
      ffc: 3,
      fantasypros: 4,
      yahoo: 5,
    });
    expect(out[0].adp).toBeCloseTo((2 + 6 + 12 + 10) / 8, 5);
  });

  it("merges sleeper into the blend and stores it", () => {
    const board: Player[] = [
      player({ id: "1", name: "Bijan Robinson", position: "RB", adp: 2 }),
    ];
    const out = applyAdp(board, {
      sleeper: [
        { name: "Bijan Robinson", position: "RB", team: "ATL", adp: 6 },
      ],
    });
    expect(out[0].adpSources).toEqual({ espn: 2, sleeper: 6 });
    // espn 1 + sleeper 2
    expect(out[0].adp).toBeCloseTo((2 * 1 + 6 * 2) / 3, 5);
  });

  it("matches DST by team, ignoring name spelling", () => {
    const board: Player[] = [
      player({ id: "d", name: "Ravens D/ST", position: "DST", team: "BAL" }),
    ];
    board[0].adpSources = { espn: 130 };
    const out = applyAdp(board, {
      ffc: [
        { name: "Baltimore Defense", position: "DST", team: "BAL", adp: 132 },
      ],
    });
    expect(out[0].adpSources?.ffc).toBe(132);
    expect(out[0].adp).toBeCloseTo((130 * 1 + 132 * 2) / 3, 5);
  });

  it("treats an existing adp as the espn baseline when adpSources is absent", () => {
    const board: Player[] = [
      player({ id: "1", name: "Bijan Robinson", position: "RB", adp: 2.3 }),
    ];
    const out = applyAdp(board, {
      ffc: [{ name: "Bijan Robinson", position: "RB", team: "ATL", adp: 1.7 }],
    });
    expect(out[0].adpSources).toEqual({ espn: 2.3, ffc: 1.7 });
    expect(out[0].adp).toBeCloseTo((2.3 * 1 + 1.7 * 2) / 3, 5);
  });

  it("leaves unmatched players on espn only", () => {
    const board: Player[] = [player({ id: "1", name: "Nobody Here", adp: 9 })];
    board[0].adpSources = { espn: 9 };
    const out = applyAdp(board, { ffc: [] });
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
    const out = applyAdp(board, { ffc: [] });
    expect(out.map((p) => p.id)).toEqual(["1", "2"]);
    expect(out[1].flag).toBe("target");
    expect(out[1].tier).toBe(2);
  });
});
