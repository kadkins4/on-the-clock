import { describe, it, expect } from "vitest";
import { mockSummary } from "./summary";
import { createMock, draftPlayer } from "./engine";
import type { League, Player } from "../../types";

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

const league = (board: Player[]): League => ({
  id: "L",
  name: "Test",
  platform: "espn",
  scoring: "ppr",
  tePremium: false,
  teams: 2,
  roster: {
    QB: 1,
    RB: 1,
    WR: 0,
    TE: 0,
    FLEX: 0,
    SUPERFLEX: 0,
    K: 0,
    DST: 0,
    bench: 0,
    disabled: ["WR", "TE", "K", "DST"],
  },
  tierLists: [{ id: "tl", name: "Default", board }],
  activeTierListId: "tl",
  defaultTierListId: "tl",
  updatedAt: 0,
});

const board = [
  p("a", "RB", 1),
  p("b", "QB", 2),
  p("c", "RB", 3),
  p("d", "QB", 4),
];

describe("mockSummary", () => {
  it("lists the user's picks and positional counts", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    // 2-team snake order is [0,1,1,0]: user (team 0) picks overall #1 and #4.
    // Sequence a,b,d,c → user ends with a (RB) and c (RB).
    m = draftPlayer(m, "a"); // pick 1, user
    m = draftPlayer(m, "b"); // pick 2, bot
    m = draftPlayer(m, "d"); // pick 3, bot
    m = draftPlayer(m, "c"); // pick 4, user
    const s = mockSummary(m, 0);
    expect(s.players.map((pl) => pl.id)).toEqual(["a", "c"]);
    expect(s.positionCounts.RB).toBe(2);
  });

  it("flags value (drafted later than ADP) and reach (earlier)", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false, valueThreshold: 2 },
      1,
    );
    // user team 0 takes "c" (adp 3) at overall pick 1 → a reach of +2
    m = draftPlayer(m, "c");
    m = draftPlayer(m, "a");
    m = draftPlayer(m, "b");
    m = draftPlayer(m, "d");
    const s = mockSummary(m, 0);
    const c = s.players.find((pl) => pl.id === "c")!;
    expect(c.overallPick).toBe(1);
    expect(c.adpDelta).toBe(2); // adp 3 - pick 1 = +2 (reach)
    expect(c.adpFlag).toBe("reach"); // +2 with an explicit threshold of 2
  });

  it("does not flag when value flags are disabled", () => {
    let m = createMock(
      league(board),
      {
        teams: 2,
        userSlot: 1,
        thirdRoundReversal: false,
        valueThreshold: 2,
        valueFlagsEnabled: false,
      },
      1,
    );
    m = draftPlayer(m, "c");
    m = draftPlayer(m, "a");
    m = draftPlayer(m, "b");
    m = draftPlayer(m, "d");
    const c = mockSummary(m, 0).players.find((pl) => pl.id === "c")!;
    expect(c.adpDelta).toBe(2); // delta still reported
    expect(c.adpFlag).toBeNull(); // but no flag when disabled
  });
});
