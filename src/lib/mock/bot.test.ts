import { describe, it, expect } from "vitest";
import { pickWindowSize, botPick } from "./bot";
import { makeRng } from "./rng";
import { openNeeds } from "./roster";
import type { Player, Position, RosterSettings } from "../../types";

const roster = (): RosterSettings => ({
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
});

const p = (id: string, pos: Player["position"], adp: number): Player => ({
  id,
  name: id,
  position: pos,
  team: "FA",
  overallRank: adp,
  byeWeek: null,
  tier: 1,
  adp,
  notes: "",
  flag: "none",
  draftStatus: "available",
});

describe("pickWindowSize", () => {
  it("is 1 in round 1 and widens with round depth", () => {
    expect(pickWindowSize(1)).toBe(1);
    expect(pickWindowSize(2)).toBeGreaterThan(pickWindowSize(1));
    expect(pickWindowSize(8)).toBeGreaterThan(pickWindowSize(4));
  });
  it("caps at a maximum", () => {
    expect(pickWindowSize(100)).toBeLessThanOrEqual(12);
  });
});

describe("botPick", () => {
  const available = [
    p("rb1", "RB", 1),
    p("wr1", "WR", 2),
    p("rb2", "RB", 3),
    p("qb1", "QB", 4),
  ];

  it("round 1 takes the single best-available that serves a need", () => {
    const needs = openNeeds([], roster());
    const id = botPick(available, needs, 1, makeRng(1));
    expect(id).toBe("rb1");
  });

  it("is deterministic for a fixed seed", () => {
    const needs = openNeeds([], roster());
    const a = botPick(available, needs, 5, makeRng(99));
    const b = botPick(available, needs, 5, makeRng(99));
    expect(a).toBe(b);
  });

  it("skips positions that serve no need when others do", () => {
    // roster with only RB need open; QB/WR/TE/K/DST all full
    const fullExceptRb: RosterSettings = {
      ...roster(),
      QB: 0,
      WR: 0,
      TE: 0,
      K: 0,
      DST: 0,
      FLEX: 0,
      RB: 2,
    };
    const needs = openNeeds([], fullExceptRb);
    // window may be wide (late round) but only RBs serve the need
    const id = botPick(available, needs, 10, makeRng(3));
    expect(["rb1", "rb2"]).toContain(id);
  });

  it("falls back to best-available when nothing serves a need", () => {
    const noNeeds = openNeeds(["RB", "WR"], {
      ...roster(),
      QB: 0,
      RB: 1,
      WR: 1,
      TE: 0,
      K: 0,
      DST: 0,
      FLEX: 0,
    });
    const id = botPick(available, noNeeds, 1, makeRng(1));
    expect(id).toBe("rb1"); // window size 1 → best available overall
  });
});

function mk(id: string, position: Player["position"], rank: number): Player {
  return {
    id,
    name: id,
    position,
    team: "FA",
    overallRank: rank,
    byeWeek: null,
    tier: null,
    adp: rank,
    notes: "",
    flag: "none",
    draftStatus: "available",
  };
}

describe("botPick K/DST gating", () => {
  // Skill starters all filled: the only open base needs are K and DST.
  const drafted: Position[] = ["QB", "RB", "RB", "WR", "WR", "TE", "RB"];
  const avail = [
    mk("k1", "K", 1),
    mk("dst1", "DST", 2),
    mk("rb9", "RB", 3),
    mk("wr9", "WR", 4),
  ];

  it("drafts bench skill players, not K/DST, while many picks remain", () => {
    const needs = openNeeds(drafted, roster());
    // round 8 of 14: 7 picks left, only K+DST needs open — must still wait
    for (let seed = 1; seed <= 20; seed++) {
      const id = botPick(avail, needs, 8, makeRng(seed), [], 7);
      expect(["rb9", "wr9"]).toContain(id);
    }
  });

  it("fills K/DST once remaining picks barely cover the open slots", () => {
    const needs = openNeeds(drafted, roster());
    for (let seed = 1; seed <= 20; seed++) {
      const id = botPick(avail, needs, 13, makeRng(seed), [], 2);
      expect(["k1", "dst1"]).toContain(id);
    }
  });
});

describe("botPick run-chasing", () => {
  function shareOfWr(recent: Player["position"][]): number {
    const avail = [mk("wr", "WR", 1), mk("rb", "RB", 2)];
    const needs = {
      base: { WR: 1, RB: 1 },
      flex: 0,
      superflex: 0,
    } as unknown as Parameters<typeof botPick>[1];
    let wr = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const rng = () => (i + 0.5) / N;
      if (botPick(avail, needs, 5, rng, recent) === "wr") wr++;
    }
    return wr / N;
  }
  it("raises the running position's selection share", () => {
    const noRun = shareOfWr([]);
    const run = shareOfWr(["WR", "WR", "WR", "WR"] as Position[]);
    expect(run).toBeGreaterThan(noRun);
  });
});
