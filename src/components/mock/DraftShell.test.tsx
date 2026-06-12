import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DraftShell } from "./DraftShell";

afterEach(cleanup);

function renderShell(
  over: Partial<React.ComponentProps<typeof DraftShell>> = {},
) {
  const props: React.ComponentProps<typeof DraftShell> = {
    tab: "draft",
    onTabChange: vi.fn(),
    teamName: "Team One",
    initials: "T1",
    color: "#3366cc",
    pickLabel: "3.04",
    isUser: false,
    isComplete: false,
    timer: <span data-testid="timer">0:20</span>,
    statusLine: "R3 · PICK 28 OF 180",
    children: <div data-testid="body">body</div>,
    ...over,
  };
  return render(<DraftShell {...props} />);
}

describe("DraftShell", () => {
  it("renders all four tabs", () => {
    renderShell();
    for (const label of ["Players", "Draft", "Board", "TV Mode"]) {
      expect(screen.getByRole("tab", { name: label })).toBeTruthy();
    }
  });

  it("marks the active tab and renders children", () => {
    renderShell({ tab: "board" });
    expect(screen.getByRole("tab", { name: "Board" }).className).toContain(
      "active",
    );
    expect(screen.getByRole("tab", { name: "Draft" }).className).not.toContain(
      "active",
    );
    expect(screen.getByTestId("body")).toBeTruthy();
  });

  it("calls onTabChange when a tab is clicked", () => {
    const onTabChange = vi.fn();
    renderShell({ onTabChange });
    fireEvent.click(screen.getByRole("tab", { name: "Players" }));
    expect(onTabChange).toHaveBeenCalledWith("players");
  });

  it("pill gets the is-user (gold) modifier only on the user's turn", () => {
    const { container, rerender } = renderShell({ isUser: false });
    expect(container.querySelector(".otc-pill.is-user")).toBeNull();
    rerender(
      <DraftShell
        tab="draft"
        onTabChange={vi.fn()}
        teamName="Team One"
        initials="T1"
        color="#3366cc"
        pickLabel="3.04"
        isUser
        isComplete={false}
        timer={null}
        statusLine="R3 · PICK 28 OF 180"
      >
        <div />
      </DraftShell>,
    );
    expect(container.querySelector(".otc-pill.is-user")).toBeTruthy();
  });

  it("hides the pill when the draft is complete", () => {
    const { container } = renderShell({ isComplete: true });
    expect(container.querySelector(".otc-pill")).toBeNull();
  });
});
