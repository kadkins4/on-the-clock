import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DevPanel } from "./DevPanel";

afterEach(cleanup);

const base = {
  players: [],
  refetch: null,
  errors: [],
  onClearErrors: () => {},
  onResetBoard: () => {},
  onClose: () => {},
};

describe("DevPanel", () => {
  it("shows the last refetch result when present", () => {
    render(
      <DevPanel
        {...base}
        refetch={{
          ok: false,
          at: Date.now(),
          reason: "too-few-ranked",
          fingerprint: "ranked=3",
        }}
      />,
    );
    expect(screen.getByText(/ranked=3/)).toBeTruthy();
  });
  it("lists runtime errors and clears them", () => {
    const onClearErrors = vi.fn();
    render(
      <DevPanel
        {...base}
        errors={[{ at: Date.now(), message: "boom", source: "onerror" }]}
        onClearErrors={onClearErrors}
      />,
    );
    expect(screen.getByText(/boom/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /clear errors/i }));
    expect(onClearErrors).toHaveBeenCalled();
  });
  it("Reset board confirms before calling onResetBoard", () => {
    const onResetBoard = vi.fn();
    const spy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<DevPanel {...base} onResetBoard={onResetBoard} />);
    fireEvent.click(screen.getByRole("button", { name: /reset board/i }));
    expect(onResetBoard).toHaveBeenCalled();
    spy.mockRestore();
  });
});
