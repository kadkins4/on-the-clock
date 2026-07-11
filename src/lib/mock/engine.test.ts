import { describe, it, expect } from "vitest";
import {
  createMock,
  currentTeamIndex,
  available,
  availableByBoard,
  draftPlayer,
  botPickId,
  undoLastPick,
  replacePick,
  rewindTo,
  isComplete,
  teamRosterPositions,
  simulateToEnd,
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

  it("honors an explicit rounds override over the roster size", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false, rounds: 5 },
      123,
    );
    expect(m.settings.rounds).toBe(5);
    expect(m.order).toHaveLength(10); // 2 teams × 5 rounds
  });

  it("builds a linear order when format is linear (every round forward)", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false, format: "linear" },
      123,
    );
    // 2 teams, roster size 3 rounds → each round runs 0,1
    expect(m.order).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it("snapshots a scoring override without touching the league", () => {
    const lg = league(board);
    const m = createMock(
      lg,
      { teams: 2, userSlot: 1, thirdRoundReversal: false, scoring: "standard" },
      123,
    );
    expect(m.scoring).toBe("standard");
    expect(lg.scoring).toBe("ppr");
  });

  it("snapshots a roster override and derives rounds + disabled from it", () => {
    const lg = league(board);
    const roster = {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 1,
      SUPERFLEX: 0,
      K: 0,
      DST: 0,
      bench: 0,
      disabled: ["K", "DST"] as Player["position"][],
    };
    const m = createMock(
      lg,
      { teams: 2, userSlot: 1, thirdRoundReversal: false, roster },
      123,
    );
    expect(m.roster).toEqual(roster);
    // rounds default = roster size = 1+2+2+1+1 = 7 → 14 picks
    expect(m.order).toHaveLength(14);
    // the override's disabled list drives the pool (QBs survive; they aren't
    // disabled), and the league's own roster is left untouched.
    expect(m.pool.some((pl) => pl.position === "QB")).toBe(true);
    expect(lg.roster.disabled).toContain("TE");
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

describe("availableByBoard", () => {
  it("returns undrafted players in board (overallRank) order, not ADP order", () => {
    // board order a,b,c,d but ADP order disagrees (pool is sorted by ADP)
    const divergent = [
      { ...p("a", "RB", 30), overallRank: 1 },
      { ...p("b", "WR", 5), overallRank: 2 },
      { ...p("c", "QB", 40), overallRank: 3 },
      { ...p("d", "RB", 10), overallRank: 4 },
    ];
    let m = createMock(
      league(divergent),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      1,
    );
    expect(m.pool.map((pl) => pl.id)).toEqual(["b", "d", "a", "c"]); // ADP
    expect(availableByBoard(m).map((pl) => pl.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
    m = draftPlayer(m, "b");
    expect(availableByBoard(m).map((pl) => pl.id)).toEqual(["a", "c", "d"]);
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

  it("never drafts K/DST early, even at a juicy ADP", () => {
    const kdstLeague: League = {
      ...league([
        p("k1", "K", 1), // best ADP in the pool
        p("dst1", "DST", 2),
        p("rb1", "RB", 3),
        p("wr1", "WR", 4),
        p("rb2", "RB", 5),
        p("wr2", "WR", 6),
        p("qb1", "QB", 7),
        p("qb2", "QB", 8),
        p("k2", "K", 9),
        p("dst2", "DST", 10),
      ]),
      roster: {
        QB: 1,
        RB: 1,
        WR: 1,
        TE: 0,
        FLEX: 0,
        SUPERFLEX: 0,
        K: 1,
        DST: 1,
        bench: 0,
        disabled: ["TE"],
      },
    };
    // 5 rounds; with K+DST open (+1 slack) bots may take them from round 3 on
    const m = createMock(
      kdstLeague,
      { teams: 2, userSlot: 2, thirdRoundReversal: false },
      7,
    );
    const id = botPickId(m); // round 1: 5 picks left > 3
    const picked = m.pool.find((pl) => pl.id === id)!;
    expect(["K", "DST"]).not.toContain(picked.position);
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

describe("bot personalities", () => {
  it("assigns bots a strategy by default", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      123,
    );
    const bots = m.teams.filter((t) => !t.isUser);
    expect(bots.some((t) => t.strategy !== null)).toBe(true);
  });

  it("leaves every team neutral when botPersonalities is false", () => {
    const m = createMock(
      league(board),
      {
        teams: 2,
        userSlot: 1,
        thirdRoundReversal: false,
        botPersonalities: false,
      },
      123,
    );
    expect(m.teams.every((t) => t.strategy === null)).toBe(true);
  });

  it("botPickId follows the on-the-clock team's strategy", () => {
    const base = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      123,
    );
    // Force the whole field to Zero RB, so whoever is picking fades the top RB.
    const zero = {
      ...base,
      teams: base.teams.map((t) => ({ ...t, strategy: "zeroRB" as const })),
    };
    const neutral = {
      ...base,
      teams: base.teams.map((t) => ({ ...t, strategy: null })),
    };
    expect(botPickId(neutral)).toBe("a"); // best RB by ADP
    expect(botPickId(zero)).toBe("b"); // Zero RB reaches past it for the WR
  });
});

describe("simulateToEnd", () => {
  it("fills the whole board in one call", () => {
    const m = createMock(
      league(board),
      { teams: 2, userSlot: 1, thirdRoundReversal: false },
      7,
    );
    const done = simulateToEnd(m);
    expect(isComplete(done)).toBe(true);
    expect(done.picks.length).toBe(done.order.length);
    // every pick is a distinct real player
    const ids = done.picks.map((p) => p.playerId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("is deterministic for a fixed seed", () => {
    const a = simulateToEnd(
      createMock(
        league(board),
        { teams: 2, userSlot: 1, thirdRoundReversal: false },
        3,
      ),
    );
    const b = simulateToEnd(
      createMock(
        league(board),
        { teams: 2, userSlot: 1, thirdRoundReversal: false },
        3,
      ),
    );
    expect(a.picks.map((p) => p.playerId)).toEqual(
      b.picks.map((p) => p.playerId),
    );
  });
});
