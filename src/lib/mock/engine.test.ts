import { describe, it, expect } from "vitest";
import {
  createMock,
  currentTeamIndex,
  available,
  draftPlayer,
  botPickId,
  undoLastPick,
  isComplete,
  teamRosterPositions,
} from "./engine";
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

describe("createMock", () => {
  it("builds order for teams*rounds and removes disabled positions", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      123,
    );
    // roster size = QB1+RB1+WR1 = 3 rounds; 2 teams → 6 picks
    expect(m.order).toHaveLength(6);
    expect(m.pool.every((pl) => pl.position !== "TE")).toBe(true);
  });
});

describe("draftPlayer + available", () => {
  it("removes drafted players and advances the pick", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    expect(currentTeamIndex(m)).toBe(0);
    m = draftPlayer(m, "a");
    expect(available(m).find((pl) => pl.id === "a")).toBeUndefined();
    expect(m.picks).toHaveLength(1);
    expect(currentTeamIndex(m)).toBe(1); // snake R1: team 0 then team 1
  });

  it("ignores a draft of an already-taken or unknown player", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    m = draftPlayer(m, "a");
    const same = draftPlayer(m, "a");
    expect(same).toBe(m);
    expect(draftPlayer(m, "zzz")).toBe(m);
  });
});

describe("botPickId", () => {
  it("returns a valid available id for the current bot team", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 2, thirdRoundReversal: false },
      7,
    );
    // userSlot 2 → team index 1; team 0 (a bot) is on the clock first
    const id = botPickId(m);
    expect(available(m).some((pl) => pl.id === id)).toBe(true);
  });
});

describe("undoLastPick", () => {
  it("restores the previous state", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    const before = available(m).length;
    m = draftPlayer(m, "a");
    m = undoLastPick(m);
    expect(available(m).length).toBe(before);
    expect(m.picks).toHaveLength(0);
    expect(currentTeamIndex(m)).toBe(0);
  });

  it("is a no-op with no picks", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    expect(undoLastPick(m)).toBe(m);
  });
});

describe("isComplete + teamRosterPositions", () => {
  it("completes after all picks and tracks each team's positions", () => {
    let m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    while (!isComplete(m)) m = draftPlayer(m, botPickId(m));
    expect(m.picks).toHaveLength(6);
    expect(teamRosterPositions(m, 0).length).toBe(3);
  });
});
