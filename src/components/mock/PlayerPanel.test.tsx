import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PlayerPanel } from "./PlayerPanel";
import type { Player } from "../../types";
import type { PlayerDraftStatus } from "../../lib/mock/playerDraftStatus";

afterEach(cleanup);

const PLAYER: Player = {
  id: "p1",
  name: "Justin Jefferson",
  position: "WR",
  team: "MIN",
  overallRank: 3,
  byeWeek: 6,
  tier: 1,
  adp: 3.2,
  notes: "",
  flag: "none",
  draftStatus: "available",
  projPoints: 312.4,
};

const UNDRAFTED: PlayerDraftStatus = { drafted: false };
const DRAFTED: PlayerDraftStatus = {
  drafted: true,
  pickLabel: "2.03",
  teamName: "Lamb Chops",
};

function renderPanel(
  player: Player | null,
  draftStatus: PlayerDraftStatus,
  onClose = vi.fn(),
  stats: { proj?: number | null; vor?: number | null } = {},
) {
  return render(
    <PlayerPanel
      player={player}
      draftStatus={draftStatus}
      onClose={onClose}
      proj={stats.proj}
      vor={stats.vor}
    />,
  );
}

describe("PlayerPanel", () => {
  it("renders nothing when player is null", () => {
    const { container } = renderPanel(null, UNDRAFTED);
    expect(container.firstChild).toBeNull();
  });

  it("renders the player name", () => {
    renderPanel(PLAYER, UNDRAFTED);
    expect(screen.getByText("Justin Jefferson")).toBeTruthy();
  });

  it("renders the ADP value", () => {
    renderPanel(PLAYER, UNDRAFTED);
    // adp 3.2 → rounded to "3"
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders projected points", () => {
    renderPanel(PLAYER, UNDRAFTED);
    expect(screen.getByText("312.4")).toBeTruthy();
  });

  it("shows STILL AVAILABLE for an undrafted player", () => {
    renderPanel(PLAYER, UNDRAFTED);
    expect(screen.getByText(/STILL AVAILABLE/i)).toBeTruthy();
  });

  it("shows DRAFTED label with pick and team for a drafted player", () => {
    renderPanel(PLAYER, DRAFTED);
    expect(screen.getByText(/DRAFTED 2\.03 · Lamb Chops/i)).toBeTruthy();
  });

  it("calls onClose when the ✕ CLOSE button is clicked", () => {
    const onClose = vi.fn();
    renderPanel(PLAYER, UNDRAFTED, onClose);
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose when the scrim is clicked", () => {
    const onClose = vi.fn();
    const { container } = renderPanel(PLAYER, UNDRAFTED, onClose);
    const scrim = container.querySelector(".pc-scrim");
    expect(scrim).toBeTruthy();
    fireEvent.click(scrim!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("calls onClose on Escape keydown", () => {
    const onClose = vi.fn();
    renderPanel(PLAYER, UNDRAFTED, onClose);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("shows team and bye inside the nameplate meta, without the position", () => {
    const { container } = renderPanel(PLAYER, UNDRAFTED);
    const meta = container.querySelector(".pc-meta");
    expect(meta?.textContent).toContain("MIN");
    expect(meta?.textContent).toContain("BYE 6");
    // Position is already shown by the badge — it must not repeat in the meta.
    expect(meta?.textContent).not.toContain("WR");
  });

  it("labels the gold value-over-replacement stat as VOR (not VALUE)", () => {
    renderPanel(PLAYER, UNDRAFTED);
    expect(screen.getByText("VOR")).toBeTruthy();
    expect(screen.queryByText("VALUE")).toBeNull();
  });

  it("renders the VOR value when provided, with a leading + for positive", () => {
    renderPanel(PLAYER, UNDRAFTED, vi.fn(), { vor: 42 });
    expect(screen.getByText("+42")).toBeTruthy();
  });

  it("renders a negative VOR without an extra sign", () => {
    renderPanel(PLAYER, UNDRAFTED, vi.fn(), { vor: -8 });
    expect(screen.getByText("-8")).toBeTruthy();
  });

  it("renders VOR as em-dash when no VOR data is supplied", () => {
    renderPanel(PLAYER, UNDRAFTED);
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it("prefers the scored proj prop over the raw projPoints", () => {
    renderPanel(PLAYER, UNDRAFTED, vi.fn(), { proj: 280.6 });
    expect(screen.getByText("280.6")).toBeTruthy();
    expect(screen.queryByText("312.4")).toBeNull();
  });

  it("renders PROJ as em-dash when projPoints is null", () => {
    const noProj: Player = { ...PLAYER, projPoints: null };
    renderPanel(noProj, UNDRAFTED);
    const dashes = screen.getAllByText("—");
    // PROJ + VALUE both become "—"
    expect(dashes.length).toBeGreaterThanOrEqual(2);
  });
});
