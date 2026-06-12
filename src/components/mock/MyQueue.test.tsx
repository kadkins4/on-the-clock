import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MyQueue } from "./MyQueue";
import type { Player } from "../../types";

afterEach(cleanup);

function makePlayer(overrides: Partial<Player> = {}): Player {
  return {
    id: "p1",
    name: "Justin Jefferson",
    position: "WR",
    team: "MIN",
    overallRank: 1,
    byeWeek: 6,
    tier: 1,
    adp: 3.2,
    notes: "",
    flag: "none",
    draftStatus: "available",
    ...overrides,
  };
}

describe("MyQueue", () => {
  it("shows empty-state message when no players are queued", () => {
    render(
      <MyQueue
        players={[]}
        canDraft={true}
        onDraft={vi.fn()}
        onRemove={vi.fn()}
        onOpenPlayer={vi.fn()}
      />,
    );
    expect(screen.getByText(/star players to build your queue/i)).toBeTruthy();
  });

  it("renders queued players in order", () => {
    const players = [
      makePlayer({ id: "p1", name: "Player One", overallRank: 1 }),
      makePlayer({ id: "p2", name: "Player Two", overallRank: 2 }),
      makePlayer({ id: "p3", name: "Player Three", overallRank: 3 }),
    ];

    render(
      <MyQueue
        players={players}
        canDraft={true}
        onDraft={vi.fn()}
        onRemove={vi.fn()}
        onOpenPlayer={vi.fn()}
      />,
    );

    const nameButtons = screen
      .getAllByRole("button")
      .filter((b) => /Player (One|Two|Three)/.test(b.textContent ?? ""));
    expect(nameButtons[0].textContent).toContain("Player One");
    expect(nameButtons[1].textContent).toContain("Player Two");
    expect(nameButtons[2].textContent).toContain("Player Three");
  });

  it("calls onDraft with the player id when DRAFT button is clicked", () => {
    const onDraft = vi.fn();
    const player = makePlayer({ id: "p42" });

    render(
      <MyQueue
        players={[player]}
        canDraft={true}
        onDraft={onDraft}
        onRemove={vi.fn()}
        onOpenPlayer={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Draft Justin Jefferson"));
    expect(onDraft).toHaveBeenCalledOnce();
    expect(onDraft).toHaveBeenCalledWith("p42");
  });

  it("calls onRemove with the player id when ✕ button is clicked", () => {
    const onRemove = vi.fn();
    const player = makePlayer({ id: "p7" });

    render(
      <MyQueue
        players={[player]}
        canDraft={true}
        onDraft={vi.fn()}
        onRemove={onRemove}
        onOpenPlayer={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle("Remove Justin Jefferson from queue"));
    expect(onRemove).toHaveBeenCalledOnce();
    expect(onRemove).toHaveBeenCalledWith("p7");
  });

  it("calls onOpenPlayer with id when name button is clicked", () => {
    const onOpenPlayer = vi.fn();
    const player = makePlayer({ id: "p5", name: "Tyreek Hill" });

    render(
      <MyQueue
        players={[player]}
        canDraft={true}
        onDraft={vi.fn()}
        onRemove={vi.fn()}
        onOpenPlayer={onOpenPlayer}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Tyreek Hill" }));
    expect(onOpenPlayer).toHaveBeenCalledOnce();
    expect(onOpenPlayer).toHaveBeenCalledWith("p5");
  });

  it("disables DRAFT button when canDraft is false", () => {
    const player = makePlayer({ id: "p1" });

    render(
      <MyQueue
        players={[player]}
        canDraft={false}
        onDraft={vi.fn()}
        onRemove={vi.fn()}
        onOpenPlayer={vi.fn()}
      />,
    );

    const draftBtn = screen.getByTitle("Draft Justin Jefferson");
    expect((draftBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("does not show empty state when players are present", () => {
    const player = makePlayer();
    render(
      <MyQueue
        players={[player]}
        canDraft={true}
        onDraft={vi.fn()}
        onRemove={vi.fn()}
        onOpenPlayer={vi.fn()}
      />,
    );
    expect(screen.queryByText(/star players to build your queue/i)).toBeNull();
  });
});
