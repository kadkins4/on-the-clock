import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { RankCell } from "./RankCell";
import type { Player } from "../../types";

afterEach(cleanup);

function P(rank: number): Player {
  return {
    id: "p1",
    name: "Bijan",
    position: "RB",
    team: "ATL",
    overallRank: rank,
    byeWeek: null,
    tier: 1,
    adp: null,
    notes: "",
    flag: "none",
    draftStatus: "available",
  } as Player;
}

// RankCell renders a bare <td>; wrap it in a table so the DOM is valid.
function setup(rank = 3) {
  const dispatch = vi.fn();
  render(
    <table>
      <tbody>
        <tr>
          <RankCell player={P(rank)} dispatch={dispatch} />
        </tr>
      </tbody>
    </table>,
  );
  return dispatch;
}

describe("RankCell", () => {
  it("shows the rank and reveals an input pre-filled with it on double-click", () => {
    setup(3);
    fireEvent.doubleClick(screen.getByText("3"));
    const input = screen.getByRole("spinbutton") as HTMLInputElement;
    expect(input.value).toBe("3");
  });

  it("dispatches setRank with the typed value on Enter", () => {
    const dispatch = setup(3);
    fireEvent.doubleClick(screen.getByText("3"));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({
      type: "setRank",
      id: "p1",
      rank: 7,
    });
  });

  it("does not dispatch on Escape", () => {
    const dispatch = setup(3);
    fireEvent.doubleClick(screen.getByText("3"));
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: "7" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not dispatch when the rank is unchanged", () => {
    const dispatch = setup(3);
    fireEvent.doubleClick(screen.getByText("3"));
    const input = screen.getByRole("spinbutton");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(dispatch).not.toHaveBeenCalled();
  });
});
