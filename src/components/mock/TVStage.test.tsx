import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TVStage } from "./TVStage";
import type { TvSnapshot } from "../../lib/mock/tvSnapshot";

afterEach(cleanup);

function makeSnapshot(overrides: Partial<TvSnapshot> = {}): TvSnapshot {
  return {
    complete: false,
    round: 1,
    overall: 3,
    totalPicks: 12,
    onClock: {
      name: "Your Team",
      initials: "YT",
      color: "#d9a53f",
      isUser: true,
    },
    currentRound: [
      {
        overall: 1,
        label: "1.01",
        initials: "YT",
        surname: "Allen",
        position: "QB",
        kind: "done",
      },
      {
        overall: 2,
        label: "1.02",
        initials: "BB",
        surname: "Hill",
        position: "WR",
        kind: "done",
      },
      {
        overall: 3,
        label: "1.03",
        initials: "YT",
        surname: null,
        position: null,
        kind: "current",
      },
      {
        overall: 4,
        label: "1.04",
        initials: "TT",
        surname: null,
        position: null,
        kind: "upcoming",
      },
    ],
    latest: {
      label: "1.02",
      name: "Tyreek Hill",
      surname: "Hill",
      position: "WR",
      team: "MIA",
      bye: 10,
      byTeam: "Bed Bath & Bijan",
    },
    upNext: [
      { initials: "CM", name: "Caleb Me Maybe", color: "#7c3aed" },
      { initials: "TT", name: "Tua Towers", color: "#0891b2" },
    ],
    ticker: [
      { label: "1.01", surname: "Allen", position: "QB" },
      { label: "1.02", surname: "Hill", position: "WR" },
    ],
    ...overrides,
  };
}

describe("TVStage", () => {
  it("renders the on-the-clock team name in the header", () => {
    render(<TVStage snapshot={makeSnapshot()} />);
    // getByText throws if not found — that's the assertion
    expect(screen.getByText("Your Team")).toBeTruthy();
  });

  it("renders THE BIG BOARD. title", () => {
    render(<TVStage snapshot={makeSnapshot()} />);
    expect(screen.getByText("THE BIG BOARD.")).toBeTruthy();
  });

  it("renders LIVE · ON THE CLOCK label", () => {
    render(<TVStage snapshot={makeSnapshot()} />);
    expect(screen.getByText(/LIVE/i)).toBeTruthy();
  });

  it("renders a split-flap row for each currentRound pick", () => {
    const { container } = render(<TVStage snapshot={makeSnapshot()} />);
    // Use DOM query on the flap board specifically to avoid ticker label collisions
    const flapRows = container.querySelectorAll(".tv-flap-row");
    expect(flapRows.length).toBe(4);
    // Verify pick labels appear within flap rows
    const pickLabels = Array.from(
      container.querySelectorAll(".tv-flap-pick"),
    ).map((el) => el.textContent);
    expect(pickLabels).toContain("1.01");
    expect(pickLabels).toContain("1.02");
    expect(pickLabels).toContain("1.03");
    expect(pickLabels).toContain("1.04");
  });

  it("renders 12 letter tiles per split-flap row", () => {
    const { container } = render(<TVStage snapshot={makeSnapshot()} />);
    const tileContainers = container.querySelectorAll(".tv-flap-tiles");
    expect(tileContainers.length).toBe(4); // one per currentRound pick
    // First done row: "Allen" = 5 letters + 7 blanks = 12 tiles
    const firstRowTiles = tileContainers[0].querySelectorAll(".tv-flap-tile");
    expect(firstRowTiles.length).toBe(12);
  });

  it("renders the latest-pick player name", () => {
    render(<TVStage snapshot={makeSnapshot()} />);
    expect(screen.getByText("Tyreek Hill")).toBeTruthy();
  });

  it("renders byTeam in the latest splash", () => {
    render(<TVStage snapshot={makeSnapshot()} />);
    expect(screen.getByText(/Bed Bath & Bijan/)).toBeTruthy();
  });

  it("renders up-next team initials", () => {
    const { container } = render(<TVStage snapshot={makeSnapshot()} />);
    // "TT" also appears as a flap-team label, use upnext section specifically
    const upnext = container.querySelector(".tv-upnext");
    expect(upnext).not.toBeNull();
    const initials = Array.from(
      upnext!.querySelectorAll(".tv-avatar-initials"),
    ).map((el) => el.textContent);
    expect(initials).toContain("CM");
    expect(initials).toContain("TT");
  });

  it("renders ticker entries with surnames", () => {
    const { container } = render(<TVStage snapshot={makeSnapshot()} />);
    const ticker = container.querySelector(".tv-ticker");
    expect(ticker).not.toBeNull();
    const names = Array.from(ticker!.querySelectorAll(".tv-ticker-name")).map(
      (el) => el.textContent,
    );
    expect(names).toContain("Allen");
    expect(names).toContain("Hill");
  });

  it("shows null state gracefully when onClock is null (complete draft)", () => {
    render(
      <TVStage snapshot={makeSnapshot({ complete: true, onClock: null })} />,
    );
    // No crash; big board title still renders
    expect(screen.getByText("THE BIG BOARD.")).toBeTruthy();
  });

  it("renders round/pick status", () => {
    const { container } = render(<TVStage snapshot={makeSnapshot()} />);
    const statusEl = container.querySelector(".tv-round-status");
    expect(statusEl).not.toBeNull();
    expect(statusEl!.textContent).toMatch(/R1/);
  });
});
