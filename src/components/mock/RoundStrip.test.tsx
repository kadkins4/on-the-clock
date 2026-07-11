import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RoundStrip } from "./RoundStrip";
import type { MockState } from "../../lib/mock/types";
import type { Player } from "../../types";

afterEach(cleanup);

function makePlayer(id: string, over: Partial<Player> = {}): Player {
  return {
    id,
    name: `Name ${id}`,
    position: "WR",
    team: "KC",
    overallRank: 1,
    byeWeek: 7,
    tier: 1,
    adp: 1,
    notes: "",
    flag: "none",
    draftStatus: "available",
    ...over,
  };
}

function makeState(over: Partial<MockState> = {}): MockState {
  return {
    pool: [],
    scoring: "ppr",
    roster: {
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
    },
    settings: { teams: 2, userSlot: 1, rounds: 3, thirdRoundReversal: false },
    teams: [
      { name: "Team Alpha", initials: "TA", color: "#f00", isUser: true, strategy: null },
      { name: "Team Beta", initials: "TB", color: "#0f0", isUser: false, strategy: null },
    ],
    order: [0, 1, 1, 0, 0, 1], // 2 teams, snake, 3 rounds
    picks: [],
    draftedIds: new Set(),
    seed: 0,
    ...over,
  };
}

describe("RoundStrip", () => {
  it("renders the round title and one row per team in that round", () => {
    const state = makeState();
    render(<RoundStrip state={state} round={1} />);
    expect(screen.getByText("Round 1")).toBeTruthy();
    // 2 teams → 2 pick labels for round 1
    expect(screen.getByText("1.01")).toBeTruthy();
    expect(screen.getByText("1.02")).toBeTruthy();
  });

  it("shows the player name for a completed pick", () => {
    const player = makePlayer("p1", { name: "Justin Jefferson" });
    const state = makeState({
      pool: [player],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p1" }],
      draftedIds: new Set(["p1"]),
    });
    render(<RoundStrip state={state} round={1} />);
    expect(screen.getByText("Justin Jefferson")).toBeTruthy();
  });

  it("marks the current pick with an ON THE CLOCK label", () => {
    const state = makeState({ picks: [], draftedIds: new Set() });
    render(<RoundStrip state={state} round={1} />);
    expect(screen.getByText("ON THE CLOCK")).toBeTruthy();
  });

  it("only renders the requested round's picks", () => {
    const state = makeState();
    render(<RoundStrip state={state} round={2} />);
    expect(screen.getByText("2.01")).toBeTruthy();
    expect(screen.queryByText("1.01")).toBeNull();
  });
});
