import { describe, it, expect, vi, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  cleanup,
} from "@testing-library/react";
import { DstPage } from "./DstPage";

// No global RTL auto-cleanup is configured in this repo, so tear down between
// tests to keep multiple DstPage renders from colliding in the DOM.
afterEach(cleanup);

describe("DstPage", () => {
  it("renders all 32 defenses, sorted by DST rank by default", () => {
    render(<DstPage onBack={vi.fn()} />);
    const rows = screen.getAllByRole("row").slice(1); // drop header row
    expect(rows).toHaveLength(32);
    // Rank 1 first.
    expect(within(rows[0]).getByText("Texans")).toBeTruthy();
    expect(within(rows[0]).getByText("HOU")).toBeTruthy();
  });

  it("marks the top target tier with a star", () => {
    render(<DstPage onBack={vi.fn()} />);
    // targetCount is 3 → three ★ flags.
    expect(screen.getAllByText("★")).toHaveLength(3);
  });

  it("sorts descending when a numeric header is clicked", () => {
    render(<DstPage onBack={vi.fn()} />);
    fireEvent.click(screen.getByText("Proj TO"));
    const rows = screen.getAllByRole("row").slice(1);
    // Bears lead the league in projected takeaways (33).
    expect(within(rows[0]).getByText("Bears")).toBeTruthy();
  });

  it("reverses sort direction on a second click of the same header", () => {
    render(<DstPage onBack={vi.fn()} />);
    const header = screen.getByText("Proj TO");
    fireEvent.click(header); // desc
    fireEvent.click(header); // asc
    const rows = screen.getAllByRole("row").slice(1);
    // Jets are lowest in takeaways (4).
    expect(within(rows[0]).getByText("Jets")).toBeTruthy();
  });

  it("calls onBack when the back link is clicked", () => {
    const onBack = vi.fn();
    render(<DstPage onBack={onBack} />);
    fireEvent.click(screen.getByText("← Back to board"));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
