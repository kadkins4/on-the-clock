import { describe, it, expect } from "vitest";
import { dataQualityIssues } from "./dataQuality";
import type { Player } from "../types";

function p(over: Partial<Player>): Player {
  return {
    id: "1",
    name: "X",
    position: "RB",
    team: "ATL",
    overallRank: 1,
    byeWeek: 7,
    tier: 1,
    adp: 10,
    projStats: {} as never,
    lastStats: {} as never,
    notes: "",
    flag: "none",
    draftStatus: "available",
    ...over,
  };
}

describe("dataQualityIssues", () => {
  it("flags missing adp / bye / projStats / lastStats", () => {
    const issues = dataQualityIssues([
      p({ id: "a", adp: null }),
      p({ id: "b", byeWeek: null }),
      p({ id: "c", projStats: null }),
      p({ id: "d", lastStats: null, position: "WR" }),
    ]);
    const ids = issues.map((i) => i.id);
    expect(issues.length).toBeGreaterThan(0);
    expect(ids).toContain("a");
  });
  it("does not flag K/DST for missing projStats/lastStats", () => {
    const issues = dataQualityIssues([
      p({ id: "k", position: "K", projStats: null, lastStats: null }),
    ]);
    expect(issues.find((i) => i.id === "k")).toBeFalsy();
  });
  it("returns empty for a clean board", () => {
    expect(dataQualityIssues([p({})])).toEqual([]);
  });
});
