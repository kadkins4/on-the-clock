import { describe, it, expect } from "vitest";
import { computeVor, replacementSlots } from "./vor";
import type { Player, ProjStats, RosterSettings } from "../types";

const roster: RosterSettings = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  SUPERFLEX: 0,
  K: 1,
  DST: 1,
  bench: 6,
  disabled: [],
};

const zero: ProjStats = {
  passYds: 0,
  passTD: 0,
  int: 0,
  rushYds: 0,
  rushTD: 0,
  rec: 0,
  recYds: 0,
  recTD: 0,
  fumblesLost: 0,
  twoPt: 0,
};

// An RB whose only projected stat is rushing yards, so projected points are
// exactly rushYds * 0.1 regardless of scoring — keeps the VOR math obvious.
function rb(id: string, rushYds: number): Player {
  return {
    id,
    name: id,
    position: "RB",
    team: "FA",
    overallRank: 1,
    byeWeek: null,
    tier: null,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
    projStats: { ...zero, rushYds },
  };
}

describe("replacementSlots", () => {
  it("adds base starters plus distributed flex by base weight", () => {
    // teams=10: RB base = 10*2 = 20; FLEX total = 10*1 = 10 split across
    // RB/WR/TE by base weight (2/2/1) -> RB gets round(10*2/5)=4 -> 24.
    const slots = replacementSlots(roster, 10);
    expect(slots.RB).toBe(24);
    expect(slots.QB).toBe(10); // 1*10, no flex/superflex share
    expect(slots.K).toBe(10);
  });
});

describe("computeVor", () => {
  it("subtracts the replacement-slot player's points", () => {
    const small: RosterSettings = { ...roster, RB: 1, FLEX: 0, K: 0, DST: 0 };
    // points: a=100, b=80, c=60, d=40; RB slot = 2*1 = 2 -> baseline = 80.
    const players = [rb("a", 1000), rb("b", 800), rb("c", 600), rb("d", 400)];
    const vor = computeVor(players, small, 2, "standard");
    expect(vor.a).toBe(20);
    expect(vor.b).toBe(0);
    expect(vor.c).toBe(-20);
  });

  it("uses league scoring for projected points", () => {
    // A WR with receptions: PPR adds 1/rec, standard adds 0.
    const wr = (id: string, rec: number): Player => ({
      ...rb(id, 0),
      position: "WR",
      projStats: { ...zero, recYds: 1000, rec },
    });
    const players = [wr("x", 100), wr("y", 0)];
    // 2 teams, WR:1 -> slot 2 -> baseline is the 2nd WR (y).
    // standard: x=y=100 -> vor 0. ppr: x=200, y=100 -> vor 100.
    expect(
      computeVor(players, { ...roster, WR: 1, FLEX: 0 }, 2, "standard").x,
    ).toBe(0);
    expect(computeVor(players, { ...roster, WR: 1, FLEX: 0 }, 2, "ppr").x).toBe(
      100,
    );
  });

  it("returns null for players or positions without projections", () => {
    const small: RosterSettings = { ...roster, RB: 1, FLEX: 0, K: 0, DST: 0 };
    const noProj: Player = { ...rb("a", 0), projStats: null, projPoints: null };
    const players = [noProj, rb("b", 500)];
    expect(computeVor(players, small, 1, "ppr").a).toBeNull();
  });

  it("skips disabled positions (null baseline)", () => {
    const d: RosterSettings = { ...roster, disabled: ["RB"] };
    expect(computeVor([rb("a", 1000)], d, 10, "ppr").a).toBeNull();
  });
});
