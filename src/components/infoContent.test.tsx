import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AboutContent, LogContent } from "./infoContent";

afterEach(cleanup);

describe("info content", () => {
  it("AboutContent describes the app", () => {
    render(<AboutContent />);
    expect(screen.getByText(/draft-day cheat sheet/i)).toBeTruthy();
  });

  it("LogContent lists shipped items", () => {
    render(<LogContent />);
    expect(screen.getByText(/Multi-source ADP/i)).toBeTruthy();
  });
});
