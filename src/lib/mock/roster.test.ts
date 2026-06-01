import { describe, it, expect } from "vitest";
import { openNeeds, servesNeed } from "./roster";
import type { RosterSettings } from "../../types";

const roster = (over: Partial<RosterSettings> = {}): RosterSettings => ({
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
  ...over,
});

describe("openNeeds", () => {
  it("reports base starters still unfilled", () => {
    const n = openNeeds(["QB", "RB"], roster());
    expect(n.base.RB).toBe(1); // 2 needed, 1 drafted
    expect(n.base.WR).toBe(2);
    expect(n.base.QB).toBeUndefined(); // filled
    expect(n.flex).toBe(1);
  });

  it("spills extra RB/WR/TE into FLEX before reporting it open", () => {
    // 2 RB fills base RB; a 3rd RB spills to FLEX
    const n = openNeeds(["RB", "RB", "RB"], roster());
    expect(n.base.RB).toBeUndefined();
    expect(n.flex).toBe(0); // 3rd RB took the flex
  });

  it("honors disabled positions (no need for them)", () => {
    const n = openNeeds([], roster({ K: 1, DST: 1, disabled: ["K", "DST"] }));
    expect(n.base.K).toBeUndefined();
    expect(n.base.DST).toBeUndefined();
  });

  it("superflex accepts a QB", () => {
    const n = openNeeds(["QB"], roster({ SUPERFLEX: 1 }));
    // base QB filled by the one QB; superflex still open
    expect(n.superflex).toBe(1);
  });
});

describe("servesNeed", () => {
  it("true when the position fills a base slot", () => {
    const n = openNeeds(["QB"], roster());
    expect(servesNeed("RB", n)).toBe(true);
  });
  it("true when only FLEX is open and pos is flex-eligible", () => {
    const n = openNeeds(["QB", "RB", "RB", "WR", "WR", "TE"], roster());
    expect(servesNeed("RB", n)).toBe(true); // flex open, RB eligible
    expect(servesNeed("QB", n)).toBe(false); // QB not flex-eligible, no SF
  });
  it("false for everything when starters + flex are full", () => {
    const full = roster({ RB: 1, WR: 1, TE: 0, K: 0, DST: 0, FLEX: 0 });
    const n = openNeeds(["QB", "RB", "WR"], full);
    expect(servesNeed("RB", n)).toBe(false);
  });
});
