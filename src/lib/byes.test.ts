import { describe, it, expect } from "vitest";
import { withByeWeeks } from "./byes";
import { teamMeta } from "../data/teamMeta";
import type { Player } from "../types";

function mk(team: string): Player {
  return {
    id: team,
    name: team,
    position: "RB",
    team,
    overallRank: 1,
    byeWeek: null,
    tier: 1,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  };
}

describe("withByeWeeks", () => {
  it("fills byeWeek from teamMeta", () => {
    const [p] = withByeWeeks([mk("PIT")]);
    expect(p.byeWeek).toBe(teamMeta.PIT.byeWeek);
  });

  it("leaves byeWeek null for FA / unknown teams", () => {
    expect(withByeWeeks([mk("FA")])[0].byeWeek).toBeNull();
    expect(withByeWeeks([mk("XXX")])[0].byeWeek).toBeNull();
  });
});
