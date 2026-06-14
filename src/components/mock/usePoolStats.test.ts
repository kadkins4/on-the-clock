import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { usePoolStats } from "./usePoolStats";
import type { MockState } from "../../lib/mock/types";
import type { Player, ProjStats } from "../../types";

const ZERO: ProjStats = {
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

function wr(id: string, over: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    position: "WR",
    team: "MIN",
    overallRank: 1,
    byeWeek: 6,
    tier: 1,
    adp: 1,
    notes: "",
    flag: "none",
    draftStatus: "available",
    ...over,
  };
}

function makeState(pool: Player[], over: Partial<MockState> = {}): MockState {
  return {
    pool,
    scoring: "ppr",
    roster: {
      QB: 1,
      RB: 2,
      WR: 1,
      TE: 1,
      FLEX: 0,
      SUPERFLEX: 0,
      K: 1,
      DST: 1,
      bench: 6,
      disabled: [],
    },
    settings: {
      teams: 2,
      userSlot: 1,
      rounds: 15,
      thirdRoundReversal: false,
    },
    teams: [],
    order: [],
    picks: [],
    draftedIds: new Set<string>(),
    seed: 0,
    ...over,
  };
}

describe("usePoolStats", () => {
  it("uses the stored projPoints when a player has no raw stat line", () => {
    const state = makeState([
      wr("a", { projPoints: 300 }),
      wr("b", { projPoints: 250 }),
    ]);
    const { result } = renderHook(() => usePoolStats(state));
    expect(result.current.projById.a).toBe(300);
    expect(result.current.projById.b).toBe(250);
  });

  it("computes VOR as proj minus the position's replacement baseline", () => {
    // WR=1 starter × 2 teams = 2 WR slots → baseline is the 2nd-best WR (250).
    const state = makeState([
      wr("a", { projPoints: 300 }),
      wr("b", { projPoints: 250 }),
    ]);
    const { result } = renderHook(() => usePoolStats(state));
    expect(result.current.vorById.a).toBe(50);
    expect(result.current.vorById.b).toBe(0);
  });

  it("scores PROJ at the league's PPR settings (not the raw projPoints)", () => {
    // 10 receptions → +10 pts at full PPR over the raw fallback.
    const stats: ProjStats = { ...ZERO, recYds: 1000, rec: 10 };
    const ppr = makeState([wr("a", { projStats: stats, projPoints: 999 })]);
    const std = makeState([wr("a", { projStats: stats, projPoints: 999 })], {
      scoring: "standard",
    });
    const pprRes = renderHook(() => usePoolStats(ppr)).result;
    const stdRes = renderHook(() => usePoolStats(std)).result;
    // 1000 rec yds = 100 pts; +10 rec at PPR, +0 at standard.
    expect(pprRes.current.projById.a).toBe(110);
    expect(stdRes.current.projById.a).toBe(100);
  });
});
