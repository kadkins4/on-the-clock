import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PickPool } from "./PickPool";
import type { Player } from "../../types";
import type { PlayerDraftStatus } from "../../lib/mock/playerDraftStatus";

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

const defaultProps = {
  canDraft: true,
  overall: 1,
  extraCols: [] as never[],
  onToggleCol: vi.fn(),
  onDraft: vi.fn(),
  onOpenPlayer: vi.fn(),
};

describe("PickPool", () => {
  it("renders a DRAFT button for an available player", () => {
    const player = makePlayer();
    render(<PickPool {...defaultProps} players={[player]} />);
    // The ＋ button should be present
    expect(screen.getByTitle("Draft Justin Jefferson")).toBeTruthy();
    // No .pp-status span (the pick·initials element) should exist
    expect(document.querySelector(".pp-status")).toBeNull();
  });

  it("labels the draft control with the word DRAFT (not a glyph)", () => {
    const player = makePlayer();
    render(<PickPool {...defaultProps} players={[player]} />);
    const btn = screen.getByTitle("Draft Justin Jefferson");
    expect(btn.textContent).toBe("DRAFT");
  });

  it("renders the player's overall rank in a rank cell", () => {
    const player = makePlayer({ overallRank: 7 });
    render(<PickPool {...defaultProps} players={[player]} />);
    const rank = document.querySelector(".pp-rank");
    expect(rank).not.toBeNull();
    expect(rank?.textContent).toBe("7");
  });

  it("renders dimmed row with pick status and no DRAFT button when draftStatusOf reports drafted", () => {
    const player = makePlayer({ id: "p1" });

    const draftStatusOf = (
      _id: string,
    ): PlayerDraftStatus & { initials?: string } => ({
      drafted: true,
      pickLabel: "3.04",
      teamName: "Coastal Bets",
      initials: "CB",
    });

    render(
      <PickPool
        {...defaultProps}
        players={[player]}
        draftStatusOf={draftStatusOf}
      />,
    );

    // Status text visible
    expect(screen.getByText("3.04 · CB")).toBeTruthy();

    // No DRAFT button
    expect(screen.queryByTitle("Draft Justin Jefferson")).toBeNull();

    // Row carries the drafted class
    const row = document.querySelector(".pp-row--drafted");
    expect(row).not.toBeNull();
  });

  it("does NOT dim the row when draftStatusOf returns drafted:false", () => {
    const player = makePlayer();

    const draftStatusOf = (
      _id: string,
    ): PlayerDraftStatus & { initials?: string } => ({
      drafted: false,
    });

    render(
      <PickPool
        {...defaultProps}
        players={[player]}
        draftStatusOf={draftStatusOf}
      />,
    );

    expect(screen.getByTitle("Draft Justin Jefferson")).toBeTruthy();
    expect(document.querySelector(".pp-row--drafted")).toBeNull();
  });

  it("renders tier headers", () => {
    const players = [
      makePlayer({ id: "p1", tier: 1 }),
      makePlayer({ id: "p2", name: "Ja'Marr Chase", tier: 1 }),
      makePlayer({ id: "p3", name: "CeeDee Lamb", tier: 2 }),
    ];

    render(<PickPool {...defaultProps} players={players} />);

    // Two distinct tiers → two tier headers
    const tiers = document.querySelectorAll(".pp-tier");
    expect(tiers.length).toBe(2);
    expect(tiers[0].textContent).toContain("Tier 1");
    expect(tiers[1].textContent).toContain("Tier 2");
  });

  it("renders PROJ and VOR extra columns from the supplied maps", () => {
    const player = makePlayer({ id: "p1" });
    render(
      <PickPool
        {...defaultProps}
        players={[player]}
        extraCols={["proj", "vor"]}
        projById={{ p1: 287.4 }}
        vorById={{ p1: 63 }}
      />,
    );
    const cells = [...document.querySelectorAll(".pp-x")].map(
      (n) => n.textContent,
    );
    expect(cells).toContain("287.4");
    expect(cells).toContain("+63"); // positive VOR gets a leading +
  });

  it("renders em-dash in PROJ/VOR columns when no map value exists", () => {
    const player = makePlayer({ id: "p1" });
    render(
      <PickPool
        {...defaultProps}
        players={[player]}
        extraCols={["proj", "vor"]}
        projById={{}}
        vorById={{}}
      />,
    );
    const cells = [...document.querySelectorAll(".pp-x")].map(
      (n) => n.textContent,
    );
    expect(cells.filter((t) => t === "—").length).toBe(2);
  });

  it("tier header count shows player count per tier", () => {
    const players = [
      makePlayer({ id: "p1", tier: 1 }),
      makePlayer({ id: "p2", name: "Ja'Marr Chase", tier: 1 }),
    ];

    render(<PickPool {...defaultProps} players={players} />);

    const tier = document.querySelector(".pp-tier");
    expect(tier?.textContent).toContain("2");
  });
});
