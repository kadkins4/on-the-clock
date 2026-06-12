import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MyRoster } from "./MyRoster";
import type { MockState } from "../../lib/mock/types";
import type { Player } from "../../types";

afterEach(cleanup);

function makePlayer(id: string, over: Partial<Player> = {}): Player {
  return {
    id,
    name: `Name ${id}`,
    position: "RB",
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
    settings: { teams: 10, userSlot: 1, rounds: 15, thirdRoundReversal: false },
    teams: [
      { name: "Team Alpha", initials: "TA", color: "#f00", isUser: true },
      { name: "Team Beta", initials: "TB", color: "#0f0", isUser: false },
    ],
    order: [],
    picks: [],
    draftedIds: new Set(),
    seed: 0,
    ...over,
  };
}

describe("MyRoster", () => {
  it("shows the empty state when the user has no picks", () => {
    render(<MyRoster state={makeState()} userTeamIndex={0} />);
    expect(screen.getByText(/your picks will appear here/i)).toBeTruthy();
  });

  it("renders the user's drafted players with round", () => {
    const player = makePlayer("p1", { name: "Bijan Robinson", position: "RB" });
    const state = makeState({
      pool: [player],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p1" }],
      draftedIds: new Set(["p1"]),
    });
    render(<MyRoster state={state} userTeamIndex={0} />);
    expect(screen.getByText("Bijan Robinson")).toBeTruthy();
    expect(screen.getByText("R1")).toBeTruthy();
  });

  it("renders a needs summary that drops the drafted position", () => {
    const player = makePlayer("p1", { position: "RB" });
    const state = makeState({
      pool: [player],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p1" }],
      draftedIds: new Set(["p1"]),
    });
    render(<MyRoster state={state} userTeamIndex={0} />);
    // roster needs 2 RB; one drafted → "RB1" should appear in the needs line
    expect(screen.getByText(/RB1/)).toBeTruthy();
  });
});
