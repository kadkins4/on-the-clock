import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Position, SortKey } from "../types";

interface Props {
  search: string;
  setSearch: (s: string) => void;
  positions: Position[];
  posFilter: Position | "All";
  setPosFilter: (p: Position | "All") => void;
  hideDrafted: boolean;
  setHideDrafted: (b: boolean) => void;
  byeFilter: number | null;
  setByeFilter: (b: number | null) => void;
  byeWeeks: number[];
  sortKey: SortKey | null;
  setSortKey: (k: SortKey | null) => void;
  currentList: string;
  listNames: string[];
  onSwitchList: (name: string) => void;
  onSaveListAs: () => void;
  onRenameList: () => void;
  onDeleteList: () => void;
  hideKDst: boolean;
  onToggleKDst: () => void;
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
        {(["All", ...props.positions] as const).map((p) => (
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
      <SettingsMenu>
        {(close) => (
          <>
            <div className="menu-label">Lists</div>
            {props.listNames.map((name) => (
              <button
                key={name}
                className={
                  name === props.currentList ? "menu-item current" : "menu-item"
                }
                onClick={() => {
                  close();
                  if (name !== props.currentList) props.onSwitchList(name);
                }}
              >
                {name === props.currentList ? "✓ " : "  "}
                {name}
              </button>
            ))}
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onSaveListAs();
              }}
            >
              Save as new list…
            </button>
            <button
              className="menu-item"
              onClick={() => {
                close();
                props.onRenameList();
              }}
            >
              Rename current…
            </button>
            <button
              className="menu-item"
              disabled={props.listNames.length <= 1}
              onClick={() => {
                close();
                props.onDeleteList();
              }}
            >
              Delete current
            </button>

            <div className="menu-sep" />
            <button className="menu-item" onClick={props.onToggleKDst}>
              {props.hideKDst ? "✓ " : "  "}Hide K &amp; DST
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
              {props.fetching ? "Fetching…" : "Fetch players"}
            </button>
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
          </>
        )}
      </SettingsMenu>
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
