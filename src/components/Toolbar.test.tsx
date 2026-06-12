import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Toolbar } from "./Toolbar";
import type { ChipConfig } from "../lib/posFilter";
import type { Position } from "../types";

afterEach(cleanup);

const noop = () => {};
const baseChips: ChipConfig = {
  positions: ["QB", "RB", "WR", "TE"],
  flex: true,
  sflex: false,
};

function renderToolbar(
  over: Partial<React.ComponentProps<typeof Toolbar>> = {},
) {
  const props = {
    search: "",
    setSearch: noop,
    posChips: baseChips,
    activePos: new Set<Position>(),
    onToggleChip: vi.fn(),
    onApplyMacro: vi.fn(),
    hideDrafted: false,
    setHideDrafted: noop,
    byeFilter: null,
    setByeFilter: noop,
    byeWeeks: [],
    grouped: true,
    onBackToTiers: noop,
    filtersActive: false,
    onClearFilters: noop,
    onUndo: noop,
    canUndo: false,
    currentLeagueId: "l1",
    leagues: [{ id: "l1", name: "L", scoring: "ppr" as const }],
    onSwitchLeague: noop,
    onAddLeague: noop,
    onDuplicateLeague: noop,
    onRenameLeague: noop,
    onDeleteLeague: noop,
    tierLists: [{ id: "t1", name: "T" }],
    activeTierListId: "t1",
    defaultTierListId: "t1",
    onSwitchTierList: noop,
    onAddTierList: noop,
    onDuplicateTierList: noop,
    onRenameTierList: noop,
    onSetDefaultTierList: noop,
    onDeleteTierList: noop,
    onScoringChange: noop,
    hideK: false,
    onToggleK: noop,
    hideDst: false,
    onToggleDst: noop,
    onFetch: noop,
    fetching: false,
    onRefreshAdp: noop,
    adpStatus: null,
    onImport: noop,
    onExportJson: noop,
    onExportCsv: noop,
    scopePref: "ask" as const,
    onScopePrefChange: noop,
    onOpenColumns: noop,
    columnsOpen: false,
    sortMode: "tier" as const,
    onSortModeChange: vi.fn(),
    ...over,
  };
  return render(
    <Toolbar {...(props as React.ComponentProps<typeof Toolbar>)} />,
  );
}

describe("Toolbar chip bar", () => {
  it("renders All + FLEX + rostered positions; no SFLEX when sflex=false", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "All" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "FLEX" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "SFLEX" })).toBeNull();
    expect(screen.getByRole("button", { name: "QB" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "K" })).toBeNull();
  });
  it("shows SFLEX when sflex=true", () => {
    renderToolbar({ posChips: { ...baseChips, sflex: true } });
    expect(screen.getByRole("button", { name: "SFLEX" })).toBeTruthy();
  });
  it("All is active when no positions selected", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "All" }).className).toContain(
      "active",
    );
  });
});

describe("Toolbar sort mode toggle", () => {
  it('renders both "Tier" and "ADP" options', () => {
    renderToolbar({ sortMode: "tier" });
    expect(screen.getByRole("button", { name: "Tier" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "ADP" })).toBeTruthy();
  });

  it('"Tier" segment is active by default (sortMode="tier")', () => {
    renderToolbar({ sortMode: "tier" });
    const tierBtn = screen.getByRole("button", { name: "Tier" });
    const adpBtn = screen.getByRole("button", { name: "ADP" });
    expect(tierBtn.className).toContain("active");
    expect(adpBtn.className).not.toContain("active");
  });

  it('"ADP" segment is active when sortMode="adp"', () => {
    renderToolbar({ sortMode: "adp" });
    const tierBtn = screen.getByRole("button", { name: "Tier" });
    const adpBtn = screen.getByRole("button", { name: "ADP" });
    expect(adpBtn.className).toContain("active");
    expect(tierBtn.className).not.toContain("active");
  });

  it("calls onSortModeChange with 'adp' when ADP button is clicked", () => {
    const onSortModeChange = vi.fn();
    renderToolbar({ sortMode: "tier", onSortModeChange });
    fireEvent.click(screen.getByRole("button", { name: "ADP" }));
    expect(onSortModeChange).toHaveBeenCalledWith("adp");
  });

  it("calls onSortModeChange with 'tier' when Tier button is clicked in ADP mode", () => {
    const onSortModeChange = vi.fn();
    renderToolbar({ sortMode: "adp", onSortModeChange });
    fireEvent.click(screen.getByRole("button", { name: "Tier" }));
    expect(onSortModeChange).toHaveBeenCalledWith("tier");
  });
});
