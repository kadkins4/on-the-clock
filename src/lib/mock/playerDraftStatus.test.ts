import { describe, it, expect } from "vitest";
import { playerDraftStatus } from "./playerDraftStatus";
import type { MockState } from "./types";
import type { Player } from "../../types";

// Minimal MockState factory — only the fields playerDraftStatus touches.
function makeState(overrides: Partial<MockState> = {}): MockState {
  const base: MockState = {
    pool: [] as Player[],
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
    settings: {
      teams: 10,
      userSlot: 1,
      rounds: 15,
      thirdRoundReversal: false,
    },
    teams: [
      { name: "Team Alpha", initials: "TA", color: "#ff0000", isUser: true, strategy: null },
      { name: "Team Beta", initials: "TB", color: "#00ff00", isUser: false, strategy: null },
      { name: "Team Gamma", initials: "TG", color: "#0000ff", isUser: false, strategy: null },
    ],
    order: [],
    picks: [],
    draftedIds: new Set<string>(),
    seed: 0,
  };
  return { ...base, ...overrides };
}

describe("playerDraftStatus", () => {
  it("returns drafted:false for an undrafted player", () => {
    const state = makeState();
    expect(playerDraftStatus(state, "player-1")).toEqual({ drafted: false });
  });

  it("returns drafted:false when draftedIds is empty", () => {
    const state = makeState({ draftedIds: new Set() });
    expect(playerDraftStatus(state, "any-id")).toEqual({ drafted: false });
  });

  it("returns correct pickLabel and teamName for a drafted player", () => {
    const state = makeState({
      picks: [
        { overall: 1, round: 1, teamIndex: 0, playerId: "player-1" },
        { overall: 2, round: 1, teamIndex: 1, playerId: "player-2" },
        { overall: 13, round: 2, teamIndex: 2, playerId: "player-3" },
      ],
      draftedIds: new Set(["player-1", "player-2", "player-3"]),
    });

    // pick 1 in a 10-team league → "1.01", team index 0 = "Team Alpha"
    expect(playerDraftStatus(state, "player-1")).toEqual({
      drafted: true,
      pickLabel: "1.01",
      teamName: "Team Alpha",
    });

    // pick 2 → "1.02", team index 1 = "Team Beta"
    expect(playerDraftStatus(state, "player-2")).toEqual({
      drafted: true,
      pickLabel: "1.02",
      teamName: "Team Beta",
    });

    // pick 13 in a 10-team league → round 2, slot 3 → "2.03", team index 2 = "Team Gamma"
    expect(playerDraftStatus(state, "player-3")).toEqual({
      drafted: true,
      pickLabel: "2.03",
      teamName: "Team Gamma",
    });
  });

  it("returns drafted:false for a player not in draftedIds even if picks has other entries", () => {
    const state = makeState({
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "player-1" }],
      draftedIds: new Set(["player-1"]),
    });
    expect(playerDraftStatus(state, "player-99")).toEqual({ drafted: false });
  });
});
