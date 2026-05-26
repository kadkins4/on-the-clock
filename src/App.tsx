import { useMemo, useState } from "react";
import { useRankings } from "./state/useRankings";
import {
  computePositionalRanks,
  groupByTier,
  sortPlayers,
} from "./lib/ranking";
import { toCsv, parseCsv } from "./lib/csv";
import { exportJson, importJson } from "./lib/storage";
import type { Position, SortKey } from "./types";
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

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter(
      (p) =>
        (posFilter === "All" || p.position === posFilter) &&
        (q === "" || p.name.toLowerCase().includes(q)) &&
        (!hideDrafted || !p.drafted),
    );
  }, [players, search, posFilter, hideDrafted]);

  const grouped = sortKey === null;
  const groups = useMemo(
    () => (grouped ? groupByTier(visible) : []),
    [grouped, visible],
  );
  const flat = useMemo(
    () => (grouped ? [] : sortPlayers(visible, sortKey!, true)),
    [grouped, visible, sortKey],
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
    </div>
  );
}
