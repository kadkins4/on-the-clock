import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { DraftBoardGrid } from "./DraftBoardGrid";
import type { MockState } from "../../lib/mock/types";
import type { Player } from "../../types";

afterEach(cleanup);

function makeState(over: Partial<MockState> = {}): MockState {
  return {
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

describe("DraftBoardGrid", () => {
  it("renders the supplied timer node in the on-the-clock cell", () => {
    const { container } = render(
      <DraftBoardGrid
        state={makeState()}
        timer={<span data-testid="board-timer">0:04</span>}
      />,
    );
    const current = container.querySelector(".bcg-cell.current");
    expect(current).not.toBeNull();
    expect(
      current?.querySelector("[data-testid='board-timer']"),
    ).not.toBeNull();
  });

  it("marks the current cell urgent when urgent is true", () => {
    const { container } = render(
      <DraftBoardGrid state={makeState()} urgent timer={<span>0:03</span>} />,
    );
    const current = container.querySelector(".bcg-cell.current");
    expect(current?.classList.contains("is-urgent")).toBe(true);
  });

  it("does not mark the current cell urgent by default", () => {
    const { container } = render(
      <DraftBoardGrid state={makeState()} timer={<span>0:18</span>} />,
    );
    const current = container.querySelector(".bcg-cell.current");
    expect(current?.classList.contains("is-urgent")).toBe(false);
  });
});
