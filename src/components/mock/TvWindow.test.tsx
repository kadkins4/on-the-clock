import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TvWindow } from "./TvWindow";

afterEach(cleanup);

describe("TvWindow announcer control", () => {
  it("waits for the draft but still offers the announcer", () => {
    render(<TvWindow />);
    expect(screen.getByText(/waiting for the draft/i)).toBeDefined();
    // Must be reachable BEFORE the first pick — the click is what unlocks
    // audio in this window, so it has to happen before anything needs speaking.
    expect(
      screen.getByRole("button", { name: /enable announcer/i }),
    ).toBeDefined();
  });

  it("is off by default", () => {
    render(<TvWindow />);
    const btn = screen.getByRole("button", { name: /enable announcer/i });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });

  it("turns on when clicked", () => {
    render(<TvWindow />);
    fireEvent.click(screen.getByRole("button", { name: /enable announcer/i }));
    const btn = screen.getByRole("button", { name: /announcer on/i });
    expect(btn.getAttribute("aria-pressed")).toBe("true");
  });

  it("turns back off — it is a toggle, not a one-way switch", () => {
    render(<TvWindow />);
    fireEvent.click(screen.getByRole("button", { name: /enable announcer/i }));
    fireEvent.click(screen.getByRole("button", { name: /announcer on/i }));
    const btn = screen.getByRole("button", { name: /enable announcer/i });
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });
});
