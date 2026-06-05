import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { InfoPage } from "./InfoPage";

afterEach(cleanup);

describe("InfoPage", () => {
  it("renders the About copy on the about page", () => {
    render(<InfoPage page="about" onBack={() => {}} />);
    expect(screen.getByText(/draft-day cheat sheet/i)).toBeTruthy();
  });

  it("renders the Log copy on the log page", () => {
    render(<InfoPage page="log" onBack={() => {}} />);
    expect(screen.getByText(/Multi-source ADP/i)).toBeTruthy();
  });

  it("calls onBack when the back link is clicked", () => {
    const onBack = vi.fn();
    render(<InfoPage page="about" onBack={onBack} />);
    fireEvent.click(screen.getByRole("button", { name: /back to board/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
