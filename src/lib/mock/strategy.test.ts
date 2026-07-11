import { describe, it, expect } from "vitest";
import { STRATEGIES, strategyMultiplier, READY_STRATEGY_IDS } from "./strategy";
import type { Needs } from "./roster";

// No open needs; the timing strategies ignore needs in v1, so an empty needs
// object is a fine stand-in everywhere below.
const noNeeds: Needs = { base: {}, flex: 0, superflex: 0 };

describe("strategy registry", () => {
  it("defines all eight personalities with a label and icon", () => {
    const ids = Object.keys(STRATEGIES);
    expect(ids).toEqual(
      expect.arrayContaining([
        "heroRB",
        "zeroRB",
        "robustRB",
        "balanced",
        "streamer",
        "tiers",
        "upside",
        "homer",
      ]),
    );
    for (const s of Object.values(STRATEGIES)) {
      expect(s.label.length).toBeGreaterThan(0);
      expect(s.icon.length).toBeGreaterThan(0);
    }
  });

  it("marks exactly the five position-timing bots as ready to assign", () => {
    expect([...READY_STRATEGY_IDS].sort()).toEqual([
      "balanced",
      "heroRB",
      "robustRB",
      "streamer",
      "zeroRB",
    ]);
  });

  it("keeps the not-ready bots neutral (multiplier 1) so they never mis-draft", () => {
    for (const id of ["tiers", "upside", "homer"] as const) {
      for (const round of [1, 4, 12]) {
        expect(strategyMultiplier(id, "RB", round, noNeeds)).toBe(1);
        expect(strategyMultiplier(id, "WR", round, noNeeds)).toBe(1);
      }
    }
  });
});

describe("balanced", () => {
  it("is always neutral across positions and rounds", () => {
    for (const pos of ["QB", "RB", "WR", "TE"] as const) {
      for (const round of [1, 5, 10, 15]) {
        expect(strategyMultiplier("balanced", pos, round, noNeeds)).toBe(1);
      }
    }
  });
});

describe("zeroRB", () => {
  it("suppresses RB and boosts WR in the early rounds", () => {
    expect(strategyMultiplier("zeroRB", "RB", 1, noNeeds)).toBeLessThan(1);
    expect(strategyMultiplier("zeroRB", "WR", 1, noNeeds)).toBeGreaterThan(1);
  });

  it("flips to boosting RB once the value window opens (mid rounds)", () => {
    expect(strategyMultiplier("zeroRB", "RB", 7, noNeeds)).toBeGreaterThan(1);
  });
});

describe("heroRB", () => {
  it("boosts RB hard in round 1", () => {
    expect(strategyMultiplier("heroRB", "RB", 1, noNeeds)).toBeGreaterThan(1);
  });

  it("suppresses RB and leans WR in rounds 2-5 (zero-RB the rest)", () => {
    expect(strategyMultiplier("heroRB", "RB", 3, noNeeds)).toBeLessThan(1);
    expect(strategyMultiplier("heroRB", "WR", 3, noNeeds)).toBeGreaterThan(1);
  });
});

describe("robustRB", () => {
  it("boosts RB in the first three rounds", () => {
    expect(strategyMultiplier("robustRB", "RB", 2, noNeeds)).toBeGreaterThan(1);
  });
});

describe("streamer", () => {
  it("suppresses QB and TE early", () => {
    expect(strategyMultiplier("streamer", "QB", 2, noNeeds)).toBeLessThan(1);
    expect(strategyMultiplier("streamer", "TE", 2, noNeeds)).toBeLessThan(1);
  });

  it("boosts QB and TE late so it still fills them", () => {
    expect(strategyMultiplier("streamer", "QB", 12, noNeeds)).toBeGreaterThan(
      1,
    );
    expect(strategyMultiplier("streamer", "TE", 12, noNeeds)).toBeGreaterThan(
      1,
    );
  });

  it("leaves RB and WR alone", () => {
    expect(strategyMultiplier("streamer", "RB", 2, noNeeds)).toBe(1);
    expect(strategyMultiplier("streamer", "WR", 12, noNeeds)).toBe(1);
  });
});
