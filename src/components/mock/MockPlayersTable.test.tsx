import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { MockPlayersTable } from "./MockPlayersTable";
import type { Player } from "../../types";
import type { PlayerDraftStatus } from "../../lib/mock/playerDraftStatus";

afterEach(cleanup);

function makePlayer(over: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Justin Jefferson",
    position: "WR",
    team: "MIN",
    overallRank: 3,
    byeWeek: 6,
    tier: 1,
    adp: 3.2,
    notes: "",
    flag: "none",
    draftStatus: "available",
    projPoints: 312.4,
    ...over,
  };
}

const available = (): PlayerDraftStatus & { initials?: string } => ({
  drafted: false,
});

const baseProps = {
  canDraft: true,
  draftStatusOf: available,
  onDraft: vi.fn(),
  onOpenPlayer: vi.fn(),
};

describe("MockPlayersTable", () => {
  it("renders the dense column headers", () => {
    render(<MockPlayersTable {...baseProps} players={[makePlayer()]} />);
    for (const h of [
      "#",
      "PLAYER",
      "POS",
      "TEAM",
      "ADP",
      "PROJ",
      "BYE",
      "STATUS",
    ]) {
      expect(screen.getByText(h)).toBeTruthy();
    }
  });

  it("shows a DRAFT button for an available player", () => {
    render(<MockPlayersTable {...baseProps} players={[makePlayer()]} />);
    const btn = screen.getByTitle("Draft Justin Jefferson");
    expect(btn.textContent).toBe("DRAFT");
  });

  it("shows pick · team and dims the row for a drafted player, no DRAFT button", () => {
    const draftStatusOf = (): PlayerDraftStatus & { initials?: string } => ({
      drafted: true,
      pickLabel: "3.04",
      teamName: "Coastal Bets",
      initials: "CB",
    });
    const { container } = render(
      <MockPlayersTable
        {...baseProps}
        draftStatusOf={draftStatusOf}
        players={[makePlayer()]}
      />,
    );
    expect(screen.getByText("3.04 · CB")).toBeTruthy();
    expect(screen.queryByTitle("Draft Justin Jefferson")).toBeNull();
    expect(container.querySelector(".mpt-row--drafted")).not.toBeNull();
  });

  it("calls onDraft when the DRAFT button is clicked", () => {
    const onDraft = vi.fn();
    render(
      <MockPlayersTable
        {...baseProps}
        onDraft={onDraft}
        players={[makePlayer({ id: "px" })]}
      />,
    );
    fireEvent.click(screen.getByTitle("Draft Justin Jefferson"));
    expect(onDraft).toHaveBeenCalledWith("px");
  });

  it("calls onOpenPlayer when the player name is clicked", () => {
    const onOpenPlayer = vi.fn();
    render(
      <MockPlayersTable
        {...baseProps}
        onOpenPlayer={onOpenPlayer}
        players={[makePlayer({ id: "px" })]}
      />,
    );
    fireEvent.click(screen.getByText("Justin Jefferson"));
    expect(onOpenPlayer).toHaveBeenCalledWith("px");
  });

  it("toggles the queue via the star button", () => {
    const onToggleQueue = vi.fn();
    render(
      <MockPlayersTable
        {...baseProps}
        players={[makePlayer({ id: "px" })]}
        queuedIds={new Set()}
        onToggleQueue={onToggleQueue}
      />,
    );
    fireEvent.click(screen.getByTitle("Add Justin Jefferson to queue"));
    expect(onToggleQueue).toHaveBeenCalledWith("px");
  });
});
