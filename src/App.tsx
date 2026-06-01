import { useEffect, useMemo, useState } from "react";
import { useRankings } from "./state/useRankings";
import { useDelayedHide } from "./state/useDelayedHide";
import {
  computePositionalRanks,
  groupByTier,
  sortPlayers,
} from "./lib/ranking";
import { toCsv, parseCsv } from "./lib/csv";
import { exportJson, importJson } from "./lib/storage";
import { fetchEspnPlayers } from "./lib/fetchEspn";
import { searchPlayers } from "./lib/search";
import type { Position, SortKey } from "./types";
import { POSITIONS } from "./types";
import { draftedByPosition } from "./lib/counts";
import { Toolbar } from "./components/Toolbar";
import { PlayerTable, type DisplayGroup } from "./components/PlayerTable";

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
  const { players, dispatch, currentLeague, leagues } = useRankings();
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<Position | "All">("All");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [byeFilter, setByeFilter] = useState<number | null>(null);
  const [hideK, setHideK] = useState(
    () =>
      localStorage.getItem(HIDE_K_KEY) === "1" ||
      localStorage.getItem(OLD_HIDE_KDST_KEY) === "1",
  );
  const [hideDst, setHideDst] = useState(
    () =>
      localStorage.getItem(HIDE_DST_KEY) === "1" ||
      localStorage.getItem(OLD_HIDE_KDST_KEY) === "1",
  );
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [fetching, setFetching] = useState(false);
  // Empty tiers are session-only: each entry is the id of the player the empty
  // tier sits directly above. Never persisted or exported.
  const [emptyTiers, setEmptyTiers] = useState<string[]>([]);

  useEffect(() => {
    localStorage.setItem(HIDE_K_KEY, hideK ? "1" : "0");
  }, [hideK]);
  useEffect(() => {
    localStorage.setItem(HIDE_DST_KEY, hideDst ? "1" : "0");
  }, [hideDst]);

  // positions to show in the summary + filter chips (K / DST hidden separately)
  const shownPositions = useMemo(
    () =>
      POSITIONS.filter(
        (p) => !(hideK && p === "K") && !(hideDst && p === "DST"),
      ),
    [hideK, hideDst],
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
        (posFilter === "All" || p.position === posFilter) &&
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
  const groups = useMemo(
    () => (grouped ? groupByTier(renderPlayers) : []),
    [grouped, renderPlayers],
  );
  const flat = useMemo(
    () => (grouped ? [] : sortPlayers(renderPlayers, sortKey!, true)),
    [grouped, renderPlayers, sortKey],
  );
  // Reordering/tier editing stays available with "hide drafted" / "hide K&DST"
  // on; only a position filter, search, or bye filter (a partial view) blocks it.
  const reorderable =
    posFilter === "All" && search.trim() === "" && byeFilter === null;

  // Drop empty-tier markers whose anchor is no longer the first player of a tier
  // (e.g. after a drag), so stale empties don't accumulate.
  useEffect(() => {
    if (!grouped || !reorderable) return;
    const firstIds = new Set(groups.map((g) => g.players[0]?.id));
    setEmptyTiers((prev) => {
      const next = prev.filter((id) => firstIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [groups, grouped, reorderable]);

  // Display model: real tiers interleaved with any session empty tiers, each
  // labelled with a running display-tier number.
  const display = useMemo<DisplayGroup[]>(() => {
    if (!grouped) return [];
    const out: DisplayGroup[] = [];
    let dt = 0;
    for (const g of groups) {
      const firstId = g.players[0]?.id;
      if (reorderable && firstId && emptyTiers.includes(firstId)) {
        dt += 1;
        out.push({ kind: "empty", anchorId: firstId, displayTier: dt });
      }
      dt += 1;
      out.push({
        kind: "tier",
        tier: g.tier as number,
        displayTier: dt,
        players: g.players,
      });
    }
    return out;
  }, [grouped, groups, emptyTiers, reorderable]);

  const onAddTier = (playerId: string, startsTier: boolean) => {
    if (startsTier) {
      setEmptyTiers((prev) =>
        prev.includes(playerId) ? prev : [...prev, playerId],
      );
    } else {
      dispatch({ type: "splitTier", playerId });
    }
  };

  const onRemoveEmpty = (anchorId: string) =>
    setEmptyTiers((prev) => prev.filter((id) => id !== anchorId));

  const onFetch = async () => {
    if (fetching) return;
    if (
      !confirm(
        "Fetch the latest players from ESPN?\n\nYour tiers, targets, draft picks and notes are kept. Player data (team, ADP, injuries) is refreshed and any new players are added.",
      )
    )
      return;
    setFetching(true);
    try {
      const fetched = await fetchEspnPlayers();
      dispatch({ type: "merge", fetched });
    } catch (err) {
      alert("Fetch failed: " + (err as Error).message);
    } finally {
      setFetching(false);
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

  const onToggleK = () => {
    setHideK((v) => {
      const next = !v;
      if (next && posFilter === "K") setPosFilter("All");
      return next;
    });
  };
  const onToggleDst = () => {
    setHideDst((v) => {
      const next = !v;
      if (next && posFilter === "DST") setPosFilter("All");
      return next;
    });
  };

  const onAddLeague = () => {
    const name = prompt("New league name:")?.trim();
    if (name) dispatch({ type: "addLeague", name });
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

  return (
    <div className="app">
      <h1>Fantasy Football Draft Helper</h1>
      <div className="drafted-summary">
        {shownPositions.map((pos) => (
          <span key={pos} className="drafted-summary-item">
            {pos} <b>{drafted[pos].drafted}</b>
            <span className="mine-count">({drafted[pos].mine})</span>
          </span>
        ))}
      </div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        positions={shownPositions}
        posFilter={posFilter}
        setPosFilter={setPosFilter}
        hideDrafted={hideDrafted}
        setHideDrafted={setHideDrafted}
        byeFilter={byeFilter}
        setByeFilter={setByeFilter}
        byeWeeks={byeWeeks}
        sortKey={sortKey}
        setSortKey={setSortKey}
        currentLeagueId={currentLeague.id}
        leagues={leagues.map((l) => ({
          id: l.id,
          name: l.name,
          scoring: l.scoring,
        }))}
        onSwitchLeague={(id) => dispatch({ type: "switchLeague", id })}
        onAddLeague={onAddLeague}
        onRenameLeague={onRenameLeague}
        onDeleteLeague={onDeleteLeague}
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
        onImport={onImport}
        onExportJson={() =>
          download("rankings.json", exportJson(players), "application/json")
        }
        onExportCsv={() => download("rankings.csv", toCsv(players), "text/csv")}
      />
      <PlayerTable
        grouped={grouped}
        display={display}
        flat={flat}
        positionalRanks={positionalRanks}
        dispatch={dispatch}
        reorderable={reorderable}
        onAddTier={onAddTier}
        onRemoveEmpty={onRemoveEmpty}
      />
      {pending.length > 0 && (
        <button className="undo-bar" onClick={undoLast}>
          Undo draft ({pending.length})
        </button>
      )}
    </div>
  );
}
