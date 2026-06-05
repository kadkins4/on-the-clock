import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useRankings } from "./state/useRankings";
import { useDelayedHide } from "./state/useDelayedHide";
import {
  computePositionalRanks,
  sortPlayers,
  defaultSortAsc,
} from "./lib/ranking";
import type { ColumnId } from "./lib/columns";
import {
  resolveColumns,
  toggleHidden,
  reorder,
  DEFAULT_LAYOUT,
  type ColumnLayout,
} from "./lib/columnLayout";
import { toCsv, parseCsv } from "./lib/csv";
import {
  exportJson,
  importJson,
  loadColumnLayout,
  saveColumnLayout,
  loadColumnScopePref,
  saveColumnScopePref,
  loadRefetchResult,
  saveRefetchResult,
  loadErrorLog,
  clearErrorLog,
  type RefetchResult,
} from "./lib/storage";
import { safeStorage } from "./lib/safeStorage";
import { fetchEspnPlayers, EspnShapeError } from "./lib/fetchEspn";
import { fetchAdp } from "./lib/fetchAdp";
import { searchPlayers } from "./lib/search";
import {
  matchesPosFilter,
  chipConfig,
  toggleChip,
  applyMacro,
} from "./lib/posFilter";
import type { Break, Player, Position, SortKey } from "./types";
import { POSITIONS } from "./types";

// Stable empty-breaks fallback so the row memo doesn't re-run every render for
// legacy boards whose `breaks` haven't been derived yet.
const EMPTY_BREAKS: Break[] = [];
import seed from "./data/seed.json";
import { draftedByPosition } from "./lib/counts";
import { Toolbar } from "./components/Toolbar";
import { ColumnManager } from "./components/board/ColumnManager";
import { ColumnScopePrompt } from "./components/board/ColumnScopePrompt";
import { PlayerTable, type DisplayRow } from "./components/PlayerTable";
import { buildItems } from "./lib/tierBreaks";
import { Intro } from "./components/Intro";

// Split off the routes a first-time visitor doesn't hit on load: the whole
// mock-draft engine (only on entering a mock) and the ?dev=1 diagnostics panel.
// Keeps them out of the initial bundle.
const MockMode = lazy(() =>
  import("./components/mock/MockMode").then((m) => ({ default: m.MockMode })),
);
const DevPanel = lazy(() =>
  import("./components/dev/DevPanel").then((m) => ({ default: m.DevPanel })),
);
import { AlphaBanner } from "./components/AlphaBanner";
import { Header } from "./components/Header";
import { InfoPage } from "./components/InfoPage";

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const HIDE_K_KEY = "ff-cheat-sheet:hideK";
const HIDE_DST_KEY = "ff-cheat-sheet:hideDst";
const OLD_HIDE_KDST_KEY = "ff-cheat-sheet:hideKDst"; // migrate combined toggle

export default function App() {
  const {
    players,
    vorById,
    projById,
    lastById,
    dispatch,
    refresh,
    currentLeague,
    leagues,
    tierLists,
    activeTierListId,
    defaultTierListId,
  } = useRankings();
  const activeTierList = tierLists.find((t) => t.id === activeTierListId);
  const [introReplay, setIntroReplay] = useState(0);
  // Clicking the brand is a soft "refresh": replay the splash and re-load data
  // from the source of truth. In-progress mock draft + filters are untouched.
  const onBrandClick = () => {
    refresh();
    setIntroReplay((n) => n + 1);
  };
  const [search, setSearch] = useState("");
  // Active position chips; empty = ALL (no filter). See lib/posFilter.
  const [posFilter, setPosFilter] = useState<Set<Position>>(() => new Set());
  const [hideDrafted, setHideDrafted] = useState(false);
  const [byeFilter, setByeFilter] = useState<number | null>(null);
  const [hideK, setHideK] = useState(
    () =>
      safeStorage.getItem(HIDE_K_KEY) === "1" ||
      safeStorage.getItem(OLD_HIDE_KDST_KEY) === "1",
  );
  const [hideDst, setHideDst] = useState(
    () =>
      safeStorage.getItem(HIDE_DST_KEY) === "1" ||
      safeStorage.getItem(OLD_HIDE_KDST_KEY) === "1",
  );
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  // Column layout: a global default plus an optional per-league override. The
  // effective layout the board renders is `override ?? global`. Edits route by
  // the scope pref (all/this/ask) — see writeLayout/onLayoutChange below.
  const [globalLayout, setGlobalLayout] = useState(loadColumnLayout);
  const [scopePref, setScopePref] = useState(loadColumnScopePref);
  const [columnsOpen, setColumnsOpen] = useState(false);
  // Set while awaiting the scope choice (pref === "ask"); also the layout to write.
  const [pendingLayout, setPendingLayout] = useState<ColumnLayout | null>(null);
  const effectiveLayout = currentLeague.columnsOverride ?? globalLayout;
  const columns = useMemo(
    () => resolveColumns(effectiveLayout),
    [effectiveLayout],
  );

  const writeLayout = (layout: ColumnLayout, scope: "all" | "this") => {
    if (scope === "all") {
      setGlobalLayout(layout);
      saveColumnLayout(layout);
      // clear any per-league override so the league inherits the new global
      dispatch({
        type: "setLeagueColumns",
        id: currentLeague.id,
        layout: null,
      });
    } else {
      dispatch({ type: "setLeagueColumns", id: currentLeague.id, layout });
    }
  };

  // Called by the manager on every edit. Routes by pref; "ask" defers via pendingLayout.
  const onLayoutChange = (layout: ColumnLayout) => {
    if (scopePref === "all") writeLayout(layout, "all");
    else if (scopePref === "this") writeLayout(layout, "this");
    else setPendingLayout(layout);
  };

  const onScopeChosen = (scope: "all" | "this", remember: boolean) => {
    if (pendingLayout) writeLayout(pendingLayout, scope);
    if (remember) {
      setScopePref(scope);
      saveColumnScopePref(scope);
    }
    setPendingLayout(null);
  };

  const onScopePrefChange = (p: "ask" | "all" | "this") => {
    setScopePref(p);
    saveColumnScopePref(p);
  };
  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc((a) => !a);
    } else {
      setSortKey(key);
      setSortAsc(defaultSortAsc(key));
    }
  };
  const onBackToTiers = () => setSortKey(null);
  const [fetching, setFetching] = useState(false);
  const [adpStatus, setAdpStatus] = useState<string | null>(null);
  const [mockMode, setMockMode] = useState(false);
  // Gated diagnostics (?dev=1) + the refetch guard result + a transient toast.
  const devMode =
    new URLSearchParams(window.location.search).get("dev") === "1";
  const [refetchResult, setRefetchResult] = useState<RefetchResult | null>(
    loadRefetchResult,
  );
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "about" | "log">("board");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    safeStorage.setItem(HIDE_K_KEY, hideK ? "1" : "0");
  }, [hideK]);
  useEffect(() => {
    safeStorage.setItem(HIDE_DST_KEY, hideDst ? "1" : "0");
  }, [hideDst]);

  // positions to show in the drafted-summary header (K / DST hidden separately)
  const shownPositions = useMemo(
    () =>
      POSITIONS.filter(
        (p) => !(hideK && p === "K") && !(hideDst && p === "DST"),
      ),
    [hideK, hideDst],
  );

  // which filter chips to render, derived from the league's roster (spec §4)
  const chips = useMemo(
    () => chipConfig(currentLeague.roster),
    [currentLeague.roster],
  );

  // distinct bye weeks present, for the bye-week filter
  const byeWeeks = useMemo(() => {
    const s = new Set<number>();
    for (const p of players) if (p.byeWeek != null) s.add(p.byeWeek);
    return [...s].sort((a, b) => a - b);
  }, [players]);

  const positionalRanks = useMemo(
    () => computePositionalRanks(players),
    [players],
  );

  const drafted = useMemo(() => draftedByPosition(players), [players]);

  const visible = useMemo(() => {
    const filtered = players.filter(
      (p) =>
        matchesPosFilter(posFilter, p.position) &&
        (!hideDrafted || p.draftStatus === "available") &&
        !(hideK && p.position === "K") &&
        !(hideDst && p.position === "DST") &&
        (byeFilter === null || p.byeWeek === byeFilter),
    );
    return searchPlayers(filtered, search);
  }, [players, search, posFilter, hideDrafted, hideK, hideDst, byeFilter]);

  const visibleIds = useMemo(() => visible.map((p) => p.id), [visible]);
  // Only drafted players (when "hide drafted" is on) may linger before hiding;
  // search/filter removals disappear immediately.
  const lingerableIds = useMemo(
    () =>
      hideDrafted
        ? players.filter((p) => p.draftStatus !== "available").map((p) => p.id)
        : [],
    [players, hideDrafted],
  );
  const { rendered: renderedIds, pending } = useDelayedHide(
    visibleIds,
    lingerableIds,
    2500,
  );
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const renderPlayers = useMemo(
    () =>
      renderedIds
        .map((id) => byId.get(id))
        .filter((p): p is (typeof players)[number] => !!p),
    [renderedIds, byId],
  );
  const undoLast = () => {
    const id = pending[pending.length - 1];
    if (id)
      dispatch({ type: "update", id, patch: { draftStatus: "available" } });
  };

  const grouped = sortKey === null;
  const flat = useMemo(
    () =>
      grouped
        ? []
        : sortPlayers(renderPlayers, sortKey!, sortAsc, {
            vor: vorById,
            proj: projById,
            last: lastById,
          }),
    [grouped, renderPlayers, sortKey, sortAsc, vorById, projById, lastById],
  );
  // Reordering/tier editing stays available with "hide drafted" / "hide K&DST"
  // on; only a position filter, search, or bye filter (a partial view) blocks it.
  const reorderable =
    posFilter.size === 0 && search.trim() === "" && byeFilter === null;

  const activeBreaks =
    currentLeague.tierLists.find((t) => t.id === activeTierListId)?.breaks ??
    EMPTY_BREAKS;

  // Breaks-driven interleaved row model replacing the old groups/display memos.
  const { rows, itemIds } = useMemo(() => {
    if (!grouped) return { rows: [] as DisplayRow[], itemIds: [] as string[] };
    const items = buildItems(renderPlayers, activeBreaks);
    const byId = new Map(renderPlayers.map((p) => [p.id, p]));
    const rows: DisplayRow[] = [];
    const itemIds: string[] = [];
    let displayTier = 1;
    let stripeIndex = 0;
    let firstInTier = true;
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (it.kind === "break") {
        itemIds.push(it.id);
        // count players in the tier BELOW this break (until next break or end)
        let count = 0;
        for (let j = i + 1; j < items.length && items[j].kind === "player"; j++)
          count++;
        displayTier += 1;
        rows.push({ kind: "break", breakId: it.id, displayTier, count });
        firstInTier = true;
        stripeIndex = 0;
      } else {
        itemIds.push(it.id);
        const player = byId.get(it.id)!;
        rows.push({
          kind: "player",
          player,
          displayTier,
          startsTier: firstInTier,
          stripeIndex,
        });
        firstInTier = false;
        stripeIndex += 1;
      }
    }
    // If the first rendered row is a player (no break above tier 1), prepend
    // a non-sortable topHeader for tier 1.
    if (rows[0]?.kind === "player") {
      const leadingCount = rows.filter(
        (r) => r.kind === "player" && r.displayTier === 1,
      ).length;
      rows.unshift({ kind: "topHeader", displayTier: 1, count: leadingCount });
    }
    return { rows, itemIds };
  }, [grouped, renderPlayers, activeBreaks]);

  const onAddTier = (playerId: string) => {
    dispatch({ type: "splitTier", playerId });
  };

  const onFetch = async () => {
    if (fetching) return;
    if (
      !confirm(
        "Refetch the latest players from ESPN?\n\nKeeps your tiers, targets, draft picks and notes. Refreshes team, ADP, projections, last-season stats and injuries; adds any new players.",
      )
    )
      return;
    setFetching(true);
    try {
      // The shape guard runs inside fetchEspnPlayers; we only dispatch on a
      // clean pull, so a malformed ESPN response leaves the board untouched.
      const fetched = await fetchEspnPlayers();
      dispatch({ type: "merge", fetched });
      const r: RefetchResult = {
        ok: true,
        at: Date.now(),
        count: fetched.length,
      };
      setRefetchResult(r);
      saveRefetchResult(r);
      setToast(`Refetched ${fetched.length} players.`);
    } catch (err) {
      const shape = err instanceof EspnShapeError;
      const r: RefetchResult = {
        ok: false,
        at: Date.now(),
        reason: shape ? (err as EspnShapeError).message : "fetch-failed",
        fingerprint: shape
          ? (err as EspnShapeError).fingerprint
          : String((err as Error).message ?? err),
      };
      setRefetchResult(r);
      saveRefetchResult(r);
      setToast(
        shape
          ? "Couldn't refresh — ESPN's data may have changed. Your board is unchanged."
          : "Refetch failed. Your board is unchanged.",
      );
    } finally {
      setFetching(false);
    }
  };

  const onResetBoard = () => {
    dispatch({ type: "setAll", players: seed as unknown as Player[] });
  };

  const onRefreshAdp = async () => {
    setAdpStatus("Loading ADP…");
    try {
      const { ffc, fantasypros, yahoo, meta } = await fetchAdp(
        currentLeague.scoring,
        currentLeague.teams,
      );
      dispatch({ type: "applyAdp", ffc, fantasypros, yahoo });
      setAdpStatus(
        `ADP: ${meta.sources.join(" + ")} ${meta.type ?? ""} (${meta.year})`.trim(),
      );
    } catch (err) {
      setAdpStatus("ADP refresh failed");
      alert("ADP refresh failed: " + (err as Error).message);
    }
  };

  const onImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (!confirm("Importing will REPLACE your current list. Continue?"))
        return;
      const text = await file.text();
      try {
        const parsed = file.name.toLowerCase().endsWith(".csv")
          ? parseCsv(text)
          : importJson(text);
        dispatch({ type: "setAll", players: parsed });
      } catch (err) {
        alert("Import failed: " + (err as Error).message);
      }
    };
    input.click();
  };

  // Reset the transient view filters to defaults — league, active tier list,
  // saved hide-K/DST prefs, and scroll position are all left alone.
  const filtersActive =
    search !== "" ||
    posFilter.size > 0 ||
    hideDrafted ||
    byeFilter !== null ||
    sortKey !== null;
  const onClearFilters = () => {
    setSearch("");
    setPosFilter(new Set());
    setHideDrafted(false);
    setByeFilter(null);
    setSortKey(null);
    setSortAsc(true);
  };

  const onToggleK = () => {
    setHideK((v) => {
      const next = !v;
      if (next)
        setPosFilter((prev) => {
          const n = new Set(prev);
          n.delete("K");
          return n;
        });
      return next;
    });
  };
  const onToggleDst = () => {
    setHideDst((v) => {
      const next = !v;
      if (next)
        setPosFilter((prev) => {
          const n = new Set(prev);
          n.delete("DST");
          return n;
        });
      return next;
    });
  };

  const onAddLeague = () => {
    const name = prompt("New league name:")?.trim();
    if (name) dispatch({ type: "addLeague", name });
  };
  const onDuplicateLeague = () => {
    const name = prompt(
      "Duplicate this league as:",
      `${currentLeague.name} copy`,
    )?.trim();
    if (name) dispatch({ type: "duplicateLeague", id: currentLeague.id, name });
  };
  const onRenameLeague = () => {
    const name = prompt("Rename this league:", currentLeague.name)?.trim();
    if (name) dispatch({ type: "renameLeague", id: currentLeague.id, name });
  };
  const onDeleteLeague = () => {
    if (leagues.length <= 1) return;
    if (
      confirm(
        `Delete the league "${currentLeague.name}"? This can't be undone.`,
      )
    )
      dispatch({ type: "deleteLeague", id: currentLeague.id });
  };

  const onAddTierList = () => {
    const name = prompt("New tier list name:")?.trim();
    if (name) dispatch({ type: "addTierList", name });
  };
  const onDuplicateTierList = () => {
    const name = prompt(
      "Duplicate this tier list as:",
      `${activeTierList?.name ?? "Default"} copy`,
    )?.trim();
    if (name) dispatch({ type: "duplicateTierList", name });
  };
  const onRenameTierList = () => {
    const name = prompt("Rename this tier list:", activeTierList?.name)?.trim();
    if (name) dispatch({ type: "renameTierList", name });
  };
  const onDeleteTierList = () => {
    if (tierLists.length <= 1) return;
    if (
      confirm(
        `Delete the tier list "${activeTierList?.name}"? This can't be undone.`,
      )
    )
      dispatch({ type: "deleteTierList", id: activeTierListId });
  };
  // filename-safe league name for exports (so 5 leagues don't all collide on
  // "rankings.json")
  const leagueSlug =
    currentLeague.name
      .replace(/[^\w.-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase() || "rankings";

  if (devMode) {
    return (
      <div className="app">
        <Suspense fallback={<div className="route-loading">Loading…</div>}>
          <DevPanel
            players={players}
            refetch={refetchResult}
            errors={loadErrorLog()}
            onClearErrors={() => {
              clearErrorLog();
              setToast("Cleared error log.");
            }}
            onResetBoard={onResetBoard}
            onClose={() => {
              window.location.search = "";
            }}
          />
        </Suspense>
      </div>
    );
  }

  if (mockMode) {
    return (
      <div className="app">
        <Suspense fallback={<div className="route-loading">Loading…</div>}>
          <MockMode
            league={currentLeague}
            onExit={() => setMockMode(false)}
            onSetValueFlags={(listId, valueFlags) =>
              dispatch({ type: "setListValueFlags", listId, valueFlags })
            }
          />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="app">
      <Intro replay={introReplay} />
      <AlphaBanner />
      <Header
        onBrandClick={() => {
          onBrandClick();
          setView("board");
        }}
        onAbout={() => setView("about")}
        onLog={() => setView("log")}
      />
      {view !== "board" ? (
        <InfoPage page={view} onBack={() => setView("board")} />
      ) : (
        <>
          <div className="drafted-summary">
            <div className="drafted-summary-counts">
              {shownPositions.map((pos) => (
                <span key={pos} className="drafted-summary-item">
                  {pos} <b>{drafted[pos].drafted}</b>
                  <span className="mine-count">({drafted[pos].mine})</span>
                </span>
              ))}
            </div>
            <div className="drafted-summary-actions">
              <button
                type="button"
                className="otc-btn"
                onClick={() => setMockMode(true)}
              >
                Mock
              </button>
              <button
                type="button"
                className="otc-btn otc-btn-soon"
                aria-disabled="true"
              >
                Draft
              </button>
            </div>
          </div>
          <Toolbar
            search={search}
            setSearch={setSearch}
            posChips={chips}
            activePos={posFilter}
            onToggleChip={(p) => setPosFilter((prev) => toggleChip(prev, p))}
            onApplyMacro={(m) => setPosFilter((prev) => applyMacro(prev, m))}
            hideDrafted={hideDrafted}
            setHideDrafted={setHideDrafted}
            byeFilter={byeFilter}
            setByeFilter={setByeFilter}
            byeWeeks={byeWeeks}
            grouped={grouped}
            onBackToTiers={onBackToTiers}
            filtersActive={filtersActive}
            onClearFilters={onClearFilters}
            currentLeagueId={currentLeague.id}
            leagues={leagues.map((l) => ({
              id: l.id,
              name: l.name,
              scoring: l.scoring,
            }))}
            onSwitchLeague={(id) => dispatch({ type: "switchLeague", id })}
            onAddLeague={onAddLeague}
            onDuplicateLeague={onDuplicateLeague}
            onRenameLeague={onRenameLeague}
            onDeleteLeague={onDeleteLeague}
            tierLists={tierLists}
            activeTierListId={activeTierListId}
            defaultTierListId={defaultTierListId}
            onSwitchTierList={(id) => dispatch({ type: "switchTierList", id })}
            onAddTierList={onAddTierList}
            onDuplicateTierList={onDuplicateTierList}
            onRenameTierList={onRenameTierList}
            onDeleteTierList={onDeleteTierList}
            onSetDefaultTierList={() =>
              dispatch({ type: "setDefaultTierList", id: activeTierListId })
            }
            onScoringChange={(scoring) =>
              dispatch({
                type: "updateLeagueSettings",
                id: currentLeague.id,
                patch: { scoring },
              })
            }
            hideK={hideK}
            onToggleK={onToggleK}
            hideDst={hideDst}
            onToggleDst={onToggleDst}
            onFetch={onFetch}
            fetching={fetching}
            onRefreshAdp={onRefreshAdp}
            adpStatus={adpStatus}
            onImport={onImport}
            onExportJson={() =>
              download(
                `${leagueSlug}-rankings.json`,
                exportJson(players),
                "application/json",
              )
            }
            onExportCsv={() =>
              download(`${leagueSlug}-rankings.csv`, toCsv(players), "text/csv")
            }
            scopePref={scopePref}
            onScopePrefChange={onScopePrefChange}
            onOpenColumns={() => setColumnsOpen((o) => !o)}
            columnsOpen={columnsOpen}
          >
            {columnsOpen && (
              <ColumnManager
                layout={effectiveLayout}
                onToggle={(id: ColumnId) =>
                  onLayoutChange(toggleHidden(effectiveLayout, id))
                }
                onReorder={(id: ColumnId, before: ColumnId) =>
                  onLayoutChange(reorder(effectiveLayout, id, before))
                }
                onReset={() => onLayoutChange(DEFAULT_LAYOUT)}
                onClose={() => setColumnsOpen(false)}
              />
            )}
          </Toolbar>
          <PlayerTable
            columns={columns}
            grouped={grouped}
            rows={rows}
            itemIds={itemIds}
            flat={flat}
            positionalRanks={positionalRanks}
            vorById={vorById}
            projById={projById}
            lastById={lastById}
            sortKey={sortKey}
            sortAsc={sortAsc}
            onSort={onSort}
            dispatch={dispatch}
            reorderable={reorderable}
            onAddTier={onAddTier}
          />
          {pending.length > 0 && (
            <button className="undo-bar" onClick={undoLast}>
              Undo draft ({pending.length})
            </button>
          )}
          {pendingLayout !== null && (
            <ColumnScopePrompt
              onChoose={onScopeChosen}
              onCancel={() => setPendingLayout(null)}
            />
          )}
        </>
      )}
      {toast && <div className="toast">{toast}</div>}
      <footer className="otc-footer">
        <a
          href="https://kendalladkins.dev/?utm_source=on-the-clock"
          target="_blank"
          rel="noopener noreferrer"
        >
          Built by Kendall Adkins
        </a>
      </footer>
    </div>
  );
}
