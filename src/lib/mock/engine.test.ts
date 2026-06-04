import { describe, it, expect } from "vitest";
import {
  createMock,
  currentTeamIndex,
  available,
  draftPlayer,
  botPickId,
  undoLastPick,
  replacePick,
  rewindTo,
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

describe("replacePick", () => {
  const start = () =>
    createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );

  it("swaps the player at a pick and frees the old one", () => {
    let m = start();
    m = draftPlayer(m, "a"); // pick 1 = a
    const out = replacePick(m, 1, "d");
    expect(out.picks[0].playerId).toBe("d");
    expect(out.picks[0].teamIndex).toBe(m.picks[0].teamIndex); // slot kept
    expect(available(out).some((p) => p.id === "a")).toBe(true); // freed
    expect(available(out).some((p) => p.id === "d")).toBe(false); // taken
  });

  it("refuses an already-drafted or unknown replacement, or bad pick", () => {
    let m = start();
    m = draftPlayer(m, "a");
    m = draftPlayer(m, "b");
    expect(replacePick(m, 1, "b")).toBe(m); // b already drafted
    expect(replacePick(m, 1, "zzz")).toBe(m); // unknown
    expect(replacePick(m, 9, "d")).toBe(m); // no such pick
  });
});

describe("rewindTo", () => {
  const start = () =>
    createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );

  it("undoes back through the given pick (it goes back on the clock)", () => {
    let m = start();
    m = draftPlayer(m, "a"); // pick 1
    m = draftPlayer(m, "b"); // pick 2
    m = draftPlayer(m, "c"); // pick 3
    const out = rewindTo(m, 2); // undo picks 2 and 3
    expect(out.picks.map((p) => p.playerId)).toEqual(["a"]);
    expect(out.draftedIds.has("a")).toBe(true);
    expect(out.draftedIds.has("b")).toBe(false);
    expect(out.draftedIds.has("c")).toBe(false);
    expect(currentTeamIndex(out)).toBe(m.order[1]); // pick 2 on the clock
  });

  it("ignores out-of-range targets", () => {
    let m = start();
    m = draftPlayer(m, "a");
    expect(rewindTo(m, 0)).toBe(m);
    expect(rewindTo(m, 5)).toBe(m);
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

import { bestAvailableId } from "./engine";
import { makeLeague } from "../league";

describe("bestAvailableId", () => {
  it("returns the available player with the lowest overallRank", () => {
    const m = {
      pool: [
        { id: "x", overallRank: 3 },
        { id: "y", overallRank: 1 },
        { id: "z", overallRank: 2 },
      ],
      draftedIds: new Set<string>(["y"]),
    } as unknown as Parameters<typeof bestAvailableId>[0];
    expect(bestAvailableId(m)).toBe("z");
  });
});

it("createMock generates one team identity per team, user flagged", () => {
  const m = createMock(
    league(board),
    { teams: 10, userSlot: 4, thirdRoundReversal: false },
    42,
  );
  expect(m.teams).toHaveLength(10);
  expect(m.teams[3].isUser).toBe(true);
});

describe("createMock value config", () => {
  it("carries valueThreshold/enabled from the start settings", () => {
    const l = makeLeague({ name: "T", teams: 10, board: [] });
    const m = createMock(
      l,
      {
        teams: 10,
        userSlot: 1,
        thirdRoundReversal: false,
        valueThreshold: 12,
        valueFlagsEnabled: false,
      },
      1,
    );
    expect(m.settings.valueThreshold).toBe(12);
    expect(m.settings.valueFlagsEnabled).toBe(false);
  });
});

describe("createMock autoDraft setting", () => {
  it("carries autoDraft: true through to state.settings", () => {
    const l = makeLeague({ name: "T", teams: 10, board: [] });
    const m = createMock(
      l,
      {
        teams: 10,
        userSlot: 1,
        thirdRoundReversal: false,
        autoDraft: true,
      },
      1,
    );
    expect(m.settings.autoDraft).toBe(true);
  });
});
