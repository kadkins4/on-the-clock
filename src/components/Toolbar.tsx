import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Position, Scoring } from "../types";
import {
  setsEqual,
  FLEX_SET,
  SFLEX_SET,
  type ChipConfig,
  type Macro,
} from "../lib/posFilter";
import type { SortMode } from "../lib/storage";
import { SearchPill } from "./SearchPill";

interface Props {
  search: string;
  setSearch: (s: string) => void;
  posChips: ChipConfig;
  activePos: ReadonlySet<Position>;
  onToggleChip: (p: Position) => void;
  onApplyMacro: (m: Macro) => void;
  hideDrafted: boolean;
  setHideDrafted: (b: boolean) => void;
  byeFilter: number | null;
  setByeFilter: (b: number | null) => void;
  byeWeeks: number[];
  grouped: boolean;
  onBackToTiers: () => void;
  filtersActive: boolean;
  onClearFilters: () => void;
  onUndo: () => void;
  canUndo: boolean;
  currentLeagueId: string;
  leagues: { id: string; name: string; scoring: Scoring }[];
  onSwitchLeague: (id: string) => void;
  onAddLeague: () => void;
  onDuplicateLeague: () => void;
  onRenameLeague: () => void;
  onDeleteLeague: () => void;
  tierLists: { id: string; name: string }[];
  activeTierListId: string;
  defaultTierListId: string;
  onSwitchTierList: (id: string) => void;
  onAddTierList: () => void;
  onDuplicateTierList: () => void;
  onRenameTierList: () => void;
  onDeleteTierList: () => void;
  onSetDefaultTierList: () => void;
  onScoringChange: (scoring: Scoring) => void;
  hideK: boolean;
  onToggleK: () => void;
  hideDst: boolean;
  onToggleDst: () => void;
  onFetch: () => void;
  fetching: boolean;
  adpStatus: string | null;
  onImport: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  scopePref: "ask" | "all" | "this";
  onScopePrefChange: (p: "ask" | "all" | "this") => void;
  onOpenColumns: () => void;
  columnsOpen: boolean;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  children?: ReactNode; // the column-manager popover, anchored to the ⚙ Columns trigger
}

export function Toolbar(props: Props) {
  return (
    <div className="toolbar">
      <SearchPill value={props.search} onChange={props.setSearch} />
      <div className="chips">
        <button
          className={
            props.activePos.size === 0 ? "chip macro active" : "chip macro"
          }
          onClick={() => props.onApplyMacro("ALL")}
        >
          All
        </button>
        {props.posChips.flex && (
          <button
            className={
              setsEqual(props.activePos, FLEX_SET)
                ? "chip macro active"
                : "chip macro"
            }
            onClick={() => props.onApplyMacro("FLEX")}
          >
            FLEX
          </button>
        )}
        {props.posChips.sflex && (
          <button
            className={
              setsEqual(props.activePos, SFLEX_SET)
                ? "chip macro active"
                : "chip macro"
            }
            onClick={() => props.onApplyMacro("SFLEX")}
          >
            SFLEX
          </button>
        )}
        {props.posChips.positions.map((p) => (
          <button
            key={p}
            className={props.activePos.has(p) ? "chip active" : "chip"}
            onClick={() => props.onToggleChip(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <button
        className={props.hideDrafted ? "hide-drafted active" : "hide-drafted"}
        aria-pressed={props.hideDrafted}
        onClick={() => props.setHideDrafted(!props.hideDrafted)}
        title="Hide players already drafted"
      >
        {props.hideDrafted ? "✓ HIDING DRAFTED" : "HIDE DRAFTED"}
      </button>
      <label>
        Bye:{" "}
        <select
          value={props.byeFilter ?? "all"}
          onChange={(e) =>
            props.setByeFilter(
              e.target.value === "all" ? null : Number(e.target.value),
            )
          }
        >
          <option value="all">All</option>
          {props.byeWeeks.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>
      <div className="sort-mode-toggle" role="group" aria-label="Sort mode">
        <button
          className={
            props.sortMode === "tier" ? "sort-mode-btn active" : "sort-mode-btn"
          }
          onClick={() => props.onSortModeChange("tier")}
          aria-pressed={props.sortMode === "tier"}
        >
          Tier
        </button>
        <button
          className={
            props.sortMode === "adp" ? "sort-mode-btn active" : "sort-mode-btn"
          }
          onClick={() => props.onSortModeChange("adp")}
          aria-pressed={props.sortMode === "adp"}
        >
          ADP
        </button>
      </div>
      <button
        className={props.grouped ? "tiers-btn active" : "tiers-btn"}
        onClick={props.onBackToTiers}
        title="Group by tier (default view)"
      >
        ↩ Tiers
      </button>
      <button
        className="clear-filters"
        onClick={props.onClearFilters}
        disabled={!props.filtersActive}
        title="Reset search, position, bye & sort (keeps your league and tier list)"
      >
        Clear filters
      </button>
      <button
        className="undo-btn"
        onClick={props.onUndo}
        disabled={!props.canUndo}
        title="Undo last change (⌘Z / Ctrl+Z)"
      >
        ↺ Undo
      </button>
      <SettingsMenu>
        {(close) => (
          <>
            <div className="menu-label">Leagues</div>
            {props.leagues.map((lg) => (
              <button
                key={lg.id}
                className={
                  lg.id === props.currentLeagueId
                    ? "menu-item current"
                    : "menu-item"
                }
                onClick={() => {
                  close();
                  if (lg.id !== props.currentLeagueId)
                    props.onSwitchLeague(lg.id);
                }}
              >
                {lg.id === props.currentLeagueId ? "✓ " : "  "}
                {lg.name}
              </button>
            ))}
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onAddLeague();
              }}
            >
              + New league…
            </button>
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onDuplicateLeague();
              }}
            >
              Duplicate current…
            </button>
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onRenameLeague();
              }}
            >
              Rename current…
            </button>
            <button
              className="menu-item"
              disabled={props.leagues.length <= 1}
              onClick={() => {
                close();
                props.onDeleteLeague();
              }}
            >
              Delete current
            </button>

            <div className="menu-sep" />
            <div className="menu-label">Tier lists</div>
            {props.tierLists.map((tl) => (
              <button
                key={tl.id}
                className={
                  tl.id === props.activeTierListId
                    ? "menu-item current"
                    : "menu-item"
                }
                onClick={() => {
                  close();
                  if (tl.id !== props.activeTierListId)
                    props.onSwitchTierList(tl.id);
                }}
              >
                {tl.id === props.activeTierListId ? "✓ " : "  "}
                {tl.name}
                {tl.id === props.defaultTierListId ? " ★" : ""}
              </button>
            ))}
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onAddTierList();
              }}
            >
              + New tier list…
            </button>
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onDuplicateTierList();
              }}
            >
              Duplicate current…
            </button>
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onRenameTierList();
              }}
            >
              Rename current…
            </button>
            <button
              className="menu-item"
              disabled={props.activeTierListId === props.defaultTierListId}
              onClick={() => {
                close();
                props.onSetDefaultTierList();
              }}
            >
              Set as default
            </button>
            <button
              className="menu-item"
              disabled={props.tierLists.length <= 1}
              onClick={() => {
                close();
                props.onDeleteTierList();
              }}
            >
              Delete current
            </button>

            <div className="menu-sep" />
            <label className="menu-label">
              Scoring{" "}
              <select
                className="menu-select"
                value={
                  props.leagues.find((l) => l.id === props.currentLeagueId)
                    ?.scoring ?? "ppr"
                }
                onChange={(e) =>
                  props.onScoringChange(e.target.value as Scoring)
                }
              >
                <option value="ppr">PPR</option>
                <option value="half">Half-PPR</option>
                <option value="standard">Standard</option>
              </select>
            </label>
            <div className="menu-hint">
              Sets the ADP blend &amp; default sort
            </div>

            <div className="menu-sep" />
            <button className="menu-item" onClick={props.onToggleK}>
              {props.hideK ? "✓ " : "  "}Hide kickers (K)
            </button>
            <button className="menu-item" onClick={props.onToggleDst}>
              {props.hideDst ? "✓ " : "  "}Hide defenses (DST)
            </button>

            <div className="menu-sep" />
            <button
              className="menu-item"
              disabled={props.fetching}
              onClick={() => {
                close();
                props.onFetch();
              }}
            >
              {props.fetching
                ? "Refreshing…"
                : "⟳ Refresh data & ADP (keeps your tiers)"}
            </button>
            {props.adpStatus && (
              <div className="menu-hint">{props.adpStatus}</div>
            )}
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onImport();
              }}
            >
              Import…
            </button>
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onExportJson();
              }}
            >
              Export JSON
            </button>
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onExportCsv();
              }}
            >
              Export CSV
            </button>
            <div className="menu-sep" />
            <label className="menu-label">
              When I change columns{" "}
              <select
                className="menu-select"
                value={props.scopePref}
                onChange={(e) =>
                  props.onScopePrefChange(
                    e.target.value as "ask" | "all" | "this",
                  )
                }
              >
                <option value="ask">Ask each time</option>
                <option value="all">Always all leagues</option>
                <option value="this">Always this league</option>
              </select>
            </label>
          </>
        )}
      </SettingsMenu>
      <div className="columns-trigger">
        <button
          className={props.columnsOpen ? "columns-btn active" : "columns-btn"}
          title="Show, hide & reorder columns"
          aria-label="Columns"
          // Keep this mousedown from reaching the manager's document-level
          // outside-click listener, so the click cleanly toggles the popover.
          onMouseDown={(e) => e.stopPropagation()}
          onClick={props.onOpenColumns}
        >
          ⚙ Columns
        </button>
        {props.children}
      </div>
    </div>
  );
}

function SettingsMenu({
  children,
}: {
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="settings" ref={ref}>
      <button
        className="settings-btn"
        title="Lists & settings"
        aria-label="Lists & settings"
        onClick={() => setOpen((o) => !o)}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-menu">{children(() => setOpen(false))}</div>
      )}
    </div>
  );
}
