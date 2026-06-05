import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Header } from "./Header";

afterEach(cleanup);

function setup(over: Partial<React.ComponentProps<typeof Header>> = {}) {
  const props = {
    onBrandClick: vi.fn(),
    onAbout: vi.fn(),
    onLog: vi.fn(),
    onMock: vi.fn(),
    onDraft: vi.fn(),
    ...over,
  };
  render(<Header {...props} />);
  return props;
}

describe("Header", () => {
  it("renders the tagline, links and action buttons", () => {
    setup();
    expect(screen.getByText("draft day cheat sheet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "About" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mock" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Draft" })).toBeTruthy();
  });

  it("fires the matching handler for each action", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    fireEvent.click(screen.getByRole("button", { name: "Mock" }));
    fireEvent.click(screen.getByRole("button", { name: "Draft" }));
    expect(p.onAbout).toHaveBeenCalledTimes(1);
    expect(p.onLog).toHaveBeenCalledTimes(1);
    expect(p.onMock).toHaveBeenCalledTimes(1);
    expect(p.onDraft).toHaveBeenCalledTimes(1);
  });

  it("fires onBrandClick from the brand button", () => {
    const p = setup();
    fireEvent.click(
      screen.getByRole("button", { name: /refresh and replay/i }),
    );
    expect(p.onBrandClick).toHaveBeenCalledTimes(1);
  });
});
