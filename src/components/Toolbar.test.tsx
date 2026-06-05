import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
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
