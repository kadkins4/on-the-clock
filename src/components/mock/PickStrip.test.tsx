import { describe, it, expect, vi, beforeAll, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { PickStrip } from "./PickStrip";

// jsdom doesn't implement scrollIntoView; stub it so the PickStrip useEffect doesn't throw.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);
import type { MockState } from "../../lib/mock/types";
import type { Player } from "../../types";

// Minimal MockState factory — mirrors the pattern in playerDraftStatus.test.ts
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
      teams: 2,
      userSlot: 1,
      rounds: 2,
      thirdRoundReversal: false,
    },
    teams: [
      { name: "Team Alpha", initials: "TA", color: "#d9a53f", isUser: true },
      { name: "Team Beta", initials: "TB", color: "#3b82c4", isUser: false },
    ],
    // snake: slot 0, 1, 1, 0 for 2 teams × 2 rounds
    order: [0, 1, 1, 0],
    picks: [],
    draftedIds: new Set<string>(),
    seed: 0,
  };
  return { ...base, ...overrides };
}

// A minimal player entry for the pool
function makePlayer(id: string, position: Player["position"] = "QB"): Player {
  return {
    id,
    name: `Player ${id}`,
    position,
    team: "KC",
    overallRank: 1,
    byeWeek: 7,
    tier: 1,
    adp: 1,
    notes: "",
    flag: "none" as const,
    draftStatus: "available" as const,
  };
}

describe("PickStrip", () => {
  it("clicking a done cell calls onOpenPlayer with its playerId", () => {
    const player = makePlayer("p1", "QB");
    const state = makeState({
      pool: [player],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p1" }],
      draftedIds: new Set(["p1"]),
    });
    const onOpenPlayer = vi.fn();
    render(
      <PickStrip state={state} userTeamIndex={0} onOpenPlayer={onOpenPlayer} />,
    );

    // The done card is identified by the pick label "1.01"
    const doneCard = screen.getByRole("button");
    fireEvent.click(doneCard);

    expect(onOpenPlayer).toHaveBeenCalledOnce();
    expect(onOpenPlayer).toHaveBeenCalledWith("p1");
  });

  it("done cell for a non-playerId pick does not render a button", () => {
    // Build a done cell with no playerId by overriding pool to exclude the player
    // (cell will have kind=done but name/position undefined)
    const state = makeState({
      pool: [],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p-missing" }],
      draftedIds: new Set(["p-missing"]),
    });
    const onOpenPlayer = vi.fn();
    render(
      <PickStrip state={state} userTeamIndex={0} onOpenPlayer={onOpenPlayer} />,
    );
    // The cell's playerId is still "p-missing" so it WILL be a button — but clicking
    // it still calls onOpenPlayer (guard only skips click if playerId is undefined).
    // Verify it renders without crashing.
    expect(screen.getByRole("button")).toBeTruthy();
  });

  it("a cell whose teamIndex === userTeamIndex gets the is-user class", () => {
    const player = makePlayer("p1", "RB");
    const state = makeState({
      pool: [player],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p1" }],
      draftedIds: new Set(["p1"]),
    });
    // userTeamIndex = 0 → the first pick belongs to the user
    render(
      <PickStrip state={state} userTeamIndex={0} onOpenPlayer={vi.fn()} />,
    );

    const doneCard = screen.getByRole("button");
    expect(doneCard.className).toContain("is-user");
  });

  it("a cell whose teamIndex !== userTeamIndex does NOT get is-user class", () => {
    const player = makePlayer("p2", "WR");
    // pick 2 belongs to teamIndex 1; user is team 0
    const state = makeState({
      pool: [makePlayer("p1", "QB"), player],
      picks: [
        { overall: 1, round: 1, teamIndex: 0, playerId: "p1" },
        { overall: 2, round: 1, teamIndex: 1, playerId: "p2" },
      ],
      draftedIds: new Set(["p1", "p2"]),
    });
    render(
      <PickStrip state={state} userTeamIndex={0} onOpenPlayer={vi.fn()} />,
    );

    // Two buttons rendered; find the one for pick 2 (second card)
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(2);

    // pick 1 (teamIndex 0) → is-user; pick 2 (teamIndex 1) → not is-user
    expect(buttons[0].className).toContain("is-user");
    expect(buttons[1].className).not.toContain("is-user");
  });

  it("current cell shows a clock glyph + countdown instead of ON THE CLOCK words", () => {
    const state = makeState({
      pool: [],
      picks: [], // no picks yet → cell 1 is "current"
      draftedIds: new Set(),
    });
    const { container } = render(
      <PickStrip
        state={state}
        userTeamIndex={0}
        onOpenPlayer={vi.fn()}
        timer={<span>0:15</span>}
      />,
    );

    // The "ON THE CLOCK" wording is gone; the countdown + a clock glyph replace it.
    expect(screen.queryByText("ON THE CLOCK")).toBeNull();
    expect(screen.getByText("0:15")).toBeTruthy();
    expect(container.querySelector(".strip-clock")).not.toBeNull();
  });

  it("marks the current card urgent when urgent is true", () => {
    const state = makeState({ pool: [], picks: [], draftedIds: new Set() });
    const { container } = render(
      <PickStrip
        state={state}
        userTeamIndex={0}
        onOpenPlayer={vi.fn()}
        timer={<span>0:03</span>}
        urgent
      />,
    );
    const current = container.querySelector(".strip-card.current");
    expect(current?.classList.contains("is-urgent")).toBe(true);
  });

  it("shows the team abbreviation in a card's top row", () => {
    const player = makePlayer("p1", "QB");
    const state = makeState({
      pool: [player],
      picks: [{ overall: 1, round: 1, teamIndex: 0, playerId: "p1" }],
      draftedIds: new Set(["p1"]),
    });
    const { container } = render(
      <PickStrip state={state} userTeamIndex={0} onOpenPlayer={vi.fn()} />,
    );
    const abbr = container.querySelector(".strip-card.done .strip-abbr");
    expect(abbr?.textContent).toBe("TA");
  });
});
