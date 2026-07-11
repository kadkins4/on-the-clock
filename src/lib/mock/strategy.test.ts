import { describe, it, expect } from "vitest";
import {
  STRATEGIES,
  strategyMultiplier,
  READY_STRATEGY_IDS,
  type StrategyContext,
} from "./strategy";
import type { Needs } from "./roster";
import type { Player, Position } from "../../types";

// No open needs; the timing strategies ignore needs in v1, so an empty needs
// object is a fine stand-in everywhere below.
const noNeeds: Needs = { base: {}, flex: 0, superflex: 0 };

// Minimal Player stub — only the fields the multipliers read matter; the rest
// carry harmless defaults.
function mk(pos: Position, extra: Partial<Player> = {}): Player {
  return {
    id: "x",
    name: "Test Player",
    position: pos,
    team: "FA",
    overallRank: 50,
    byeWeek: null,
    tier: null,
    adp: 50,
    notes: "",
    flag: "none",
    draftStatus: "available",
    ...extra,
  };
}

const ctx = (round: number, roster: Player[] = []): StrategyContext => ({
  round,
  needs: noNeeds,
  roster,
});

describe("strategy registry", () => {
  it("defines all personalities with a label and icon", () => {
    const ids = Object.keys(STRATEGIES);
    expect(ids).toEqual(
      expect.arrayContaining([
        "heroRB",
        "zeroRB",
        "robustRB",
        "balanced",
        "streamer",
        "prospector",
        "graybeard",
        "valueSniper",
        "stacker",
        "tiers",
        "homer",
      ]),
    );
    for (const s of Object.values(STRATEGIES)) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.icon.length).toBeGreaterThan(0);
    }
  });

  it("marks the nine modeled bots as ready to assign (tiers + homer stay parked)", () => {
    expect([...READY_STRATEGY_IDS].sort()).toEqual([
      "balanced",
      "graybeard",
      "heroRB",
      "prospector",
      "robustRB",
      "stacker",
      "streamer",
      "valueSniper",
      "zeroRB",
    ]);
  });

  it("keeps the not-ready bots neutral (multiplier 1) so they never mis-draft", () => {
    for (const id of ["tiers", "homer"] as const) {
      for (const round of [1, 4, 12]) {
        expect(strategyMultiplier(id, mk("RB"), ctx(round))).toBe(1);
        expect(strategyMultiplier(id, mk("WR"), ctx(round))).toBe(1);
      }
    }
  });
});

describe("balanced", () => {
  it("is always neutral across positions and rounds", () => {
    for (const pos of ["QB", "RB", "WR", "TE"] as const) {
      for (const round of [1, 5, 10, 15]) {
        expect(strategyMultiplier("balanced", mk(pos), ctx(round))).toBe(1);
      }
    }
  });
});

describe("zeroRB", () => {
  it("suppresses RB and boosts WR in the early rounds", () => {
    expect(strategyMultiplier("zeroRB", mk("RB"), ctx(1))).toBeLessThan(1);
    expect(strategyMultiplier("zeroRB", mk("WR"), ctx(1))).toBeGreaterThan(1);
  });

  it("flips to boosting RB once the value window opens (mid rounds)", () => {
    expect(strategyMultiplier("zeroRB", mk("RB"), ctx(7))).toBeGreaterThan(1);
  });
});

describe("heroRB", () => {
  it("boosts RB hard in round 1", () => {
    expect(strategyMultiplier("heroRB", mk("RB"), ctx(1))).toBeGreaterThan(1);
  });

  it("suppresses RB and leans WR in rounds 2-5 (zero-RB the rest)", () => {
    expect(strategyMultiplier("heroRB", mk("RB"), ctx(3))).toBeLessThan(1);
    expect(strategyMultiplier("heroRB", mk("WR"), ctx(3))).toBeGreaterThan(1);
  });
});

describe("robustRB", () => {
  it("boosts RB in the first three rounds", () => {
    expect(strategyMultiplier("robustRB", mk("RB"), ctx(2))).toBeGreaterThan(1);
  });
});

describe("streamer", () => {
  it("suppresses QB and TE early", () => {
    expect(strategyMultiplier("streamer", mk("QB"), ctx(2))).toBeLessThan(1);
    expect(strategyMultiplier("streamer", mk("TE"), ctx(2))).toBeLessThan(1);
  });

  it("boosts QB and TE late so it still fills them", () => {
    expect(strategyMultiplier("streamer", mk("QB"), ctx(12))).toBeGreaterThan(
      1,
    );
    expect(strategyMultiplier("streamer", mk("TE"), ctx(12))).toBeGreaterThan(
      1,
    );
  });

  it("leaves RB and WR alone", () => {
    expect(strategyMultiplier("streamer", mk("RB"), ctx(2))).toBe(1);
    expect(strategyMultiplier("streamer", mk("WR"), ctx(12))).toBe(1);
  });
});

describe("prospector (young / rookies)", () => {
  it("boosts rookies and sophomores hardest", () => {
    expect(
      strategyMultiplier("prospector", mk("RB", { yearsExp: 0 }), ctx(3)),
    ).toBeGreaterThan(1.4);
    expect(
      strategyMultiplier("prospector", mk("WR", { yearsExp: 1 }), ctx(3)),
    ).toBeGreaterThan(1.4);
  });

  it("still boosts still-young players by age when experience is higher", () => {
    expect(
      strategyMultiplier(
        "prospector",
        mk("WR", { yearsExp: 3, age: 23 }),
        ctx(3),
      ),
    ).toBeGreaterThan(1);
  });

  it("is neutral on established older players and on missing bio", () => {
    expect(
      strategyMultiplier(
        "prospector",
        mk("RB", { yearsExp: 6, age: 30 }),
        ctx(3),
      ),
    ).toBe(1);
    expect(strategyMultiplier("prospector", mk("RB"), ctx(3))).toBe(1);
  });
});

describe("graybeard (proven vets)", () => {
  it("rewards established vets and fades rookies", () => {
    expect(
      strategyMultiplier("graybeard", mk("RB", { yearsExp: 5 }), ctx(3)),
    ).toBeGreaterThan(1);
    expect(
      strategyMultiplier("graybeard", mk("RB", { yearsExp: 0 }), ctx(3)),
    ).toBeLessThan(1);
  });

  it("is neutral when experience is unknown", () => {
    expect(strategyMultiplier("graybeard", mk("WR"), ctx(3))).toBe(1);
  });
});

describe("valueSniper (board rates above market)", () => {
  it("boosts a player whose ADP sits well below his board rank", () => {
    // overallRank 20 (board loves him) but adp 60 (market fades him) → value
    const m = mk("WR", { overallRank: 20, adp: 60 });
    expect(strategyMultiplier("valueSniper", m, ctx(4))).toBeGreaterThan(1);
  });

  it("is neutral when the market agrees or is higher on him", () => {
    const m = mk("WR", { overallRank: 20, adp: 15 });
    expect(strategyMultiplier("valueSniper", m, ctx(4))).toBe(1);
  });

  it("is neutral when ADP is missing", () => {
    expect(
      strategyMultiplier("valueSniper", mk("WR", { adp: null }), ctx(4)),
    ).toBe(1);
  });
});

describe("stacker (QB correlation)", () => {
  it("does nothing before a QB is on the roster", () => {
    expect(
      strategyMultiplier("stacker", mk("WR", { team: "KC" }), ctx(3)),
    ).toBe(1);
  });

  it("boosts pass-catchers on the rostered QB's team", () => {
    const roster = [mk("QB", { team: "KC" })];
    expect(
      strategyMultiplier("stacker", mk("WR", { team: "KC" }), ctx(4, roster)),
    ).toBeGreaterThan(1);
    expect(
      strategyMultiplier("stacker", mk("TE", { team: "KC" }), ctx(4, roster)),
    ).toBeGreaterThan(1);
  });

  it("leaves other teams and the QB's own RB alone", () => {
    const roster = [mk("QB", { team: "KC" })];
    expect(
      strategyMultiplier("stacker", mk("WR", { team: "BUF" }), ctx(4, roster)),
    ).toBe(1);
    expect(
      strategyMultiplier("stacker", mk("RB", { team: "KC" }), ctx(4, roster)),
    ).toBe(1);
  });
});
