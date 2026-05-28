import type { Position, SortKey } from "../types";
import { POSITIONS } from "../types";

interface Props {
  search: string;
  setSearch: (s: string) => void;
  posFilter: Position | "All";
  setPosFilter: (p: Position | "All") => void;
  hideDrafted: boolean;
  setHideDrafted: (b: boolean) => void;
  sortKey: SortKey | null;
  setSortKey: (k: SortKey | null) => void;
  onFetch: () => void;
  fetching: boolean;
  onImport: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
}

export function Toolbar(props: Props) {
  return (
    <div className="toolbar">
      <input
        className="search"
        placeholder={"Search…"}
        value={props.search}
        onChange={(e) => props.setSearch(e.target.value)}
      />
      <div className="chips">
        {(["All", ...POSITIONS] as const).map((p) => (
          <button
            key={p}
            className={props.posFilter === p ? "chip active" : "chip"}
            onClick={() => props.setPosFilter(p)}
          >
            {p}
          </button>
        ))}
      </div>
      <label className="hide-drafted">
        <input
          type="checkbox"
          checked={props.hideDrafted}
          onChange={(e) => props.setHideDrafted(e.target.checked)}
        />{" "}
        Hide drafted
      </label>
      <label>
        Sort:{" "}
        <select
          value={props.sortKey ?? "tier"}
          onChange={(e) =>
            props.setSortKey(
              e.target.value === "tier" ? null : (e.target.value as SortKey),
            )
          }
        >
          <option value="tier">Tier (grouped)</option>
          <option value="overall">Overall</option>
          <option value="adp">ADP</option>
          <option value="name">Name</option>
          <option value="bye">Bye</option>
        </select>
      </label>
      <button onClick={props.onFetch} disabled={props.fetching}>
        {props.fetching ? "Fetching…" : "Fetch players"}
      </button>
      <button onClick={props.onImport}>Import</button>
      <button onClick={props.onExportJson}>Export JSON</button>
      <button onClick={props.onExportCsv}>Export CSV</button>
    </div>
  );
}
