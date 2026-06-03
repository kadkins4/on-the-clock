import { describe, it, expect } from "vitest";
import {
  formatPick,
  buildPickCells,
  userColumnIndex,
  buildBoardGrid,
  userPickMarkers,
} from "./board";
import { createMock, draftPlayer } from "./engine";
import type { League, Player } from "../../types";

const p = (id: string, pos: Player["position"], adp: number): Player => ({
  id,
  name: id.toUpperCase(),
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

// 2 teams, roster = QB1/RB1/WR1 (rest disabled) => 3 rounds => 6 picks.
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
    WR: 1,
    TE: 0,
    FLEX: 0,
    SUPERFLEX: 0,
    K: 0,
    DST: 0,
    bench: 0,
    disabled: ["TE", "K", "DST"],
  },
  tierLists: [{ id: "tl", name: "Default", board }],
  activeTierListId: "tl",
  defaultTierListId: "tl",
  updatedAt: 0,
});

const board = [
  p("a", "RB", 1),
  p("b", "WR", 2),
  p("c", "QB", 3),
  p("d", "RB", 4),
  p("e", "WR", 5),
  p("f", "QB", 6),
];

describe("formatPick", () => {
  it("formats round and 2-digit slot within the round", () => {
    expect(formatPick(1, 12)).toBe("1.01");
    expect(formatPick(4, 12)).toBe("1.04");
    expect(formatPick(12, 12)).toBe("1.12");
  });

  it("rolls over to the next round", () => {
    expect(formatPick(13, 12)).toBe("2.01");
    expect(formatPick(25, 12)).toBe("3.01");
  });
});

describe("buildPickCells", () => {
  it("marks the first pick current and the rest upcoming at draft start", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    const cells = buildPickCells(m);
    expect(cells).toHaveLength(6); // order length
    expect(cells[0].kind).toBe("current");
    expect(cells[0].label).toBe("1.01");
    expect(cells[0].teamLabel).toBe("Team 1");
    expect(cells[1].kind).toBe("upcoming");
  });

  it("fills completed picks with player name/position and advances current", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    m = draftPlayer(m, "a"); // overall 1, team 0
    const cells = buildPickCells(m);
    expect(cells[0].kind).toBe("done");
    expect(cells[0].name).toBe("A");
    expect(cells[0].position).toBe("RB");
    expect(cells[1].kind).toBe("current");
  });
});

describe("userColumnIndex", () => {
  it("is the 0-based user slot", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 2, thirdRoundReversal: false },
      1,
    );
    expect(userColumnIndex(m)).toBe(1);
  });
});

describe("buildBoardGrid", () => {
  it("is a rounds x teams matrix, null where unpicked", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    const grid = buildBoardGrid(m);
    expect(grid).toHaveLength(3); // 3 rounds
    expect(grid[0]).toHaveLength(2); // 2 teams
    expect(grid[0][0]).toBeNull();
  });

  it("places picks by team column and honors snake order across rounds", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    m = draftPlayer(m, "a"); // overall 1 -> round 1, team 0
    m = draftPlayer(m, "b"); // overall 2 -> round 1, team 1
    m = draftPlayer(m, "c"); // overall 3 -> round 2, team 1 (snake reverses)
    const grid = buildBoardGrid(m);
    expect(grid[0][0]?.name).toBe("A");
    expect(grid[0][1]?.name).toBe("B");
    // round 2 first sequential pick ("2.01") belongs to team 1's column
    expect(grid[1][1]?.name).toBe("C");
    expect(grid[1][1]?.label).toBe("2.01");
    expect(grid[1][0]).toBeNull();
  });
});

describe("userPickMarkers", () => {
  // 2-team snake order = teams [0,1,1,0,0,1]; user (slot 2 -> team 1) picks at
  // overall 2, 3, 6.
  it("marks where the user's upcoming picks land in board order", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 2, thirdRoundReversal: false },
      1,
    );
    expect(userPickMarkers(m, 1)).toEqual([
      { availIndex: 1, overall: 2, round: 1 },
      { availIndex: 2, overall: 3, round: 2 },
      { availIndex: 5, overall: 6, round: 3 },
    ]);
  });

  it("offsets by picks already made so availIndex tracks the available list", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 2, thirdRoundReversal: false },
      1,
    );
    m = draftPlayer(m, "a"); // overall 1 done; on the clock is now overall 2
    const markers = userPickMarkers(m, 1);
    // the user's next pick (overall 2) is the top of the available list
    expect(markers[0]).toEqual({ availIndex: 0, overall: 2, round: 1 });
    expect(markers.map((x) => x.availIndex)).toEqual([0, 1, 4]);
  });
});

describe("buildPickCells value signal", () => {
  it("flags a made pick that cleared the threshold vs ADP", () => {
    const player = (id: string, adp: number) => ({
      id,
      name: id,
      position: "RB" as const,
      team: "FA",
      overallRank: 1,
      byeWeek: null,
      tier: null,
      adp,
      notes: "",
      flag: "none" as const,
      draftStatus: "available" as const,
    });
    const m = {
      pool: [player("a", 20)],
      order: [0, 1],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "a" }],
      draftedIds: new Set(["a"]),
      settings: {
        teams: 2,
        userSlot: 1,
        rounds: 1,
        thirdRoundReversal: false,
        valueThreshold: 14,
        valueFlagsEnabled: true,
      },
    } as unknown as Parameters<typeof buildPickCells>[0];
    const done = buildPickCells(m).find((c) => c.kind === "done")!;
    expect(done.signal).toEqual({ kind: "reach", amount: 19 });
  });

  it("attaches no signal when value flags are disabled", () => {
    const player = {
      id: "a",
      name: "a",
      position: "RB" as const,
      team: "FA",
      overallRank: 1,
      byeWeek: null,
      tier: null,
      adp: 20,
      notes: "",
      flag: "none" as const,
      draftStatus: "available" as const,
    };
    const m = {
      pool: [player],
      order: [0, 1],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "a" }],
      draftedIds: new Set(["a"]),
      settings: {
        teams: 2,
        userSlot: 1,
        rounds: 1,
        thirdRoundReversal: false,
        valueThreshold: 14,
        valueFlagsEnabled: false,
      },
    } as unknown as Parameters<typeof buildPickCells>[0];
    expect(
      buildPickCells(m).find((c) => c.kind === "done")!.signal,
    ).toBeUndefined();
  });
});
