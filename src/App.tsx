import { useMemo, useState } from "react";
import { useRankings } from "./state/useRankings";
import { useDelayedHide } from "./state/useDelayedHide";
import {
  computePositionalRanks,
  groupByTier,
  sortPlayers,
} from "./lib/ranking";
import { toCsv, parseCsv } from "./lib/csv";
import { exportJson, importJson } from "./lib/storage";
import { searchPlayers } from "./lib/search";
import type { Position, SortKey } from "./types";
import { POSITIONS } from "./types";
import { draftedByPosition } from "./lib/counts";
import { Toolbar } from "./components/Toolbar";
import { PlayerTable } from "./components/PlayerTable";
import { AddPlayerForm } from "./components/AddPlayerForm";

function download(filename: string, text: string, type: string) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const { players, dispatch } = useRankings();
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<Position | "All">("All");
  const [hideDrafted, setHideDrafted] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const positionalRanks = useMemo(
    () => computePositionalRanks(players),
    [players],
  );

  const drafted = useMemo(() => draftedByPosition(players), [players]);

  const visible = useMemo(() => {
    const filtered = players.filter(
      (p) =>
        (posFilter === "All" || p.position === posFilter) &&
        (!hideDrafted || p.draftStatus === "available"),
    );
    return searchPlayers(filtered, search);
  }, [players, search, posFilter, hideDrafted]);

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
  const reorderable =
    posFilter === "All" && search.trim() === "" && !hideDrafted;

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

  return (
    <div className="app">
      <h1>FF Cheat Sheet</h1>
      <div className="drafted-summary">
        {POSITIONS.map((pos) => (
          <span key={pos} className="drafted-summary-item">
            {pos} <b>{drafted[pos]}</b>
          </span>
        ))}
      </div>
      <Toolbar
        search={search}
        setSearch={setSearch}
        posFilter={posFilter}
        setPosFilter={setPosFilter}
        hideDrafted={hideDrafted}
        setHideDrafted={setHideDrafted}
        sortKey={sortKey}
        setSortKey={setSortKey}
        onAdd={() => setShowAdd(true)}
        onImport={onImport}
        onExportJson={() =>
          download("rankings.json", exportJson(players), "application/json")
        }
        onExportCsv={() => download("rankings.csv", toCsv(players), "text/csv")}
      />
      {showAdd && (
        <AddPlayerForm
          onAdd={(p) => dispatch({ type: "add", player: p })}
          onClose={() => setShowAdd(false)}
        />
      )}
      <PlayerTable
        grouped={grouped}
        groups={groups}
        flat={flat}
        positionalRanks={positionalRanks}
        dispatch={dispatch}
        reorderable={reorderable}
      />
      {pending.length > 0 && (
        <button className="undo-bar" onClick={undoLast}>
          Undo draft ({pending.length})
        </button>
      )}
    </div>
  );
}
