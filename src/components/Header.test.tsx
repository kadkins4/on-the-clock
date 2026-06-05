import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Header } from "./Header";

afterEach(cleanup);

function setup(over: Partial<React.ComponentProps<typeof Header>> = {}) {
  const props = {
    onBrandClick: vi.fn(),
    onAbout: vi.fn(),
    onLog: vi.fn(),
    ...over,
  };
  render(<Header {...props} />);
  return props;
}

describe("Header", () => {
  it("renders the tagline and nav links", () => {
    setup();
    expect(screen.getByText("draft day cheat sheet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "About" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Log" })).toBeTruthy();
  });

  it("fires the matching handler for each nav link", () => {
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "About" }));
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    expect(p.onAbout).toHaveBeenCalledTimes(1);
    expect(p.onLog).toHaveBeenCalledTimes(1);
  });

  it("fires onBrandClick from the brand button", () => {
    const p = setup();
    fireEvent.click(
      screen.getByRole("button", { name: /refresh and replay/i }),
    );
    expect(p.onBrandClick).toHaveBeenCalledTimes(1);
  });
});
