import { describe, it, expect } from "vitest";
import { scoreStatLine, projectedPoints, lastSeasonPoints } from "./projection";
import type { Player, ProjStats } from "../types";

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

function player(
  position: Player["position"],
  projStats: ProjStats | null,
  projPoints: number | null = null,
): Pick<Player, "position" | "projStats" | "projPoints"> {
  return { position, projStats, projPoints };
}

describe("projectedPoints", () => {
  it("scores a QB line with standard passing/rushing values", () => {
    const qb = player("QB", {
      ...zero,
      passYds: 4000,
      passTD: 30,
      int: 10,
      rushYds: 200,
      rushTD: 2,
    });
    // 4000*.04 + 30*4 + (-10*2) + 200*.1 + 2*6 = 160 + 120 - 20 + 20 + 12 = 292
    expect(projectedPoints(qb, "standard")).toBeCloseTo(292, 5);
  });

  it("applies the per-reception value by scoring", () => {
    const wr = player("WR", { ...zero, recYds: 1000, recTD: 8, rec: 90 });
    const baseNoRec = 1000 * 0.1 + 8 * 6; // 180
    expect(projectedPoints(wr, "standard")).toBeCloseTo(baseNoRec, 5);
    expect(projectedPoints(wr, "half")).toBeCloseTo(baseNoRec + 90 * 0.5, 5);
    expect(projectedPoints(wr, "ppr")).toBeCloseTo(baseNoRec + 90 * 1, 5);
  });

  it("adds TE premium only for tight ends", () => {
    const te = player("TE", { ...zero, rec: 80 });
    const wr = player("WR", { ...zero, rec: 80 });
    expect(projectedPoints(te, "ppr", true)).toBeCloseTo(80 * 1.5, 5);
    expect(projectedPoints(wr, "ppr", true)).toBeCloseTo(80 * 1, 5);
  });

  it("subtracts fumbles and counts two-point conversions", () => {
    const rb = player("RB", {
      ...zero,
      rushYds: 1000,
      fumblesLost: 3,
      twoPt: 2,
    });
    // 100 - 6 + 4 = 98
    expect(projectedPoints(rb, "standard")).toBeCloseTo(98, 5);
  });

  it("falls back to ESPN's total when there is no raw line (K/DST)", () => {
    expect(projectedPoints(player("K", null, 140), "ppr")).toBe(140);
    expect(projectedPoints(player("DST", null, null), "ppr")).toBeNull();
  });
});

describe("scoreStatLine", () => {
  it("scores receptions by scoring format", () => {
    const s: ProjStats = { ...zero, rec: 100, recYds: 1000 };
    expect(scoreStatLine(s, "WR", "ppr")).toBe(200); // 100*1 + 1000*0.1
    expect(scoreStatLine(s, "WR", "half")).toBe(150);
    expect(scoreStatLine(s, "WR", "standard")).toBe(100);
  });
  it("adds TE premium to receptions only for TEs", () => {
    const s: ProjStats = { ...zero, rec: 10 };
    expect(scoreStatLine(s, "TE", "ppr", true)).toBe(15); // 10*1.5
    expect(scoreStatLine(s, "WR", "ppr", true)).toBe(10);
  });
});

describe("lastSeasonPoints", () => {
  it("scores lastStats with the same core", () => {
    const p = {
      position: "RB",
      lastStats: { ...zero, rushYds: 1000, rushTD: 10 },
    } as Player;
    expect(lastSeasonPoints(p, "ppr")).toBe(160); // 1000*0.1 + 10*6
  });
  it("returns null when no last line (no projPoints fallback)", () => {
    const p = { position: "RB", lastStats: null } as Player;
    expect(lastSeasonPoints(p, "ppr")).toBeNull();
  });
});
