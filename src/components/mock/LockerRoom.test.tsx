import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LockerRoom } from "./LockerRoom";
import type { MockState } from "../../lib/mock/types";
import type { Player } from "../../types";

afterEach(cleanup);

// Minimal MockState factory — mirrors the pattern from playerDraftStatus.test.ts
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
      teams: 3,
      userSlot: 1,
      rounds: 15,
      thirdRoundReversal: false,
    },
    teams: [
      { name: "Your Team", initials: "YT", color: "#d9a53f", isUser: true },
      { name: "Team Beta", initials: "TB", color: "#7c3aed", isUser: false },
      { name: "Team Gamma", initials: "TG", color: "#0891b2", isUser: false },
    ],
    order: [0, 1, 2, 2, 1, 0], // 2 rounds, 3 teams
    picks: [],
    draftedIds: new Set<string>(),
    seed: 0,
  };
  return { ...base, ...overrides };
}

function makePlayer(
  id: string,
  name: string,
  position: Player["position"],
): Player {
  return {
    id,
    name,
    position,
    team: "KC",
    byeWeek: 14,
    overallRank: 1,
    adp: null,
    tier: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  };
}

describe("LockerRoom", () => {
  it("renders one column per team", () => {
    const state = makeState();
    const { container } = render(<LockerRoom state={state} />);
    const cols = container.querySelectorAll(".lr-col");
    expect(cols).toHaveLength(3);
  });

  it("renders the user column with gold/user class", () => {
    const state = makeState();
    const { container } = render(<LockerRoom state={state} />);
    const cols = container.querySelectorAll(".lr-col");
    expect(cols[0].classList.contains("lr-col-user")).toBe(true);
    expect(cols[1].classList.contains("lr-col-user")).toBe(false);
    expect(cols[2].classList.contains("lr-col-user")).toBe(false);
  });

  it("user column header has the user class for gold outline", () => {
    const state = makeState();
    const { container } = render(<LockerRoom state={state} />);
    const headers = container.querySelectorAll(".lr-header");
    expect(headers[0].classList.contains("lr-header-user")).toBe(true);
    expect(headers[1].classList.contains("lr-header-user")).toBe(false);
  });

  it("shows an empty marker when a team has no picks", () => {
    const state = makeState();
    const { container } = render(<LockerRoom state={state} />);
    const empties = container.querySelectorAll(".lr-empty");
    // All 3 teams have no picks
    expect(empties).toHaveLength(3);
  });

  it("renders drafted players as mini cards in their team column", () => {
    const qb = makePlayer("p1", "Patrick Mahomes", "QB");
    const rb = makePlayer("p2", "Christian McCaffrey", "RB");
    const state = makeState({
      pool: [qb, rb],
      picks: [
        { overall: 1, round: 1, teamIndex: 0, playerId: "p1" },
        { overall: 2, round: 1, teamIndex: 1, playerId: "p2" },
      ],
      draftedIds: new Set(["p1", "p2"]),
    });
    const { container } = render(<LockerRoom state={state} />);
    const cards = container.querySelectorAll("[data-testid='lr-pick-card']");
    // 1 pick per drafting team
    expect(cards).toHaveLength(2);

    // Team 0 (user) should show Mahomes's last name
    const col0 = container.querySelectorAll(".lr-col")[0];
    expect(col0.textContent).toContain("Mahomes");

    // Team 1 should show McCaffrey's last name
    const col1 = container.querySelectorAll(".lr-col")[1];
    expect(col1.textContent).toContain("McCaffrey");
  });

  it("shows the full player name on a pick card (not just the surname)", () => {
    const qb = makePlayer("p1", "Patrick Mahomes", "QB");
    const state = makeState({
      pool: [qb],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p1" }],
      draftedIds: new Set(["p1"]),
    });
    const { container } = render(<LockerRoom state={state} />);
    const name = container.querySelector(".lr-pick-name");
    expect(name?.textContent).toBe("Patrick Mahomes");
  });

  it("renders the needs footer for each column", () => {
    const state = makeState();
    const footers = screen.queryAllByTestId("lr-needs");
    // Use container query instead since screen needs the render
    const { container } = render(<LockerRoom state={state} />);
    const needs = container.querySelectorAll("[data-testid='lr-needs']");
    expect(needs).toHaveLength(3);
  });

  it("needs footer reflects drafted positions", () => {
    const qb = makePlayer("p1", "Patrick Mahomes", "QB");
    const state = makeState({
      pool: [qb],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p1" }],
      draftedIds: new Set(["p1"]),
    });
    const { container } = render(<LockerRoom state={state} />);
    const col0 = container.querySelectorAll(".lr-col")[0];
    const footer = col0.querySelector("[data-testid='lr-needs']");
    // User drafted 1 QB so QB need drops to 0
    expect(footer?.textContent).toContain("QB0");
    // RB need remains 2
    expect(footer?.textContent).toContain("RB2");
  });

  it("pick cards carry the pos-* class for position tinting", () => {
    const qb = makePlayer("p1", "Patrick Mahomes", "QB");
    const state = makeState({
      pool: [qb],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p1" }],
      draftedIds: new Set(["p1"]),
    });
    const { container } = render(<LockerRoom state={state} />);
    const card = container.querySelector("[data-testid='lr-pick-card']");
    expect(card?.classList.contains("pos-QB")).toBe(true);
  });
});
